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

// The agent whose session (or copilot suggestion) got escalated — they
// should know when someone picks it up or resolves it. Escalation.sessionId
// and .auditRequestId are mutually exclusive (see schema.prisma), so resolve
// whichever one is set to find the agent's userId. No-op if that lookup
// comes up empty (shouldn't happen — sessions/audit rows aren't deletable
// today — but stay defensive).
async function resolveEscalationOwnerId(escalation) {
  if (escalation.sessionId) {
    const session = await prisma.chatSession.findUnique({
      where: { id: escalation.sessionId },
      select: { userId: true },
    });
    return session?.userId ?? null;
  }
  if (escalation.auditRequestId) {
    const audit = await prisma.audit.findUnique({
      where: { requestId: escalation.auditRequestId },
      select: { email: true },
    });
    if (!audit) return null;
    const user = await prisma.user.findUnique({ where: { email: audit.email }, select: { id: true } });
    return user?.id ?? null;
  }
  return null;
}

async function notifyEscalationStatusChanged(escalation, status) {
  const ownerId = await resolveEscalationOwnerId(escalation);
  if (!ownerId) return;

  const type = status === "RESOLVED" ? "ESCALATION_RESOLVED" : "ESCALATION_ACKNOWLEDGED";
  const title = status === "RESOLVED" ? "Escalation resolved" : "Escalation acknowledged";

  await prisma.notification.create({
    data: {
      userId: ownerId,
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

  // Raised from the Chrome extension's Suggested Resolution panel when an
  // agent marks a suggestion 👎 not helpful — auditRequestId is that
  // suggestion's own audit.request_id (not a chat_sessions row; the
  // extension has no chat session of that shape). Only the agent who
  // actually received that suggestion can escalate it.
  async createFromAudit(auditRequestId, reason, requesterEmail) {
    const audit = await prisma.audit.findUnique({
      where: { requestId: auditRequestId },
      select: { requestId: true, email: true },
    });
    if (!audit) {
      throw new AppError("No suggestion found for that request", 404);
    }
    if (audit.email !== requesterEmail) {
      throw new AppError("You can only escalate your own suggestions", 403);
    }

    const existing = await prisma.escalation.findUnique({ where: { auditRequestId } });
    if (existing) return existing;

    const escalation = await prisma.escalation.create({
      data: { auditRequestId, reason, status: "OPEN" },
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
        auditRequest: {
          select: { requestId: true, email: true, captureSource: true, matchedSection: true },
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

  // Same transition as updateStatus, but callable by the agent who owns the
  // escalation too (not just TEAM_LEAD/ADMIN) — the Chrome extension calls
  // this, not updateStatus. Kept as a thin wrapper so the one state-machine
  // (existing/RESOLVED/notify) lives in updateStatus alone.
  async updateStatusAsAgent(escalationId, status, requesterEmail, requesterRole) {
    const existing = await prisma.escalation.findUnique({ where: { id: escalationId } });
    if (!existing) {
      throw new AppError("Escalation not found", 404);
    }
    if (requesterRole !== "TEAM_LEAD" && requesterRole !== "ADMIN") {
      const ownerId = await resolveEscalationOwnerId(existing);
      const requester = await prisma.user.findUnique({ where: { email: requesterEmail }, select: { id: true } });
      if (!requester || requester.id !== ownerId) {
        throw new AppError("You do not have permission to update this escalation", 403);
      }
    }
    return escalationService.updateStatus(escalationId, status);
  },
};

export default escalationService;