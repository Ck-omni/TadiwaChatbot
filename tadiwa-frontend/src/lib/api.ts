/**
 * Thin client for the tadiwa-backend API. Every response is the backend's
 * standard envelope: { success, message, data }. This unwraps it and throws
 * ApiError (carrying the backend's own message + HTTP status) on failure,
 * so callers can show `err.message` straight to the user.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

async function apiFetch<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    // Network failure (backend down, CORS rejection, offline) — fetch throws
    // before there's any Response to read a message from.
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page) — fall through, body stays null.
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

// Like apiFetch, but for multipart/form-data (file uploads): the browser
// must set its own Content-Type with the multipart boundary, so this
// deliberately never sets one itself — only Authorization.
async function apiUpload<T>(path: string, formData: FormData, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: formData, headers });
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body — fall through, body stays null.
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

export type UserRole = 'AGENT' | 'TEAM_LEAD' | 'ADMIN';

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  TEAM_LEAD: 'Team Lead',
  AGENT: 'Agent',
};

export interface BackendUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  // /auth/me's field selection omits these two; /api/users's includes them.
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logout: (refreshToken: string) =>
    apiFetch<null>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: (accessToken: string) => apiFetch<BackendUser>('/auth/me', { method: 'GET' }, accessToken),
};

export interface CreateUserInput {
  email: string;
  password: string;
  fullName?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export const usersApi = {
  // ADMIN or TEAM_LEAD only — the backend 403s anyone else.
  list: (accessToken: string) => apiFetch<BackendUser[]>('/users', { method: 'GET' }, accessToken),

  // ADMIN only. There is no invite-by-email flow on the backend — this
  // creates the account directly with the given password.
  create: (accessToken: string, input: CreateUserInput) =>
    apiFetch<BackendUser>('/users', { method: 'POST', body: JSON.stringify(input) }, accessToken),

  // ADMIN only. Partial update — send only the fields that changed
  // (fullName, role, and/or isActive); the backend requires at least one.
  update: (accessToken: string, id: number, input: UpdateUserInput) =>
    apiFetch<BackendUser>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(input) }, accessToken),

  // Self-service — any authenticated user, acting only on their own account.
  // No `role`/`isActive` field exists on this input at all: a user can never
  // change their own role or reactivate/deactivate themselves this way,
  // regardless of what role they hold.
  updateMe: (accessToken: string, input: UpdateOwnProfileInput) =>
    apiFetch<BackendUser>('/users/me', { method: 'PUT', body: JSON.stringify(input) }, accessToken),

  changeMyPassword: (accessToken: string, input: ChangePasswordInput) =>
    apiFetch<null>('/users/me/password', { method: 'PUT', body: JSON.stringify(input) }, accessToken),

  // Soft delete — deactivates the account (same end state as an admin using
  // the Deactivate button) rather than removing it; reversible by an admin.
  deactivateMe: (accessToken: string) => apiFetch<null>('/users/me', { method: 'DELETE' }, accessToken),
};

export interface UpdateOwnProfileInput {
  fullName?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  senderId: number;
  role: 'USER' | 'ASSISTANT' | null; // only meaningful for AI sessions; null for peer messages
  content: string;
  readAt: string | null;
  createdAt: string;
  sender?: BackendUser;
}

export interface ConversationSummary {
  sessionId: string;
  peer: BackendUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export const chatsApi = {
  // Any authenticated user — who you can message.
  listPeers: (accessToken: string) => apiFetch<BackendUser[]>('/chats/peers', { method: 'GET' }, accessToken),

  // My threads, each with the peer's info, last message, and unread count.
  listConversations: (accessToken: string) => apiFetch<ConversationSummary[]>('/chats/conversations', { method: 'GET' }, accessToken),

  // Full history with one peer. Empty array if no thread exists yet — not an error.
  getMessages: (accessToken: string, otherUserId: number) =>
    apiFetch<ChatMessage[]>(`/chats/conversations/${otherUserId}/messages`, { method: 'GET' }, accessToken),

  // Creates the thread on first contact.
  sendMessage: (accessToken: string, recipientId: number, content: string) =>
    apiFetch<ChatMessage>('/chats/messages', { method: 'POST', body: JSON.stringify({ recipientId, content }) }, accessToken),

  markRead: (accessToken: string, otherUserId: number) =>
    apiFetch<{ updated: number }>(`/chats/conversations/${otherUserId}/read`, { method: 'POST' }, accessToken),
};

export type EscalationStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Escalation {
  id: number;
  sessionId: string;
  reason: string;
  status: EscalationStatus;
  createdAt: string;
  resolvedAt: string | null;
  // Present on GET /escalations (the list endpoint enriches it); the PUT
  // response is the bare Prisma row and omits it — merge with existing
  // client-side state rather than relying on it after an update.
  session?: {
    id: string;
    userId: number;
    user: { id: number; fullName: string; email: string };
  };
}

export const escalationsApi = {
  // TEAM_LEAD or ADMIN only — the backend 403s anyone else.
  list: (accessToken: string, status?: EscalationStatus) =>
    apiFetch<Escalation[]>(`/escalations${status ? `?status=${status}` : ''}`, { method: 'GET' }, accessToken),

  updateStatus: (accessToken: string, id: number, status: 'ACKNOWLEDGED' | 'RESOLVED') =>
    apiFetch<Escalation>(`/escalations/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }, accessToken),
};

// One row per user for a given week: the weekly escalation-resolution
// target a team lead/admin handed them (null if none was ever set) and how
// many of their escalations were actually resolved that week. `resolved` is
// always computed live on the backend — it's never something the frontend
// (or anyone) can set directly.
export interface ProductivityEntry {
  userId: number;
  fullName: string;
  email: string;
  role: UserRole;
  weekStart: string; // that week's Monday, e.g. "2026-08-24"
  target: number | null;
  resolved: number;
  percentOfTarget: number | null; // null when target is null or 0
  surpassed: boolean;
}

export interface SetProductivityTargetInput {
  userId: number;
  weekStart: string; // any date within the target week
  target: number;
}

export const productivityApi = {
  // TEAM_LEAD/ADMIN get every active user's row for the week; anyone else
  // gets back only their own — the backend enforces this, not the client.
  list: (accessToken: string, weekStart?: string) =>
    apiFetch<ProductivityEntry[]>(`/productivity${weekStart ? `?weekStart=${weekStart}` : ''}`, { method: 'GET' }, accessToken),

  // TEAM_LEAD/ADMIN only — the backend 403s anyone else.
  setTarget: (accessToken: string, input: SetProductivityTargetInput) =>
    apiFetch<{ userId: number; weekStart: string; target: number }>(
      '/productivity/targets',
      { method: 'POST', body: JSON.stringify(input) },
      accessToken
    ),
};

export type ShiftBlockStatus = 'completed' | 'current' | 'upcoming';

export interface ShiftBlock {
  id: number;
  userId: number;
  startsAt: string;
  endsAt: string;
  task: string;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  // Only present on GET /schedule (computed live server-side from the
  // block's own start/end against the current time) — never on the raw
  // create/update response.
  status?: ShiftBlockStatus;
}

export interface ShiftPeer {
  userId: number;
  fullName: string;
  role: UserRole;
  // Derived purely from the schedule, not real presence: 'online' means a
  // block covers this exact instant, 'away' means scheduled today but not
  // in a block right now.
  status: 'online' | 'away';
}

export interface CreateShiftBlockInput {
  userId: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  task: string;
}

export interface UpdateShiftBlockInput {
  startsAt?: string;
  endsAt?: string;
  task?: string;
}

export const scheduleApi = {
  // Own schedule by default; pass userId (TEAM_LEAD/ADMIN only) to view someone else's.
  list: (accessToken: string, date: string, userId?: number) =>
    apiFetch<ShiftBlock[]>(
      `/schedule?date=${date}${userId ? `&userId=${userId}` : ''}`,
      { method: 'GET' },
      accessToken
    ),

  peers: (accessToken: string, date: string) =>
    apiFetch<ShiftPeer[]>(`/schedule/peers?date=${date}`, { method: 'GET' }, accessToken),

  // TEAM_LEAD/ADMIN only — the backend 403s anyone else.
  createBlock: (accessToken: string, input: CreateShiftBlockInput) =>
    apiFetch<ShiftBlock>('/schedule/blocks', { method: 'POST', body: JSON.stringify(input) }, accessToken),

  updateBlock: (accessToken: string, id: number, input: UpdateShiftBlockInput) =>
    apiFetch<ShiftBlock>(`/schedule/blocks/${id}`, { method: 'PUT', body: JSON.stringify(input) }, accessToken),

  deleteBlock: (accessToken: string, id: number) =>
    apiFetch<null>(`/schedule/blocks/${id}`, { method: 'DELETE' }, accessToken),
};

export interface TrendPoint {
  label: string;
  value: number;
}

export interface CategoryCount {
  label: string;
  value: number;
}

export interface DashboardSummary {
  weekStart: string;
  activeTechs: number;
  avgProductivity: number;
  nextWeekTarget: number;
  queueHealth: number; // 0-100
  weeklyResolutions: TrendPoint[]; // Mon..Sun, escalations resolved that day
  ticketCategories: CategoryCount[]; // chatbot-matched KB section this week, top 4 + "Other"
}

export const dashboardApi = {
  // Any authenticated user — every field is a team-wide aggregate.
  summary: (accessToken: string, weekStart?: string) =>
    apiFetch<DashboardSummary>(`/dashboard/summary${weekStart ? `?weekStart=${weekStart}` : ''}`, { method: 'GET' }, accessToken),
};

// One row per chatbot ("ZSmart Ticket Copilot") suggestion request made from
// the Chrome extension — this is the extension-usage half of the audit log.
// Backed by GET /api/audit, which reads the extension's own `audit` table
// (a separate database from the rest of this app — see tadiwa-backend's
// apps/audit/service/audit.js for why).
export interface AuditLogEntry {
  requestId: string;
  ts: string;
  username: string;
  captureSource: string | null;
  ticketChars: number | null;
  suggestionChars: number | null;
  kbHits: number | null;
  rating: 'up' | 'down' | null;
  matchedSection: string | null;
  choice: number | null;
  overrideSection: string | null;
  sessionId: string | null;
}

export interface AuditLogFilters {
  username?: string;
  captureSource?: string;
  rating?: 'up' | 'down';
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
}

export const auditApi = {
  // ADMIN or TEAM_LEAD only — the backend 403s anyone else.
  list: (accessToken: string, filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return apiFetch<AuditLogEntry[]>(`/audit${qs ? `?${qs}` : ''}`, { method: 'GET' }, accessToken);
  },
};

// A merged, user-specific feed: unread peer-chat conversations (derived live
// from Message.readAt, same source TeamComms itself polls) plus escalation
// events (a real backend-persisted row — opened for TEAM_LEAD/ADMIN,
// acknowledged/resolved for the agent whose session it was). `kind`
// discriminates which fields are meaningful.
export type NotificationKind = 'chat' | 'escalation';

export interface NotificationItem {
  id: string; // "chat:<peerId>" or "escalation:<notificationId>" — stable list key
  kind: NotificationKind;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  // kind === 'chat'
  peerId?: number;
  unreadCount?: number;
  // kind === 'escalation'
  notificationId?: number;
  escalationId?: number | null;
}

export const notificationsApi = {
  list: (accessToken: string) => apiFetch<NotificationItem[]>('/notifications', { method: 'GET' }, accessToken),

  // Lightweight — safe to poll often for a bell badge.
  count: (accessToken: string) => apiFetch<{ unread: number }>('/notifications/count', { method: 'GET' }, accessToken),

  // Escalation notifications only — a chat notification clears itself when
  // its conversation is opened (chatsApi.markRead), not through this call.
  markRead: (accessToken: string, notificationId: number) =>
    apiFetch<null>(`/notifications/${notificationId}/read`, { method: 'POST' }, accessToken),

  markAllRead: (accessToken: string) => apiFetch<null>('/notifications/read-all', { method: 'POST' }, accessToken),
};

// One guide procedure/article. `source`/`section`/`tags`/`embedding` exist
// for the Chrome extension's ticket-copilot ingestion (which writes into
// this same table — see tadiwa-backend's apps/knowledgeBase and
// helpdesk_browser_extension-main/backend/main.py); entries authored here
// leave `section`/`tags` empty and, for a file upload, set `source` to the
// original filename purely as a provenance note. There's no `embedding`
// field here — Prisma treats that pgvector column as fully internal, so it
// never reaches the API either way.
export interface KnowledgeBaseEntry {
  id: number;
  topic: string;
  content: string;
  source: string | null;
  section: string | null;
  tags: string[];
  isActive: boolean;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  topic: string;
  content: string;
}

export interface UpdateKnowledgeBaseInput {
  topic?: string;
  content?: string;
  isActive?: boolean;
}

// Extensions accepted by POST /knowledge-base/upload — kept in sync by hand
// with ACCEPTED_EXTENSIONS in tadiwa-backend's textExtraction.js.
export const KB_UPLOAD_ACCEPT = '.pdf,.docx,.txt,.md,.markdown';

export const knowledgeBaseApi = {
  // Any authenticated user. ADMIN can pass includeInactive to also see
  // deactivated entries; the backend ignores the flag for anyone else.
  list: (accessToken: string, includeInactive = false) =>
    apiFetch<KnowledgeBaseEntry[]>(`/knowledge-base${includeInactive ? '?includeInactive=true' : ''}`, { method: 'GET' }, accessToken),

  getById: (accessToken: string, id: number) =>
    apiFetch<KnowledgeBaseEntry>(`/knowledge-base/${id}`, { method: 'GET' }, accessToken),

  // ADMIN only — write the entry's text directly.
  create: (accessToken: string, input: CreateKnowledgeBaseInput) =>
    apiFetch<KnowledgeBaseEntry>('/knowledge-base', { method: 'POST', body: JSON.stringify(input) }, accessToken),

  // ADMIN only — upload a document and let the backend extract its text.
  // `topic` is optional; omitted, the backend falls back to the filename.
  uploadFile: (accessToken: string, file: File, topic?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (topic?.trim()) formData.append('topic', topic.trim());
    return apiUpload<KnowledgeBaseEntry>('/knowledge-base/upload', formData, accessToken);
  },

  // ADMIN only.
  update: (accessToken: string, id: number, input: UpdateKnowledgeBaseInput) =>
    apiFetch<KnowledgeBaseEntry>(`/knowledge-base/${id}`, { method: 'PUT', body: JSON.stringify(input) }, accessToken),

  // ADMIN only — soft deactivate (isActive: false), not a hard delete.
  deactivate: (accessToken: string, id: number) =>
    apiFetch<KnowledgeBaseEntry>(`/knowledge-base/${id}`, { method: 'DELETE' }, accessToken),
};

export { apiFetch, apiUpload, API_BASE_URL };
