import React from 'react';
import { AlertCircle, BarChart3, CheckCircle2, MessageSquare, RefreshCw, Send, ShieldCheck, Target, Ticket, Users, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { dashboardApi, ApiError, type DashboardSummary } from '../lib/api';
import LineTrendChart from '../components/charts/LineTrendChart';
import CategoryDonutChart from '../components/charts/CategoryDonutChart';

// Validated categorical hues, fixed order — see the dataviz skill's
// references/palette.md. "Other" (the rollup of everything past the top 4
// matched KB sections) gets a neutral gray, not a competing hue.
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const OTHER_COLOR = '#94a3b8';

function queueZoneLabel(health: number) {
  if (health >= 90) return 'Green Zone';
  if (health >= 70) return 'Amber Zone';
  return 'Red Zone';
}

export default function Dashboard() {
  const { accessToken } = useAuth();
  const [chatMessage, setChatMessage] = React.useState('');
  const [teamMessages, setTeamMessages] = React.useState([
    { id: 1, user: 'Tinashe (Team Lead)', text: 'Heads up team, Ecocash PIN reset latency is increasing. Follow SOP 4.2.', time: '10:05 AM', isLeader: true },
    { id: 2, user: 'Blessing K.', text: 'Copy that. Seeing a few reports already.', time: '10:08 AM', isLeader: false },
    { id: 3, user: 'Sharon Z.', text: 'SIM Swap approvals are running smooth now.', time: '10:15 AM', isLeader: false },
  ]);

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchSummary = React.useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      setSummary(await dashboardApi.summary(accessToken));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const ticketCategories = React.useMemo(
    () => (summary?.ticketCategories ?? []).map((c, i) => ({
      ...c,
      color: i < CATEGORY_COLORS.length ? CATEGORY_COLORS[i] : OTHER_COLOR,
    })),
    [summary]
  );

  const handleSendTeamMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage = {
      id: Date.now(),
      user: 'You',
      text: chatMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isLeader: false
    };
    setTeamMessages([...teamMessages, newMessage]);
    setChatMessage('');
  };

  return (
    <div className=" mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight text-slate-600 dark:text-white">Dashboard</h1>
        <button
          onClick={fetchSummary}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 dark:bg-transparent dark:border-slate-600 dark:text-slate-200"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
          <button onClick={fetchSummary} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Active Techs"
          value={summary ? String(summary.activeTechs) : '—'}
          trend="Agents & Team Leads"
          icon={<Users className="text-blue-600" />}
        />
        <StatCard
          title="Avg Productivity"
          value={summary ? String(summary.avgProductivity) : '—'}
          trend="Resolutions / Tech"
          icon={<BarChart3 className="text-emerald-600" />}
        />
        <StatCard
          title="Next Week Target"
          value={summary ? String(summary.nextWeekTarget) : '—'}
          trend={summary && summary.nextWeekTarget > 0 ? 'Set by Team Lead' : 'Not Set Yet'}
          icon={<Target className="text-sky-600" />}
        />
        <StatCard
          title="Queue Health"
          value={summary ? `${summary.queueHealth}%` : '—'}
          trend={summary ? queueZoneLabel(summary.queueHealth) : '—'}
          icon={<CheckCircle2 className="text-emerald-600" />}
        />
      </div>

      <div className="">
        {/* Left Column: Resolutions & SOPs */}
        <div className="lg:col-span-12 xl:col-span-8 space-y-8">
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <div className="bg-white dark:border-slate-600 dark:bg-transparent rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="mb-6">
                <h2 className="font-bold text-lg text-slate-600 dark:text-slate-300">Team Ticket Resolutions</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">This week, across all active techs</p>
              </div>
              {summary ? (
                <LineTrendChart data={summary.weeklyResolutions} />
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">{loadError ? 'Could not load.' : 'Loading…'}</p>
              )}
            </div>
            <div className="bg-white dark:bg-transparent dark:border-slate-600 rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="mb-6">
                <h2 className="font-bold text-lg text-slate-600 dark:text-slate-300">Ticket Category Breakdown</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">Chatbot-matched KB topic, this week</p>
              </div>
              {!summary ? (
                <p className="text-sm text-slate-400 text-center py-12">{loadError ? 'Could not load.' : 'Loading…'}</p>
              ) : ticketCategories.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">No chatbot activity this week yet.</p>
              ) : (
                <CategoryDonutChart data={ticketCategories} centerLabel="Tickets This Week" />
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-transparent rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 relative">
             <div className="absolute top-0 right-0 p-8 opacity-5">
               <ShieldCheck size={120} />
             </div>
             <div className="flex items-center justify-between mb-8">
               <h2 className="font-bold text-2xl flex items-center gap-3 text-slate-600 dark:text-slate-300">
                 <Ticket size={24} className="text-blue-600" />
                 Core Resolutions & SOPs
               </h2>
               <div className="flex gap-2">
                 <span className="px-3 py-1 bg-blue-50 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-widest border border-blue-200">Updated Today</span>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <ResolutionItem
                 title="SIM Card Replacement"
                 summary="Authenticate on Back-Office Portal → Enter CCID → Process in Individual Portal."
                 steps={[
                   "Switch to Back-Office portal",
                   "Authenticate SIM card",
                   "Order Entry → Operations → SIM Replacement",
                   "Enter ICCID and Ticket ID"
                 ]}
               />
               <ResolutionItem
                 title="Line Reconnection"
                 summary="Recycle disabled SIMs and bind to active service numbers."
                 steps={[
                   "Check SIM Lifecycle for 'disabled' state",
                   "Recycle if disabled, escalate if available",
                   "Perform SIM Card Binding",
                   "PPS First Dial in Operations"
                 ]}
               />
               <ResolutionItem
                 title="Hanging Orders"
                 summary="Check Abnormal Work Orders and redo provisioning actions."
                 steps={[
                   "Provisioning → Dispatch Order Query",
                   "Copy Dispatch ID → Online Work Order Query",
                   "Check Abnormal Work Order tab",
                   "Authenticate HLR/HGIRI/Check In as needed"
                 ]}
               />
               <ResolutionItem
                 title="Roaming / USSD Fixes"
                 summary="Verify HLR parameters and OBSSM restrictions."
                 steps={[
                   "Check cvBS and RSA 2-6 variants (Roaming)",
                   "SUD command to remove OBSSM (USSD)",
                   "Reset VLR/SGSN if restricted",
                   "Manual network selection advice"
                 ]}
               />
             </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl p-6 border border-emerald-200 dark:border-emerald-500/20">
              <h3 className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-4 font-bold flex items-center gap-2">
                <Zap size={14} /> Quick Action: Services
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Adding GPRS/Telephony:</p>
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 space-y-1">
                <div>1. Order Entry → Modify Offer</div>
                <div>2. Add Button → Search Service</div>
                <div>3. Waiver 100% (for bundles)</div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-200">
              <h3 className="text-xs uppercase tracking-widest text-blue-700 mb-4 font-bold flex items-center gap-2">
                <Zap size={14} /> Quick Action: Balance
              </h3>
              <p className="text-sm text-slate-600 mb-4">Adjustments & D.A:</p>
              <div className="text-[10px] font-mono text-slate-400 space-y-1">
                <div>1. Account Receivable → Adjust</div>
                <div>2. Add Account Balance for new D.A</div>
                <div>3. Select Unit of Measurement</div>
              </div>
            </div>
            <div className="bg-sky-50 rounded-3xl p-6 border border-sky-200">
              <h3 className="text-xs uppercase tracking-widest text-sky-700 mb-4 font-bold flex items-center gap-2">
                <Zap size={14} /> Quick Action: Blocks
              </h3>
              <p className="text-sm text-slate-600 mb-4">Suspensions/Lost SIM:</p>
              <div className="text-[10px] font-mono text-slate-400 space-y-1">
                <div>1. Operations → Suspension/LOST</div>
                <div>2. Reactivation → Restore</div>
                <div>3. Enter Ticket ID → Confirm</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-transparent p-6 rounded-2xl border border-slate-200  hover:shadow-md overflow-hidden relative group transition-shadow dark:border-slate-700 min-w-0">
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full blur-3xl group-hover:bg-slate-100 transition-colors"></div>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="p-2 bg-slate-100 rounded-xl border border-slate-200 shrink-0">{icon}</div>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest dark:text-slate-300 text-right min-w-0 break-words">{trend}</span>
      </div>
      <p className="text-sm text-slate-500 font-medium break-words">{title}</p>
      <h3 className="text-3xl sm:text-4xl font-bold mt-1 tracking-tighter text-slate-600 dark:text-slate-300 break-words">{value}</h3>
    </div>
  );
}

function ResolutionItem({ title, summary, steps }: { title: string, summary: string, steps: string[] }) {
  return (
    <div className="p-6 bg-white dark:bg-transparent border border-slate-200 shadow-sm rounded-3xl hover:shadow-md transition-all border-l-4 border-l-blue-500 group">
      <h3 className="font-bold text-base mb-2 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed italic border-b border-slate-100 pb-4">{summary}</p>
      <ul className="space-y-2">
        {steps.map((step, idx) => (
          <li key={idx} className="flex gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="text-blue-600 font-bold">{idx + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
