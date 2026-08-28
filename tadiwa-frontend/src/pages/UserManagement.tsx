import React from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Pencil, RefreshCw, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usersApi, ApiError, ROLE_LABELS, type BackendUser, type UserRole, type CreateUserInput, type UpdateUserInput } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

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

export default function UserManagement() {
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
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <h1 className="text-3xl font-bold mb-8 tracking-tight text-slate-600 dark:text-white">User Management</h1>

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
