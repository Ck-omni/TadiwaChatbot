import React from 'react';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usersApi, scheduleApi, ApiError, ROLE_LABELS, type BackendUser, type ShiftBlock, type ShiftPeer } from '../lib/api';

// Shift scheduling: a team lead/admin assigns time blocks ("08:00-10:00
// Morning Handoff") that make up an agent's day. Backed by
// GET/POST/PUT/DELETE /api/schedule (tadiwa-backend/apps/schedule).
// Note: days are treated as UTC calendar days throughout (same simplification
// Productivity.tsx uses for weeks) — fine for a single-office team, but a
// shift starting right around local midnight in a large UTC offset could
// land on the "wrong" day. Worth revisiting if this ever spans timezones.

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Schedule() {
  const { accessToken, user } = useAuth();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  const [date, setDate] = React.useState(() => startOfDayUTC(new Date()));
  const dateKey = toDateInputValue(date);

  const [blocks, setBlocks] = React.useState<ShiftBlock[] | null>(null);
  const [peers, setPeers] = React.useState<ShiftPeer[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editingBlock, setEditingBlock] = React.useState<ShiftBlock | null>(null);
  const [deletingBlock, setDeletingBlock] = React.useState<ShiftBlock | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fetchAll = React.useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [myBlocks, shiftPeers] = await Promise.all([
        scheduleApi.list(accessToken, dateKey),
        scheduleApi.peers(accessToken, dateKey),
      ]);
      setBlocks(myBlocks);
      setPeers(shiftPeers);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateKey]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async () => {
    if (!accessToken || !deletingBlock) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await scheduleApi.deleteBlock(accessToken, deletingBlock.id);
      setBlocks((prev) => prev?.filter((b) => b.id !== deletingBlock.id) ?? prev);
      setDeletingBlock(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete this shift.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Shift Schedule</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm dark:bg-transparent dark:border-slate-600">
            <button onClick={() => setDate((d) => addDays(d, -1))} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors dark:hover:bg-slate-800" aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatDateLabel(date)}</span>
            <button onClick={() => setDate((d) => addDays(d, 1))} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors dark:hover:bg-slate-800" aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 dark:bg-transparent dark:border-slate-600 dark:text-slate-200"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </button>
          {isPrivileged && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={14} /> Add Shift
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
          <button onClick={fetchAll} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-xs uppercase tracking-widest hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Timeline */}
        <div className="bg-white dark:bg-transparent rounded-3xl border border-slate-200 shadow-sm overflow-hidden dark:border-slate-600">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between dark:border-slate-600">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-slate-300">
              <Calendar className="text-blue-600" size={20} />
              Personal Timeline
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {blocks === null && !loadError && (
              <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
            )}
            {blocks !== null && blocks.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No shifts scheduled for this day.</p>
            )}
            {blocks?.map((block) => (
              <ScheduleItem
                key={block.id}
                time={`${formatTime(block.startsAt)} - ${formatTime(block.endsAt)}`}
                task={block.task}
                status={block.status ?? 'upcoming'}
                onEdit={isPrivileged ? () => setEditingBlock(block) : undefined}
                onDelete={isPrivileged ? () => setDeletingBlock(block) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Shift Peers */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden dark:bg-transparent dark:border-slate-600">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between dark:border-slate-600">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-slate-300">
              <Users className="text-blue-600" size={20} />
              Shift Peers
            </h2>
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest px-3 py-1 bg-blue-50 rounded-full">
              {peers?.filter((p) => p.status === 'online').length ?? 0} Online
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4">
            {peers === null && !loadError && (
              <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
            )}
            {peers !== null && peers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No one else is scheduled for this day.</p>
            )}
            {peers?.map((peer) => (
              <PeerCard key={peer.userId} name={peer.fullName} role={ROLE_LABELS[peer.role]} status={peer.status} />
            ))}
          </div>
        </div>
      </div>

      {addModalOpen && (
        <ShiftBlockModal
          date={date}
          onClose={() => setAddModalOpen(false)}
          onSaved={(block) => {
            setAddModalOpen(false);
            if (block.userId === user?.id) setBlocks((prev) => [...(prev ?? []), block].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
            fetchAll();
          }}
        />
      )}

      {editingBlock && (
        <ShiftBlockModal
          date={date}
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSaved={(updated) => {
            setBlocks((prev) => prev?.map((b) => (b.id === updated.id ? { ...updated, status: b.status } : b)) ?? prev);
            setEditingBlock(null);
          }}
        />
      )}

      {deletingBlock && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDeletingBlock(null); }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <h3 className="font-bold text-lg text-slate-900">Delete this shift?</h3>
            <p className="text-xs text-slate-500 mt-2">
              "{deletingBlock.task}" ({formatTime(deletingBlock.startsAt)} - {formatTime(deletingBlock.endsAt)}) will be removed from the schedule.
            </p>
            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => setDeletingBlock(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleItem({
  time,
  task,
  status,
  onEdit,
  onDelete,
}: {
  time: string;
  task: string;
  status: 'completed' | 'current' | 'upcoming';
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl border transition-all group",
      status === 'current' ? "bg-blue-50 border-blue-200 shadow-sm dark:bg-transparent dark:border-slate-600" :
      status === 'completed' ? "bg-slate-50 border-slate-100 opacity-60 dark:bg-transparent dark:border-slate-600" : "bg-slate-50 border-slate-100 dark:bg-transparent dark:border-slate-600"
    )}>
      <div className={cn(
        "text-[10px] font-mono w-24 shrink-0",
        status === 'current' ? "text-blue-700" : "text-slate-400"
      )}>{time}</div>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{task}</div>
      <div className={cn(
        "w-2 h-2 rounded-full shrink-0",
        status === 'current' ? "bg-blue-500 animate-pulse" :
        status === 'completed' ? "bg-emerald-500" : "bg-slate-200"
      )} />
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onEdit && (
            <button onClick={onEdit} title="Edit shift" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Delete shift" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PeerCard({ name, role, status }: { name: string, role: string, status: 'online' | 'away' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl group hover:shadow-sm transition-all dark:bg-transparent dark:border-slate-600">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center font-bold text-blue-700">
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div className={cn(
            "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
            status === 'online' ? "bg-emerald-500" : "bg-orange-500"
          )} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-300">{name}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-widest">{role}</p>
        </div>
      </div>
      <span className={cn(
        "text-[8px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full",
        status === 'online' ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900" : "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900"
      )}>
        {status}
      </span>
    </div>
  );
}

// Doubles as both "Add Shift" (no `block` prop) and "Edit Shift" (with one).
// Editing never reassigns the user — just the time/task — so the user
// picker only shows up when creating.
function ShiftBlockModal({
  date,
  block,
  onClose,
  onSaved,
}: {
  date: Date;
  block?: ShiftBlock;
  onClose: () => void;
  onSaved: (block: ShiftBlock) => void;
}) {
  const { accessToken, user: currentUser } = useAuth();
  const isEditing = !!block;
  const firstInputRef = React.useRef<HTMLSelectElement>(null);

  const [users, setUsers] = React.useState<BackendUser[] | null>(null);
  const [usersError, setUsersError] = React.useState('');
  const [userId, setUserId] = React.useState<number | ''>(block?.userId ?? '');
  const [startTime, setStartTime] = React.useState(block ? formatTime(block.startsAt) : '08:00');
  const [endTime, setEndTime] = React.useState(block ? formatTime(block.endsAt) : '10:00');
  const [task, setTask] = React.useState(block?.task ?? '');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isEditing || !accessToken) return;
    usersApi.list(accessToken)
      .then((list) => {
        setUsers(list);
        setUserId((prev) => (prev === '' && list.length > 0 ? list[0].id : prev));
      })
      .catch((err) => setUsersError(err instanceof ApiError ? err.message : 'Could not load users.'));
  }, [accessToken, isEditing]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError('');

    if (!task.trim()) {
      setError('Describe what this shift covers.');
      return;
    }
    const dateStr = toDateInputValue(date);
    const start = new Date(`${dateStr}T${startTime}:00`);
    const end = new Date(`${dateStr}T${endTime}:00`);
    if (end <= start) {
      setError('End time must be after start time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = isEditing
        ? await scheduleApi.updateBlock(accessToken, block.id, { startsAt: start.toISOString(), endsAt: end.toISOString(), task: task.trim() })
        : await scheduleApi.createBlock(accessToken, { userId: userId === '' ? (currentUser?.id ?? 0) : userId, startsAt: start.toISOString(), endsAt: end.toISOString(), task: task.trim() });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this shift.');
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
            <h3 className="font-bold text-lg text-slate-900">{isEditing ? 'Edit Shift' : 'Add Shift'}</h3>
            <p className="text-xs text-slate-500 mt-1">{formatDateLabel(date)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isEditing && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Technician</label>
              {usersError ? (
                <p className="text-xs text-red-600">{usersError}</p>
              ) : (
                <select
                  ref={firstInputRef}
                  value={userId}
                  onChange={(e) => setUserId(Number(e.target.value))}
                  disabled={users === null}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all disabled:opacity-60"
                >
                  {users === null && <option>Loading…</option>}
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Task</label>
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Morning Handoff & High Priority Queue"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
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
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
