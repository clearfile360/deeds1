import { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  ShieldCheck, 
  Activity, 
  Users, 
  CheckCircle,
  FileCode2,
  Lock,
  Cpu,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  History,
  Trash2,
  LockKeyhole,
  CheckCircle2,
  KeyRound,
  XCircle,
  UserPlus
} from 'lucide-react';
import SQLViewer from '../components/SQLViewer';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

export default function AdminPanel() {
  const { 
    currentUser,
    usersList, 
    updateUserRole, 
    updateUserStatus, 
    auditLogs,
    refreshAuditLogs,
    syncDatabase
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'schema' | 'api' | 'services' | 'users' | 'audits'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Elevated reviewer states
  const [sessionStatus, setSessionStatus] = useState<{ active: boolean; reasonCode?: string; expiresAt?: string; minutesRemaining?: number } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionSuccess, setSessionSuccess] = useState('');

  const getAuthHeaders = async () => {
    let token = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {}

    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'x-user-email': currentUser?.email || '',
      'x-user-role': currentUser?.role || 'Client'
    };
  };

  const checkSessionStatus = async () => {
    if (currentUser?.role !== 'Auditor') return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/elevate/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setSessionStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch elevated review status:', e);
    }
  };

  const handleElevate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError('');
    setSessionSuccess('');
    if (!reasonInput.trim()) {
      setSessionError('Mandatory reason code is required.');
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/elevate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reasonCode: reasonInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setSessionError(data.error || 'Failed to activate elevated review session.');
      } else {
        setSessionSuccess('Elevated review session successfully activated! RAW PII values are now unlocked for 15 minutes.');
        setReasonInput('');
        await checkSessionStatus();
        await syncDatabase();
      }
    } catch (err: any) {
      setSessionError(err.message || 'Network error.');
    }
  };

  const handleDemote = async () => {
    setSessionError('');
    setSessionSuccess('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/demote', {
        method: 'POST',
        headers
      });
      if (res.ok) {
        setSessionSuccess('Elevated session terminated. PII returned to standard masked mode.');
        await checkSessionStatus();
        await syncDatabase();
      } else {
        setSessionError('Failed to terminate session.');
      }
    } catch (err: any) {
      setSessionError(err.message || 'Network error.');
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Auditor') {
      checkSessionStatus();
      const interval = setInterval(checkSessionStatus, 15000); // Check every 15 seconds
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Check if current user role has access to admin functions
  const isAuthorized = currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Auditor';

  const rawPostgresSQL = `-- ==========================================
-- UNIKORN360 DEEDOS — PostgreSQL Schema Spec
-- Enterprise Legal-Tech SaaS for Tamil Nadu Registry
-- ==========================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Permissions
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT
);

-- Table 3: Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id)
);

-- Table 4: Clients (Layer 4 Client Management)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    pan VARCHAR(10) UNIQUE,
    aadhaar VARCHAR(14) UNIQUE,
    address TEXT NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL
);

-- Table 5: Documents (Step 1-11 Wizard)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_no VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'Draft',
    total_consideration NUMERIC(15, 2) DEFAULT 0.00,
    market_value NUMERIC(15, 2) DEFAULT 0.00,
    guideline_value NUMERIC(15, 2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    raw_document_en TEXT,
    raw_document_ta TEXT
);`;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-800">
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-full text-rose-500 mb-4 animate-bounce">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">IAM Authorization Violation</h3>
        <p className="text-xs text-slate-500 max-w-md mt-2 leading-relaxed">
          The requested administrative module is strictly restricted to <strong className="text-slate-800">Super Admin, Admin, and Internal Auditor</strong> roles. Your current role lacks appropriate security clearance.
        </p>
      </div>
    );
  }

  // Filter users based on search
  const filteredUsers = usersList.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.organization || 'Independent').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter audit logs based on search
  const filteredLogs = auditLogs.filter(l => 
    (l.userEmail || l.user || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    (l.message || l.details || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    (l.type || l.action || '').toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 text-left flex items-center justify-between">
        <div>
          <h3 className="text-md font-bold text-slate-800">SaaS Administration Console</h3>
          <p className="text-xs text-slate-400">Review IAM credentials, system security logs, database schemas, and STAR 2.0 adapters</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-bold text-emerald-800">
          <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span>IAM & Audit Engine: Live</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs text-slate-500 font-bold shrink-0">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer ${activeSubTab === 'users' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent hover:text-slate-800'}`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>IAM User Directory</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('audits')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer ${activeSubTab === 'audits' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent hover:text-slate-800'}`}
        >
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span>Security SIEM Audit Logs</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('schema')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer ${activeSubTab === 'schema' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent hover:text-slate-800'}`}
        >
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            <span>PostgreSQL Schema (DDL)</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('api')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer ${activeSubTab === 'api' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent hover:text-slate-800'}`}
        >
          <div className="flex items-center gap-1.5">
            <Terminal className="h-4 w-4" />
            <span>API Controllers Spec</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('services')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer ${activeSubTab === 'services' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent hover:text-slate-800'}`}
        >
          <div className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4" />
            <span>STAR 2.0 Microservices</span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        
        {/* USERS / IAM DIRECTORY */}
        {activeSubTab === 'users' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Operator Directory & Role Allocation</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Approve incoming registrations, suspend profiles, or re-allocate STAR 2.0 licenses.</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search operators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-xs w-64 bg-slate-50 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider font-bold border-b border-slate-100">
                    <th className="p-3">Operator Identity</th>
                    <th className="p-3">Office / Org</th>
                    <th className="p-3">SaaS Role Designation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Access Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <div>
                          <p className="font-bold text-slate-800">{user.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{user.organization}</td>
                      <td className="p-3">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-bold text-slate-700"
                        >
                          <option value="Super Admin">Super Admin</option>
                          <option value="Admin">Admin (SRO)</option>
                          <option value="Document Writer">Document Writer</option>
                          <option value="Lawyer">Lawyer</option>
                          <option value="Broker">Broker</option>
                          <option value="Data Entry Operator">Data Entry Operator</option>
                          <option value="Client">Client</option>
                          <option value="Auditor">Auditor</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user.status === 'Approved' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                          user.status === 'Suspended' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.status === 'Pending Approval' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'Approved')}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded text-[10px] uppercase transition cursor-pointer"
                            >
                              Approve Profile
                            </button>
                          )}
                          {user.status === 'Approved' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'Suspended')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded text-[10px] uppercase transition border border-rose-100 cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                          {user.status === 'Suspended' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'Approved')}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded text-[10px] uppercase transition border border-teal-100 cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECURITY SIEM AUDIT LOGS */}
        {activeSubTab === 'audits' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4 text-left shadow-xl">
            {currentUser?.role === 'Auditor' && (
              <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-5 mb-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
                  <div>
                    <h5 className="text-xs uppercase font-extrabold tracking-wider text-teal-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Auditor Elevated PII Review Control Centre</span>
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Tamil Nadu STAR 2.0 zero-trust protocol. Auditor raw decryption requires explicit server privilege verification, mandatory justification, and immutable transaction logging. Sessions expire in 15 minutes.
                    </p>
                  </div>
                  <div>
                    {sessionStatus?.active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span>
                        ELEVATED SESSION ACTIVE ({sessionStatus.minutesRemaining}m left)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                        PII VALUES MASKED
                      </span>
                    )}
                  </div>
                </div>

                {sessionError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{sessionError}</span>
                  </div>
                )}

                {sessionSuccess && (
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{sessionSuccess}</span>
                  </div>
                )}

                {sessionStatus?.active ? (
                  <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-400">Current Elevated Session Authorization Reason Code:</p>
                      <p className="text-xs font-mono font-bold text-slate-200 bg-slate-950 px-2 py-1 rounded border border-slate-850 inline-block">
                        {sessionStatus.reasonCode}
                      </p>
                      <p className="text-[10px] text-slate-500">Decryption window terminates on {sessionStatus.expiresAt ? new Date(sessionStatus.expiresAt).toLocaleTimeString() : 'N/A'}</p>
                    </div>
                    <div>
                      <button
                        onClick={handleDemote}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition duration-150 flex items-center gap-1.5 shadow-lg shadow-rose-950/20"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Revoke Elevated Decryption</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleElevate} className="flex flex-col sm:flex-row items-end gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-850">
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <span>Mandatory Justification Reason Code</span>
                        <span className="text-rose-400 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter official audit reference code or regulatory purpose justification..."
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-teal-950/20"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Request Elevated Access</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <LockKeyhole className="h-4.5 w-4.5 text-teal-400" />
                  <span>STAR 2.0 Security Information & Event Log (SIEM)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Chronological ledger of security assertions, login failures, and key handshakes.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter logs by operator..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="p-2 border border-slate-800 rounded-lg text-xs w-64 bg-slate-950 text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[500px] space-y-2 pr-1 font-mono text-[11px] text-slate-300">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No security events found matching the current search parameters.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const logType = log.type || log.action || 'system';
                  const logMessage = log.message || log.details || 'System event recorded';
                  const isFailure = logType.includes('failed');
                  return (
                    <div key={log.id} className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isFailure ? 'bg-rose-950/20 border-rose-900/30 text-rose-200' : 'bg-slate-950 border-slate-850 text-slate-300'
                    }`}>
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            isFailure ? 'bg-rose-500 animate-pulse' : 'bg-teal-500'
                          }`} />
                          <span className={`font-bold uppercase text-[9px] tracking-wider px-1.5 py-0.2 rounded ${
                            isFailure ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>{logType}</span>
                          <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="font-semibold text-xs leading-normal">{logMessage}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Browser fingerprint: {log.browser || 'Chrome'} • Device: {log.device || 'Desktop'} • IP: {log.ip || log.ipAddress || '157.45.109.112'}</p>
                      </div>
                      <span className="text-[10px] text-teal-400 font-bold shrink-0">{log.userEmail || log.user || 'system'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* POSTGRESQL SCHEMA */}
        {activeSubTab === 'schema' && (
          <SQLViewer sqlContent={rawPostgresSQL} />
        )}

        {/* API CONTROLLERS */}
        {activeSubTab === 'api' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden text-left p-6 space-y-6">
            <div className="flex items-center gap-2 text-teal-400 border-b border-slate-800 pb-3">
              <FileCode2 className="h-4.5 w-4.5" />
              <h4 className="text-sm font-bold text-white">Express API Routing Control Skeletons</h4>
            </div>

            <p className="text-xs text-slate-400 leading-normal">
              Below is the backend routing schema matching `/backend/server.ts` handles:
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/extract</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Processes uploaded binary files through Gemini-3.5-flash vision OCR to extract structured buyers, sellers, and survey variables to pre-fill the form.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/validate</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Evaluates deed draft states against Tamil Nadu SRO compliance rulesets (witnesses counts, Section 47A under-valuation protections).
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/fraud-check</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Scans Tamil Nadu Star 2.0 Prohibited Lands register (Section 22-A of Registration Act) to block double registrations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MICROSERVICES */}
        {activeSubTab === 'services' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-left space-y-4">
            <h4 className="text-sm font-bold text-slate-800">Integration Adapters for Tamil Nadu Star 2.0</h4>
            <p className="text-xs text-slate-500 leading-normal">
              These modular microservices handle secure integrations with the Tamil Nadu Star 2.0 registry ecosystem:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Service 1:</span>
                <h5 className="text-slate-800 font-extrabold">Patta/Chitta API Synchronizer</h5>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Queries revenue databases (Anyal/E-Service) to verify if the survey numbers match the patta records before drafting is finalized.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Service 2:</span>
                <h5 className="text-slate-800 font-extrabold">FMB Sketch OCR & Land Boundary Verifier</h5>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Scans FMB (Field Measurement Book) drawings to double-check dimensions (East, West, North, South) matching the written deed boundaries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
