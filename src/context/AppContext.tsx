import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  UserAccount, 
  UserRole, 
  ClientProfile, 
  DeedWizardState, 
  SavedDraft, 
  AuditLog, 
  SystemNotification, 
  DraftStatus,
  getRoleAllowedTabs 
} from '../types';
import { 
  DUMMY_CLIENTS, 
  DRAFT_DEEDS, 
  DUMMY_NOTIFICATIONS 
} from '../utils/dummyData';
import { 
  supabase, 
  isSupabaseConfigured,
  signInWithGoogleOAuth, 
  signOutSupabase, 
  getActiveSession, 
  mapSupabaseUserToUserAccount,
  SUPER_ADMIN_EMAILS
} from '../lib/supabase';
// Retained legacy Firebase helpers for backward compatibility with Firestore persistence (non-active authority)
import { 
  loginWithGoogle, 
  getUserProfileFromFirestore, 
  syncUserProfileToFirestore, 
  updateUserRoleInFirestore, 
  updateUserStatusInFirestore, 
  getAllUsersFromFirestore, 
  addAuditLogToFirestore, 
  getAuditLogsFromFirestore 
} from '../utils/firebase';

interface AppContextType {
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  simulationRole: UserRole | null;
  setSimulationRole: (role: UserRole | null) => void;
  effectiveRole: UserRole;
  authLoading: boolean;
  loginWithGoogleHandler: () => Promise<{ success: boolean; message: string; user?: UserAccount }>;
  logoutUser: () => Promise<void>;
  auditLogs: AuditLog[];
  refreshAuditLogs: () => Promise<void>;
  usersList: UserAccount[];
  refreshUsersList: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  updateUserStatus: (userId: string, newStatus: 'Approved' | 'Pending Approval' | 'Suspended') => Promise<void>;
  syncDatabase: () => Promise<void>;
  
  savedDrafts: SavedDraft[];
  currentDraft: SavedDraft | null;
  activeStep: number;
  setActiveStep: (step: number) => void;
  autosaveStatus: 'Saving...' | 'Saved' | 'Saved (Local only)' | 'Save Failed' | null;
  clients: ClientProfile[];
  notifications: SystemNotification[];
  
  // Tab Routing
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // CRUD Operations
  createDraft: (docType: string, subType: string) => SavedDraft;
  loadDraft: (id: string) => void;
  updateCurrentDraftState: (state: DeedWizardState) => void;
  saveDraftManual: () => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  duplicateDraft: (id: string) => SavedDraft;
  updateDraftStatus: (id: string, status: DraftStatus) => Promise<void>;
  
  // Clients CRUD
  addClient: (client: ClientProfile) => Promise<void>;
  
  // Helper validations
  getStepCompletionStates: (state: DeedWizardState) => boolean[];
  calculateProgress: (state: DeedWizardState) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default blank wizard state helper
export const createDefaultState = (docType = 'SALE', subType = 'SALE_METRO'): DeedWizardState => {
  return {
    documentType: docType,
    documentSubtype: subType,
    parties: [
      {
        id: 'p1',
        role: docType === 'GIFT' ? 'Donor' : 'Seller',
        name: '',
        fatherName: '',
        dob: '',
        age: 0,
        occupation: '',
        aadhaar: '',
        pan: '',
        phone: '',
        email: '',
        address: ''
      },
      {
        id: 'p2',
        role: docType === 'GIFT' ? 'Donee' : 'Buyer',
        name: '',
        fatherName: '',
        dob: '',
        age: 0,
        occupation: '',
        aadhaar: '',
        pan: '',
        phone: '',
        email: '',
        address: ''
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai South',
      taluk: '',
      village: '',
      ward: '',
      block: '',
      propertyType: docType === 'LEASE' ? 'Commercial Building' : 'Residential Plot / Land',
      sro: '',
      doorNo: ''
    },
    survey: {
      surveyNo: '',
      subDivision: '',
      pattaNo: '',
      tslrNo: '',
      chittaRef: ''
    },
    surveys: [
      {
        surveyNo: '',
        subDivision: '',
        pattaNo: '',
        tslrNo: '',
        chittaRef: ''
      }
    ],
    extent: {
      sqft: 0,
      acre: 0,
      cent: 0,
      hectare: 0,
      areaUnit: 'Sq.ft',
      totalExtent: 0,
      eastWest: '',
      northSouth: '',
      builtUpArea: 0,
      uds: 0
    },
    boundary: {
      east: '',
      west: '',
      north: '',
      south: ''
    },
    ownershipHistory: {
      parentDocType: 'Sale Deed',
      parentDocNo: '',
      parentDocYear: '',
      parentDocSRO: '',
      parentDocDate: '',
      priorOwners: '',
      historyNarrative: ''
    },
    transaction: {
      marketValue: 0,
      guidelineValue: 0,
      considerationAmount: 0,
      advancePaid: 0,
      balancePaid: 0,
      paymentMode: 'NEFT/RTGS',
      paymentRefNo: '',
      paymentDate: '',
      bankName: ''
    },
    witnesses: [
      {
        id: 'w1',
        name: '',
        fatherName: '',
        age: 0,
        aadhaar: '',
        idProof: '',
        address: '',
        phone: '',
        occupation: ''
      },
      {
        id: 'w2',
        name: '',
        fatherName: '',
        age: 0,
        aadhaar: '',
        idProof: '',
        address: '',
        phone: '',
        occupation: ''
      }
    ],
    selectedClauses: ['cl1', 'cl2', 'cl3']
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state management - starts in loading state until Supabase session is verified
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const cached = localStorage.getItem('unikorn_authenticated_user');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [simulationRole, setSimulationRole] = useState<UserRole | null>(() => {
    return localStorage.getItem('unikorn_simulation_role') as UserRole | null;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  // Derived effective role
  const effectiveRole: UserRole = simulationRole || currentUser?.role || 'Client';

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [currentDraft, setCurrentDraft] = useState<SavedDraft | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'Saving...' | 'Saved' | 'Saved (Local only)' | 'Save Failed' | null>(null);
  
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>(DUMMY_CLIENTS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(DUMMY_NOTIFICATIONS);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutosavingRef = useRef<boolean>(false);

  /**
   * User-scoped storage helpers for isolation across accounts
   */
  const getUserDraftsStorageKey = (user?: UserAccount | null): string => {
    const targetUser = user !== undefined ? user : currentUser;
    const uid = targetUser?.id || targetUser?.uid;
    if (uid) {
      return `unikorn360_saved_drafts_${uid}`;
    }
    const email = targetUser?.email;
    if (email) {
      return `unikorn360_saved_drafts_${email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    return `unikorn360_saved_drafts_anonymous`;
  };

  const loadLocalDraftsForUser = (user?: UserAccount | null): SavedDraft[] => {
    const key = getUserDraftsStorageKey(user);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((d: any) => d && d.id);
        }
      }
    } catch (e) {
      console.warn("Failed to read user drafts from localStorage:", e);
    }
    return [];
  };

  const saveUserDraftsToDisk = (draftsList: SavedDraft[], user?: UserAccount | null): boolean => {
    const key = getUserDraftsStorageKey(user);
    try {
      localStorage.setItem(key, JSON.stringify(draftsList));
      return true;
    } catch (e) {
      console.error("Failed to write drafts to user storage key", key, e);
      return false;
    }
  };

  const mergeDraftsDeterministic = (localDrafts: SavedDraft[], remoteDrafts: SavedDraft[]): SavedDraft[] => {
    const draftMap = new Map<string, SavedDraft>();

    // Insert remote drafts first
    for (const doc of remoteDrafts) {
      if (doc && doc.id) {
        draftMap.set(doc.id, doc);
      }
    }

    // Merge local drafts, using newer modifiedAt
    for (const localDoc of localDrafts) {
      if (!localDoc || !localDoc.id) continue;
      if (!draftMap.has(localDoc.id)) {
        draftMap.set(localDoc.id, localDoc);
      } else {
        const remoteDoc = draftMap.get(localDoc.id)!;
        const localTime = new Date(localDoc.modifiedAt || localDoc.createdAt || 0).getTime();
        const remoteTime = new Date(remoteDoc.modifiedAt || remoteDoc.createdAt || 0).getTime();
        if (localTime >= remoteTime) {
          draftMap.set(localDoc.id, localDoc);
        }
      }
    }

    return Array.from(draftMap.values());
  };

  /**
   * Safe asynchronous Supabase session token retrieval for API headers
   */
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    let token = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {
      console.warn('Notice: Failed to fetch active Supabase session token:', e);
    }

    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'x-user-id': currentUser?.id || currentUser?.uid || '',
      'x-user-email': currentUser?.email || '',
      'x-user-role': effectiveRole || 'Client'
    };
  };

  // Sync with Firestore & backend
  const refreshAuditLogs = async () => {
    try {
      const logs = await getAuditLogsFromFirestore();
      if (logs && logs.length > 0) {
        setAuditLogs(logs);
      }
    } catch (e) {
      console.warn('Notice: Firestore audit logs fetch handled gracefully.');
    }
  };

  const refreshUsersList = async () => {
    try {
      // 1. Try Firestore first if available
      const fbUsers = await getAllUsersFromFirestore();
      if (fbUsers && fbUsers.length > 0) {
        setUsersList(fbUsers);
        return;
      }

      // 2. Try backend API with auth headers
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/auth/users', { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: UserAccount[] = data.map((u: any) => ({
              id: u.id,
              uid: u.id,
              name: u.name,
              email: u.email,
              phone: u.phone || '',
              organization: u.organization || 'UNIKORN360 DEED360',
              role: u.role as UserRole,
              status: u.status as any,
              photo: u.photo || '',
              createdAt: u.createdAt || u.created_at || new Date().toISOString()
            }));
            setUsersList(mapped);
            return;
          }
        }
      } catch (err) {
        // Backend users endpoint may be restricted for non-admin roles
      }
    } catch (e) {
      console.warn('Notice: Users list fetch handled gracefully:', e);
    }
  };

  // Sync everything on user role / change
  const syncDatabase = async () => {
    try {
      await refreshAuditLogs();
      await refreshUsersList();
      
      const headers = await getAuthHeaders();

      // Step 1: Ensure current user local drafts are loaded
      const currentLocal = loadLocalDraftsForUser(currentUser);
      if (currentLocal.length > 0) {
        setSavedDrafts(currentLocal);
      }

      // Step 2: Sync Documents with remote backend API
      try {
        const docRes = await fetch('/api/documents', { headers });
        if (docRes.ok) {
          const remoteDocsRaw = await docRes.json();
          const remoteDocs = Array.isArray(remoteDocsRaw) 
            ? remoteDocsRaw.filter((d: any, index: number, self: any[]) => d && d.id && self.findIndex((t: any) => t.id === d.id) === index)
            : [];
          
          // Deterministic merge
          const merged = mergeDraftsDeterministic(currentLocal, remoteDocs);
          setSavedDrafts(merged);
          saveUserDraftsToDisk(merged, currentUser);

          // Push any local-only or newer local drafts up to backend
          for (const draft of merged) {
            const remoteDoc = remoteDocs.find((r: any) => r.id === draft.id);
            if (!remoteDoc) {
              fetch('/api/documents', {
                method: 'POST',
                headers,
                body: JSON.stringify(draft)
              }).catch(e => console.warn('Background draft push notice:', e));
            } else {
              const localTime = new Date(draft.modifiedAt || draft.createdAt || 0).getTime();
              const remoteTime = new Date(remoteDoc.modifiedAt || remoteDoc.createdAt || 0).getTime();
              if (localTime > remoteTime) {
                fetch(`/api/documents/${draft.id}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify(draft)
                }).catch(e => console.warn('Background draft update notice:', e));
              }
            }
          }
        } else {
          // If remote fails, DO NOT clear drafts! Keep local drafts intact.
          console.warn(`Remote /api/documents returned ${docRes.status}, keeping local user drafts intact.`);
        }
      } catch (err) {
        // Network error - KEEP local drafts intact
        console.warn('Network failure accessing /api/documents, keeping local user drafts intact:', err);
      }

      // Sync Clients
      try {
        const clientRes = await fetch('/api/clients', { headers });
        if (clientRes.ok) {
          const data = await clientRes.json();
          if (data.clients && data.clients.length > 0) {
            const uniqueClients = Array.isArray(data.clients)
              ? data.clients.filter((c: any, index: number, self: any[]) => c && c.id && self.findIndex((t: any) => t.id === c.id) === index)
              : [];
            setClients(uniqueClients);
            localStorage.setItem('unikorn360_clients', JSON.stringify(uniqueClients));
          } else {
            // Seed clients to backend
            const localClientsRaw = localStorage.getItem('unikorn360_clients');
            const localClients = localClientsRaw ? JSON.parse(localClientsRaw) : DUMMY_CLIENTS;
            const uniqueLocal = Array.isArray(localClients)
              ? localClients.filter((c: any, index: number, self: any[]) => c && c.id && self.findIndex((t: any) => t.id === c.id) === index)
              : [];
            setClients(uniqueLocal);
            for (const c of uniqueLocal) {
              await fetch('/api/clients', {
                method: 'POST',
                headers,
                body: JSON.stringify(c)
              });
            }
          }
        }
      } catch (err) {
        console.warn("Client sync network error:", err);
      }
    } catch (e) {
      console.warn('Notice: Database sync handled gracefully:', e);
    }
  };

  /**
   * Explicit Supabase Authentication Initialization Flow
   * (Supabase Auth is the ONLY active authority)
   */
  useEffect(() => {
    let isMounted = true;

    const initializeSupabaseAuth = async () => {
      try {
        // Step 1: Query initial session from Supabase client
        const session = await getActiveSession();
        if (isMounted) {
          if (session?.user) {
            const profile = mapSupabaseUserToUserAccount(session.user);
            setCurrentUser(profile);
            localStorage.setItem('unikorn_authenticated_user', JSON.stringify(profile));
            const userDrafts = loadLocalDraftsForUser(profile);
            setSavedDrafts(userDrafts);
          } else {
            // Check if there is a cached user profile
            const cached = localStorage.getItem('unikorn_authenticated_user');
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                setCurrentUser(parsed);
                const userDrafts = loadLocalDraftsForUser(parsed);
                setSavedDrafts(userDrafts);
              } catch (e) {
                setCurrentUser(null);
                setSavedDrafts([]);
              }
            } else {
              setCurrentUser(null);
              setSavedDrafts([]);
            }
          }
        }
      } catch (err) {
        console.warn('Auth initialization getSession warning:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeSupabaseAuth();

    // Step 2: Subscribe to Supabase Auth State Changes (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          const profile = mapSupabaseUserToUserAccount(session.user);
          setCurrentUser(profile);
          localStorage.setItem('unikorn_authenticated_user', JSON.stringify(profile));
          const userDrafts = loadLocalDraftsForUser(profile);
          setSavedDrafts(userDrafts);
        }
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentDraft(null);
        setSavedDrafts([]);
        setSimulationRole(null);
        localStorage.removeItem('unikorn_authenticated_user');
        localStorage.removeItem('unikorn_simulation_role');
        localStorage.removeItem('deedos360_supabase_auth_token');
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync database only after auth initialization is complete and a valid user exists
  useEffect(() => {
    if (!authLoading && currentUser) {
      syncDatabase().catch(err => {
        console.warn('Background database synchronization notice:', err);
      });
    }
  }, [authLoading, currentUser, effectiveRole]);

  // Handle active tab protection and defaults based on role change
  useEffect(() => {
    if (currentUser) {
      const allowed = getRoleAllowedTabs(effectiveRole);
      // If active tab is not allowed for the new role, switch to the first allowed tab
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0] || 'dashboard');
      }
    }
  }, [effectiveRole, currentUser]);

  // Validation function to track completion status for each step
  const getStepCompletionStates = (state: DeedWizardState): boolean[] => {
    const states = Array(11).fill(false);
    
    try {
      // Step 1: Doc Type
      states[0] = !!state.documentType;

      // Step 2: Parties
      states[1] = state.parties.length >= 2 && state.parties.every(party => 
        party.name?.trim() && 
        party.fatherName?.trim() && 
        party.age >= 18 && 
        party.aadhaar?.trim() && 
        party.pan?.trim() && 
        party.phone?.trim() && 
        party.address?.trim()
      );

      // Step 3: Property Details
      states[2] = !!(
        state.property.district && 
        state.property.registrationDistrict && 
        state.property.taluk && 
        state.property.village && 
        state.property.sro && 
        state.property.doorNo?.trim()
      );

      // Step 4: Survey Details
      const surveysToValidate = state.surveys && state.surveys.length > 0 ? state.surveys : [state.survey];
      states[3] = surveysToValidate.length > 0 && surveysToValidate.every(s => 
        s.surveyNo?.trim() && 
        s.subDivision?.trim() && 
        s.pattaNo?.trim() && 
        s.chittaRef?.trim()
      );

      // Step 5: Extent Details
      const totalExtent = state.extent.totalExtent || state.extent.sqft;
      states[4] = !!(
        totalExtent > 0 && 
        state.extent.eastWest?.trim() && 
        state.extent.northSouth?.trim()
      );

      // Step 6: Boundary Details
      states[5] = !!(
        state.boundary.east?.trim() && 
        state.boundary.west?.trim() && 
        state.boundary.north?.trim() && 
        state.boundary.south?.trim()
      );

      // Step 7: Ownership History
      states[6] = !!(
        state.ownershipHistory.parentDocNo?.trim() && 
        state.ownershipHistory.parentDocYear?.trim() && 
        state.ownershipHistory.parentDocDate?.trim() && 
        state.ownershipHistory.parentDocSRO?.trim() && 
        state.ownershipHistory.priorOwners?.trim()
      );

      // Step 8: Transaction Details
      states[7] = state.documentType === 'GIFT' 
        ? true 
        : !!(
            state.transaction.considerationAmount > 0 && 
            state.transaction.paymentRefNo?.trim()
          );

      // Step 9: Witness Details
      states[8] = state.witnesses.length >= 2 && state.witnesses.every(w => 
        w.name?.trim() && 
        w.fatherName?.trim() && 
        w.age >= 18 && 
        (w.idProof?.trim() || w.aadhaar?.trim()) && 
        w.address?.trim()
      );

      // Step 10: Selected Clauses
      states[9] = state.selectedClauses.length > 0;

      // Step 11: Review is always complete if we reached here
      states[10] = true;

    } catch (err) {
      console.error("Step validation crashed", err);
    }

    return states;
  };

  // Calculate overall completeness percentage based on 11 steps
  const calculateProgress = (state: DeedWizardState): number => {
    const states = getStepCompletionStates(state);
    const completed = states.filter(Boolean).length;
    return Math.round((completed / 11) * 100);
  };

  // Save drafts when changed
  const saveAllDraftsToDisk = (draftsList: SavedDraft[]) => {
    return saveUserDraftsToDisk(draftsList, currentUser);
  };

  // Supabase Auth with Google OAuth
  const loginWithGoogleHandler = async () => {
    try {
      if (isSupabaseConfigured) {
        await signInWithGoogleOAuth();
        return { success: true, message: 'Redirecting to Google Sign-In via Supabase...' };
      } else {
        // Fallback for local sandbox testing if Supabase cloud keys are not yet configured:
        const devUser: UserAccount = {
          id: 'sb-usr-dev-' + Date.now().toString(36),
          uid: 'sb-usr-dev-' + Date.now().toString(36),
          name: 'Super Admin',
          email: 'raj.asusrog@gmail.com',
          photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          phone: '9840123456',
          organization: 'UNIKORN360 DEED360',
          role: 'Super Admin',
          status: 'Approved',
          createdAt: new Date().toISOString()
        };
        setCurrentUser(devUser);
        setSimulationRole(null);
        localStorage.removeItem('unikorn_simulation_role');
        localStorage.setItem('unikorn_authenticated_user', JSON.stringify(devUser));
        await refreshUsersList();
        return { success: true, message: 'Google Authentication Successful', user: devUser };
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      return { success: false, message: err?.message || 'Google Authentication failed.' };
    }
  };

  const logoutUser = async () => {
    try {
      await signOutSupabase();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setCurrentUser(null);
    setSimulationRole(null);
    localStorage.removeItem('unikorn_authenticated_user');
    localStorage.removeItem('unikorn_simulation_role');
    localStorage.removeItem('deedos360_supabase_auth_token');
    setActiveTab('dashboard');
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: newRole })
      });
      await updateUserRoleInFirestore(userId, newRole);
    } catch (e) {
      console.warn("Backend user role update bypassed:", e);
    }

    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    if (currentUser && currentUser.id === userId) {
      const updated = { ...currentUser, role: newRole };
      setCurrentUser(updated);
      localStorage.setItem('unikorn_authenticated_user', JSON.stringify(updated));
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'Approved' | 'Pending Approval' | 'Suspended') => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/auth/users/${userId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      await updateUserStatusInFirestore(userId, newStatus);
    } catch (e) {
      console.warn("Backend user status update bypassed:", e);
    }

    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    if (currentUser && currentUser.id === userId) {
      const updated = { ...currentUser, status: newStatus };
      setCurrentUser(updated);
      localStorage.setItem('unikorn_authenticated_user', JSON.stringify(updated));
    }
  };

  // Populate Default Dummies
  const loadDefaultDummies = () => {
    const defaultState = createDefaultState('SALE', 'SALE_METRO');
    const dft1State: DeedWizardState = {
      ...defaultState,
      selectedClauses: ['cl1', 'cl2', 'cl3', 'cl4', 'cl5']
    };
    const dft2State: DeedWizardState = {
      ...defaultState,
      selectedClauses: ['cl1', 'cl2', 'cl3', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11']
    };

    const finalDummies: SavedDraft[] = DRAFT_DEEDS.map((deed: any) => {
      let docState = defaultState;
      if (deed.id === 'dft1') docState = dft1State;
      if (deed.id === 'dft2') docState = dft2State;
      
      return {
        id: deed.id,
        docNo: deed.docNo,
        docType: deed.docType,
        subType: deed.subType,
        partiesCount: deed.partiesCount,
        propertyAddress: deed.propertyAddress,
        consideration: deed.consideration,
        status: deed.status as DraftStatus,
        writer: deed.writer,
        progress: deed.progress,
        createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
        modifiedAt: new Date(deed.date).toISOString(),
        createdBy: currentUser?.email || 'system',
        state: docState
      };
    });

    setSavedDrafts(finalDummies);
    saveAllDraftsToDisk(finalDummies);
  };

  // Periodic autosave triggers every 30s if currentDraft is active
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentDraft && !isAutosavingRef.current) {
        autosaveCurrentDraft();
      }
    }, 30000);
    
    return () => clearInterval(timer);
  }, [currentDraft]);

  // Handle auto-saving state with visual indicator
  const autosaveCurrentDraft = () => {
    if (!currentDraft) return;
    
    isAutosavingRef.current = true;
    setAutosaveStatus('Saving...');
    
    setTimeout(async () => {
      try {
        const updatedProgress = calculateProgress(currentDraft.state);
        const updatedDraft = {
          ...currentDraft,
          progress: updatedProgress,
          modifiedAt: new Date().toISOString()
        };
        
        // Save to backend
        try {
          const headers = await getAuthHeaders();
          await fetch(`/api/documents/${updatedDraft.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updatedDraft)
          });
        } catch (e) {
          console.error("Backend autosave failed, falling back to local only", e);
        }

        setSavedDrafts(prev => {
          const list = prev.map(d => d.id === updatedDraft.id ? updatedDraft : d);
          saveAllDraftsToDisk(list);
          return list;
        });
        
        setAutosaveStatus('Saved');
        isAutosavingRef.current = false;
        
        // Clear saved indicator after 3 seconds
        setTimeout(() => {
          setAutosaveStatus(prev => prev === 'Saved' ? null : prev);
        }, 3000);

      } catch (err) {
        console.error("Autosave failed", err);
        setAutosaveStatus('Save Failed');
        isAutosavingRef.current = false;
      }
    }, 800);
  };

  // Trigger autosave when major changes occur in active draft
  const triggerAutosaveDebounced = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setAutosaveStatus('Saving...');
    autosaveTimerRef.current = setTimeout(() => {
      autosaveCurrentDraft();
    }, 1500);
  };

  // CRUD: Create Draft
  const createDraft = (docType: string, subType: string): SavedDraft => {
    const uniqueId = `dft-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomRef = `DEED/2026/${Math.floor(1000 + Math.random() * 9000)}`;
    
    const docTypeLabel = docType === 'SALE' ? 'Sale Deed' 
      : docType === 'GIFT' ? 'Gift Settlement Deed'
      : docType === 'SETTLE' ? 'Family Settlement Deed'
      : docType === 'PARTITION' ? 'Partition Deed'
      : docType === 'LEASE' ? 'Lease Deed'
      : 'Mortgage Deed';

    const subTypeLabel = subType === 'SALE_METRO' ? 'Sale in Metro Area'
      : subType === 'SALE_PANCHAYAT' ? 'Sale in Panchayat Area'
      : subType === 'GIFT_FAMILY' ? 'Gift to Family Member'
      : 'Residential Lease';

    const newState = createDefaultState(docType, subType);
    
    const newDraft: SavedDraft = {
      id: uniqueId,
      docNo: randomRef,
      docType: docTypeLabel,
      subType: subTypeLabel,
      partiesCount: 2,
      propertyAddress: 'No Address Specified Yet',
      consideration: docType === 'LEASE' ? 25000 : 500000,
      status: 'Draft',
      writer: `Drafted by ${currentUser?.name || currentUser?.email || 'Licensed Writer'}`,
      progress: 0,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      createdBy: currentUser?.email || 'unknown',
      state: newState
    };

    setSavedDrafts(prev => {
      const list = [newDraft, ...prev];
      saveAllDraftsToDisk(list);
      return list;
    });

    // POST to backend
    getAuthHeaders().then(headers => {
      fetch('/api/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDraft)
      }).catch(err => console.error("Error creating draft on backend:", err));
    });

    // Automatically load it
    setCurrentDraft(newDraft);
    setActiveStep(1);
    setActiveTab('wizard');

    // Add notification
    const newNotif: SystemNotification = {
      id: `n-${Date.now()}`,
      title: 'New Draft Created',
      message: `Started new ${docTypeLabel} draft ${randomRef}. Complete all 11 wizard steps to generate registration deed.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

    return newDraft;
  };

  // CRUD: Load existing draft
  const loadDraft = (id: string) => {
    const draft = savedDrafts.find(d => d.id === id);
    if (draft) {
      setCurrentDraft(draft);
      setActiveStep(1);
      setActiveTab('wizard');
    } else {
      alert(`Draft with ID ${id} was not found.`);
    }
  };

  // CRUD: Update state of current draft
  const updateCurrentDraftState = (newState: DeedWizardState) => {
    if (!currentDraft) return;
    
    const partiesCount = newState.parties.length;
    
    // Address format
    let propertyAddress = 'No Address Specified Yet';
    if (newState.property.doorNo || newState.property.village) {
      propertyAddress = `${newState.property.doorNo || ''}, ${newState.property.village || ''}, ${newState.property.taluk || ''} Taluk, ${newState.property.district || ''}`.replace(/^,\s*/, '');
    }

    // Consideration amount
    const consideration = newState.transaction.considerationAmount || 0;

    const updatedDraft: SavedDraft = {
      ...currentDraft,
      partiesCount,
      propertyAddress,
      consideration,
      state: newState,
      modifiedAt: new Date().toISOString()
    };

    setCurrentDraft(updatedDraft);
    
    // Trigger Debounced Autosave
    triggerAutosaveDebounced();
  };

  // CRUD: Manual save draft
  const saveDraftManual = async () => {
    if (!currentDraft) {
      alert('No active drafting session found.');
      return;
    }

    setAutosaveStatus('Saving...');
    
    try {
      const updatedProgress = calculateProgress(currentDraft.state);
      const updatedDraft = {
        ...currentDraft,
        progress: updatedProgress,
        modifiedAt: new Date().toISOString(),
        status: (currentDraft.status === 'Draft' && updatedProgress > 50) ? 'In Progress' as DraftStatus : currentDraft.status
      };

      // PUT to backend
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/documents/${updatedDraft.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updatedDraft)
        });
      } catch (e) {
        console.error("Backend manual save failed:", e);
      }

      setCurrentDraft(updatedDraft);
      setSavedDrafts(prev => {
        const list = prev.map(d => d.id === updatedDraft.id ? updatedDraft : d);
        saveAllDraftsToDisk(list);
        return list;
      });

      setAutosaveStatus('Saved');
      
      const notifId = `n-${Date.now()}`;
      const newNotif: SystemNotification = {
        id: notifId,
        title: 'Draft Saved Manually',
        message: `Deed draft ${currentDraft.docNo} saved successfully. ${updatedProgress}% steps completed.`,
        type: 'success',
        timestamp: new Date().toISOString(),
        read: false
      };
      
      setNotifications(prev => [newNotif, ...prev]);
      alert(`Saved draft ${currentDraft.docNo} successfully! (${updatedProgress}% Completed)`);
      
      setTimeout(() => {
        setAutosaveStatus(null);
      }, 3000);

    } catch (e) {
      console.error(e);
      setAutosaveStatus('Save Failed');
    }
  };

  // CRUD: Delete Draft
  const deleteDraft = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this deed draft? This action is irreversible.')) {
      return;
    }

    const draftToDelete = savedDrafts.find(d => d.id === id);
    if (!draftToDelete) return;

    // DELETE from backend
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers
      });
    } catch (e) {
      console.error("Backend deletion failed:", e);
    }

    setSavedDrafts(prev => {
      const filtered = prev.filter(d => d.id !== id);
      saveAllDraftsToDisk(filtered);
      return filtered;
    });

    if (currentDraft?.id === id) {
      setCurrentDraft(null);
    }

    // Add alert notification
    const newNotif: SystemNotification = {
      id: `n-${Date.now()}`,
      title: 'Draft Deleted',
      message: `Deed draft reference ${draftToDelete.docNo} was permanently removed.`,
      type: 'warning',
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    alert(`Successfully deleted draft ${draftToDelete.docNo}.`);
  };

  // CRUD: Duplicate Draft
  const duplicateDraft = (id: string): SavedDraft => {
    const original = savedDrafts.find(d => d.id === id);
    if (!original) {
      throw new Error("Draft not found to duplicate");
    }

    const uniqueId = `dft-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomRef = `DEED/2026/${Math.floor(1000 + Math.random() * 9000)} (DUP)`;

    const duplicatedDraft: SavedDraft = {
      ...original,
      id: uniqueId,
      docNo: randomRef,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      state: {
        ...original.state
      }
    };

    // POST to backend
    getAuthHeaders().then(headers => {
      fetch('/api/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify(duplicatedDraft)
      }).catch(err => console.error("Error duplicating draft on backend:", err));
    });

    setSavedDrafts(prev => {
      const list = [duplicatedDraft, ...prev];
      saveAllDraftsToDisk(list);
      return list;
    });

    const newNotif: SystemNotification = {
      id: `n-${Date.now()}`,
      title: 'Draft Duplicated',
      message: `Successfully duplicated ${original.docNo} into new reference ${randomRef}.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    alert(`Successfully duplicated into draft ${randomRef}.`);

    return duplicatedDraft;
  };

  // Update draft status manually
  const updateDraftStatus = async (id: string, status: DraftStatus) => {
    const draft = savedDrafts.find(d => d.id === id);
    if (!draft) return;

    const updated = { ...draft, status, modifiedAt: new Date().toISOString() };

    // PUT to backend
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error("Backend status update failed:", e);
    }

    setSavedDrafts(prev => {
      const list = prev.map(d => d.id === id ? updated : d);
      saveAllDraftsToDisk(list);
      return list;
    });

    if (currentDraft?.id === id) {
      setCurrentDraft(prev => prev ? { ...prev, status } : null);
    }
  };

  // Client profiles management
  const addClient = async (client: ClientProfile) => {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/clients', {
        method: 'POST',
        headers,
        body: JSON.stringify(client)
      });
    } catch (e) {
      console.error("Backend client creation failed:", e);
    }

    setClients(prev => {
      const list = [client, ...prev];
      localStorage.setItem('unikorn360_clients', JSON.stringify(list));
      return list;
    });
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      simulationRole,
      setSimulationRole,
      effectiveRole,
      authLoading,
      loginWithGoogleHandler,
      logoutUser,
      auditLogs,
      refreshAuditLogs,
      usersList,
      refreshUsersList,
      updateUserRole,
      updateUserStatus,
      syncDatabase,
      
      savedDrafts,
      currentDraft,
      activeStep,
      setActiveStep,
      autosaveStatus,
      clients,
      notifications,
      activeTab,
      setActiveTab,
      
      createDraft,
      loadDraft,
      updateCurrentDraftState,
      saveDraftManual,
      deleteDraft,
      duplicateDraft,
      updateDraftStatus,
      addClient,
      getStepCompletionStates,
      calculateProgress
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
