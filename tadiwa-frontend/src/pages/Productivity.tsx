import React from 'react';
import { AlertCircle, BarChart3, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw, Target, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { productivityApi, ApiError, type ProductivityEntry } from '../lib/api';

// Weekly escalation-resolution targets: a team lead/admin hands each agent a
// number for the week, and productivity is just that target measured
// against how many of their escalations actually got resolved — backed by
// GET/POST /api/productivity (tadiwa-backend/apps/productivity). Surpassing
// a target is expected and celebrated, not capped.

function mondayOf(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);
  return utc;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatWeekRange(monday: Date) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const startLabel = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endLabel = sunday.toLocaleDateString(undefined, sameMonth ? { day: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${startLabel} – ${endLabel}, ${sunday.getUTCFullYear()}`;
}

export default function Productivity() {
  const { accessToken, user } = useAuth();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));

  const [entries, setEntries] = React.useState<ProductivityEntry[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [targetingUser, setTargetingUser] = React.useState<ProductivityEntry | null>(null);

  const fetchEntries = React.useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await productivityApi.list(accessToken, toDateInputValue(weekStart));
      setEntries(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load productivity data.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, weekStart]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const stats = React.useMemo(() => {
    if (!entries || entries.length === 0) return null;
    const withTargets = entries.filter((e) => e.target != null);
    const totalTarget = withTargets.reduce((sum, e) => sum + (e.target ?? 0), 0);
    const totalResolved = withTargets.reduce((sum, e) => sum + e.resolved, 0);
    const surpassedCount = entries.filter((e) => e.surpassed).length;
    const overallPercent = totalTarget > 0 ? Math.round((totalResolved / totalTarget) * 100) : null;
    return { totalTarget, totalResolved, surpassedCount, overallPercent, trackedCount: withTargets.length };
  }, [entries]);

  const me = React.useMemo(() => entries?.find((e) => e.userId === user?.id) ?? null, [entries, user?.id]);

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isPrivileged ? 'Team Productivity' : 'My Productivity'}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm dark:bg-transparent dark:border-slate-600">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors dark:hover:bg-slate-800"
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatWeekRange(weekStart)}</span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors dark:hover:bg-slate-800"
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={fetchEntries}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 dark:bg-transparent dark:border-slate-600 dark:text-slate-200"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
          <button onClick={fetchEntries} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard/Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-transparent dark:border-slate-600">
          <div className="p-6 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <BarChart3 className="text-blue-600" size={20} />
              Weekly Resolutions
            </h2>
          </div>

          {entries === null && !loadError && (
            <p className="text-sm text-slate-400 text-center py-12">Loading productivity data…</p>
          )}

          {entries !== null && entries.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">No users to show.</p>
          )}

          {entries !== null && entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className='dark:bg-blue-500 '>
                  <tr className="border-b border-slate-200 dark:border-slate-600 text-[10px] uppercase tracking-widest text-slate-400 dark:text-white">
                    <th className="px-6 py-4 font-bold">Technician</th>
                    <th className="px-6 py-4 font-bold text-center">Target</th>
                    <th className="px-6 py-4 font-bold text-center">Resolved</th>
                    <th className="px-6 py-4 font-bold text-center">% of Target</th>
                    <th className="px-6 py-4 font-bold text-right">{isPrivileged ? 'Actions' : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                  {entries.map((entry) => (
                    <tr key={entry.userId} className="transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                            {entry.fullName[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{entry.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-mono text-slate-700 dark:text-white">
                        {entry.target ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-mono text-slate-700 dark:text-white">{entry.resolved}</td>
                      <td className="px-6 py-4 text-center">
                        {entry.percentOfTarget == null ? (
                          <span className="text-xs px-2 py-1 rounded-md font-bold text-slate-400 bg-slate-50">No target</span>
                        ) : (
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-md font-bold",
                            entry.surpassed ? "text-emerald-700 bg-emerald-50" : entry.percentOfTarget >= 75 ? "text-blue-700 bg-blue-50" : "text-orange-700 bg-orange-50"
                          )}>
                            {entry.percentOfTarget}%{entry.surpassed ? ' ↑' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isPrivileged && (
                          <button
                            onClick={() => setTargetingUser(entry)}
                            title="Set weekly target"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Targets Summary */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-3xl p-6 border border-blue-200 dark:bg-transparent dark:border-slate-600 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-6 font-mono flex items-center gap-2">
              <Target size={16} /> {isPrivileged ? 'Team Target' : 'My Target'}
            </h3>
            {isPrivileged ? (
              stats ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-4xl font-bold font-mono text-slate-900 mb-1 dark:text-white">{stats.totalResolved}<span className="text-lg text-slate-400">/{stats.totalTarget}</span></p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest dark:text-slate-300">Resolutions vs Target this week</p>
                  </div>
                  <div className="pt-4 border-t border-blue-200 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-300">Overall Achievement</span>
                      <span className="font-mono text-slate-900 dark:text-white">{stats.overallPercent != null ? `${stats.overallPercent}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-300">Agents Surpassed</span>
                      <span className="text-emerald-600 font-bold">{stats.surpassedCount} / {entries?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-300">Targets Set</span>
                      <span className="font-mono text-slate-900 dark:text-white">{stats.trackedCount} / {entries?.length ?? 0}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">No data for this week yet.</p>
              )
            ) : me ? (
              <div className="space-y-4">
                <div>
                  <p className="text-4xl font-bold font-mono text-slate-900 mb-1 dark:text-white">
                    {me.resolved}{me.target != null && <span className="text-lg text-slate-400">/{me.target}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest dark:text-slate-300">Resolutions this week</p>
                </div>
                {me.target != null && (
                  <div className="pt-4 border-t border-blue-200 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-300">% of Target</span>
                      <span className={cn("font-bold", me.surpassed ? "text-emerald-600" : "text-slate-900 dark:text-white")}>{me.percentOfTarget}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-300">{me.surpassed ? 'Surpassed by' : 'Remaining'}</span>
                      <span className="text-emerald-600 font-bold">{Math.abs(me.resolved - me.target)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-300">Loading…</p>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm dark:bg-transparent dark:border-slate-600">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 font-mono dark:text-white">Insight</h3>
            <p className="text-sm text-slate-600 leading-relaxed italic dark:text-slate-300">
              {isPrivileged
                ? stats
                  ? stats.trackedCount === 0
                    ? 'No weekly targets have been set yet — use the pencil icon on a row to set one.'
                    : `${stats.surpassedCount} of ${stats.trackedCount} agents with a target have surpassed it this week. Overall achievement sits at ${stats.overallPercent ?? 0}%.`
                  : 'No productivity data for this week yet.'
                : me?.target == null
                  ? "No target has been set for you this week yet — check back once your team lead sets one."
                  : me.surpassed
                    ? `Great work — you've surpassed your target of ${me.target} by ${me.resolved - me.target} resolution${me.resolved - me.target === 1 ? '' : 's'}.`
                    : `You're at ${me.percentOfTarget}% of your target — ${me.target - me.resolved} more resolution${me.target - me.resolved === 1 ? '' : 's'} to go this week.`}
            </p>
          </div>
        </div>
      </div>

      {targetingUser && (
        <SetTargetModal
          entry={targetingUser}
          weekStart={weekStart}
          onClose={() => setTargetingUser(null)}
          onSaved={(userId, target) => {
            setEntries((prev) =>
              prev?.map((e) => (e.userId === userId ? { ...e, target, percentOfTarget: target ? Math.round((e.resolved / target) * 100) : null, surpassed: e.resolved > target } : e)) ?? prev
            );
            setTargetingUser(null);
          }}
        />
      )}
    </div>
  );
}

function SetTargetModal({
  entry,
  weekStart,
  onClose,
  onSaved,
}: {
  entry: ProductivityEntry;
  weekStart: Date;
  onClose: () => void;
  onSaved: (userId: number, target: number) => void;
}) {
  const { accessToken } = useAuth();
  const firstInputRef = React.useRef<HTMLInputElement>(null);

  const [target, setTarget] = React.useState(String(entry.target ?? ''));
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError('');

    const parsed = Number(target);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole number of 0 or more.');
      return;
    }

    setIsSubmitting(true);
    try {
      await productivityApi.setTarget(accessToken, { userId: entry.userId, weekStart: toDateInputValue(weekStart), target: parsed });
      onSaved(entry.userId, parsed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set this target.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Set Weekly Target</h3>
            <p className="text-xs text-slate-500 mt-1">{entry.fullName} · {formatWeekRange(weekStart)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Escalations to Resolve</label>
            <input
              ref={firstInputRef}
              type="number"
              min={0}
              step={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 20"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-2">Currently resolved this week: {entry.resolved}. Surpassing the target is fine — there's no cap.</p>
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
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
              {isSubmitting ? 'Saving…' : 'Set Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
