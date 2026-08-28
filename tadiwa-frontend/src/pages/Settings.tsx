import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Bot, User, KeyRound, Loader2, MessageSquare, Pencil, Plug, ShieldCheck, UserCheck, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usersApi, ApiError, ROLE_LABELS, type UpdateOwnProfileInput } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

type SettingsTab = 'agent' | 'connection' | 'profile';

const TABS: { id: SettingsTab, label: string, icon: React.ReactNode }[] = [
  { id: 'agent', label: 'Agent', icon: <Bot size={16} /> },
  { id: 'connection', label: 'Connection', icon: <Plug size={16} /> },
  {id: 'profile', label: 'Profile', icon: <User size={16} />},
];

export default function Settings() {
  
  // The header's profile-menu link navigates here with state:{tab:'profile'}
  // — everything else lands on the default Agent tab.

  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(
    () => ((location.state as { tab?: SettingsTab } | null)?.tab) ?? 'agent'
  );

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <h1 className="text-3xl font-bold mb-8 tracking-tight text-slate-600 dark:text-white">Settings</h1>

      <div className="flex items-center gap-1 mb-8 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'agent' && <AgentPanel />}
      {activeTab === 'connection' && <ConnectionPanel />}
      {activeTab === 'profile' && <ProfilePanel />}
    </div>
  );
}

function AgentPanel() {
  const [naturalVoice, setNaturalVoice] = React.useState(true);
  const [autoListen, setAutoListen] = React.useState(true);

  return (
    <div className="max-w-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6 dark:bg-transparent dark:border-slate-600">
        <ToggleRow
          title="Natural Voice"
          description="Enable Tadiwa's supportive tone"
          checked={naturalVoice}
          onChange={setNaturalVoice}
        />
        <ToggleRow
          title="Auto-Listen After Greeting"
          description='Listen for queries after "Hallo"'
          checked={autoListen}
          onChange={setAutoListen}
        />
        <button className="w-full py-3 bg-slate-100 rounded-xl font-bold uppercase tracking-widest text-xs border border-slate-200 hover:bg-slate-200 text-slate-700 transition-all">
          Save Workspace Preferences
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string, description: string, checked: boolean, onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "w-12 h-6 rounded-full relative shadow-inner transition-colors shrink-0",
          checked ? "bg-blue-600" : "bg-slate-200"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
          checked ? "right-1" : "left-1"
        )} />
      </button>
    </div>
  );
}

const INTEGRATIONS = [
  { name: 'Gemini AI Assistant', description: "Powers TADIWA's real-time SOP guidance.", status: 'connected' as const, icon: Bot },
  { name: 'Econet Back-Office Portal', description: 'SIM lifecycle, provisioning & order entry.', status: 'connected' as const, icon: ShieldCheck },
  { name: 'Ecocash Payment Gateway', description: 'Balance adjustments & D.A lookups.', status: 'connected' as const, icon: Wallet },
  { name: 'WhatsApp Business API', description: 'Customer-facing chat handoff.', status: 'disconnected' as const, icon: MessageSquare },
];

function ConnectionPanel() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {INTEGRATIONS.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-blue-600 shrink-0">
              <item.icon size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
              item.status === 'connected' ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", item.status === 'connected' ? "bg-emerald-500" : "bg-red-500")} />
              {item.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
            <button className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
              {item.status === 'connected' ? 'Manage' : 'Connect'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// My own account — every user gets this tab regardless of role. Role itself
// is always shown read-only here: nobody, agent/team-lead/admin alike, can
// change their own role through self-service; that stays in the admin-only
// User Management page.
function ProfilePanel() {
  const { accessToken, user, refreshUser, logout } = useAuth();

  const [fullName, setFullName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [detailsError, setDetailsError] = React.useState('');
  const [detailsSuccess, setDetailsSuccess] = React.useState(false);
  const [isSavingDetails, setIsSavingDetails] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordChanged, setPasswordChanged] = React.useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');

  // Force a fresh sign-in shortly after anything that revokes the current
  // session server-side (password change, self-deactivation) — the access
  // token still works until it expires, but the refresh token underneath it
  // is already dead, so staying "logged in" here would just fail later and
  // more confusingly.
  React.useEffect(() => {
    if (!passwordChanged) return;
    const timer = setTimeout(() => logout(), 1800);
    return () => clearTimeout(timer);
  }, [passwordChanged, logout]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;
    setDetailsError('');
    setDetailsSuccess(false);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setDetailsError('Full name cannot be empty.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setDetailsError('Enter a valid email address.');
      return;
    }

    const input: UpdateOwnProfileInput = {};
    if (trimmedName !== user.name) input.fullName = trimmedName;
    if (trimmedEmail !== user.email) input.email = trimmedEmail;

    if (Object.keys(input).length === 0) {
      setDetailsSuccess(true);
      return;
    }

    setIsSavingDetails(true);
    try {
      await usersApi.updateMe(accessToken, input);
      await refreshUser();
      setDetailsSuccess(true);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Could not update your profile.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await usersApi.changeMyPassword(accessToken, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChanged(true);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accessToken) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await usersApi.deactivateMe(accessToken);
      logout();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete your account.');
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-6 animate-in fade-in duration-300">
      {passwordChanged && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <UserCheck size={16} /> Password changed. You'll be signed out for security in a moment — sign back in with your new password.
        </div>
      )}

      {/* Account Details */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 dark:bg-transparent dark:border-slate-600">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Account Details</h3>
        <p className="text-xs text-slate-500 mb-6 dark:text-slate-300">Your name and email as they appear across the console.</p>

        <form onSubmit={handleSaveDetails} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setDetailsSuccess(false); }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setDetailsSuccess(false); }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">System Role</label>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl dark:bg-slate-800 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{ROLE_LABELS[user.role]}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Set by an admin</span>
            </div>
          </div>

          {detailsError && (
            <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
              {detailsError}
            </div>
          )}
          {detailsSuccess && !detailsError && (
            <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Saved.
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingDetails}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {isSavingDetails ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            {isSavingDetails ? 'Saving…' : 'Save Details'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 dark:bg-transparent dark:border-slate-600">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <KeyRound size={18} className="text-blue-600" /> Change Password
        </h3>
        <p className="text-xs text-slate-500 mb-6 dark:text-slate-300">Changing your password signs you out of every device.</p>

        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          {passwordError && (
            <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            disabled={isChangingPassword || passwordChanged}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {isChangingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {isChangingPassword ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50/50 rounded-3xl border border-red-200 shadow-sm p-8 dark:bg-transparent dark:border-red-900/50">
        <h3 className="font-bold text-lg text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
          <AlertTriangle size={18} /> Danger Zone
        </h3>
        <p className="text-xs text-slate-500 mb-6 dark:text-slate-300">
          Deletes your account by deactivating it — you'll immediately lose access and be signed out. An admin can reactivate it later; nothing is permanently erased.
        </p>

        {deleteError && (
          <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4" role="alert">
            {deleteError}
          </div>
        )}

        <button
          onClick={() => setDeleteModalOpen(true)}
          className="px-5 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-300 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
        >
          Delete Account
        </button>
      </div>

      {deleteModalOpen && (
        <ConfirmModal
          title="Delete your account?"
          description="This deactivates your account and signs you out everywhere. You'll need an admin to reactivate it before you can sign in again."
          confirmLabel="Delete Account"
          destructive
          isSubmitting={isDeleting}
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}
