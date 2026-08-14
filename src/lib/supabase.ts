import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { UserAccount, UserRole } from '../types';

// Environment variable retrieval with safe fallback
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://mock-placeholder.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key-placeholder';

export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL && 
  env.VITE_SUPABASE_ANON_KEY &&
  env.VITE_SUPABASE_URL !== 'https://mock-placeholder.supabase.co'
);

// Explicit Super Admin account allowlist (no substring matching)
export const SUPER_ADMIN_EMAILS: string[] = [
  'clearfile360@gmail.com',
  'raj.asusrog@gmail.com'
];

// Centralized Supabase client instance
// (VITE_SUPABASE_ANON_KEY only - SERVICE_ROLE_KEY is strictly backend-only)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'deedos360_supabase_auth_token'
  }
});

/**
 * Initiate Supabase Google OAuth Flow
 */
export async function signInWithGoogleOAuth() {
  if (!isSupabaseConfigured) {
    console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Simulating development OAuth authentication.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error('Supabase Google OAuth error:', error);
    throw error;
  }

  return data;
}

/**
 * Sign out current Supabase user
 */
export async function signOutSupabase() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase signOut caught error:', err);
  }
}

/**
 * Get active session safely
 */
export async function getActiveSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Error retrieving Supabase session:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.warn('getActiveSession exception:', err);
    return null;
  }
}

/**
 * Maps a Supabase Auth User object to canonical DeedOS360 UserAccount
 */
export function mapSupabaseUserToUserAccount(
  sbUser: User, 
  customProfile?: Partial<UserAccount> | null
): UserAccount {
  const email = (sbUser.email || '').trim().toLowerCase();
  const rawEmail = sbUser.email || 'user@unikorn.com';
  const name = sbUser.user_metadata?.full_name || 
               sbUser.user_metadata?.name || 
               rawEmail.split('@')[0] || 
               'User';
  const photo = sbUser.user_metadata?.avatar_url || 
                sbUser.user_metadata?.picture || 
                '';

  // Strict role resolution via exact allowlist
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
                            
  const assignedRole: UserRole = isSuperAdmin 
    ? 'Super Admin' 
    : (customProfile?.role || 'Document Writer');

  const assignedStatus = isSuperAdmin 
    ? 'Approved' 
    : (customProfile?.status || 'Approved');

  return {
    id: sbUser.id,
    uid: sbUser.id,
    name: customProfile?.name || name,
    email: rawEmail,
    photo: customProfile?.photo || photo,
    phone: customProfile?.phone || sbUser.phone || '',
    organization: customProfile?.organization || 'UNIKORN360 DEED360',
    role: assignedRole,
    status: assignedStatus,
    createdAt: sbUser.created_at || new Date().toISOString()
  };
}

/**
 * Helper to retrieve role of current user
 */
export function getCurrentUserRole(user: UserAccount | null): UserRole {
  return user?.role || 'Client';
}
