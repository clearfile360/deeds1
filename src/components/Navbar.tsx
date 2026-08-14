import { useState, FormEvent, useEffect } from 'react';
import { 
  Bell, 
  MapPin, 
  LogOut, 
  Shield, 
  CalendarDays, 
  FileCheck2,
  User,
  KeyRound,
  Activity,
  Smartphone,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Building2,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserRole } from '../types';
import { DUMMY_NOTIFICATIONS } from '../utils/dummyData';
import { useApp } from '../context/AppContext';
import { addAuditLogToFirestore } from '../utils/firebase';

interface NavbarProps {
  activeTab: string;
  currentUserRole: UserRole;
  userEmail: string;
}

export default function Navbar({ activeTab, currentUserRole, userEmail }: NavbarProps) {
  const { currentUser, logoutUser } = useApp();
  
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Modals state
  const [showProfileModal, setShowProfileModal] = useState<'profile' | 'security' | 'password' | 'sessions' | null>(null);

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);

  // Security toggles
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [autoLockout, setAutoLockout] = useState('15');
  const [rememberedDevicesCount, setRememberedDevicesCount] = useState(1);

  // Active sessions
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      setActiveSessions([
        {
          id: 'sess-current',
          device: 'Desktop Chrome (macOS/Windows)',
          ip: '157.45.109.112',
          loginTime: new Date().toISOString()
        }
      ]);
    }
  }, [currentUser, showProfileModal]);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Sub-Registry Intelligence Dashboard';
      case 'wizard':
        return 'Deed drafting & Validation Wizard (Bilingual)';
      case 'clients':
        return currentUserRole === 'Broker' ? 'Client Leads Directory' : currentUserRole === 'Client' ? 'My KYC & Registration Profile' : 'Client Profile Master Directory';
      case 'templates':
        return 'STAR 2.0 Bilingual Template Library';
      case 'clauses':
        return 'Tamil Nadu Sub-Registration Clause Index';
      case 'admin':
        return 'SaaS Administration & Schema Control';
      case 'settings':
        return currentUserRole === 'Client' ? 'Account Preferences' : 'System Mappings & SRO Settings';
      default:
        return 'DeedOS360 by Unikorn360 AI Solutions';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getSROLocation = () => {
    switch (currentUserRole) {
      case 'Super Admin':
        return 'All SROs (Chennai Zone)';
      case 'Admin':
        return 'Joint-I SRO Mylapore';
      case 'Document Writer':
        return 'SRO Thiruvanmiyur';
      case 'Lawyer':
        return 'SRO Tambaram Office';
      default:
        return 'Local Sub-Registrar Office';
    }
  };

  const handlePasswordChangeSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess(false);

    if (!currentUser) return;

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    addAuditLogToFirestore('password change', 'Security preference updated.', currentUser.email);
    setPassSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleRevokeSession = (sessionId: string) => {
    if (!currentUser) return;
    if (window.confirm("Revoking this session will sign you out. Proceed?")) {
      logoutUser();
    }
  };

  return (
    <header id="app-navbar" className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 relative z-40 font-sans">
      {/* Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{getPageTitle()}</h2>
        <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <FileCheck2 className="h-3 w-3" />
          Production Draft V3
        </span>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-4">
        {/* SRO Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Active Juris: <strong className="text-slate-800">{getSROLocation()}</strong></span>
        </div>

        {/* Date Time Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>June 29, 2026 (Mon)</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            id="notifications-toggle"
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
            className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full transition-all duration-150 relative cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span id="notification-badge" className="absolute top-1.5 right-1.5 h-4 w-4 bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center rounded-full border border-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div id="notifications-panel" className="absolute right-0 mt-2.5 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-100">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-sm font-bold text-slate-800">Star 2.0 Registry Warnings ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <div key={notif.id} className={`p-4 hover:bg-slate-50 transition-colors ${!notif.read ? 'bg-slate-50/60' : ''}`}>
                    <div className="flex items-start gap-2.5 text-left">
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                        notif.type === 'error' ? 'bg-rose-500' :
                        notif.type === 'warning' ? 'bg-amber-500' :
                        notif.type === 'success' ? 'bg-teal-500' : 'bg-sky-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                          <span className="text-[10px] text-slate-400">just now</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                <button onClick={() => setShowNotifications(false)} className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer">
                  Close Panel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Badge Profile Dropdown Menu */}
        <div className="relative">
          <button 
            id="navbar-profile-dropdown-btn"
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="flex items-center gap-2.5 border-l border-slate-200 pl-4 hover:bg-slate-50 py-1 px-2 rounded-lg transition text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200 text-xs shadow-sm bg-gradient-to-tr from-emerald-100 to-teal-100">
              {currentUserRole.substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-slate-800 truncate max-w-36">{userEmail}</span>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{currentUserRole}</span>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>

          {showProfileMenu && (
            <div id="navbar-profile-dropdown-panel" className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-left text-xs text-slate-700 animate-in fade-in duration-100">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <p className="font-extrabold text-slate-800 truncate">{currentUser?.name || 'Portal Operator'}</p>
                <p className="text-[10px] text-slate-500 truncate font-semibold mt-0.5">{userEmail}</p>
              </div>
              
              <button 
                onClick={() => { setShowProfileMenu(false); setShowProfileModal('profile'); }} 
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-600"
              >
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <span>My Profile Details</span>
              </button>
              
              <button 
                onClick={() => { setShowProfileMenu(false); setShowProfileModal('security'); }} 
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-600"
              >
                <Shield className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Security Hardening</span>
              </button>

              <button 
                onClick={() => { setShowProfileMenu(false); setShowProfileModal('password'); }} 
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-600"
              >
                <KeyRound className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Update Password</span>
              </button>

              <button 
                onClick={() => { setShowProfileMenu(false); setShowProfileModal('sessions'); }} 
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-600"
              >
                <Activity className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="flex-1">Active User Sessions</span>
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              <button 
                onClick={() => { setShowProfileMenu(false); logoutUser(); }} 
                className="w-full text-left px-4 py-2.5 hover:bg-rose-50 text-rose-600 font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-rose-500 shrink-0" />
                <span>Revoke Session (Log Out)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC PROFILE INFORMATION MODAL */}
      {showProfileModal === 'profile' && currentUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-800">Portal Profile & License Credentials</span>
              </div>
              <button onClick={() => setShowProfileModal(null)} className="text-xs font-extrabold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">Close</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-100 to-indigo-100 flex items-center justify-center text-xl font-extrabold text-emerald-800">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-800">{currentUser.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{currentUser.email}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full mt-1.5 uppercase">
                    Status: {currentUser.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Assigned Tenant Role</span>
                  <p className="text-slate-800 font-extrabold text-xs">{currentUser.role}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Organization / SRO</span>
                  <p className="text-slate-800 font-extrabold text-xs">{currentUser.organization}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Mobile (STAR-2.0 Linked)</span>
                  <p className="text-slate-800 font-extrabold text-xs font-mono">{currentUser.phone}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Security Scope Keys</span>
                  <p className="text-slate-800 font-extrabold text-[10px] font-mono leading-none truncate mt-0.5">
                    {currentUser.permissions?.join(', ') || 'view_own_deeds'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/30 rounded-xl border border-indigo-100/40 text-[10px] text-slate-500 leading-normal flex items-start gap-2">
                <Building2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>This profile is federated directly via the Tamil Nadu STAR 2.0 Identity Server. Security keys cannot be modified from this console without Super Admin SRO endorsement.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC SECURITY HARDENING MODAL */}
      {showProfileModal === 'security' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-800">SaaS Identity Hardening & Security Keys</span>
              </div>
              <button onClick={() => setShowProfileModal(null)} className="text-xs font-extrabold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">Close</button>
            </div>
            <div className="p-6 space-y-5 text-xs text-slate-600 font-semibold">
              
              {/* Option 1: MFA */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5 max-w-[70%]">
                  <h5 className="text-slate-800 font-extrabold text-xs">Simulated Two-Factor Authentication (MFA)</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Adds an enhanced OTP verification page challenge upon enter console.</p>
                </div>
                <button 
                  onClick={() => { setMfaEnabled(!mfaEnabled); addAuditLogToFirestore('password change', `MFA preference toggled: ${!mfaEnabled}`, userEmail); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition border cursor-pointer ${
                    mfaEnabled ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {mfaEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Option 2: Inactivity Timeout */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-0.5 max-w-[70%]">
                  <h5 className="text-slate-800 font-extrabold text-xs">Session Inactivity Lockout</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Automatically revoke sessions if inactive for chosen minutes.</p>
                </div>
                <select 
                  value={autoLockout} 
                  onChange={(e) => { setAutoLockout(e.target.value); addAuditLogToFirestore('password change', `Session timeout updated: ${e.target.value} minutes`, userEmail); }}
                  className="bg-slate-50 border border-slate-200 rounded p-1.5 font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">60 Minutes</option>
                </select>
              </div>

              {/* Option 3: Brute Force protection indicator */}
              <div className="flex items-start gap-3 bg-rose-50/30 p-3.5 border border-rose-100/40 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h6 className="text-rose-800 font-extrabold text-xs">Lockout Policy Activated</h6>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    SRO brute force protection rules lock credentials permanently after <strong className="text-slate-700 font-bold">5 failed authentication attempts</strong>. The lockout must then be manually unblocked via SRO Admin endorsement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC UPDATE PASSWORD MODAL */}
      {showProfileModal === 'password' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-800">Update Secure Password</span>
              </div>
              <button onClick={() => setShowProfileModal(null)} className="text-xs font-extrabold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">Close</button>
            </div>
            
            <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4 text-xs font-semibold">
              
              {passError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 bg-teal-50 border border-teal-100 text-teal-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-teal-600" />
                  <span>Your password was modified successfully and security keys regenerated.</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white rounded-lg transition mt-2 cursor-pointer"
              >
                Re-encrypt Password & Save
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC ACTIVE SESSIONS MODAL */}
      {showProfileModal === 'sessions' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-left animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-800">Manage Active JWT Sessions</span>
              </div>
              <button onClick={() => setShowProfileModal(null)} className="text-xs font-extrabold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">Close</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-normal">
                Review and revoke active login tokens assigned to this operator identity to prevent session hijacking:
              </p>

              <div className="space-y-3 max-h-72 overflow-y-auto">
                {activeSessions.map((sess) => (
                  <div key={sess.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 text-left">
                      <Smartphone className="h-5 w-5 text-slate-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800">{sess.device}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-teal-50 border border-teal-100 rounded text-teal-700 font-bold uppercase">Active</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Browser: {sess.browser} • IP: {sess.ip}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Auth: {new Date(sess.loginTime).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded text-[10px] uppercase border border-rose-100 transition cursor-pointer shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-[10px] text-slate-400 leading-normal flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Revoking a device's session invalidates the JWT bearer payload instantly, blocking all further Tamil Nadu STAR-2.0 database integrations.</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
