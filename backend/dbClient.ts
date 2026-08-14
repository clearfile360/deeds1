import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export let isPostgres = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('@base:');
let pgPool: pg.Pool | null = null;

export function disablePostgres() {
  isPostgres = false;
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
}

if (isPostgres) {
  try {
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
        ? false 
        : { rejectUnauthorized: false }
    });
    // Handle background pool errors gracefully
    pgPool.on('error', (err) => {
      console.warn('PostgreSQL pool background notice:', err?.message || err);
      disablePostgres();
    });
  } catch (err) {
    console.warn('Failed to initialize PostgreSQL pool, falling back to JSON storage:', err);
    disablePostgres();
  }
} else {
  console.log('Using robust JSON flat-file storage local fallback...');
}

// Helper to query PostgreSQL database
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return res.rows;
  }
  throw new Error('Database client not initialized in PostgreSQL mode.');
}

// Helper to execute SQL commands in PostgreSQL
export async function execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return { rowCount: res.rowCount || 0 };
  }
  throw new Error('Database client not initialized in PostgreSQL mode.');
}

// Helper for ACID Transactions
export async function withTransaction<T>(
  callback: (client: { query: typeof query; execute: typeof execute }) => Promise<T>
): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const tQuery = async (sql: string, params: any[] = []) => {
        const res = await client.query(sql, params);
        return res.rows;
      };
      const tExecute = async (sql: string, params: any[] = []) => {
        const res = await client.query(sql, params);
        return { rowCount: res.rowCount || 0 };
      };
      const result = await callback({ query: tQuery, execute: tExecute });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error('ACID transactions helper is only available in PostgreSQL mode.');
}

// Initialize tables and constraint schemas on startup
export async function initDatabase() {
  if (!pgPool) return;
  
  console.log('Initializing production PostgreSQL tables & indexes...');
  
  // 1. Create Users Table
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50) NOT NULL,
      organization VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      permissions TEXT NOT NULL,
      status VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )
  `);

  await execute(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE
  `);

  // 2. Create Clients Table
  await execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      father_name VARCHAR(255) NOT NULL,
      dob VARCHAR(50) NOT NULL,
      age INTEGER NOT NULL,
      occupation VARCHAR(255) NOT NULL,
      pan VARCHAR(255) NOT NULL,
      aadhaar VARCHAR(255) NOT NULL,
      pan_hash VARCHAR(64),
      aadhaar_hash VARCHAR(64),
      address TEXT NOT NULL,
      phone VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )
  `);

  // 3. Create Documents/Deeds Table
  await execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(50) PRIMARY KEY,
      doc_no VARCHAR(100) UNIQUE NOT NULL,
      doc_type VARCHAR(100) NOT NULL,
      sub_type VARCHAR(100) NOT NULL,
      parties_count INTEGER NOT NULL,
      property_address TEXT NOT NULL,
      consideration REAL NOT NULL,
      status VARCHAR(50) NOT NULL,
      writer VARCHAR(255) NOT NULL,
      progress INTEGER NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      modified_at VARCHAR(50) NOT NULL,
      created_by VARCHAR(255) NOT NULL,
      state TEXT NOT NULL,
      survey_no VARCHAR(50),
      sub_division VARCHAR(50),
      village VARCHAR(100)
    )
  `);

  // 4. Create Audit Logs Table
  await execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      timestamp VARCHAR(50) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      action VARCHAR(255) NOT NULL,
      details TEXT NOT NULL,
      ip_address VARCHAR(50) NOT NULL
    )
  `);

  // Performance Optimization Indexes
  await execute(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_documents_survey ON documents(survey_no, sub_division, village)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_documents_writer ON documents(writer)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_clients_pan_hash ON clients(pan_hash)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_clients_aadhaar_hash ON clients(aadhaar_hash)`);

  // ALTER columns dynamically for encryption storage
  try {
    await execute(`ALTER TABLE clients ALTER COLUMN pan TYPE VARCHAR(255)`);
    await execute(`ALTER TABLE clients ALTER COLUMN aadhaar TYPE VARCHAR(255)`);
    await execute(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pan_hash VARCHAR(64)`);
    await execute(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64)`);
  } catch (err) {
    console.log('PostgreSQL client table columns alter/migration completed/already-updated:', err);
  }
  
  // Unique Constraint index to prevent duplicate finalized deed for same survey + subdivision + village
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_finalized_survey 
    ON documents(survey_no, sub_division, village) 
    WHERE status = 'Finalized'
  `);

  console.log('Production PostgreSQL database schema initialization completed.');
}
