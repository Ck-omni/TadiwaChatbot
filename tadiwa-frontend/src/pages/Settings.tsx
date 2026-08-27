import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Bot, Eye, User ,EyeOff, KeyRound, Loader2, MessageSquare, Pencil, Plug, RefreshCw, ShieldCheck, UserCheck, UserPlus, UserX, Users, Wallet, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usersApi, ApiError, ROLE_LABELS, type BackendUser, type UserRole, type CreateUserInput, type UpdateUserInput, type UpdateOwnProfileInput } from '../lib/api';

type SettingsTab = 'agent' | 'users' | 'connection' | 'profile';

const TABS: { id: SettingsTab, label: string, icon: React.ReactNode }[] = [
  { id: 'agent', label: 'Agent', icon: <Bot size={16} /> },
  { id: 'users', label: 'Users', icon: <Users size={16} /> },
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
      {activeTab === 'users' && <UsersPanel />}
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

function generateTempPassword() {
  // 12 chars from a mixed alphabet — comfortably clears the backend's
  // 8-char minimum. Not a cryptographic concern: it's a one-time temp
  // password the admin hands to the new user, who should change it on
  // first login (there's no forced-reset flow on the backend to enforce
  // that today — worth building if this goes past internal dev use).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function UsersPanel() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<BackendUser[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<BackendUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = React.useState<BackendUser | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = React.useState<number | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const fetchUsers = React.useCallback(async () => {
    if (!accessToken) return;
    setLoadError(null);
    try {
      const list = await usersApi.list(accessToken);
      setUsers(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load users.');
    }
  }, [accessToken]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (target: BackendUser) => {
    if (!accessToken) return;
    setStatusError(null);
    setStatusUpdatingId(target.id);
    try {
      const updated = await usersApi.update(accessToken, target.id, { isActive: !(target.isActive ?? true) });
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
      setDeactivatingUser(null);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Could not update this user.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Workspace Users</h2>
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-300">Manage technician access to the Omni Helpdesk console.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
        >
          <UserPlus size={14} /> Invite User
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden dark:bg-transparent border border-slate-200 dark:border-slate-600">
        {loadError && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
            <button onClick={fetchUsers} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
          </div>
        )}

        {statusError && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {statusError}</span>
            <button onClick={() => setStatusError(null)} className="font-bold text-xs uppercase tracking-widest hover:underline">Dismiss</button>
          </div>
        )}

        {users === null && !loadError && (
          <p className="text-sm text-slate-400 text-center py-12">Loading users…</p>
        )}

        {users !== null && users.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">No users yet.</p>
        )}

        {users !== null && users.length > 0 && (
          <table className="w-full text-left">
            <thead className='dark:bg-blue-500 dark:text-white'>
              <tr className="border-b border-slate-200 dark:border-slate-600 text-sm  tracking-widest text-slate-400 dark:text-white">
                <th className="px-6 py-4 font-medium">Technician</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {users.map((u) => {
                const displayName = u.fullName || u.email;
                const isActive = u.isActive !== false;
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                          {displayName[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-300">{ROLE_LABELS[u.role]}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400 dark:text-slate-300">{u.email}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                        !isActive ? "text-slate-500 bg-slate-100" : "text-emerald-700 bg-emerald-50"
                      )}>
                        {!isActive ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(u)}
                          title="Edit user"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeactivatingUser(u)}
                          disabled={isSelf}
                          title={isSelf ? "You can't deactivate your own account" : isActive ? 'Deactivate user' : 'Reactivate user'}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            isSelf
                              ? "text-slate-300 cursor-not-allowed"
                              : isActive
                                ? "text-slate-500 hover:text-red-600 hover:bg-red-50"
                                : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          )}
                        >
                          {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <InviteUserModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            fetchUsers();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
            setEditingUser(null);
          }}
        />
      )}

      {deactivatingUser && (
        <ConfirmModal
          title={deactivatingUser.isActive === false ? 'Reactivate user?' : 'Deactivate user?'}
          description={
            deactivatingUser.isActive === false
              ? `${deactivatingUser.fullName || deactivatingUser.email} will regain access to the console.`
              : `${deactivatingUser.fullName || deactivatingUser.email} will immediately lose access to the console. You can reactivate them later.`
          }
          confirmLabel={deactivatingUser.isActive === false ? 'Reactivate' : 'Deactivate'}
          destructive={deactivatingUser.isActive !== false}
          isSubmitting={statusUpdatingId === deactivatingUser.id}
          onCancel={() => setDeactivatingUser(null)}
          onConfirm={() => handleToggleActive(deactivatingUser)}
        />
      )}
    </div>
  );
}

function InviteUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { accessToken } = useAuth();
  const firstInputRef = React.useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState(generateTempPassword());
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<UserRole>('AGENT');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError('');

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    const input: CreateUserInput = { email: email.trim(), password, role };
    if (fullName.trim()) input.fullName = fullName.trim();

    try {
      await usersApi.create(accessToken, input);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Invite User</h3>
            <p className="text-xs text-slate-500 mt-1">Creates the account directly — there's no email-invite step yet, so share these credentials with them yourself.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
            <input
              ref={firstInputRef}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tanaka Moyo"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tanaka.m@econet.co.zw"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            >
              <option value="AGENT">Agent</option>
              <option value="TEAM_LEAD">Team Lead</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPassword(generateTempPassword())}
                title="Generate a new temporary password"
                className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 transition-colors shrink-0"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {isSubmitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: BackendUser; onClose: () => void; onSaved: (updated: BackendUser) => void }) {
  const { accessToken } = useAuth();
  const firstInputRef = React.useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = React.useState(user.fullName || '');
  const [role, setRole] = React.useState<UserRole>(user.role);
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError('');

    const input: UpdateUserInput = {};
    const trimmedName = fullName.trim();
    if (trimmedName !== (user.fullName || '')) input.fullName = trimmedName;
    if (role !== user.role) input.role = role;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await usersApi.update(accessToken, user.id, input);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Edit User</h3>
            <p className="text-xs text-slate-500 mt-1">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
            <input
              ref={firstInputRef}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tanaka Moyo"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            >
              <option value="AGENT">Agent</option>
              <option value="TEAM_LEAD">Team Lead</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {error && (
            <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  destructive,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <h3 className="font-bold text-lg text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-2">{description}</p>

        <div className="flex gap-3 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-lg",
              destructive ? "bg-red-600 hover:bg-red-500 shadow-red-500/20" : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
            )}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
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
// Users tab above.
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
