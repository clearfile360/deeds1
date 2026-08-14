/**
 * ============================================================================
 * LEGACY FIREBASE COMPATIBILITY MODULE
 * ============================================================================
 * Retained for backward compatibility during Supabase Auth & PostgreSQL migration.
 * Do NOT use this for primary authentication in Phase 1+.
 * Canonical Auth is handled by: src/lib/supabase.ts
 * ============================================================================
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  addDoc 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, UserRole } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId) 
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
  return errInfo;
}

// Custom Google Sign-In helper
export async function loginWithGoogle() {
  try {
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    const result = await signInWithPopup(auth, googleProvider);
    return {
      success: true,
      user: result.user
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, 'auth/google');
    return {
      success: false,
      error: error?.message || 'Google authentication failed'
    };
  }
}

// Fetch user profile document from Firestore
export async function getUserProfileFromFirestore(uid: string): Promise<UserAccount | null> {
  if (!auth.currentUser) return null;
  const pathForGetDoc = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGetDoc);
    return null;
  }
}

// Sync or provision Google Auth user to Firestore
export async function syncUserProfileToFirestore(fbUser: FirebaseUser): Promise<UserAccount> {
  const uid = fbUser.uid;
  const email = fbUser.email || 'user@unikorn.com';
  const name = fbUser.displayName || email.split('@')[0] || 'User';
  const photo = fbUser.photoURL || '';

  const existing = await getUserProfileFromFirestore(uid);
  if (existing) {
    return existing;
  }

  const isSuperAdminEmail = email.toLowerCase().includes('admin') || email.toLowerCase() === 'raj.asusrog@gmail.com';
  const initialRole: UserRole = isSuperAdminEmail ? 'Super Admin' : 'Client';
  const initialStatus = isSuperAdminEmail ? 'Approved' : 'Pending Approval';

  const newUser: UserAccount = {
    id: uid,
    uid: uid,
    name: name,
    email: email,
    photo: photo,
    phone: fbUser.phoneNumber || '',
    organization: 'UNIKORN360 DEED360',
    role: initialRole,
    status: initialStatus,
    createdAt: new Date().toISOString()
  };

  const pathForWrite = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, newUser);
    await addAuditLogToFirestore(
      'register',
      `Auto-provisioned Google profile for ${email} with role ${initialRole} (Status: ${initialStatus})`,
      email
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }

  return newUser;
}

// Admin: Update user role in Firestore
export async function updateUserRoleInFirestore(uid: string, newRole: UserRole) {
  const pathForUpdate = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, pathForUpdate);
  }
}

// Admin: Update user status in Firestore
export async function updateUserStatusInFirestore(uid: string, newStatus: 'Approved' | 'Pending Approval' | 'Suspended') {
  const pathForUpdate = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status: newStatus });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, pathForUpdate);
  }
}

// Fetch all registered users from Firestore
export async function getAllUsersFromFirestore(): Promise<UserAccount[]> {
  if (!auth.currentUser) {
    return [];
  }
  const pathForGetDocs = 'users';
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const usersList: UserAccount[] = [];
    snap.forEach((d) => {
      usersList.push(d.data() as UserAccount);
    });
    return usersList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathForGetDocs);
    return [];
  }
}

// Audit logs Firestore helpers
export async function addAuditLogToFirestore(type: string, message: string, userEmail: string) {
  if (!auth.currentUser) {
    return;
  }
  const pathForWrite = 'audit_logs';
  try {
    const logsCol = collection(db, 'audit_logs');
    await addDoc(logsCol, {
      timestamp: new Date().toISOString(),
      type: type,
      message: message,
      userEmail: userEmail,
      ip: '157.45.109.112',
      device: 'Desktop',
      browser: 'Google Chrome'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, pathForWrite);
  }
}

export async function getAuditLogsFromFirestore() {
  if (!auth.currentUser) {
    return [];
  }
  const pathForGetDocs = 'audit_logs';
  try {
    const logsCol = collection(db, 'audit_logs');
    const q = query(logsCol, orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    const logs: any[] = [];
    snap.forEach(d => {
      logs.push({ id: d.id, ...d.data() });
    });
    return logs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathForGetDocs);
    return [];
  }
}

export { signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
