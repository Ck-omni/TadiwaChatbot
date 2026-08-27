import React from 'react';
import { AlertCircle, Filter, RefreshCw, Search, ShieldAlert, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { auditApi, ApiError, type AuditLogEntry, type AuditLogFilters } from '../lib/api';

// Every row here is one suggestion request the "ZSmart Ticket Copilot"
// Chrome extension made to its backend — the closest thing this system has
// to a chatbot login/usage event. See tadiwa-backend/apps/audit for where
// GET /api/audit reads these from the extension's own database.

const RATING_OPTIONS: { value: '' | 'up' | 'down'; label: string }[] = [
  { value: '', label: 'All ratings' },
  { value: 'up', label: 'Thumbs up' },
  { value: 'down', label: 'Thumbs down' },
];

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function RatingBadge({ rating }: { rating: AuditLogEntry['rating'] }) {
  if (rating === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full text-emerald-700 bg-emerald-50">
        <ThumbsUp size={10} /> Up
      </span>
    );
  }
  if (rating === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full text-red-700 bg-red-50">
        <ThumbsDown size={10} /> Down
      </span>
    );
  }
  return <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full text-slate-500 bg-slate-100">—</span>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 dark:bg-transparent dark:border-slate-600">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

export default function AuditLog() {
  const { accessToken, user } = useAuth();

  // The backend 403s anyone below TEAM_LEAD — skip the round trip and
  // explain why, rather than surfacing a raw "permission" error.
  const canView = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  const [entries, setEntries] = React.useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const [usernameInput, setUsernameInput] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [rating, setRating] = React.useState<'' | 'up' | 'down'>('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  const filters: AuditLogFilters = React.useMemo(
    () => ({
      username: username || undefined,
      rating: rating || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [username, rating, from, to]
  );

  const fetchEntries = React.useCallback(async () => {
    if (!accessToken || !canView) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await auditApi.list(accessToken, filters);
      setEntries(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load the audit log.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canView, filters]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsername(usernameInput.trim());
  };

  const clearFilters = () => {
    setUsernameInput('');
    setUsername('');
    setRating('');
    setFrom('');
    setTo('');
  };

  const hasFilters = !!(username || rating || from || to);

  const stats = React.useMemo(() => {
    if (!entries) return null;
    const total = entries.length;
    const noMatch = entries.filter((e) => !e.matchedSection).length;
    const up = entries.filter((e) => e.rating === 'up').length;
    const down = entries.filter((e) => e.rating === 'down').length;
    const rated = up + down;
    const satisfaction = rated > 0 ? `${Math.round((up / rated) * 100)}%` : '—';
    return { total, noMatch, satisfaction };
  }, [entries]);

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-300">
            Every suggestion the ZSmart Ticket Copilot Chrome extension served, and how agents rated it.
          </p>
        </div>
        <button
          onClick={fetchEntries}
          disabled={!canView || isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 dark:bg-transparent dark:border-slate-600 dark:text-slate-200"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {!canView ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center dark:bg-transparent dark:border-slate-600">
          <ShieldAlert size={28} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Team Lead or Admin access required.</p>
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Ask an admin if you need visibility into extension usage.</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatTile label="Requests" value={String(stats.total)} />
              <StatTile label="No KB match" value={String(stats.noMatch)} />
              <StatTile label="Agent satisfaction" value={stats.satisfaction} />
            </div>
          )}

          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex-wrap dark:bg-transparent dark:border-slate-600"
          >
            <div className="flex items-center gap-2 flex-1 min-w-45 px-3 py-2 bg-slate-50 rounded-xl dark:bg-slate-800">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Search by user…"
                className="bg-transparent text-sm outline-none w-full text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <select
              value={rating}
              onChange={(e) => setRating(e.target.value as '' | 'up' | 'down')}
              className="px-3 py-2 bg-slate-50 rounded-xl text-sm text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-100"
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="px-3 py-2 bg-slate-50 rounded-xl text-sm text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-100"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="px-3 py-2 bg-slate-50 rounded-xl text-sm text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-100"
            />

            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              <Filter size={14} /> Apply
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-widest dark:text-slate-400"
              >
                <X size={14} /> Clear
              </button>
            )}
          </form>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden dark:bg-transparent border border-slate-200 dark:border-slate-600">
            {loadError && (
              <div className="flex items-center justify-between gap-3 px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
                <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
                <button onClick={fetchEntries} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
              </div>
            )}

            {entries === null && !loadError && (
              <p className="text-sm text-slate-400 text-center py-12">Loading audit log…</p>
            )}

            {entries !== null && entries.length === 0 && !loadError && (
              <p className="text-sm text-slate-400 text-center py-12">
                {hasFilters ? 'No requests match these filters.' : 'No extension activity recorded yet.'}
              </p>
            )}

            {entries !== null && entries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="dark:bg-blue-500 dark:text-white">
                    <tr className="border-b border-slate-200 dark:border-slate-600 text-sm tracking-widest text-slate-400 dark:text-white">
                      <th className="px-6 py-4 font-medium whitespace-nowrap">Time</th>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Capture Source</th>
                      <th className="px-6 py-4 font-medium">Matched Section</th>
                      <th className="px-6 py-4 font-medium text-right">KB Hits</th>
                      <th className="px-6 py-4 font-medium text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                    {entries.map((entry) => (
                      <tr key={entry.requestId} className="transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-300 whitespace-nowrap">
                          {formatTimestamp(entry.ts)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                              {entry.username[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{entry.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-300">{entry.captureSource || '—'}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-300">
                          {entry.matchedSection || <span className="text-red-600">No match</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-300 text-right">{entry.kbHits ?? '—'}</td>
                        <td className="px-6 py-4 text-right"><RatingBadge rating={entry.rating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
