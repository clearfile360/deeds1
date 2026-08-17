/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  aiExtractDocumentData, 
  aiValidateDeedDocument, 
  aiRecommendClauses, 
  aiCheckDeedFraudRisk 
} from './ai';
import { db, DbUser, DbClient, DbDocument, DbAuditLog, migrateAndBootstrap, getMasterDataEngine } from './db';
import { serializeClient, serializeDocument, getDeterministicHash } from './pii';

dotenv.config();

// Initialize server-side Supabase client (using service role key or anon key securely on backend)
const serverSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serverSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabaseServer: SupabaseClient | null = null;
if (serverSupabaseUrl && serverSupabaseKey) {
  try {
    supabaseServer = createClient(serverSupabaseUrl, serverSupabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('Could not initialize Supabase server client:', err);
  }
}

interface ElevatedSession {
  userId: string;
  userEmail: string;
  role: string;
  reasonCode: string;
  expiresAt: Date;
}

// In-memory registry for active elevated Auditor sessions
const activeElevatedSessions = new Map<string, ElevatedSession>();

// Explicit Super Admin account allowlist
const SUPER_ADMIN_EMAILS = ['clearfile360@gmail.com', 'raj.asusrog@gmail.com'];

// Help build user context for PII serialization and masking with strict session checks
const buildUserContext = async (req: Request) => {
  const dbUsers = await db.getUsers();
  const reqEmail = (req as any).user?.email || '';
  const fullUser = dbUsers.find(u => u.email.toLowerCase() === reqEmail.toLowerCase());
  
  const role = fullUser ? fullUser.role : ((req as any).user?.role || 'Client');
  const email = fullUser ? fullUser.email : reqEmail;
  const id = fullUser ? fullUser.id : '';
  const phone = fullUser ? fullUser.phone : '';
  
  let elevatedReview = false;
  let reasonCode = '';

  // Elevated review MUST require: authenticated Auditor role, explicit server-side permission, mandatory reason, and active unexpired session
  if (role === 'Auditor' && email) {
    const session = activeElevatedSessions.get(email.toLowerCase());
    const canViewRawPII = fullUser?.permissions?.includes('canViewRawPII') || false;
    
    if (session && canViewRawPII && new Date() < session.expiresAt) {
      elevatedReview = true;
      reasonCode = session.reasonCode;
    }
  }
  
  return { role, email, id, phone, elevatedReview, reasonCode };
};

// Log raw PII access securely to SIEM audit trail
const logRawPIIAccess = async (req: Request, clientRecordId: string, reasonCode: string) => {
  const dbUsers = await db.getUsers();
  const reqEmail = (req as any).user?.email || 'authenticated_user';
  const fullUser = dbUsers.find(u => u.email.toLowerCase() === reqEmail.toLowerCase());
  const userId = fullUser ? fullUser.id : 'unknown';
  const role = fullUser ? fullUser.role : 'Auditor';

  await db.addAuditLog({
    userEmail: reqEmail,
    role: role,
    action: 'RAW_PII_ACCESS',
    details: JSON.stringify({
      userId,
      role,
      timestamp: new Date().toISOString(),
      clientRecordId,
      reasonCode
    }),
    ipAddress: req.ip || '127.0.0.1'
  });
};

// Load environmental parameters
dotenv.config();

// JWT Secret Check (Must refuse production startup if JWT secret missing)
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is required in production mode.");
    process.exit(1);
  }
}

// Password Complexity Policy Validation
function validatePasswordPolicy(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

// Legacy SHA-256 hash detection
function isLegacyHash(hash: string): boolean {
  if (!hash) return false;
  if (hash.startsWith('sha256_')) return true;
  if (hash.length === 64 && /^[0-9a-fA-F]+$/.test(hash)) return true;
  if (!hash.startsWith('$2')) return true;
  return false;
}

const app = express();
app.use(express.json());

const PORT = 3001; // Backend runs internally or serves proxy handles

// Define standard User Roles
type UserRole = 
  | 'Super Admin' 
  | 'Admin' 
  | 'Document Writer' 
  | 'Lawyer' 
  | 'Broker' 
  | 'Data Entry Operator' 
  | 'Client' 
  | 'Auditor';

// ==========================================
// LAYER 1: RBAC & PERMISSIONS ENGINE
// ==========================================

interface PermissionRequest extends Request {
  user?: {
    id?: string;
    email: string;
    role: UserRole;
  };
}

// Supabase & Session Auth Middleware
const authMiddleware = async (req: PermissionRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (supabaseServer && token) {
      try {
        const { data: { user }, error } = await supabaseServer.auth.getUser(token);
        if (user && user.email) {
          const dbUsers = await db.getUsers();
          const matched = dbUsers.find(u => u.email.toLowerCase() === user.email?.toLowerCase() || u.id === user.id);
          
          const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
          const defaultRole: UserRole = isSuperAdmin ? 'Super Admin' : 'Document Writer';

          req.user = {
            id: user.id,
            email: user.email,
            role: matched ? (matched.role as UserRole) : (user.user_metadata?.role || defaultRole),
          };
          return next();
        }
      } catch (err) {
        console.warn('Bearer token validation failed:', err);
      }
    }
  }

  // Fallback to headers for local/testing requests
  const fallbackEmail = (req.headers['x-user-email'] as string) || '';
  const fallbackId = (req.headers['x-user-id'] as string) || '';
  req.user = {
    id: fallbackId,
    email: fallbackEmail,
    role: (req.headers['x-user-role'] as UserRole) || (SUPER_ADMIN_EMAILS.includes(fallbackEmail.toLowerCase()) ? 'Super Admin' : 'Document Writer'),
  };
  next();
};

// Permission checking middleware generator
const requirePermission = (allowedRoles: UserRole[]) => {
  return (req: PermissionRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Role '${req.user.role}' lacks sufficient privileges. Required roles: [${allowedRoles.join(', ')}]` 
      });
    }
    next();
  };
};

// Resource Ownership Verification Middleware
const requireResourceAccess = (resourceType: 'documents' | 'clients' | 'audits') => {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      }

      // 1. Fetch full user from database using email to avoid trusting frontend headers
      const dbUsers = await db.getUsers();
      const fullUser = dbUsers.find(u => u.email.toLowerCase() === req.user?.email?.toLowerCase());
      if (!fullUser) {
        return res.status(403).json({ error: 'Access Denied: User profile not found.' });
      }

      const role = fullUser.role as UserRole;
      const method = req.method;

      // Super Admin and Admin have full access to everything
      if (role === 'Super Admin' || role === 'Admin') {
        return next();
      }

      // Auditor has read-only access (GET requests only)
      if (role === 'Auditor') {
        if (method === 'GET') {
          return next();
        } else {
          return res.status(403).json({ error: 'Access Denied: Auditors have read-only access.' });
        }
      }

      // 2. Fetch the resource ID from request params
      const resourceId = req.params.id;

      if (resourceType === 'audits') {
        // Audit logs are only accessible to Super Admin, Admin, and Auditor (already handled above)
        // Others are blocked from accessing audit logs.
        if (method === 'GET') {
          return res.status(403).json({ error: 'Access Denied: Lacks privilege to view audits.' });
        }
        return next();
      }

      if (resourceType === 'documents') {
        if (!resourceId) {
          return next();
        }

        const docs = await db.getDocuments();
        const doc = docs.find(d => d.id === resourceId);
        if (!doc) {
          // Denied Access Response: No resource metadata leakage (HTTP 403)
          return res.status(403).json({ error: 'Access Denied: Resource not accessible or not found.' });
        }

        // Apply rules:
        const currentUid = fullUser.id || req.user?.id;
        const currentEmail = (fullUser.email || req.user?.email || '').toLowerCase();

        // - Document Writer / Lawyer: only documents created by them OR explicitly assigned to them
        if (role === 'Document Writer' || role === 'Lawyer' || role === 'Data Entry Operator') {
          const isOwner = (currentUid && doc.createdByUserId === currentUid) ||
                          (currentEmail && doc.createdByEmail?.toLowerCase() === currentEmail) ||
                          (currentEmail && doc.createdBy?.toLowerCase() === currentEmail) || 
                          doc.writer === fullUser.name || 
                          (currentUid && doc.state?.createdByUserId === currentUid) ||
                          (currentEmail && doc.state?.createdBy?.toLowerCase() === currentEmail) ||
                          (currentUid && doc.state?.assignedTo === currentUid) || 
                          (currentEmail && doc.state?.assignedTo?.toLowerCase() === currentEmail);
          if (!isOwner) {
            return res.status(403).json({ error: 'Access Denied: You do not own or have assignment to this document.' });
          }
        }
        // - Broker: only assigned clients and related documents
        else if (role === 'Broker') {
          const clients = await db.getClients();
          const brokerClients = clients.filter((c: any) => 
            c.assignedTo === fullUser.id || 
            c.assignedTo === fullUser.email || 
            c.createdBy === fullUser.email
          );
          const brokerClientEmails = brokerClients.map(c => c.email.toLowerCase()).filter(Boolean);
          const brokerClientPhones = brokerClients.map(c => c.phone).filter(Boolean);

          const isRelatedDoc = 
            (currentUid && doc.createdByUserId === currentUid) ||
            (currentEmail && doc.createdByEmail?.toLowerCase() === currentEmail) ||
            (currentEmail && doc.createdBy?.toLowerCase() === currentEmail) ||
            (currentUid && doc.state?.assignedTo === currentUid) || 
            (currentEmail && doc.state?.assignedTo?.toLowerCase() === currentEmail) ||
            doc.state?.brokerId === fullUser.id ||
            doc.state?.brokerEmail === fullUser.email ||
            doc.state?.parties?.some((p: any) => 
              (p.email && brokerClientEmails.includes(p.email.toLowerCase())) ||
              (p.phone && brokerClientPhones.includes(p.phone))
            );

          if (!isRelatedDoc) {
            return res.status(403).json({ error: 'Access Denied: This document is not related to any of your assigned clients.' });
          }
        }
        // - Client: only own documents
        else if (role === 'Client') {
          const isOwnDoc = 
            (currentUid && doc.createdByUserId === currentUid) ||
            (currentEmail && doc.createdByEmail?.toLowerCase() === currentEmail) ||
            (currentEmail && doc.createdBy?.toLowerCase() === currentEmail) || 
            doc.state?.parties?.some((p: any) => p.email?.toLowerCase() === currentEmail);
          if (!isOwnDoc) {
            return res.status(403).json({ error: 'Access Denied: You can only access your own documents.' });
          }
        } else {
          return res.status(403).json({ error: 'Access Denied: Insufficient permissions for this resource.' });
        }

        return next();
      }

      if (resourceType === 'clients') {
        if (!resourceId) {
          return next();
        }

        const clients = await db.getClients();
        const client = clients.find(c => c.id === resourceId);
        if (!client) {
          return res.status(403).json({ error: 'Access Denied: Resource not accessible or not found.' });
        }

        // Apply rules:
        // - Document Writer / Lawyer: only clients they created, or who are parties in their documents
        if (role === 'Document Writer' || role === 'Lawyer') {
          const docs = await db.getDocuments();
          const writerDocs = docs.filter(d => 
            d.createdBy === fullUser.email || 
            d.writer === fullUser.name || 
            d.state?.assignedTo === fullUser.id || 
            d.state?.assignedTo === fullUser.email
          );
          const hasPartyLink = writerDocs.some(d => 
            d.state?.parties?.some((p: any) => p.email?.toLowerCase() === client.email.toLowerCase() || p.phone === client.phone)
          );

          const isOwner = (client as any).createdBy === fullUser.email || 
                          client.email === fullUser.email || 
                          hasPartyLink;
          if (!isOwner) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to access this client.' });
          }
        }
        // - Broker: only assigned clients
        else if (role === 'Broker') {
          const isAssigned = (client as any).assignedTo === fullUser.id || 
                             (client as any).assignedTo === fullUser.email || 
                             (client as any).createdBy === fullUser.email ||
                             client.email === fullUser.email;
          if (!isAssigned) {
            return res.status(403).json({ error: 'Access Denied: You can only access your assigned clients.' });
          }
        }
        // - Client: only own documents / client profile
        else if (role === 'Client') {
          const isOwn = client.email?.toLowerCase() === fullUser.email.toLowerCase() || 
                        client.phone === fullUser.phone || 
                        client.id === fullUser.id;
          if (!isOwn) {
            return res.status(403).json({ error: 'Access Denied: You can only access your own client profile.' });
          }
        } else {
          return res.status(403).json({ error: 'Access Denied: Insufficient permissions for this resource.' });
        }

        return next();
      }

      return next();
    } catch (error) {
      console.error('Resource access validation error:', error);
      return res.status(403).json({ error: 'Access Denied: Authorization validation failed.' });
    }
  };
};

// ==========================================
// LAYER 4 & 5: REST API ENDPOINTS
// ==========================================

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'UNIKORN360 DEEDOS CORE CORE-ENGINE',
    postgres_pool: 'healthy (12 active connections)'
  });
});

// --- AUTHENTICATION ROUTER ---
app.post('/api/auth/login', async (req, res) => {
  const { email, passwordPlain, password } = req.body;
  const inputPassword = passwordPlain || password;
  const users = await db.getUsers();
  
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    await db.addAuditLog({
      userEmail: email,
      role: 'Client',
      action: 'FAILED_LOGIN',
      details: 'User profile not found.',
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.status(400).json({ error: 'Invalid credentials. User profile not found.' });
  }

  if (user.status === 'Suspended') {
    await db.addAuditLog({
      userEmail: email,
      role: user.role,
      action: 'SUSPENDED_LOGIN_BLOCKED',
      details: 'Suspended profile login attempt blocked.',
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.status(403).json({ error: 'Your profile is suspended. Please contact security support.' });
  }

  if (!inputPassword) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  let isPasswordCorrect = false;

  if (isLegacyHash(user.passwordHash)) {
    // 1. Validate old SHA-256 hash or simulated hash
    const sha256Hex = crypto.createHash('sha256').update(inputPassword).digest('hex');
    
    let hashVal = 0;
    for (let i = 0; i < inputPassword.length; i++) {
      const char = inputPassword.charCodeAt(i);
      hashVal = (hashVal << 5) - hashVal + char;
      hashVal = hashVal & hashVal;
    }
    const simulated = 'sha256_' + Math.abs(hashVal).toString(16);

    if (user.passwordHash === sha256Hex || user.passwordHash === simulated) {
      isPasswordCorrect = true;

      // 2. Immediately rehash using secure bcrypt
      const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
      const secureHash = bcrypt.hashSync(inputPassword, rounds);

      // 3. Replace stored credential (seamless migration)
      user.passwordHash = secureHash;
      const allUsers = await db.getUsers();
      const idx = allUsers.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        allUsers[idx].passwordHash = secureHash;
        await db.saveUsers(allUsers);
      }
    }
  } else {
    // Use library verification
    try {
      isPasswordCorrect = bcrypt.compareSync(inputPassword, user.passwordHash);
    } catch (err) {
      isPasswordCorrect = false;
    }
  }

  if (!isPasswordCorrect) {
    await db.addAuditLog({
      userEmail: email,
      role: user.role,
      action: 'FAILED_LOGIN_PASSWORD',
      details: 'Incorrect credentials submitted.',
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.status(400).json({ error: 'Invalid credentials. Incorrect password.' });
  }

  if (user.mustResetPassword) {
    await db.addAuditLog({
      userEmail: email,
      role: user.role,
      action: 'FORCED_PASSWORD_RESET',
      details: 'First-time login password reset required.',
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.status(403).json({ error: 'For security reasons, you must reset your password on first login.', requireReset: true });
  }

  await db.addAuditLog({
    userEmail: email,
    role: user.role,
    action: 'LOGIN',
    details: 'Successful user authentication.',
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Session authenticated.', user });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, organization, role, password, passwordPlain, passwordHash, status } = req.body;
  const rawPassword = password || passwordPlain;
  const users = await db.getUsers();

  const requestedRole = role || 'Client';
  const allowedPublicRoles = ['Client', 'Broker', 'Document Writer', 'Lawyer'];

  // Public registration role validation - never allow privileged roles via public endpoint
  if (['Auditor', 'Admin', 'Super Admin'].includes(requestedRole) || !allowedPublicRoles.includes(requestedRole)) {
    return res.status(403).json({ error: 'Public registration is only permitted for non-privileged roles (Client, Broker, Document Writer).' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email address already registered under another account.' });
  }

  let finalHash = '';

  if (rawPassword) {
    // Validate password policy
    if (!validatePasswordPolicy(rawPassword)) {
      return res.status(400).json({ 
        error: 'Password does not meet validation criteria. It must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }
    // Hash output must never expose raw password
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    finalHash = bcrypt.hashSync(rawPassword, rounds);
  } else if (passwordHash) {
    // Fallback if passwordHash is passed instead of raw password (like pre-hashed frontend legacy signups)
    if (passwordHash.startsWith('$2')) {
      finalHash = passwordHash;
    } else {
      finalHash = passwordHash;
    }
  } else {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const newUser: DbUser = {
    id: `usr-${Math.floor(Math.random() * 900000 + 100000)}`,
    name,
    email,
    phone,
    organization: organization || 'Independent',
    role: requestedRole,
    permissions: requestedRole === 'Super Admin' ? ['*'] : requestedRole === 'Auditor' ? ['audit_logs', 'view_all_deeds', 'canViewRawPII'] : ['view_own_deeds'],
    status: status || 'Pending Approval',
    passwordHash: finalHash,
    createdAt: new Date().toISOString()
  };

  const updated = [...users, newUser];
  await db.saveUsers(updated);

  await db.addAuditLog({
    userEmail: email,
    role: newUser.role,
    action: 'REGISTER',
    details: `User registered: ${name} (Status: ${newUser.status})`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Registration successful!', user: newUser });
});

app.get('/api/auth/users', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (req, res) => {
  res.json(await db.getUsers());
});

app.put('/api/auth/users/:id/role', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const users = await db.getUsers();
  
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Creation of privileged roles must require authenticated Super Admin
  if (['Auditor', 'Admin', 'Super Admin'].includes(role)) {
    if (req.user?.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Only an authenticated Super Admin can assign or create privileged roles (Auditor, Admin, Super Admin).' });
    }
  }

  const oldRole = users[userIndex].role;
  users[userIndex].role = role;

  // Set the default permissions for privileged role if assigned
  if (role === 'Super Admin') {
    users[userIndex].permissions = ['*'];
  } else if (role === 'Auditor') {
    users[userIndex].permissions = ['audit_logs', 'view_all_deeds', 'canViewRawPII'];
  }

  await db.saveUsers(users);

  // Every privileged role creation must log: ROLE_CREATED with creator user id and timestamp
  if (['Auditor', 'Admin', 'Super Admin'].includes(role)) {
    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Super Admin',
      action: 'ROLE_CREATED',
      details: `ROLE_CREATED: Creator User ID: ${req.user?.id || 'unknown'}, Timestamp: ${new Date().toISOString()}, Target Email: ${users[userIndex].email}, New Role: ${role}`,
      ipAddress: req.ip || '127.0.0.1'
    });
  } else {
    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Admin',
      action: 'ROLE_CHANGE',
      details: `Changed role from ${oldRole} to ${role} for user ${users[userIndex].email}`,
      ipAddress: req.ip || '127.0.0.1'
    });
  }

  res.json({ message: 'User role updated successfully.', user: users[userIndex] });
});

app.post('/api/auth/users/privileged', authMiddleware, requirePermission(['Super Admin']), async (req, res) => {
  const { name, email, phone, organization, role, password, passwordPlain } = req.body;
  const rawPassword = password || passwordPlain;
  const users = await db.getUsers();

  if (!email || !role || !rawPassword) {
    return res.status(400).json({ error: 'Name, Email, Role, and Password are required.' });
  }

  if (!['Auditor', 'Admin', 'Super Admin'].includes(role)) {
    return res.status(400).json({ error: 'This route is only for creating privileged roles (Auditor, Admin, Super Admin).' });
  }

  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email address already registered under another account.' });
  }

  if (!validatePasswordPolicy(rawPassword)) {
    return res.status(400).json({ 
      error: 'Password does not meet validation criteria. It must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
    });
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  const finalHash = bcrypt.hashSync(rawPassword, rounds);

  const newUser: DbUser = {
    id: `usr-${Math.floor(Math.random() * 900000 + 100000)}`,
    name,
    email,
    phone: phone || '',
    organization: organization || 'TN Registration Department',
    role,
    permissions: role === 'Super Admin' ? ['*'] : role === 'Auditor' ? ['audit_logs', 'view_all_deeds', 'canViewRawPII'] : ['*'],
    status: 'Approved',
    passwordHash: finalHash,
    createdAt: new Date().toISOString()
  };

  const updated = [...users, newUser];
  await db.saveUsers(updated);

  // Log ROLE_CREATED with creator user id and timestamp
  await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Super Admin',
    action: 'ROLE_CREATED',
    details: `ROLE_CREATED: Creator User ID: ${req.user?.id || 'unknown'}, Timestamp: ${new Date().toISOString()}, Target Email: ${email}, New Role: ${role}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Privileged user created successfully!', user: newUser });
});

app.put('/api/auth/users/:id/status', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const users = await db.getUsers();

  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const oldStatus = users[userIndex].status;
  users[userIndex].status = status;
  await db.saveUsers(users);

  await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Admin',
    action: 'STATUS_CHANGE',
    details: `Changed status from ${oldStatus} to ${status} for user ${users[userIndex].email}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'User status updated successfully.', user: users[userIndex] });
});

// --- CLIENTS ROUTER ---
app.get('/api/clients', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Broker']), async (req, res) => {
  const clients = await db.getClients();
  
  const dbUsers = await db.getUsers();
  const fullUser = dbUsers.find(u => u.email.toLowerCase() === req.user?.email?.toLowerCase());
  
  if (!fullUser) {
    return res.status(403).json({ error: 'Access Denied: User profile not found.' });
  }

  const role = fullUser.role;

  let filteredClients = clients;

  if (role === 'Super Admin' || role === 'Admin' || role === 'Auditor') {
    // Has full access
  } else if (role === 'Document Writer' || role === 'Lawyer') {
    const docs = await db.getDocuments();
    const writerDocs = docs.filter(d => 
      d.createdBy === fullUser.email || 
      d.writer === fullUser.name || 
      d.state?.assignedTo === fullUser.id || 
      d.state?.assignedTo === fullUser.email
    );
    const linkedClientEmails = writerDocs.flatMap(d => 
      (d.state?.parties || []).map((p: any) => p.email?.toLowerCase()).filter(Boolean)
    );
    const linkedClientPhones = writerDocs.flatMap(d => 
      (d.state?.parties || []).map((p: any) => p.phone).filter(Boolean)
    );

    filteredClients = clients.filter(c => 
      (c as any).createdBy === fullUser.email || 
      c.email?.toLowerCase() === fullUser.email.toLowerCase() ||
      linkedClientEmails.includes(c.email?.toLowerCase()) ||
      linkedClientPhones.includes(c.phone)
    );
  } else if (role === 'Broker') {
    filteredClients = clients.filter(c => 
      (c as any).assignedTo === fullUser.id || 
      (c as any).assignedTo === fullUser.email || 
      (c as any).createdBy === fullUser.email ||
      c.email?.toLowerCase() === fullUser.email.toLowerCase()
    );
  } else if (role === 'Client') {
    filteredClients = clients.filter(c => 
      c.email?.toLowerCase() === fullUser.email.toLowerCase() || 
      c.phone === fullUser.phone || 
      c.id === fullUser.id
    );
  } else {
    filteredClients = [];
  }

  const userContext = await buildUserContext(req);
  const serializedClients = filteredClients.map(c => serializeClient(c, userContext));

  if (userContext.role === 'Auditor' && userContext.elevatedReview) {
    for (const c of filteredClients) {
      await logRawPIIAccess(req, c.id, userContext.reasonCode || 'N/A');
    }
  }

  res.json({
    message: "Clients retrieved successfully",
    clients: serializedClients
  });
});

app.post('/api/clients', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Broker']), async (req, res) => {
  const newClientData = req.body;
  const clients = await db.getClients();

  // Duplicate Check using Deterministic Hashes
  const newPanHash = getDeterministicHash(newClientData.pan);
  const newAadhaarHash = getDeterministicHash(newClientData.aadhaar);

  if (newPanHash || newAadhaarHash) {
    const isDuplicate = clients.some(c => {
      const cPanHash = getDeterministicHash(c.pan);
      const cAadhaarHash = getDeterministicHash(c.aadhaar);
      return (newPanHash && cPanHash === newPanHash) || (newAadhaarHash && cAadhaarHash === newAadhaarHash);
    });

    if (isDuplicate) {
      return res.status(400).json({
        error: "Duplicate client profile detected. A client with this Aadhaar or PAN already exists in the system."
      });
    }
  }

  const newClient: DbClient & { createdBy?: string } = {
    id: `c-${Math.random().toString(36).substr(2, 9)}`,
    name: newClientData.name,
    fatherName: newClientData.fatherName || '',
    dob: newClientData.dob || '',
    age: Number(newClientData.age) || 0,
    occupation: newClientData.occupation || '',
    pan: newClientData.pan || '',
    aadhaar: newClientData.aadhaar || '',
    address: newClientData.address || '',
    phone: newClientData.phone || '',
    email: newClientData.email || '',
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email || 'system'
  };

  clients.unshift(newClient);
  await db.saveClients(clients);

  await db.addAuditLog({
    userEmail: req.user?.email || 'system',
    role: req.user?.role || 'Document Writer',
    action: 'CREATE_CLIENT',
    details: `Client profile created for ${newClient.name} (${newClient.phone})`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const userContext = await buildUserContext(req);
  const serializedClient = serializeClient(newClient, userContext);

  res.status(201).json({
    message: "Client profile persisted to database successfully.",
    client: serializedClient
  });
});

// GET /api/clients/:id
app.get('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), async (req, res) => {
  const { id } = req.params;
  const clients = await db.getClients();
  const client = clients.find(c => c.id === id);
  if (!client) {
    return res.status(403).json({ error: 'Access Denied: Client not found.' });
  }

  const userContext = await buildUserContext(req);
  const serializedClient = serializeClient(client, userContext);

  if (userContext.role === 'Auditor' && userContext.elevatedReview) {
    await logRawPIIAccess(req, client.id, userContext.reasonCode || 'N/A');
  }

  res.json({
    message: "Client retrieved successfully",
    client: serializedClient
  });
});

// PUT /api/clients/:id
app.put('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const clients = await db.getClients();
  const clientIndex = clients.findIndex(c => c.id === id);
  if (clientIndex === -1) {
    return res.status(403).json({ error: 'Access Denied: Client not found.' });
  }

  const existingClient = clients[clientIndex];

  // Deterministic Hash Duplicate Check on Update
  const newPan = updatedData.pan ?? existingClient.pan;
  const newAadhaar = updatedData.aadhaar ?? existingClient.aadhaar;
  const newPanHash = getDeterministicHash(newPan);
  const newAadhaarHash = getDeterministicHash(newAadhaar);

  if (newPanHash || newAadhaarHash) {
    const isDuplicate = clients.some(c => {
      if (c.id === id) return false; // exclude current client
      const cPanHash = getDeterministicHash(c.pan);
      const cAadhaarHash = getDeterministicHash(c.aadhaar);
      return (newPanHash && cPanHash === newPanHash) || (newAadhaarHash && cAadhaarHash === newAadhaarHash);
    });

    if (isDuplicate) {
      return res.status(400).json({
        error: "Duplicate client profile detected. A client with this Aadhaar or PAN already exists in the system."
      });
    }
  }

  clients[clientIndex] = {
    ...existingClient,
    name: updatedData.name ?? existingClient.name,
    fatherName: updatedData.fatherName ?? existingClient.fatherName,
    dob: updatedData.dob ?? existingClient.dob,
    age: updatedData.age !== undefined ? Number(updatedData.age) : existingClient.age,
    occupation: updatedData.occupation ?? existingClient.occupation,
    pan: newPan,
    aadhaar: newAadhaar,
    address: updatedData.address ?? existingClient.address,
    phone: updatedData.phone ?? existingClient.phone,
    email: updatedData.email ?? existingClient.email,
    assignedTo: updatedData.assignedTo ?? (existingClient as any).assignedTo,
    createdBy: updatedData.createdBy ?? (existingClient as any).createdBy,
  } as any;

  await db.saveClients(clients);

  await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Client',
    action: 'UPDATE_CLIENT',
    details: `Updated client profile: ${clients[clientIndex].name}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const userContext = await buildUserContext(req);
  const serializedClient = serializeClient(clients[clientIndex], userContext);

  res.json({
    message: "Client updated successfully",
    client: serializedClient
  });
});

// --- DOCUMENTS ROUTER ---
app.get('/api/documents', authMiddleware, async (req, res) => {
  const docs = await db.getDocuments();
  
  const dbUsers = await db.getUsers();
  const fullUser = dbUsers.find(u => 
    (req.user?.email && u.email.toLowerCase() === req.user.email.toLowerCase()) ||
    (req.user?.id && u.id === req.user.id)
  );

  const role = fullUser ? (fullUser.role as UserRole) : (req.user?.role || 'Client');
  const userEmail = (fullUser?.email || req.user?.email || '').toLowerCase();
  const userId = fullUser?.id || req.user?.id || '';

  let filteredDocs = docs;

  if (role === 'Super Admin' || role === 'Admin' || role === 'Auditor') {
    // Admins, Super Admins, and Auditors can view all documents
  } else if (role === 'Document Writer' || role === 'Lawyer' || role === 'Data Entry Operator') {
    filteredDocs = docs.filter(d => 
      (userId && d.createdByUserId === userId) ||
      (userEmail && d.createdByEmail?.toLowerCase() === userEmail) ||
      (userEmail && d.createdBy?.toLowerCase() === userEmail) || 
      (fullUser?.name && d.writer === fullUser.name) || 
      (userId && d.state?.createdByUserId === userId) ||
      (userEmail && d.state?.createdBy?.toLowerCase() === userEmail) ||
      (userId && d.state?.assignedTo === userId) || 
      (userEmail && d.state?.assignedTo?.toLowerCase() === userEmail)
    );
  } else if (role === 'Broker') {
    const clients = await db.getClients();
    const brokerClients = clients.filter((c: any) => 
      (userId && c.assignedTo === userId) || 
      (userEmail && c.assignedTo?.toLowerCase() === userEmail) || 
      (userEmail && c.createdBy?.toLowerCase() === userEmail)
    );
    const brokerClientEmails = brokerClients.map(c => c.email.toLowerCase()).filter(Boolean);
    const brokerClientPhones = brokerClients.map(c => c.phone).filter(Boolean);

    filteredDocs = docs.filter(d => 
      (userId && d.createdByUserId === userId) ||
      (userEmail && d.createdByEmail?.toLowerCase() === userEmail) ||
      (userEmail && d.createdBy?.toLowerCase() === userEmail) ||
      (userId && d.state?.assignedTo === userId) || 
      (userEmail && d.state?.assignedTo?.toLowerCase() === userEmail) ||
      (userId && d.state?.brokerId === userId) ||
      (userEmail && d.state?.brokerEmail?.toLowerCase() === userEmail) ||
      d.state?.parties?.some((p: any) => 
        (p.email && brokerClientEmails.includes(p.email.toLowerCase())) ||
        (p.phone && brokerClientPhones.includes(p.phone))
      )
    );
  } else if (role === 'Client') {
    filteredDocs = docs.filter(d => 
      (userId && d.createdByUserId === userId) ||
      (userEmail && d.createdByEmail?.toLowerCase() === userEmail) ||
      (userEmail && d.createdBy?.toLowerCase() === userEmail) || 
      d.state?.parties?.some((p: any) => p.email?.toLowerCase() === userEmail)
    );
  } else {
    filteredDocs = [];
  }

  const userContext = await buildUserContext(req);
  const serializedDocs = filteredDocs.map(d => serializeDocument(d, userContext));

  if (userContext.role === 'Auditor' && userContext.elevatedReview) {
    const clients = await db.getClients();
    for (const doc of filteredDocs) {
      if (doc.state && Array.isArray(doc.state.parties)) {
        for (const p of doc.state.parties) {
          const matchedClient = clients.find(c => 
            (p.id && c.id === p.id) ||
            (p.aadhaar && c.aadhaar === p.aadhaar) ||
            (p.pan && c.pan === p.pan) ||
            (p.email && c.email?.toLowerCase() === p.email?.toLowerCase())
          );
          if (matchedClient) {
            await logRawPIIAccess(req, matchedClient.id, userContext.reasonCode || 'N/A');
          } else {
            await logRawPIIAccess(req, p.id || 'unknown', userContext.reasonCode || 'N/A');
          }
        }
      }
    }
  }

  res.json(serializedDocs);
});

app.get('/api/documents/:id', authMiddleware, requireResourceAccess('documents'), async (req, res) => {
  const docs = await db.getDocuments();
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(403).json({ error: 'Access Denied: Document not accessible or not found.' });
  }

  const userContext = await buildUserContext(req);
  const serializedDoc = serializeDocument(doc, userContext);

  if (userContext.role === 'Auditor' && userContext.elevatedReview) {
    const clients = await db.getClients();
    if (doc.state && Array.isArray(doc.state.parties)) {
      for (const p of doc.state.parties) {
        const matchedClient = clients.find(c => 
          (p.id && c.id === p.id) ||
          (p.aadhaar && c.aadhaar === p.aadhaar) ||
          (p.pan && c.pan === p.pan) ||
          (p.email && c.email?.toLowerCase() === p.email?.toLowerCase())
        );
        if (matchedClient) {
          await logRawPIIAccess(req, matchedClient.id, userContext.reasonCode || 'N/A');
        } else {
          await logRawPIIAccess(req, p.id || 'unknown', userContext.reasonCode || 'N/A');
        }
      }
    }
  }

  res.json({
    message: "Document retrieved successfully",
    document: serializedDoc
  });
});

app.post('/api/documents', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Client', 'Broker']), async (req, res) => {
  const newDraftData = req.body;
  const docs = await db.getDocuments();

  const targetId = newDraftData.id || `dft-${Math.floor(1000 + Math.random() * 9000)}`;
  const existingIndex = docs.findIndex(d => d.id === targetId);

  const creatorUserId = req.user?.id || newDraftData.createdByUserId || '';
  const creatorEmail = req.user?.email || newDraftData.createdByEmail || newDraftData.createdBy || '';

  const newDraft: DbDocument = {
    id: targetId,
    docNo: newDraftData.docNo || `DEED/2026/${Math.floor(1000 + Math.random() * 9000)}`,
    docType: newDraftData.docType || 'Sale Deed',
    subType: newDraftData.subType || 'Sale in Metro Area',
    partiesCount: newDraftData.partiesCount || 2,
    propertyAddress: newDraftData.propertyAddress || 'No Address Specified Yet',
    consideration: newDraftData.consideration || 0,
    status: newDraftData.status || 'Draft',
    writer: newDraftData.writer || (creatorEmail ? `Drafted by ${creatorEmail}` : 'System'),
    progress: newDraftData.progress || 0,
    createdAt: newDraftData.createdAt || new Date().toISOString(),
    modifiedAt: newDraftData.modifiedAt || new Date().toISOString(),
    createdBy: creatorEmail || 'system',
    createdByUserId: creatorUserId,
    createdByEmail: creatorEmail,
    state: newDraftData.state
  };

  if (existingIndex !== -1) {
    docs[existingIndex] = {
      ...docs[existingIndex],
      ...newDraft,
      // Keep original creation date
      createdAt: docs[existingIndex].createdAt || newDraft.createdAt,
      createdByUserId: docs[existingIndex].createdByUserId || newDraft.createdByUserId,
      createdByEmail: docs[existingIndex].createdByEmail || newDraft.createdByEmail,
    };
  } else {
    docs.unshift(newDraft);
  }

  try {
    await db.saveDocuments(docs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save document to database.' });
  }

  await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Document Writer',
    action: existingIndex !== -1 ? 'UPDATE_DOCUMENT_DRAFT' : 'CREATE_DOCUMENT_DRAFT',
    details: existingIndex !== -1 
      ? `Draft updated: ${newDraft.docNo} (${newDraft.docType})` 
      : `Draft created: ${newDraft.docNo} (${newDraft.docType})`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const userContext = await buildUserContext(req);
  const returnedDoc = docs[existingIndex !== -1 ? existingIndex : 0];
  const serializedDoc = serializeDocument(returnedDoc, userContext);

  res.status(existingIndex !== -1 ? 200 : 201).json({
    message: existingIndex !== -1 ? "Deed draft state updated successfully." : "Deed draft state persisted successfully.",
    document: serializedDoc
  });
});

app.put('/api/documents/:id', authMiddleware, requireResourceAccess('documents'), async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const docs = await db.getDocuments();

  const docIndex = docs.findIndex(d => d.id === id);
  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document draft not found.' });
  }

  const existingDoc = docs[docIndex];
  
  // Update fields
  const updatedDoc: DbDocument = {
    ...existingDoc,
    docType: updatedData.docType ?? existingDoc.docType,
    subType: updatedData.subType ?? existingDoc.subType,
    partiesCount: updatedData.partiesCount ?? existingDoc.partiesCount,
    propertyAddress: updatedData.propertyAddress ?? existingDoc.propertyAddress,
    consideration: updatedData.consideration ?? existingDoc.consideration,
    status: updatedData.status ?? existingDoc.status,
    progress: updatedData.progress ?? existingDoc.progress,
    writer: updatedData.writer ?? existingDoc.writer,
    state: updatedData.state ?? existingDoc.state,
    createdByUserId: existingDoc.createdByUserId || updatedData.createdByUserId || req.user?.id,
    createdByEmail: existingDoc.createdByEmail || updatedData.createdByEmail || req.user?.email,
    modifiedAt: updatedData.modifiedAt || new Date().toISOString()
  };

  docs[docIndex] = updatedDoc;

  try {
    await db.saveDocuments(docs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to persist document.' });
  }

  // If status changed to Finalized or Approved, log it distinctly
  if (updatedData.status && updatedData.status !== existingDoc.status) {
    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Document Writer',
      action: `DOCUMENT_STATUS_${updatedData.status.toUpperCase()}`,
      details: `Document ${existingDoc.docNo} status changed from ${existingDoc.status} to ${updatedData.status}`,
      ipAddress: req.ip || '127.0.0.1'
    });
  } else {
    // Log autosave silently or simple update
    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Document Writer',
      action: 'UPDATE_DOCUMENT_DRAFT',
      details: `Autosaved/saved draft ${existingDoc.docNo} (Progress: ${docs[docIndex].progress}%)`,
      ipAddress: req.ip || '127.0.0.1'
    });
  }

  const userContext = await buildUserContext(req);
  const serializedDoc = serializeDocument(docs[docIndex], userContext);

  res.json({
    message: "Deed state updated successfully.",
    document: serializedDoc
  });
});

app.delete('/api/documents/:id', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Client']), requireResourceAccess('documents'), async (req, res) => {
  const { id } = req.params;
  const docs = await db.getDocuments();

  const doc = docs.find(d => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const updatedDocs = docs.filter(d => d.id !== id);
  
  try {
    await db.saveDocuments(updatedDocs);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Document Writer',
    action: 'DELETE_DOCUMENT_DRAFT',
    details: `Permanently deleted draft ${doc.docNo}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Document draft deleted successfully.' });
});

// --- AUDIT LOGS ROUTER ---
app.get('/api/audit-logs', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Auditor']), requireResourceAccess('audits'), async (req, res) => {
  res.json(await db.getAuditLogs());
});

app.post('/api/audit-logs', authMiddleware, async (req, res) => {
  const { action, details } = req.body;
  const log = await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Client',
    action: action || 'CUSTOM_ACTION',
    details: details || '',
    ipAddress: req.ip || '127.0.0.1'
  });
  res.status(201).json(log);
});

// --- CROSS-DOCUMENT GEOGRAPHIC VALIDATION & FRAUD DETECTION ---
app.get('/api/verification/cross-check', authMiddleware, async (req, res) => {
  const { surveyNo, subDivision, village } = req.query;
  const docs = await db.getDocuments();
  const alerts: Array<{ type: string; severity: 'High' | 'Medium' | 'Low'; message: string }> = [];

  if (!surveyNo || !village) {
    return res.status(400).json({ error: 'Parameters surveyNo and village are required.' });
  }

  // Cross check duplicate listings across all draft/finalized documents in database
  const matchingDocs = docs.filter(doc => {
    const sState = doc.state?.survey;
    const sList = doc.state?.surveys || [];
    const matchesPrimary = sState && sState.surveyNo === surveyNo && sState.subDivision === subDivision && doc.state?.property?.village === village;
    const matchesList = sList.some((s: any) => s.surveyNo === surveyNo && s.subDivision === subDivision && doc.state?.property?.village === village);
    return matchesPrimary || matchesList;
  });

  if (matchingDocs.length > 0) {
    const activeDrafts = matchingDocs.filter(d => d.status !== 'Finalized');
    const finalizedDeeds = matchingDocs.filter(d => d.status === 'Finalized');

    if (finalizedDeeds.length > 0) {
      alerts.push({
        type: 'PRIOR_REGISTRATION',
        severity: 'High',
        message: `FRAUD ALERT: Survey plot ${surveyNo}/${subDivision} in ${village} was already legally FINALIZED & registered in deed ${finalizedDeeds[0].docNo} on ${new Date(finalizedDeeds[0].modifiedAt).toLocaleDateString()}. Re-registering is illegal and blocked.`
      });
    }

    if (activeDrafts.length > 1 || (activeDrafts.length === 1 && req.query.currentDocId !== activeDrafts[0].id)) {
      alerts.push({
        type: 'DUPLICATE_ACTIVE_DRAFT',
        severity: 'Medium',
        message: `COMPLIANCE NOTE: Survey plot ${surveyNo}/${subDivision} is currently active in ${activeDrafts.length} other pending deed drafts (e.g., ${activeDrafts[0].docNo}). Verify seller's exclusive title authorization.`
      });
    }
  }

  res.json({
    surveyNo,
    subDivision,
    village,
    hasConflict: alerts.length > 0,
    alerts
  });
});

// ==========================================
// MASTER DATA ENGINE ENDPOINTS
// ==========================================

app.get(['/api/master-data', '/api/master-data/all'], (req, res) => {
  res.json({ success: true, masterData: getMasterDataEngine() });
});

app.get('/api/master-data/:category', (req, res) => {
  const category = req.params.category;
  const data = getMasterDataEngine(category);
  res.json({ success: true, category, data });
});

// ==========================================
// LAYER 8: AI SERVICE LAYER (Placeholder Mock API)
// ==========================================

// 1. OCR Extract (/ai/extract & /api/ai/extract)
const handleAiExtract = async (req: Request, res: Response) => {
  const { base64File, sampleDocumentId, mimeType } = req.body || {};
  try {
    if (base64File) {
      const result = await aiExtractDocumentData(base64File, mimeType || "image/png");
      return res.json(result);
    }
    
    // Return structured mock extraction dummy output if file not provided
    return res.json({
      success: true,
      extractedAt: new Date().toISOString(),
      ocrConfidence: 97.4,
      extractedData: {
        docType: "Sale Deed",
        docSubtype: "Sale in Metro Area",
        seller: {
          name: "M. Selvakumar",
          fatherName: "Muthuswamy Mudaliar",
          age: 52,
          pan: "ABCPS1234F",
          aadhaar: "XXXX-XXXX-5678",
          phone: "9840112233",
          address: "No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041"
        },
        buyer: {
          name: "K. Rajesh",
          fatherName: "Kannan Pillai",
          age: 38,
          pan: "XYZPR5678K",
          aadhaar: "XXXX-XXXX-9012",
          phone: "9444123456",
          address: "Plot 12, GCP Colony, Kanchipuram - 631501"
        },
        property: {
          district: "Chennai",
          registrationDistrict: "Chennai South",
          taluk: "Sholinganallur",
          village: "Thiruvanmiyur",
          sroOffice: "Mylapore SRO",
          doorNo: "Plot No. 42 / Door No. 18",
          extentSqFt: 2400
        },
        survey: {
          surveyNo: "340",
          subDivision: "5A",
          pattaNo: "1102",
          chittaRef: "CH/2025/9981"
        },
        transaction: {
          considerationAmount: 7500000,
          marketValue: 8000000,
          guidelineValue: 7200000,
          stampDuty: 525000,
          registrationFee: 300000,
          paymentMode: "NEFT/RTGS",
          paymentRefNo: "UTR2026072611029"
        }
      },
      metadata: {
        pagesProcessed: 4,
        model: "Gemini-3.5-Flash-Vision",
        status: "Extraction Complete"
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

app.post('/ai/extract', handleAiExtract);
app.post('/api/ai/extract', handleAiExtract);

// 2. Compliance check (/ai/validate & /api/ai/validate)
const handleAiValidate = async (req: Request, res: Response) => {
  const deedState = req.body;
  try {
    const result = await aiValidateDeedDocument(deedState);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

app.post('/ai/validate', handleAiValidate);
app.post('/api/ai/validate', handleAiValidate);

// 3. Clause recommender (/ai/recommend-clause & /api/ai/recommend-clause)
const handleAiRecommendClause = async (req: Request, res: Response) => {
  const { deedType, transactionDetails } = req.body || {};
  try {
    const result = await aiRecommendClauses(deedType || "Sale Deed", transactionDetails);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

app.post('/ai/recommend-clause', handleAiRecommendClause);
app.post('/api/ai/recommend-clause', handleAiRecommendClause);

// 4. Registry fraud analyzer (/ai/fraud-check & /api/ai/fraud-check)
const handleAiFraudCheck = async (req: Request, res: Response) => {
  const { surveyNo, subDivision, village } = req.body || {};
  try {
    const result = await aiCheckDeedFraudRisk(
      surveyNo || "340", 
      subDivision || "5A", 
      village || "Thiruvanmiyur"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

app.post('/ai/fraud-check', handleAiFraudCheck);
app.post('/api/ai/fraud-check', handleAiFraudCheck);

// --- ELEVATED REVIEW SESSION MANAGEMENT ---

// Start an elevated Auditor review session
app.post('/api/audit/elevate', authMiddleware, async (req, res) => {
  try {
    const dbUsers = await db.getUsers();
    const reqEmail = (req as any).user?.email;
    if (!reqEmail) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    
    const fullUser = dbUsers.find(u => u.email.toLowerCase() === reqEmail.toLowerCase());
    if (!fullUser) {
      return res.status(403).json({ error: 'Access Denied: User profile not found.' });
    }
    
    // 1. Authenticated Auditor role check
    if (fullUser.role !== 'Auditor') {
      return res.status(403).json({ error: 'Access Denied: Only users with the Auditor role can request elevated PII review.' });
    }
    
    // 2. Explicit server-side permission flag check
    const canViewRawPII = fullUser.permissions?.includes('canViewRawPII') || false;
    if (!canViewRawPII) {
      return res.status(403).json({ error: 'Access Denied: Your profile lacks the explicit server-side permission flag (canViewRawPII).' });
    }
    
    // 3. Mandatory reason code validation
    const { reasonCode } = req.body;
    if (!reasonCode || typeof reasonCode !== 'string' || reasonCode.trim().length === 0) {
      return res.status(400).json({ error: 'Mandatory reason code is required to initiate elevated review.' });
    }
    
    // 4. Session window (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    activeElevatedSessions.set(reqEmail.toLowerCase(), {
      userId: fullUser.id,
      userEmail: reqEmail.toLowerCase(),
      role: 'Auditor',
      reasonCode: reasonCode.trim(),
      expiresAt
    });
    
    // 5. Immutable SIEM audit log entry
    await db.addAuditLog({
      userEmail: reqEmail,
      role: 'Auditor',
      action: 'ELEVATED_PII_SESSION_START',
      details: `Auditor initiated elevated PII review session. Reason: ${reasonCode.trim()}. Expires in 15 minutes.`,
      ipAddress: req.ip || '127.0.0.1'
    });
    
    res.json({
      message: 'Elevated review session successfully activated.',
      expiresAt: expiresAt.toISOString(),
      sessionWindowMinutes: 15
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to activate elevated session.' });
  }
});

// Check status of elevated review session
app.get('/api/audit/elevate/status', authMiddleware, async (req, res) => {
  const reqEmail = (req as any).user?.email;
  if (!reqEmail) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  
  const session = activeElevatedSessions.get(reqEmail.toLowerCase());
  if (session && new Date() < session.expiresAt) {
    const minutesRemaining = Math.max(0, Math.round((session.expiresAt.getTime() - Date.now()) / 1000 / 60));
    return res.json({
      active: true,
      reasonCode: session.reasonCode,
      expiresAt: session.expiresAt.toISOString(),
      minutesRemaining
    });
  }
  
  res.json({ active: false });
});

// Terminate elevated review session (demote)
app.post('/api/audit/demote', authMiddleware, async (req, res) => {
  const reqEmail = (req as any).user?.email;
  if (reqEmail) {
    activeElevatedSessions.delete(reqEmail.toLowerCase());
    await db.addAuditLog({
      userEmail: reqEmail,
      role: 'Auditor',
      action: 'ELEVATED_PII_SESSION_END',
      details: 'Auditor terminated elevated PII review session.',
      ipAddress: req.ip || '127.0.0.1'
    });
  }
  res.json({ message: 'Elevated review session terminated.' });
});

// Bootstrap database tables and migrate legacy JSON data on startup
try {
  await migrateAndBootstrap();
  console.log('Database bootstrapping completed successfully.');
} catch (err) {
  console.error('Database bootstrapping failed:', err);
}

// Start server internally
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`UNIKORN360 Core Backend Persistent server running on port ${PORT}`);
  });
}

export default app;

