import {prisma} from "../../../lib/prismaClient.js";
import {AppError} from "../../../utils/appError.js";

// Someone who needs to know an escalation just opened — every active
// TEAM_LEAD/ADMIN, since GET /api/escalations is already restricted to them.
async function notifyEscalationOpened(escalation) {
  const responders = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["TEAM_LEAD", "ADMIN"] } },
    select: { id: true },
  });
  if (responders.length === 0) return;

  await prisma.notification.createMany({
    data: responders.map((u) => ({
      userId: u.id,
      type: "ESCALATION_OPENED",
      title: "New escalation",
      body: escalation.reason,
      escalationId: escalation.id,
    })),
  });
}

// The agent whose session got escalated — they should know when someone
// picks it up or resolves it. No-op if the session has since been deleted
// (shouldn't happen — sessions aren't deletable today — but stay defensive).
async function notifyEscalationStatusChanged(escalation, status) {
  const session = await prisma.chatSession.findUnique({
    where: { id: escalation.sessionId },
    select: { userId: true },
  });
  if (!session) return;

  const type = status === "RESOLVED" ? "ESCALATION_RESOLVED" : "ESCALATION_ACKNOWLEDGED";
  const title = status === "RESOLVED" ? "Escalation resolved" : "Escalation acknowledged";

  await prisma.notification.create({
    data: {
      userId: session.userId,
      type,
      title,
      body: escalation.reason,
      escalationId: escalation.id,
    },
  });
}

export const escalationService = {

  async create(sessionId, reason) {
    const existing = await prisma.escalation.findUnique({ where: { sessionId } });
    if (existing) return existing;

    const escalation = await prisma.escalation.create({
      data: { sessionId, reason, status: "OPEN" },
    });
    await notifyEscalationOpened(escalation);
    return escalation;
  },

  async list(status) {
    return prisma.escalation.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        session: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
  },
 
  async updateStatus(escalationId, status) {
    const existing = await prisma.escalation.findUnique({ where: { id: escalationId } });
    if (!existing) {
      throw new AppError("Escalation not found", 404);
    }
    if (existing.status === "RESOLVED") {
      throw new AppError("This escalation has already been resolved", 409);
    }
 
    const updated = await prisma.escalation.update({
      where: { id: escalationId },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
    });
    await notifyEscalationStatusChanged(updated, status);
    return updated;
  },
};
 
export default escalationService;