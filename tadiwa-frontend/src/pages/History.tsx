import React from 'react';
import { AlertCircle, Check, CheckCheck, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { escalationsApi, ApiError, type Escalation, type EscalationStatus } from '../lib/api';

// Escalation history — every chat session an agent (or the chatbot itself)
// flagged for human follow-up. Backed by GET/PUT /api/escalations
// (tadiwa-backend/apps/escalations), which is TEAM_LEAD/ADMIN only.

const STATUS_TABS: { value: EscalationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const STATUS_STYLES: Record<EscalationStatus, string> = {
  OPEN: 'text-red-700 bg-red-50 border-red-100',
  ACKNOWLEDGED: 'text-amber-700 bg-amber-50 border-amber-100',
  RESOLVED: 'text-emerald-700 bg-emerald-50 border-emerald-100',
};

function formatTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function History() {
  const { accessToken, user } = useAuth();
  const canView = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  const [escalations, setEscalations] = React.useState<Escalation[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [tab, setTab] = React.useState<EscalationStatus | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = React.useState<number | null>(null);
  const [updateError, setUpdateError] = React.useState<string | null>(null);

  const fetchEscalations = React.useCallback(async () => {
    if (!accessToken || !canView) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await escalationsApi.list(accessToken, tab === 'ALL' ? undefined : tab);
      setEscalations(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load escalation history.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canView, tab]);

  React.useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const handleUpdateStatus = async (escalation: Escalation, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    if (!accessToken) return;
    setUpdateError(null);
    setUpdatingId(escalation.id);
    try {
      const updated = await escalationsApi.updateStatus(accessToken, escalation.id, status);
      setEscalations((prev) =>
        prev?.map((e) => (e.id === escalation.id ? { ...e, ...updated, session: e.session } : e)) ?? prev
      );
    } catch (err) {
      setUpdateError(err instanceof ApiError ? err.message : 'Could not update this escalation.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Escalation History</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-300">Chat sessions flagged for human follow-up.</p>
        </div>
        <button
          onClick={fetchEscalations}
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
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Ask an admin if you need visibility into escalations.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm dark:bg-transparent dark:border-slate-600">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                  tab === t.value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadError && (
            <div className="flex items-center justify-between gap-3 px-6 py-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
              <button onClick={fetchEscalations} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
            </div>
          )}

          {updateError && (
            <div className="flex items-center justify-between gap-3 px-6 py-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <span className="flex items-center gap-2"><AlertCircle size={16} /> {updateError}</span>
              <button onClick={() => setUpdateError(null)} className="font-bold text-xs uppercase tracking-widest hover:underline">Dismiss</button>
            </div>
          )}

          {escalations === null && !loadError && (
            <p className="text-sm text-slate-400 text-center py-12">Loading escalation history…</p>
          )}

          {escalations !== null && escalations.length === 0 && !loadError && (
            <p className="text-sm text-slate-400 text-center py-12">No escalations {tab === 'ALL' ? 'yet' : `with status "${tab.toLowerCase()}"`}.</p>
          )}

          {escalations !== null && escalations.length > 0 && (
            <div className="space-y-3">
              {escalations.map((esc) => {
                const requester = esc.session?.user;
                const isUpdating = updatingId === esc.id;
                return (
                  <div key={esc.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm dark:bg-transparent dark:border-slate-600 flex-wrap">
                    <div className="text-[10px] font-mono text-slate-400 shrink-0 w-32">{formatTime(esc.createdAt)}</div>

                    <div className="flex-1 min-w-50">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{esc.reason}</p>
                      {requester && (
                        <p className="text-xs text-slate-400 mt-0.5">{requester.fullName || requester.email}</p>
                      )}
                    </div>

                    <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border shrink-0', STATUS_STYLES[esc.status])}>
                      {esc.status}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      {esc.status === 'OPEN' && (
                        <button
                          onClick={() => handleUpdateStatus(esc, 'ACKNOWLEDGED')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Acknowledge
                        </button>
                      )}
                      {esc.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateStatus(esc, 'RESOLVED')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />} Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
