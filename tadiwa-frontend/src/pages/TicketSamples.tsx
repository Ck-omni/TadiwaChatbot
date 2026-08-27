import { Home, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';

// A static reference recreation of a ZSmart v9 "Case Detail" record — shown
// to agents so they can recognize the real system's field layout without
// needing a live ticket open. Every value here is fabricated sample data,
// not a real case (fields that were redacted PII in the source screenshot
// are filled with obviously-fake placeholders, clearly marked below).

interface Field {
  label: string;
  value: string;
  link?: boolean;
}

const BASIC_INFO_COLUMNS: Field[][] = [
  [
    { label: 'Case Code', value: 'CASE-2026052600123' },
    { label: 'Case Type', value: 'Normal' },
    { label: 'Creator', value: 'T. Moyo (Econet Staff)' },
    { label: 'Expedite', value: 'No' },
    { label: 'Alert Limit Time', value: '2026-05-26 13:02:26' },
    { label: 'Case Status', value: 'Closed' },
    { label: 'SLA Countdown Time', value: '0D 1H 36M' },
  ],
  [
    { label: 'Source', value: 'Econet Staff' },
    { label: 'Creator Phone', value: '+263 71 234 5678' },
    { label: 'Notification Channel', value: 'SMS' },
    { label: 'Finish Limit Time', value: '2026-05-26 13:17:26' },
    { label: 'Current Handler', value: '-' },
  ],
  [
    { label: 'Urgency', value: 'Normal' },
    { label: 'FCR', value: 'No' },
    { label: 'Case Creation Time', value: '2026-05-26 11:32:26' },
    { label: 'Parent Rule Case', value: 'No' },
    { label: 'Repeat Count', value: '0' },
  ],
];

const CUSTOMER_INFO_COLUMNS: Field[][] = [
  [
    { label: 'Service Number', value: '+263 77 000 0000' },
    { label: 'Next of kin', value: '-' },
    { label: 'Main Offer', value: 'Postpaid Staff Subscription Plan' },
    { label: 'Status Reason', value: '-' },
  ],
  [
    { label: 'Customer Name', value: 'CALL CENTRE (VIRTUAL)', link: true },
    { label: 'Contact Phone', value: '-' },
    { label: 'Account Type', value: 'Postpaid' },
    { label: 'ID Number', value: '63-000000A00' },
  ],
  [
    { label: 'Account No.', value: '10023456789' },
    { label: 'Contact Email', value: '-' },
    { label: 'Subscriber Status', value: 'Active' },
  ],
];

function FieldRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-36 shrink-0 text-right text-slate-400 dark:text-slate-500">{label}:</span>
      <span className={cn('font-medium', link ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200')}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-1 h-4 bg-blue-600 rounded-full" />
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
    </div>
  );
}

export default function TicketSamples() {
  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Ticket Sample</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-300">
            Reference layout of a ZSmart Case Detail record, so it's recognizable without a live ticket open.
          </p>
        </div>
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          Sample data — not a live ticket
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-transparent dark:border-slate-600">
        {/* Decorative recreation of ZSmart's own browser-style tab strip */}
        <div className="flex items-stretch bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
          <div className="flex items-center justify-center w-10 border-r border-slate-200 dark:border-slate-700 text-slate-400">
            <Home size={15} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-r border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
            Task Center
            <X size={13} className="text-slate-300" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-sm font-medium text-blue-700 dark:text-blue-400 border-b-2 border-b-blue-600 -mb-px">
            Case Detail
            <X size={13} className="text-slate-300" />
          </div>
        </div>

        {/* Page header row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Case Detail</h3>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800">
            <Plus size={13} /> Add Note
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Basic Information */}
          <section>
            <SectionHeader title="Basic Information" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-3">
              {BASIC_INFO_COLUMNS.map((column, i) => (
                <div key={i} className="space-y-3">
                  {column.map((f) => (
                    <FieldRow key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Case Information */}
          <section>
            <SectionHeader title="Case Information" />
            <div className="space-y-4">
              <FieldRow label="Case Service Type" value="Omni_Smartbiz Bundles(OmniContact Helpdesk Support)" />
              <div className="flex gap-3 text-sm">
                <span className="w-36 shrink-0 text-right text-slate-400 dark:text-slate-500 pt-2">Content:</span>
                <div className="flex-1 min-h-24 px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 dark:border-slate-600 dark:text-slate-200">
                  TEST
                </div>
              </div>
            </div>
          </section>

          {/* Customer Information */}
          <section>
            <SectionHeader title="Customer Information" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-3">
              {CUSTOMER_INFO_COLUMNS.map((column, i) => (
                <div key={i} className="space-y-3">
                  {column.map((f) => (
                    <FieldRow key={f.label} label={f.label} value={f.value} link={f.link} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
