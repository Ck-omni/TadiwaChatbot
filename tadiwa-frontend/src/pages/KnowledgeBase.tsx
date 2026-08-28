import React from 'react';
import {
  AlertCircle, ArchiveRestore, BookOpen, EyeOff, FileText, Loader2, Pencil,
  Plus, RefreshCw, Search, Tag, Type, Upload, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  knowledgeBaseApi, ApiError, KB_UPLOAD_ACCEPT,
  type KnowledgeBaseEntry, type CreateKnowledgeBaseInput,
} from '../lib/api';

// Guide procedures/articles agents (and the chat assistant) draw on. Backed
// by GET/POST/PUT/DELETE /api/knowledge-base (tadiwa-backend/apps/
// knowledgeBase) — the same table the Chrome extension's ticket-copilot
// ingests into directly, which is why some entries carry a `source`
// filename or `section` heading path that nothing here ever sets.

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function KnowledgeBase() {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [entries, setEntries] = React.useState<KnowledgeBaseEntry[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<KnowledgeBaseEntry | null>(null);
  const [viewingEntry, setViewingEntry] = React.useState<KnowledgeBaseEntry | null>(null);
  const [togglingEntry, setTogglingEntry] = React.useState<KnowledgeBaseEntry | null>(null);
  const [isToggling, setIsToggling] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fetchEntries = React.useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await knowledgeBaseApi.list(accessToken, isAdmin && showInactive);
      setEntries(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load the knowledge base.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAdmin, showInactive]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filtered = React.useMemo(() => {
    if (!entries) return null;
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.topic.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }, [entries, search]);

  const handleToggleActive = async () => {
    if (!accessToken || !togglingEntry) return;
    setActionError(null);
    setIsToggling(true);
    try {
      const updated = togglingEntry.isActive
        ? await knowledgeBaseApi.deactivate(accessToken, togglingEntry.id)
        : await knowledgeBaseApi.update(accessToken, togglingEntry.id, { isActive: true });
      setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? prev);
      setTogglingEntry(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this entry.');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-300">
            Guide procedures agents and the AI assistant draw on to resolve tickets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEntries}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 dark:bg-transparent dark:border-slate-600 dark:text-slate-200"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={14} /> Add Entry
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex-wrap dark:bg-transparent dark:border-slate-600">
        <div className="flex items-center gap-2 flex-1 min-w-45 px-3 py-2 bg-slate-50 rounded-xl dark:bg-slate-800">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topic or content…"
            className="bg-transparent text-sm outline-none w-full text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>
        )}
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {loadError}</span>
          <button onClick={fetchEntries} className="font-bold text-xs uppercase tracking-widest hover:underline">Retry</button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-xs uppercase tracking-widest hover:underline">Dismiss</button>
        </div>
      )}

      {filtered === null && !loadError && (
        <p className="text-sm text-slate-400 text-center py-16">Loading knowledge base…</p>
      )}

      {filtered !== null && filtered.length === 0 && !loadError && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center dark:bg-transparent dark:border-slate-600">
          <BookOpen size={28} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {search ? 'No entries match this search.' : 'No knowledge base entries yet.'}
          </p>
          {isAdmin && !search && (
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Add one by writing it directly or uploading a document.</p>
          )}
        </div>
      )}

      {filtered !== null && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onView={() => setViewingEntry(entry)}
              onEdit={() => setEditingEntry(entry)}
              onToggleActive={() => setTogglingEntry(entry)}
            />
          ))}
        </div>
      )}

      {(addModalOpen || editingEntry) && (
        <EntryFormModal
          entry={editingEntry ?? undefined}
          onClose={() => { setAddModalOpen(false); setEditingEntry(null); }}
          onSaved={(saved) => {
            setEntries((prev) => {
              if (!prev) return [saved];
              const exists = prev.some((e) => e.id === saved.id);
              return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev];
            });
            setAddModalOpen(false);
            setEditingEntry(null);
          }}
        />
      )}

      {viewingEntry && (
        <ViewEntryModal
          entry={viewingEntry}
          isAdmin={isAdmin}
          onClose={() => setViewingEntry(null)}
          onEdit={() => { setEditingEntry(viewingEntry); setViewingEntry(null); }}
        />
      )}

      {togglingEntry && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setTogglingEntry(null); }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <h3 className="font-bold text-lg text-slate-900">
              {togglingEntry.isActive ? 'Deactivate this entry?' : 'Reactivate this entry?'}
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              {togglingEntry.isActive
                ? `"${togglingEntry.topic}" will stop showing to agents and the AI assistant. This doesn't delete it — you can reactivate it any time.`
                : `"${togglingEntry.topic}" will start showing to agents and the AI assistant again.`}
            </p>
            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => setTogglingEntry(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isToggling}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-lg',
                  togglingEntry.isActive ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                )}
              >
                {isToggling && <Loader2 size={14} className="animate-spin" />}
                {isToggling ? 'Saving…' : togglingEntry.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryCard({
  entry, isAdmin, onView, onEdit, onToggleActive,
}: {
  entry: KnowledgeBaseEntry;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className={cn(
      'group bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 transition-all hover:shadow-md dark:bg-transparent',
      entry.isActive ? 'border-slate-200 dark:border-slate-600' : 'border-slate-200 opacity-60 dark:border-slate-600'
    )}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onView} className="text-left font-bold text-slate-900 dark:text-white text-sm leading-snug hover:text-blue-600 transition-colors line-clamp-2">
          {entry.topic}
        </button>
        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={onEdit} title="Edit" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil size={13} />
            </button>
            <button
              onClick={onToggleActive}
              title={entry.isActive ? 'Deactivate' : 'Reactivate'}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              {entry.isActive ? <EyeOff size={13} /> : <ArchiveRestore size={13} />}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-3 flex-1">{entry.content}</p>

      <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold uppercase tracking-widest">
        {!entry.isActive && (
          <span className="px-2 py-1 rounded-full text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900">Inactive</span>
        )}
        {entry.source && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900" title={entry.source}>
            <FileText size={10} /> {entry.source}
          </span>
        )}
        {entry.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800">
            <Tag size={10} /> {tag}
          </span>
        ))}
        <span className="ml-auto normal-case font-medium tracking-normal text-slate-400">
          {formatDate(entry.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function ViewEntryModal({
  entry, isAdmin, onClose, onEdit,
}: {
  entry: KnowledgeBaseEntry;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">{entry.topic}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-2 text-[10px] font-bold uppercase tracking-widest">
              {!entry.isActive && <span className="px-2 py-1 rounded-full text-red-700 bg-red-50">Inactive</span>}
              {entry.source && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-blue-700 bg-blue-50">
                  <FileText size={10} /> {entry.source}
                </span>
              )}
              {entry.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-slate-600 bg-slate-100">
                  <Tag size={10} /> {tag}
                </span>
              ))}
              <span className="normal-case font-medium tracking-normal text-slate-400">Updated {formatDate(entry.updatedAt)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-8 px-8 py-2 border-t border-slate-100">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed py-4">{entry.content}</p>
        </div>

        {isAdmin && (
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type EntryMode = 'write' | 'upload';

// Doubles as "Add Entry" (no `entry` prop — offers Write/Upload) and "Edit
// Entry" (with one — text fields only; re-extracting from a fresh upload on
// edit isn't supported, so that toggle is hidden while editing).
function EntryFormModal({
  entry, onClose, onSaved,
}: {
  entry?: KnowledgeBaseEntry;
  onClose: () => void;
  onSaved: (entry: KnowledgeBaseEntry) => void;
}) {
  const { accessToken } = useAuth();
  const isEditing = !!entry;

  const [mode, setMode] = React.useState<EntryMode>('write');
  const [topic, setTopic] = React.useState(entry?.topic ?? '');
  const [content, setContent] = React.useState(entry?.content ?? '');
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError('');

    if (mode === 'upload' && !isEditing) {
      if (!file) {
        setError('Choose a file to upload.');
        return;
      }
      setIsSubmitting(true);
      try {
        const saved = await knowledgeBaseApi.uploadFile(accessToken, file, topic.trim() || undefined);
        onSaved(saved);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not upload this file.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!topic.trim()) {
      setError('Give this entry a topic.');
      return;
    }
    if (!content.trim()) {
      setError('Content cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateKnowledgeBaseInput = { topic: topic.trim(), content: content.trim() };
      const saved = isEditing
        ? await knowledgeBaseApi.update(accessToken, entry.id, input)
        : await knowledgeBaseApi.create(accessToken, input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-slate-900">{isEditing ? 'Edit Entry' : 'Add Entry'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode('write')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all',
                mode === 'write' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
              )}
            >
              <Type size={13} /> Write
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all',
                mode === 'upload' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
              )}
            >
              <Upload size={13} /> Upload File
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'write' || isEditing ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="SIM Card Replacement"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder="Step-by-step procedure or reference text…"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all resize-y"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Document (PDF, Word, or text)
                </label>
                <label className="flex flex-col items-center justify-center gap-2 w-full px-4 py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all">
                  <Upload size={20} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {file ? file.name : 'Click to choose a file'}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400">PDF · DOCX · TXT · MD, max 15MB</span>
                  <input
                    type="file"
                    accept={KB_UPLOAD_ACCEPT}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Topic <span className="normal-case font-medium text-slate-400">(optional — defaults to the filename)</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Leave blank to use the filename"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>
            </>
          )}

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
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
