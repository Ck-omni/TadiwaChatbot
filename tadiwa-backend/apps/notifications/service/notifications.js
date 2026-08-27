import { prisma } from "../../../lib/prismaClient.js";
import { chatService } from "../../chats/service/chatService.js";
import { AppError } from "../../../utils/appError.js";

const FEED_LIMIT = 50;

// Chat notifications aren't a stored row — one entry per peer conversation
// that currently has unread messages, reusing the exact same unread-count
// logic TeamComms already polls (Message.readAt is the single source of
// truth; duplicating it into Notification rows would just invite drift).
async function getChatItems(userId) {
  const conversations = await chatService.listConversations(userId);
  return conversations
    .filter((c) => c.unreadCount > 0)
    .map((c) => ({
      id: `chat:${c.peer.id}`,
      kind: "chat",
      title: c.peer.fullName || c.peer.email,
      body: c.lastMessage ? c.lastMessage.content : "New message",
      isRead: false,
      createdAt: c.lastMessage ? c.lastMessage.createdAt : new Date(),
      peerId: c.peer.id,
      unreadCount: c.unreadCount,
    }));
}

async function getEscalationItems(userId) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
  });
  return rows.map((n) => ({
    id: `escalation:${n.id}`,
    kind: "escalation",
    notificationId: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt,
    escalationId: n.escalationId,
  }));
}

export const notificationService = {
  async getFeed(userId) {
    const [chatItems, escalationItems] = await Promise.all([
      getChatItems(userId),
      getEscalationItems(userId),
    ]);
    return [...chatItems, ...escalationItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, FEED_LIMIT);
  },

  // Counts CONVERSATIONS with unread messages, not raw message count — "3
  // people messaged you" reads better on a bell badge than a raw tally.
  async getUnreadCount(userId) {
    const [conversations, escalationUnread] = await Promise.all([
      chatService.listConversations(userId),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    const chatUnread = conversations.filter((c) => c.unreadCount > 0).length;
    return chatUnread + escalationUnread;
  },

  // Escalation notifications only — chat "read" state is owned entirely by
  // Message.readAt (set when the conversation is opened; see chatService.markRead).
  async markOneRead(userId, notificationId) {
    const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!existing || existing.userId !== userId) {
      throw new AppError("Notification not found", 404);
    }
    if (existing.isRead) return existing;

    return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  },

  // Clears the whole bell in one action: every escalation notification AND
  // every unread peer message addressed to this user.
  async markAllRead(userId) {
    await Promise.all([
      prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      }),
      prisma.message.updateMany({
        where: {
          readAt: null,
          senderId: { not: userId },
          session: {
            recipientId: { not: null },
            OR: [{ userId }, { recipientId: userId }],
          },
        },
        data: { readAt: new Date() },
      }),
    ]);
  },
};

export default notificationService;
