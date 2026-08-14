import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { isPostgres, initDatabase, query, execute, withTransaction, disablePostgres } from './dbClient.js';
import { encryptGCM, decryptGCM, getDeterministicHash, maskPIIInText } from './pii.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');

// Legacy & Local Fallback JSON reader/writer helpers
const readJsonFile = <T>(fileName: string, defaultVal: T): T => {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return defaultVal;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading JSON file ${fileName}:`, err);
    return defaultVal;
  }
};

const writeJsonFile = <T>(fileName: string, data: T): void => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing JSON file ${fileName}:`, err);
  }
};

// Database Schema Interfaces
export interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  permissions: string[];
  status: 'Approved' | 'Pending Approval' | 'Suspended';
  passwordHash: string;
  createdAt: string;
}

export interface DbClient {
  id: string;
  name: string;
  fatherName: string;
  dob: string;
  age: number;
  occupation: string;
  pan: string;
  aadhaar: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface DbAuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  role: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface DbDocument {
  id: string;
  docNo: string;
  docType: string;
  subType: string;
  partiesCount: number;
  propertyAddress: string;
  consideration: number;
  status: string;
  writer: string;
  progress: number;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  state: any; // Full DeedWizardState
}

// Dynamically generate a cryptographically random temporary password for the bootstrap Auditor
const dynamicAuditorPassword = crypto.randomBytes(12).toString('hex') + 'A1!';
const dynamicAuditorHash = crypto.createHash('sha256').update(dynamicAuditorPassword).digest('hex');

console.log('==================================================================');
console.log('[SECURITY] Generated secure random temporary password for Auditor:');
console.log(`Email: auditor.vasan@gmail.com`);
console.log(`Password: ${dynamicAuditorPassword}`);
console.log('==================================================================');

// Initial default user data if db is completely blank
const DEFAULT_USERS: DbUser[] = [
  {
    id: 'usr-104200',
    name: 'V. Sridhar',
    email: 'writer.sridhar@gmail.com',
    phone: '9840123456',
    organization: 'Thiruvanmiyur Doc Writers Association',
    role: 'Document Writer',
    permissions: ['view_own_deeds'],
    status: 'Approved',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // admin123
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-104201',
    name: 'Admin Muthu',
    email: 'admin.muthu@tnreginet.gov.in',
    phone: '9444012345',
    organization: 'TN Registration Department',
    role: 'Admin',
    permissions: ['*'],
    status: 'Approved',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // admin123
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-104202',
    name: 'Auditor Vasan',
    email: 'auditor.vasan@gmail.com',
    phone: '9844567890',
    organization: 'Internal Audit Cell',
    role: 'Auditor',
    permissions: ['audit_logs', 'view_all_deeds', 'canViewRawPII'],
    status: 'Approved',
    passwordHash: dynamicAuditorHash, // dynamic random password hash
    createdAt: new Date().toISOString(),
    mustResetPassword: true
  }
];

// One-time self-healing data migration on startup
export async function migrateAndBootstrap() {
  if (!isPostgres) {
    console.log('Running in Local JSON Fallback Mode. Database bootstrapping is skipped.');
    return;
  }

  try {
    await initDatabase();

    console.log('Database connected. Checking if legacy JSON data migration is required...');

    // 1. Migrate Users
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const count = Number(userCount[0]?.count || 0);
    if (count === 0) {
      console.log('PostgreSQL users table is empty. Running user migration from legacy JSON file...');
      const legacyUsers = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
      await withTransaction(async (client) => {
        for (const u of legacyUsers) {
          await client.execute(`
            INSERT INTO users (id, name, email, phone, organization, role, permissions, status, password_hash, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            u.id, u.name, u.email, u.phone, u.organization, u.role,
            JSON.stringify(u.permissions), u.status, u.passwordHash, u.createdAt
          ]);
        }
      });
      console.log(`Migrated ${legacyUsers.length} users successfully to PostgreSQL.`);
    }

    // 2. Migrate Clients
    const clientCount = await query('SELECT COUNT(*) as count FROM clients');
    const cCount = Number(clientCount[0]?.count || 0);
    if (cCount === 0) {
      const legacyClients = readJsonFile<DbClient[]>('clients.json', []);
      if (legacyClients && legacyClients.length > 0) {
        console.log('PostgreSQL clients table is empty. Running client migration from legacy JSON file...');
        await withTransaction(async (client) => {
          for (const c of legacyClients) {
            await client.execute(`
              INSERT INTO clients (id, name, father_name, dob, age, occupation, pan, aadhaar, pan_hash, aadhaar_hash, address, phone, email, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
              c.id, c.name, c.fatherName, c.dob, c.age, c.occupation,
              encryptGCM(c.pan), encryptGCM(c.aadhaar),
              getDeterministicHash(c.pan), getDeterministicHash(c.aadhaar),
              c.address, c.phone, c.email, c.createdAt
            ]);
          }
        });
        console.log(`Migrated ${legacyClients.length} clients successfully to PostgreSQL.`);
      }
    }

    // 3. Migrate Documents
    const docCount = await query('SELECT COUNT(*) as count FROM documents');
    const dCount = Number(docCount[0]?.count || 0);
    if (dCount === 0) {
      const legacyDocs = readJsonFile<DbDocument[]>('documents.json', []);
      if (legacyDocs && legacyDocs.length > 0) {
        console.log('PostgreSQL documents table is empty. Running document migration from legacy JSON file...');
        await withTransaction(async (client) => {
          for (const doc of legacyDocs) {
            const surveyNo = doc.state?.surveys?.[0]?.surveyNo || doc.state?.survey?.surveyNo || null;
            const subDivision = doc.state?.surveys?.[0]?.subDivision || doc.state?.survey?.subDivision || null;
            const village = doc.state?.property?.village || null;

            const clonedState = JSON.parse(JSON.stringify(doc.state || {}));
            if (clonedState && Array.isArray(clonedState.parties)) {
              clonedState.parties = clonedState.parties.map((p: any) => ({
                ...p,
                pan: p.pan ? encryptGCM(p.pan) : p.pan,
                aadhaar: p.aadhaar ? encryptGCM(p.aadhaar) : p.aadhaar
              }));
            }

            await client.execute(`
              INSERT INTO documents (
                id, doc_no, doc_type, sub_type, parties_count, property_address,
                consideration, status, writer, progress, created_at, modified_at, created_by, state,
                survey_no, sub_division, village
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `, [
              doc.id, doc.docNo, doc.docType, doc.subType, doc.partiesCount, doc.propertyAddress,
              doc.consideration, doc.status, doc.writer, doc.progress, doc.createdAt, doc.modifiedAt, doc.createdBy,
              JSON.stringify(clonedState), surveyNo, subDivision || '', village
            ]);
          }
        });
        console.log(`Migrated ${legacyDocs.length} documents successfully to PostgreSQL.`);
      }
    }

    // 4. Migrate Audit Logs
    const auditCount = await query('SELECT COUNT(*) as count FROM audit_logs');
    const aCount = Number(auditCount[0]?.count || 0);
    if (aCount === 0) {
      const legacyLogs = readJsonFile<DbAuditLog[]>('audit_logs.json', []);
      if (legacyLogs && legacyLogs.length > 0) {
        console.log('PostgreSQL audit logs table is empty. Running audit logs migration from legacy JSON file...');
        await withTransaction(async (client) => {
          for (const log of legacyLogs) {
            await client.execute(`
              INSERT INTO audit_logs (id, timestamp, user_email, role, action, details, ip_address)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              log.id, log.timestamp, log.userEmail, log.role, log.action, maskPIIInText(log.details), log.ipAddress
            ]);
          }
        });
        console.log(`Migrated ${legacyLogs.length} audit logs successfully to PostgreSQL.`);
      }
    }

    // Perform transparent migration of existing plaintexts in local JSON files (if any)
    try {
      const clientsPath = path.join(DATA_DIR, 'clients.json');
      if (fs.existsSync(clientsPath)) {
        const allClients = readJsonFile<DbClient[]>('clients.json', []);
        let mutated = false;
        for (const c of allClients) {
          if (c.pan && !c.pan.startsWith('v1:')) {
            c.pan = encryptGCM(c.pan);
            mutated = true;
          }
          if (c.aadhaar && !c.aadhaar.startsWith('v1:')) {
            c.aadhaar = encryptGCM(c.aadhaar);
            mutated = true;
          }
          if (!(c as any).pan_hash && c.pan) {
            (c as any).pan_hash = getDeterministicHash(c.pan);
            mutated = true;
          }
          if (!(c as any).aadhaar_hash && c.aadhaar) {
            (c as any).aadhaar_hash = getDeterministicHash(c.aadhaar);
            mutated = true;
          }
        }
        if (mutated) {
          console.log('Migrated legacy plaintext values in clients.json to encrypted values.');
          writeJsonFile('clients.json', allClients);
        }
      }
      
      const docsPath = path.join(DATA_DIR, 'documents.json');
      if (fs.existsSync(docsPath)) {
        const allDocs = readJsonFile<DbDocument[]>('documents.json', []);
        let mutated = false;
        for (const d of allDocs) {
          if (d.state && Array.isArray(d.state.parties)) {
            for (const p of d.state.parties) {
              if (p.pan && !p.pan.startsWith('v1:')) {
                p.pan = encryptGCM(p.pan);
                mutated = true;
              }
              if (p.aadhaar && !p.aadhaar.startsWith('v1:')) {
                p.aadhaar = encryptGCM(p.aadhaar);
                mutated = true;
              }
            }
          }
        }
        if (mutated) {
          console.log('Migrated legacy plaintext values in documents.json to encrypted values.');
          writeJsonFile('documents.json', allDocs);
        }
      }
    } catch (err) {
      console.warn('Transparent local JSON encryption migration failed/skipped:', err);
    }

    console.log('Database bootstrapping and migrations completed successfully.');
  } catch (err) {
    console.warn('PostgreSQL connection/bootstrapping failed. Automatically falling back to Local JSON flat-file storage:', err);
    disablePostgres();
  }
}

// Unified Transparent Repository Interface
export const db = {
  // USERS
  getUsers: async (): Promise<DbUser[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM users ORDER BY created_at DESC');
      return rows.map(r => ({
        ...r,
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []),
        passwordHash: r.password_hash,
        createdAt: r.created_at,
        mustResetPassword: r.must_reset_password
      }));
    } else {
      return readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
    }
  },
  
  saveUsers: async (users: DbUser[]): Promise<void> => {
    if (isPostgres) {
      await withTransaction(async (client) => {
        const idsInList = users.map(u => u.id).filter(Boolean);
        if (idsInList.length > 0) {
          const placeholders = idsInList.map((_, i) => `$${i + 1}`).join(', ');
          await client.execute(`DELETE FROM users WHERE id NOT IN (${placeholders})`, idsInList);
        } else {
          await client.execute(`DELETE FROM users`);
        }
        
        for (const u of users) {
          await client.execute(`
            INSERT INTO users (id, name, email, phone, organization, role, permissions, status, password_hash, created_at, must_reset_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              organization = EXCLUDED.organization,
              role = EXCLUDED.role,
              permissions = EXCLUDED.permissions,
              status = EXCLUDED.status,
              password_hash = EXCLUDED.password_hash,
              must_reset_password = EXCLUDED.must_reset_password
          `, [
            u.id, u.name, u.email, u.phone, u.organization, u.role,
            JSON.stringify(u.permissions), u.status, u.passwordHash, u.createdAt, u.mustResetPassword || false
          ]);
        }
      });
    } else {
      writeJsonFile('users.json', users);
    }
  },
  
  // CLIENTS
  getClients: async (): Promise<DbClient[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM clients ORDER BY created_at DESC');
      const uniqueClients: DbClient[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (r.id && !seen.has(r.id)) {
          seen.add(r.id);
          uniqueClients.push({
            ...r,
            fatherName: r.father_name,
            createdAt: r.created_at,
            pan: decryptGCM(r.pan),
            aadhaar: decryptGCM(r.aadhaar)
          });
        }
      }
      return uniqueClients;
    } else {
      const allClients = readJsonFile<DbClient[]>('clients.json', []);
      const uniqueClients: DbClient[] = [];
      const seen = new Set<string>();
      for (const c of allClients) {
        if (c && c.id && !seen.has(c.id)) {
          seen.add(c.id);
          uniqueClients.push({
            ...c,
            pan: decryptGCM(c.pan),
            aadhaar: decryptGCM(c.aadhaar)
          });
        }
      }
      return uniqueClients;
    }
  },
  
  saveClients: async (clients: DbClient[]): Promise<void> => {
    const seen = new Set<string>();
    const uniqueClients = clients.filter(c => {
      if (c && c.id && !seen.has(c.id)) {
        seen.add(c.id);
        return true;
      }
      return false;
    });

    if (isPostgres) {
      await withTransaction(async (client) => {
        const idsInList = uniqueClients.map(c => c.id).filter(Boolean);
        if (idsInList.length > 0) {
          const placeholders = idsInList.map((_, i) => `$${i + 1}`).join(', ');
          await client.execute(`DELETE FROM clients WHERE id NOT IN (${placeholders})`, idsInList);
        } else {
          await client.execute(`DELETE FROM clients`);
        }

        for (const c of uniqueClients) {
          await client.execute(`
            INSERT INTO clients (id, name, father_name, dob, age, occupation, pan, aadhaar, pan_hash, aadhaar_hash, address, phone, email, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              father_name = EXCLUDED.father_name,
              dob = EXCLUDED.dob,
              age = EXCLUDED.age,
              occupation = EXCLUDED.occupation,
              pan = EXCLUDED.pan,
              aadhaar = EXCLUDED.aadhaar,
              pan_hash = EXCLUDED.pan_hash,
              aadhaar_hash = EXCLUDED.aadhaar_hash,
              address = EXCLUDED.address,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email
          `, [
            c.id, c.name, c.fatherName, c.dob, c.age, c.occupation,
            encryptGCM(c.pan), encryptGCM(c.aadhaar),
            getDeterministicHash(c.pan), getDeterministicHash(c.aadhaar),
            c.address, c.phone, c.email, c.createdAt
          ]);
        }
      });
    } else {
      const encryptedClients = uniqueClients.map(c => ({
        ...c,
        pan: encryptGCM(c.pan),
        aadhaar: encryptGCM(c.aadhaar),
        pan_hash: getDeterministicHash(c.pan),
        aadhaar_hash: getDeterministicHash(c.aadhaar)
      }));
      writeJsonFile('clients.json', encryptedClients);
    }
  },
  
  // AUDIT LOGS
  getAuditLogs: async (): Promise<DbAuditLog[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
      return rows.map(r => ({
        ...r,
        userEmail: r.user_email,
        ipAddress: r.ip_address
      }));
    } else {
      return readJsonFile<DbAuditLog[]>('audit_logs.json', []);
    }
  },
  
  addAuditLog: async (log: Omit<DbAuditLog, 'id' | 'timestamp'>): Promise<DbAuditLog> => {
    const maskedDetails = maskPIIInText(log.details);
    const newLog: DbAuditLog = {
      id: `aud-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString(),
      ...log,
      details: maskedDetails
    };
    if (isPostgres) {
      await execute(`
        INSERT INTO audit_logs (id, timestamp, user_email, role, action, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        newLog.id, newLog.timestamp, newLog.userEmail, newLog.role, newLog.action, newLog.details, newLog.ipAddress
      ]);
    } else {
      const logs = readJsonFile<DbAuditLog[]>('audit_logs.json', []);
      logs.unshift(newLog);
      writeJsonFile('audit_logs.json', logs);
    }
    return newLog;
  },
  
  // DOCUMENTS
  getDocuments: async (): Promise<DbDocument[]> => {
    const decryptParties = (parties: any[]) => {
      if (!parties || !Array.isArray(parties)) return parties;
      return parties.map((p: any) => ({
        ...p,
        pan: p.pan ? decryptGCM(p.pan) : p.pan,
        aadhaar: p.aadhaar ? decryptGCM(p.aadhaar) : p.aadhaar
      }));
    };

    if (isPostgres) {
      const rows = await query('SELECT * FROM documents ORDER BY modified_at DESC');
      const uniqueDocs: DbDocument[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (r.id && !seen.has(r.id)) {
          seen.add(r.id);
          const state = typeof r.state === 'string' ? JSON.parse(r.state) : r.state;
          if (state && Array.isArray(state.parties)) {
            state.parties = decryptParties(state.parties);
          }
          uniqueDocs.push({
            id: r.id,
            docNo: r.doc_no,
            docType: r.doc_type,
            subType: r.sub_type,
            partiesCount: r.parties_count,
            propertyAddress: r.property_address,
            consideration: r.consideration,
            status: r.status,
            writer: r.writer,
            progress: r.progress,
            createdAt: r.created_at,
            modifiedAt: r.modified_at,
            createdBy: r.created_by,
            state: state
          });
        }
      }
      return uniqueDocs;
    } else {
      const allDocs = readJsonFile<DbDocument[]>('documents.json', []);
      const uniqueDocs: DbDocument[] = [];
      const seen = new Set<string>();
      for (const d of allDocs) {
        if (d && d.id && !seen.has(d.id)) {
          seen.add(d.id);
          const clonedDoc = JSON.parse(JSON.stringify(d));
          if (clonedDoc.state && Array.isArray(clonedDoc.state.parties)) {
            clonedDoc.state.parties = decryptParties(clonedDoc.state.parties);
          }
          uniqueDocs.push(clonedDoc);
        }
      }
      return uniqueDocs;
    }
  },
  
  saveDocuments: async (docs: DbDocument[]): Promise<void> => {
    const encryptParties = (parties: any[]) => {
      if (!parties || !Array.isArray(parties)) return parties;
      return parties.map((p: any) => ({
        ...p,
        pan: p.pan ? encryptGCM(p.pan) : p.pan,
        aadhaar: p.aadhaar ? encryptGCM(p.aadhaar) : p.aadhaar
      }));
    };

    const seen = new Set<string>();
    const uniqueDocs = docs.filter(d => {
      if (d && d.id && !seen.has(d.id)) {
        seen.add(d.id);
        return true;
      }
      return false;
    });

    // Prepare encrypted docs for saving
    const preparedDocs = uniqueDocs.map(d => {
      const cloned = JSON.parse(JSON.stringify(d));
      if (cloned.state && Array.isArray(cloned.state.parties)) {
        cloned.state.parties = encryptParties(cloned.state.parties);
      }
      return cloned;
    });

    if (isPostgres) {
      await withTransaction(async (client) => {
        const idsInList = preparedDocs.map(d => d.id).filter(Boolean);
        if (idsInList.length > 0) {
          const placeholders = idsInList.map((_, i) => `$${i + 1}`).join(', ');
          await client.execute(`DELETE FROM documents WHERE id NOT IN (${placeholders})`, idsInList);
        } else {
          await client.execute(`DELETE FROM documents`);
        }

        for (const doc of preparedDocs) {
          const surveyNo = doc.state?.surveys?.[0]?.surveyNo || doc.state?.survey?.surveyNo || null;
          const subDivision = doc.state?.surveys?.[0]?.subDivision || doc.state?.survey?.subDivision || null;
          const village = doc.state?.property?.village || null;

          // Prevent dual listing fraud for Finalized status
          if (doc.status === 'Finalized' && surveyNo && village) {
            const conflicting = await client.query(`
              SELECT doc_no FROM documents 
              WHERE survey_no = $1 AND sub_division = $2 AND village = $3 AND status = 'Finalized' AND id <> $4
              LIMIT 1
            `, [surveyNo, subDivision || '', village, doc.id]);
            
            if (conflicting && conflicting.length > 0) {
              throw new Error(`Trust Verification Gate Blocked: Survey plot ${surveyNo}/${subDivision || 'N/A'} in ${village} is already legally finalized and registered under deed ${conflicting[0].doc_no}. Duplicate finalization is strictly blocked to prevent fraudulent transactions.`);
            }
          }

          await client.execute(`
            INSERT INTO documents (
              id, doc_no, doc_type, sub_type, parties_count, property_address,
              consideration, status, writer, progress, created_at, modified_at, created_by, state,
              survey_no, sub_division, village
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              doc_no = EXCLUDED.doc_no,
              doc_type = EXCLUDED.doc_type,
              sub_type = EXCLUDED.sub_type,
              parties_count = EXCLUDED.parties_count,
              property_address = EXCLUDED.property_address,
              consideration = EXCLUDED.consideration,
              status = EXCLUDED.status,
              writer = EXCLUDED.writer,
              progress = EXCLUDED.progress,
              modified_at = EXCLUDED.modified_at,
              state = EXCLUDED.state,
              survey_no = EXCLUDED.survey_no,
              sub_division = EXCLUDED.sub_division,
              village = EXCLUDED.village
          `, [
            doc.id, doc.docNo, doc.docType, doc.subType, doc.partiesCount, doc.propertyAddress,
            doc.consideration, doc.status, doc.writer, doc.progress, doc.createdAt, doc.modifiedAt, doc.createdBy,
            JSON.stringify(doc.state), surveyNo, subDivision || '', village
          ]);
        }
      });
    } else {
      // JSON validation constraint emulation to match Postgres integrity checks perfectly
      for (const doc of preparedDocs) {
        const surveyNo = doc.state?.surveys?.[0]?.surveyNo || doc.state?.survey?.surveyNo || null;
        const subDivision = doc.state?.surveys?.[0]?.subDivision || doc.state?.survey?.subDivision || null;
        const village = doc.state?.property?.village || null;

        if (doc.status === 'Finalized' && surveyNo && village) {
          const conflicting = preparedDocs.find(d => 
            d.id !== doc.id && 
            d.status === 'Finalized' &&
            (d.state?.surveys?.[0]?.surveyNo === surveyNo || d.state?.survey?.surveyNo === surveyNo) &&
            (d.state?.surveys?.[0]?.subDivision === subDivision || d.state?.survey?.subDivision === subDivision) &&
            d.state?.property?.village === village
          );
          if (conflicting) {
            throw new Error(`Trust Verification Gate Blocked: Survey plot ${surveyNo}/${subDivision || 'N/A'} in ${village} is already legally finalized and registered under deed ${conflicting.docNo}. Duplicate finalization is strictly blocked to prevent fraudulent transactions.`);
          }
        }
      }
      writeJsonFile('documents.json', preparedDocs);
    }
  }
};

// ----------------------------------------------------------------------------
// MASTER DATA ENGINE FOR UNIKORN360 DEEDOS
// ----------------------------------------------------------------------------

export const MASTER_DATA_ENGINE = {
  documentTypes: [
    { id: 'dt1', code: 'SALE', nameEn: 'Sale Deed', nameTa: 'கிரயப் பத்திரம்', description: 'Absolute conveyance of immovable property title' },
    { id: 'dt2', code: 'SETTLEMENT', nameEn: 'Settlement Deed', nameTa: 'செட்டில்மெண்ட் பத்திரம்', description: 'Transfer of property among family/relatives' },
    { id: 'dt3', code: 'GIFT', nameEn: 'Gift Deed', nameTa: 'தான பத்திரம்', description: 'Voluntary transfer of property without monetary consideration' },
    { id: 'dt4', code: 'PARTITION', nameEn: 'Partition Deed', nameTa: 'பாகப்பிரிவினை பத்திரம்', description: 'Division of co-owned property among co-sharers' },
    { id: 'dt5', code: 'RELEASE', nameEn: 'Release Deed', nameTa: 'விடுதலைப் பத்திரம்', description: 'Relinquishment of rights over joint property' },
    { id: 'dt6', code: 'LEASE', nameEn: 'Lease Deed', nameTa: 'குத்தகை / வாடகை பத்திரம்', description: 'Transfer of right to enjoy property for fixed term' },
    { id: 'dt7', code: 'MORTGAGE', nameEn: 'Mortgage Deed', nameTa: 'அடமானப் பத்திரம்', description: 'Transfer of interest in property as security for loan' },
    { id: 'dt8', code: 'POA', nameEn: 'Power of Attorney', nameTa: 'பொது அதிகாரப் பத்திரம்', description: 'Appointment of agent to manage property' },
    { id: 'dt9', code: 'RECTIFICATION', nameEn: 'Rectification Deed', nameTa: 'பிழை திருத்தல் பத்திரம்', description: 'Correction of clerical/typographical errors in prior deed' },
    { id: 'dt10', code: 'TRUST', nameEn: 'Trust Deed', nameTa: 'அறக்கட்டளை பத்திரம்', description: 'Creation of public/private trust' },
    { id: 'dt11', code: 'WILL', nameEn: 'Will', nameTa: 'உயில் சாசனம்', description: 'Testamentary disposition of property' }
  ],
  documentSubtypes: [
    { id: 'dst1', code: 'SALE_METRO', nameEn: 'Sale in Corporation / Metro Area', nameTa: 'மாநகராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst2', code: 'SALE_MUNI', nameEn: 'Sale in Municipality Area', nameTa: 'நகராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst3', code: 'SALE_RURAL', nameEn: 'Sale in Village Panchayat Area', nameTa: 'ஊராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst4', code: 'SETTLE_FAMILY', nameEn: 'Family Settlement Deed', nameTa: 'குடும்ப உறுப்பினர்களுக்குள் செட்டில்மெண்ட்', extra: { docTypeCode: 'SETTLEMENT' } },
    { id: 'dst5', code: 'GIFT_NON_FAMILY', nameEn: 'Non-Family Gift Deed', nameTa: 'குடும்பம் அல்லாதவருக்கு கொடை', extra: { docTypeCode: 'GIFT' } },
    { id: 'dst6', code: 'LEASE_COMMERCIAL', nameEn: 'Commercial Property Lease', nameTa: 'வணிக பயன்பாட்டு குத்தகை', extra: { docTypeCode: 'LEASE' } },
    { id: 'dst7', code: 'MORTGAGE_SIMPLE', nameEn: 'Simple Mortgage without Possession', nameTa: 'சுவாதீனமில்லா எளிய அடமானம்', extra: { docTypeCode: 'MORTGAGE' } }
  ],
  partyRoles: [
    { id: 'pr1', code: 'SELLER', nameEn: 'Vendor / Seller', nameTa: 'விற்பனையாளர் / கிரயதாரர்', category: 'Transferor' },
    { id: 'pr2', code: 'BUYER', nameEn: 'Vendee / Purchaser', nameTa: 'வாங்குபவர்', category: 'Transferee' },
    { id: 'pr3', code: 'SETTLOR', nameEn: 'Settlor', nameTa: 'செட்டில்மெண்ட் செய்பவர்', category: 'Transferor' },
    { id: 'pr4', code: 'SETTLEE', nameEn: 'Settlee', nameTa: 'செட்டில்மெண்ட் பெறுபவர்', category: 'Transferee' },
    { id: 'pr5', code: 'DONOR', nameEn: 'Donor', nameTa: 'கொடையாளர்', category: 'Transferor' },
    { id: 'pr6', code: 'DONEE', nameEn: 'Donee', nameTa: 'கொடை பெறுபவர்', category: 'Transferee' },
    { id: 'pr7', code: 'LESSOR', nameEn: 'Lessor / Landlord', nameTa: 'சொத்து உரிமையாளர் / குத்தகை தருபவர்', category: 'Transferor' },
    { id: 'pr8', code: 'LESSEE', nameEn: 'Lessee / Tenant', nameTa: 'குத்தகைதாரர் / வாடகைதாரர்', category: 'Transferee' },
    { id: 'pr9', code: 'MORTGAGOR', nameEn: 'Mortgagor', nameTa: 'அடமானம் வைப்பவர்', category: 'Transferor' },
    { id: 'pr10', code: 'MORTGAGEE', nameEn: 'Mortgagee / Lender', nameTa: 'அடமானம் பெறுபவர் / கடன் தருபவர்', category: 'Transferee' },
    { id: 'pr11', code: 'POA_AGENT', nameEn: 'Power Agent', nameTa: 'பொது அதிகார முகவர்', category: 'Neutral' },
    { id: 'pr12', code: 'WITNESS', nameEn: 'Witness', nameTa: 'சாட்சி', category: 'Witness' }
  ],
  occupationMaster: [
    { id: 'oc1', code: 'AGRI', nameEn: 'Agriculture / Farming', nameTa: 'விவசாயம்' },
    { id: 'oc2', code: 'BIZ', nameEn: 'Business / Enterprise Owner', nameTa: 'தொழில் / வணிகம்' },
    { id: 'oc3', code: 'PVT', nameEn: 'Private Sector Employee', nameTa: 'தனியார் நிறுவன வேலை' },
    { id: 'oc4', code: 'GOVT', nameEn: 'Government Service Officer', nameTa: 'அரசுப் பணி' },
    { id: 'oc5', code: 'PROF', nameEn: 'Professional (Lawyer/Doctor/Eng)', nameTa: 'தொழில்முறை வல்லுநர்' },
    { id: 'oc6', code: 'HOMEMAKER', nameEn: 'Homemaker', nameTa: 'இல்லத்தரசி' },
    { id: 'oc7', code: 'RETIRED', nameEn: 'Retired Employee / Pensioner', nameTa: 'ஓய்வு பெற்றவர்' }
  ],
  relationshipMaster: [
    { id: 'rm1', code: 'S_O', nameEn: 'Son of', nameTa: 'மகன்' },
    { id: 'rm2', code: 'D_O', nameEn: 'Daughter of', nameTa: 'மகள்' },
    { id: 'rm3', code: 'W_O', nameEn: 'Wife of', nameTa: 'மனைவி' },
    { id: 'rm4', code: 'H_O', nameEn: 'Husband of', nameTa: 'கணவர்' },
    { id: 'rm5', code: 'C_O', nameEn: 'Care of', nameTa: 'பாதுகாவலர்' }
  ],
  districtMaster: [
    { id: 'd3', code: 'CHN', nameEn: 'Chennai', nameTa: 'சென்னை', registrationDistrict: 'Chennai South' },
    { id: 'd2', code: 'CGL', nameEn: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', registrationDistrict: 'Chengalpattu' },
    { id: 'd10', code: 'KCP', nameEn: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', registrationDistrict: 'Kanchipuram' },
    { id: 'd4', code: 'CBE', nameEn: 'Coimbatore', nameTa: 'கோயம்புத்தூர்', registrationDistrict: 'Coimbatore' },
    { id: 'd14', code: 'MDU', nameEn: 'Madurai', nameTa: 'மதுரை', registrationDistrict: 'Madurai' },
    { id: 'd29', code: 'TRY', nameEn: 'Tiruchirappalli', nameTa: 'திருச்சிராப்பள்ளி', registrationDistrict: 'Tiruchirappalli' },
    { id: 'd23', code: 'SLM', nameEn: 'Salem', nameTa: 'சேலம்', registrationDistrict: 'Salem' },
    { id: 'd36', code: 'VEL', nameEn: 'Vellore', nameTa: 'வேலூர்', registrationDistrict: 'Vellore' }
  ],
  talukMaster: [
    { id: 't1', code: 'MYL', nameEn: 'Mylapore', nameTa: 'மயிலாப்பூர்', extra: { districtCode: 'CHN' } },
    { id: 't2', code: 'SHO', nameEn: 'Sholinganallur', nameTa: 'சோழிங்கநல்லூர்', extra: { districtCode: 'CHN' } },
    { id: 't3', code: 'VEL_T', nameEn: 'Velachery', nameTa: 'வேளச்சேரி', extra: { districtCode: 'CHN' } },
    { id: 't4', code: 'CGL_T', nameEn: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', extra: { districtCode: 'CGL' } },
    { id: 't5', code: 'KCP_T', nameEn: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', extra: { districtCode: 'KCP' } },
    { id: 't6', code: 'CBE_S', nameEn: 'Coimbatore South', nameTa: 'தெற்கு கோயம்புத்தூர்', extra: { districtCode: 'CBE' } }
  ],
  villageMaster: [
    { id: 'v1', code: 'THIRU', nameEn: 'Thiruvanmiyur', nameTa: 'திருவான்மியூர்', extra: { talukCode: 'SHO' } },
    { id: 'v2', code: 'VEL_V', nameEn: 'Velachery Village', nameTa: 'வேளச்சேரி கிராமம்', extra: { talukCode: 'VEL_T' } },
    { id: 'v3', code: 'MYL_V', nameEn: 'Mylapore Town', nameTa: 'மயிலாப்பூர் நகரம்', extra: { talukCode: 'MYL' } },
    { id: 'v4', code: 'PER', nameEn: 'Perungudi', nameTa: 'பெருங்குடி', extra: { talukCode: 'SHO' } },
    { id: 'v5', code: 'KCP_TOWN', nameEn: 'Kanchipuram Town', nameTa: 'காஞ்சிபுரம் டவுன்', extra: { talukCode: 'KCP_T' } }
  ],
  sroMaster: [
    { id: 's1', code: 'SRO_MYL', nameEn: 'Mylapore SRO', nameTa: 'மயிலாப்பூர் சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1042' } },
    { id: 's2', code: 'SRO_VEL', nameEn: 'Velachery SRO', nameTa: 'வேளச்சேரி சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1043' } },
    { id: 's3', code: 'SRO_J1_S', nameEn: 'Joint I Chennai South SRO', nameTa: 'இணை I தென் சென்னை சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1001' } },
    { id: 's4', code: 'SRO_KCP', nameEn: 'Kanchipuram Joint SRO', nameTa: 'காஞ்சிபுரம் இணை சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'KCP', sroCode: '2010' } },
    { id: 's5', code: 'SRO_CGL', nameEn: 'Chengalpattu Joint I SRO', nameTa: 'செங்கல்பட்டு இணை I சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CGL', sroCode: '3015' } }
  ],
  propertyTypeMaster: [
    { id: 'pt1', code: 'RES_PLOT', nameEn: 'Residential House Site / Plot', nameTa: 'மனை / குடியிருப்பு மனை', category: 'Land' },
    { id: 'pt2', code: 'AGRI_NANJAI', nameEn: 'Agricultural Wet Land (Nanjai)', nameTa: 'விவசாய நஞ்சை நிலம்', category: 'Agricultural' },
    { id: 'pt3', code: 'AGRI_PUNJAI', nameEn: 'Agricultural Dry Land (Punjai)', nameTa: 'விவசாய புஞ்சை நிலம்', category: 'Agricultural' },
    { id: 'pt4', code: 'COMM_PLOT', nameEn: 'Commercial Vacant Land', nameTa: 'வணிக காலி மனை', category: 'Land' },
    { id: 'pt5', code: 'FLAT_APT', nameEn: 'Flat / Residential Apartment Unit', nameTa: 'அடுக்குமாடி குடியிருப்பு', category: 'Flat' },
    { id: 'pt6', code: 'COMM_BLDG', nameEn: 'Commercial Building / Shop', nameTa: 'வணிகக் கட்டிடம் / கடை', category: 'Building' }
  ],
  clauseLibrary: [
    {
      id: 'cl1',
      code: 'CLAUSE_TITLE_GUARANTEE',
      title: 'Title Guarantee & Clear Encumbrance Covenant',
      category: 'Standard',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor hereby covenants that the Scheduled Property is free from all encumbrances, mortgages, liens, lis pendens, and legal attachments whatsoever, and that the Vendor possesses absolute title.',
      contentTa: 'விற்பனையாளர் இதன் மூலம் உறுதி அளிப்பது என்னவென்றால், அட்டவணைச் சொத்தில் எந்தவிதமான வில்லங்கமோ, கடன்களோ, அடமானமோ, அல்லது நீதிமன்ற ஜப்தியோ இல்லை.'
    },
    {
      id: 'cl2',
      code: 'CLAUSE_LEGAL_HEIR_INDEMNITY',
      title: 'Legal Heir Claims Indemnity Clause',
      category: 'Indemnity',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor hereby indemnifies the Purchaser against any future inheritance or legal heir claims that may be raised by minor or undisclosed legal heirs regarding the Scheduled Property.',
      contentTa: 'விற்பனையாளர் இதன் மூலம் உறுதி அளிப்பதாவது, இச்சொத்தின் மீது மைனர் அல்லது வெளிப்படுத்தப்படாத வாரிசுகளால் எதிர்காலத்தில் ஏதேனும் உரிமை கோரல் எழுந்தால், அதற்கு விற்பனையாளரே பொறுப்பேற்று நஷ்டஈடு வழங்குவார்.'
    },
    {
      id: 'cl3',
      code: 'CLAUSE_POSSESSION_DELIVERY',
      title: 'Delivery of Peaceful Physical Possession',
      category: 'Possession',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor confirms having delivered full, peaceful, and vacant physical possession of the Scheduled Property along with original parent title documents to the Purchaser.',
      contentTa: 'விற்பனையாளர் அட்டவணைச் சொத்தின் அமைதியான, பூரண சுயா தீன சுவாதீனத்தையும் அசல் தாய் பத்திரங்களையும் வாங்குபவரிடம் ஒப்படைத்து விட்டார்.'
    },
    {
      id: 'cl4',
      code: 'CLAUSE_STAMP_DUTY_UNDERVALUATION',
      title: 'Section 47A Stamp Duty Undertaking',
      category: 'Compliance',
      isMandatory: false,
      isActive: true,
      contentEn: 'In the event of any order passed under Section 47A of the Indian Stamp Act for under-valuation, the parties undertake to comply with the statutory directive within prescribed timelines.',
      contentTa: 'இந்திய முத்திரைச் சட்டப் பிரிவு 47A இன் கீழ் ஏதேனும் முத்திரைத்தாள் கூடுதல் கட்டண உத்தரவு பிறப்பிக்கப்பட்டால், சட்டப்படி அதற்குரிய தொகையை செலுத்த ஒப்புக்கொள்கிறார்கள்.'
    }
  ]
};

export function getMasterDataEngine(category?: string) {
  if (!category) {
    return MASTER_DATA_ENGINE;
  }
  
  const key = category.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof typeof MASTER_DATA_ENGINE;
  if (MASTER_DATA_ENGINE[key]) {
    return MASTER_DATA_ENGINE[key];
  }
  
  // Alternative key mappings
  const map: Record<string, keyof typeof MASTER_DATA_ENGINE> = {
    'document-types': 'documentTypes',
    'document-subtypes': 'documentSubtypes',
    'party-roles': 'partyRoles',
    'occupations': 'occupationMaster',
    'relationships': 'relationshipMaster',
    'districts': 'districtMaster',
    'taluks': 'talukMaster',
    'villages': 'villageMaster',
    'sros': 'sroMaster',
    'property-types': 'propertyTypeMaster',
    'clauses': 'clauseLibrary'
  };

  const matchedKey = map[category.toLowerCase()];
  if (matchedKey && MASTER_DATA_ENGINE[matchedKey]) {
    return MASTER_DATA_ENGINE[matchedKey];
  }

  return MASTER_DATA_ENGINE;
}

