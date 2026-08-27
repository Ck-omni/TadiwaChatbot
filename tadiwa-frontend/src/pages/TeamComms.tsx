import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, Search, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { chatsApi, ApiError, ROLE_LABELS, type BackendUser, type ChatMessage, type ConversationSummary } from '../lib/api';

const CONVERSATIONS_POLL_MS = 6000;
const MESSAGES_POLL_MS = 4000;

function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Sidebar preview time: exact clock time today, "Yesterday", "N days ago",
// then a short date — same idea the old mock data used, now driven by real timestamps.
function formatRelativePreview(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatClockTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TeamComms() {
  const { user, accessToken } = useAuth();
  // A notification-bell click on a chat item navigates here with
  // state:{peerId} to jump straight into that conversation.
  const location = useLocation();
  const initialPeerId = (location.state as { peerId?: number } | null)?.peerId ?? null;

  const [peers, setPeers] = React.useState<BackendUser[] | null>(null);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<number | null>(initialPeerId);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [sendError, setSendError] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const conversationByPeerId = React.useMemo(() => {
    const map = new Map<number, ConversationSummary>();
    for (const c of conversations) map.set(c.peer.id, c);
    return map;
  }, [conversations]);

  const activeContact = React.useMemo(() => peers?.find((p) => p.id === activeId) ?? null, [peers, activeId]);

  const filteredPeers = React.useMemo(
    () => (peers ?? []).filter((p) => p.fullName.toLowerCase().includes(search.trim().toLowerCase())),
    [peers, search]
  );

  const loadDirectory = React.useCallback(async () => {
    if (!accessToken) return;
    setLoadError(null);
    try {
      const [peerList, conversationList] = await Promise.all([
        chatsApi.listPeers(accessToken),
        chatsApi.listConversations(accessToken),
      ]);
      setPeers(peerList);
      setConversations(conversationList);
      setActiveId((current) => current ?? peerList[0]?.id ?? null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load Team Comms.');
    }
  }, [accessToken]);

  const refreshConversations = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      setConversations(await chatsApi.listConversations(accessToken));
    } catch {
      // Silent — this is a background refresh; the visible error banner is
      // owned by loadDirectory's initial load, not by polling.
    }
  }, [accessToken]);

  const loadMessages = React.useCallback(async (peerId: number, opts: { showSpinner: boolean }) => {
    if (!accessToken) return;
    if (opts.showSpinner) setMessagesLoading(true);
    try {
      const list = await chatsApi.getMessages(accessToken, peerId);
      setMessages(list);
      if (list.some((m) => m.senderId === peerId && !m.readAt)) {
        await chatsApi.markRead(accessToken, peerId);
        refreshConversations();
      }
    } catch (err) {
      if (opts.showSpinner) setLoadError(err instanceof ApiError ? err.message : 'Could not load this conversation.');
    } finally {
      if (opts.showSpinner) setMessagesLoading(false);
    }
  }, [accessToken, refreshConversations]);

  // Initial load.
  React.useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Poll the conversation list (sidebar previews + unread badges) in the background.
  React.useEffect(() => {
    const id = setInterval(refreshConversations, CONVERSATIONS_POLL_MS);
    return () => clearInterval(id);
  }, [refreshConversations]);

  // Load history whenever the active contact changes, then keep polling it
  // while that conversation stays open — there's no push/websocket layer on
  // the backend, so this is how an incoming reply shows up without a manual reload.
  React.useEffect(() => {
    if (activeId === null) return;
    loadMessages(activeId, { showSpinner: true });
    const id = setInterval(() => loadMessages(activeId, { showSpinner: false }), MESSAGES_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, accessToken]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, activeId]);

  const handleSend = async () => {
    if (!draft.trim() || !activeId || !accessToken) return;
    setSending(true);
    setSendError('');
    try {
      const sent = await chatsApi.sendMessage(accessToken, activeId, draft.trim());
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      refreshConversations();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto h-[calc(100vh-128px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-300">Team Comms</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-2xl">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-blue-700">Zimbabwe Back-Office (Active)</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden flex dark:bg-transparent">
        {/* Left: Contacts */}
        <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 dark:bg-transparent dark:border-slate-600">
          <div className="p-5 border-b border-slate-200 bg-white dark:bg-transparent dark:border-slate-600">
            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5 border border-slate-200 focus-within:border-blue-400 transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loadError && (
              <div className="flex flex-col items-center gap-2 text-center px-4 py-8">
                <AlertCircle size={20} className="text-red-500" />
                <p className="text-xs text-red-600">{loadError}</p>
                <button onClick={loadDirectory} className="text-xs font-bold text-blue-600 hover:underline">Retry</button>
              </div>
            )}

            {!loadError && peers === null && (
              <p className="text-xs text-slate-400 text-center py-8 px-4">Loading contacts…</p>
            )}

            {!loadError && peers !== null && filteredPeers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8 px-4">
                {peers.length === 0 ? 'No other users yet.' : `No contacts match "${search}"`}
              </p>
            )}

            {!loadError && filteredPeers.map((peer) => {
              const conversation = conversationByPeerId.get(peer.id);
              return (
                <ContactRow
                  key={peer.id}
                  peer={peer}
                  preview={conversation?.lastMessage?.content ?? 'No messages yet'}
                  time={conversation?.lastMessage ? formatRelativePreview(conversation.lastMessage.createdAt) : ''}
                  unreadCount={conversation?.unreadCount ?? 0}
                  active={peer.id === activeId}
                  onClick={() => setActiveId(peer.id)}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Active conversation */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeContact ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              {peers === null ? 'Loading…' : 'Select a contact to start messaging.'}
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-600 flex items-center gap-3 bg-white shrink-0 dark:bg-transparent">
                <Avatar name={activeContact.fullName} isLeader={activeContact.role === 'TEAM_LEAD'} active={activeContact.isActive !== false} size={40} />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-slate-300 truncate">{activeContact.fullName}</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400">
                    {activeContact.isActive !== false ? (
                      <span className="text-emerald-600 font-medium">● Active</span>
                    ) : (
                      'Deactivated'
                    )}
                    {' · '}
                    {ROLE_LABELS[activeContact.role]}
                  </p>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {messagesLoading && <p className="text-xs text-slate-400 text-center py-8">Loading conversation…</p>}
                {!messagesLoading && messages.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">Start the conversation with {activeContact.fullName}.</p>
                )}
                {!messagesLoading && messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} contact={activeContact} isMe={msg.senderId === user?.id} />
                ))}
              </div>

              <div className="p-4 bg-white border-t border-slate-200 shrink-0 dark:bg-slate-950">
                {sendError && <p className="text-[10px] text-red-600 mb-2 px-1">{sendError}</p>}
                <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-2 border border-slate-200 focus-within:border-blue-400 transition-all">
                  <input
                    type="text"
                    placeholder={`Message ${activeContact.fullName}...`}
                    className="flex-1 bg-transparent border-none focus:outline-none text-xs text-slate-900 px-2 placeholder:text-slate-400"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, isLeader, active, size = 36 }: { name: string; isLeader: boolean; active: boolean; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={cn(
          'w-full h-full rounded-full flex items-center justify-center font-bold border',
          isLeader ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600'
        )}
        style={{ fontSize: size * 0.36 }}
      >
        {initials}
      </div>
      {active && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
}

function ContactRow({
  peer,
  preview,
  time,
  unreadCount,
  active,
  onClick,
}: {
  peer: BackendUser;
  preview: string;
  time: string;
  unreadCount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-5 py-4 border-b border-slate-100 text-left transition-colors dark:border-slate-600',
        active ? 'bg-blue-600 text-white' : 'hover:bg-white/60'
      )}
    >
      <Avatar name={peer.fullName} isLeader={peer.role === 'TEAM_LEAD'} active={peer.isActive !== false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm truncate', unreadCount > 0 ? 'font-bold' : 'font-medium', active ? 'text-white' : unreadCount > 0 ? 'text-slate-900' : 'text-slate-700')}>
            {peer.fullName}
          </span>
          {time && <span className={cn('text-[9px] font-mono shrink-0', active ? 'text-white/70' : 'text-slate-400')}>{time}</span>}
        </div>
        <p className={cn('text-xs truncate mt-0.5', active ? 'text-white/80' : unreadCount > 0 ? 'text-slate-600 font-medium' : 'text-slate-400')}>
          {preview}
        </p>
      </div>
      {unreadCount > 0 && (
        <span className={cn(
          'shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
          active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
        )}>
          {unreadCount}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ message, contact, isMe }: { message: ChatMessage; contact: BackendUser; isMe: boolean }) {
  return (
    <div className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={cn('text-[9px] font-bold uppercase tracking-wider', contact.role === 'TEAM_LEAD' && !isMe ? 'text-blue-600' : 'text-slate-400')}>
          {isMe ? 'You' : contact.fullName}
        </span>
        <span className="text-[8px] text-slate-300 font-mono">{formatClockTime(message.createdAt)}</span>
      </div>
      <div className="max-w-[70%] p-4 rounded-2xl text-xs leading-relaxed bg-blue-600 text-white" style={{ borderTopRightRadius: isMe ? 0 : undefined, borderTopLeftRadius: !isMe ? 0 : undefined }}>
        {message.content}
      </div>
    </div>
  );
}
