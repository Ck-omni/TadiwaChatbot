import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConfirmModal({
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
