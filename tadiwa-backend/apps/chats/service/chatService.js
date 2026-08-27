import { prisma } from "../../../lib/prismaClient.js";
import { AppError } from "../../../utils/appError.js";

const PUBLIC_PEER_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
};

// ChatSession.userId/recipientId has no inherent "who started it" meaning
// for peer threads — it's just the two participants. Storing them in a
// fixed (lower id, higher id) order means a pair only ever gets ONE session
// no matter which direction they're addressed from, which is exactly what
// @@unique([userId, recipientId]) on ChatSession enforces.
function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export const chatService = {
  // Anyone messageable — every other active user. No role gating: peer
  // messaging is a general feature, not an admin console (unlike GET
  // /api/users, which is ADMIN/TEAM_LEAD-only).
  async listPeers(currentUserId) {
    return prisma.user.findMany({
      where: { id: { not: currentUserId }, isActive: true },
      select: PUBLIC_PEER_FIELDS,
      orderBy: { fullName: "asc" },
    });
  },

  async getOrCreateSession(userIdA, userIdB) {
    const [userId, recipientId] = canonicalPair(userIdA, userIdB);
    return prisma.chatSession.upsert({
      where: { userId_recipientId: { userId, recipientId } },
      update: {},
      create: { userId, recipientId },
    });
  },

  async sendMessage(senderId, recipientId, content) {
    if (senderId === recipientId) {
      throw new AppError("You can't message yourself", 400);
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || !recipient.isActive) {
      throw new AppError("Recipient not found", 404);
    }

    const session = await this.getOrCreateSession(senderId, recipientId);
    return prisma.message.create({
      data: { sessionId: session.id, senderId, content },
      include: { sender: { select: PUBLIC_PEER_FIELDS } },
    });
  },

  // One row per peer thread the current user is in, with the OTHER
  // participant's public info, their last message, and how many of THEIR
  // messages to me are still unread.
  async listConversations(currentUserId) {
    const sessions = await prisma.chatSession.findMany({
      where: {
        recipientId: { not: null }, // exclude user<->AI sessions
        OR: [{ userId: currentUserId }, { recipientId: currentUserId }],
      },
      include: {
        user: { select: PUBLIC_PEER_FIELDS },
        recipient: { select: PUBLIC_PEER_FIELDS },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { startedAt: "desc" },
    });

    return Promise.all(
      sessions.map(async (s) => {
        const peer = s.userId === currentUserId ? s.recipient : s.user;
        const unreadCount = await prisma.message.count({
          where: { sessionId: s.id, senderId: peer.id, readAt: null },
        });
        return {
          sessionId: s.id,
          peer,
          lastMessage: s.messages[0] ?? null,
          unreadCount,
        };
      })
    );
  },

  // No conversation yet is a valid state (nobody has messaged this peer
  // before) — returns an empty list rather than 404ing.
  async getMessages(currentUserId, otherUserId) {
    const [userId, recipientId] = canonicalPair(currentUserId, otherUserId);
    const session = await prisma.chatSession.findUnique({
      where: { userId_recipientId: { userId, recipientId } },
    });
    if (!session) return [];

    return prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: PUBLIC_PEER_FIELDS } },
    });
  },

  async markRead(currentUserId, otherUserId) {
    const [userId, recipientId] = canonicalPair(currentUserId, otherUserId);
    const session = await prisma.chatSession.findUnique({
      where: { userId_recipientId: { userId, recipientId } },
    });
    if (!session) return { updated: 0 };

    const result = await prisma.message.updateMany({
      where: { sessionId: session.id, senderId: otherUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },
};

export default chatService;
