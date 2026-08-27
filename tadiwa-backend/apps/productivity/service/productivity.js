import { prisma } from "../../../lib/prismaClient.js";
import { AppError } from "../../../utils/appError.js";

// Normalizes any date-ish input to that week's Monday, 00:00 UTC — the
// canonical "weekStart" every target and lookup keys off of, so "week of
// 2026-08-24" means the same thing everywhere regardless of what day within
// that week someone queries it.
export function weekStartOf(input) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new AppError("Invalid date", 400);
  }
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);
  return utc;
}

export const productivityService = {
  weekStartOf,

  // Sets (or updates) the weekly resolution target a team lead/admin is
  // handing a user. One row per (user, week) — calling this again for the
  // same week just overwrites the number.
  async setTarget({ userId, weekStart, target, setByUserId }) {
    const week = weekStartOf(weekStart);

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new AppError("User not found", 404);
    }

    return prisma.productivityTarget.upsert({
      where: { userId_weekStart: { userId, weekStart: week } },
      update: { target, setByUserId },
      create: { userId, weekStart: week, target, setByUserId },
    });
  },

  // One row per in-scope user for the given week: their target (null if
  // none was ever set), how many of their escalations were actually
  // resolved that week, and whether they surpassed target. Scope is
  // enforced here, not in the controller: TEAM_LEAD/ADMIN see every active
  // user, an AGENT only ever gets their own row back.
  async list({ weekStart, requestingUser }) {
    const week = weekStartOf(weekStart);
    const weekEnd = new Date(week);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const isPrivileged = requestingUser.role === "ADMIN" || requestingUser.role === "TEAM_LEAD";

    const users = isPrivileged
      ? await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, fullName: true, email: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : await prisma.user.findMany({
          where: { id: requestingUser.id },
          select: { id: true, fullName: true, email: true, role: true },
        });

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return [];

    // Resolution counts are computed from Escalation rows, never stored —
    // "who resolved it" is attributed via the chat session's owner
    // (session.userId), since Escalation itself doesn't track a resolver.
    const [targets, resolvedEscalations] = await Promise.all([
      prisma.productivityTarget.findMany({ where: { userId: { in: userIds }, weekStart: week } }),
      prisma.escalation.findMany({
        where: {
          status: "RESOLVED",
          resolvedAt: { gte: week, lt: weekEnd },
          session: { userId: { in: userIds } },
        },
        select: { session: { select: { userId: true } } },
      }),
    ]);

    const targetByUser = new Map(targets.map((t) => [t.userId, t]));
    const resolvedByUser = new Map();
    for (const esc of resolvedEscalations) {
      const uid = esc.session.userId;
      resolvedByUser.set(uid, (resolvedByUser.get(uid) ?? 0) + 1);
    }

    return users.map((u) => {
      const target = targetByUser.get(u.id)?.target ?? null;
      const resolved = resolvedByUser.get(u.id) ?? 0;
      return {
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        weekStart: week,
        target,
        resolved,
        percentOfTarget: target ? Math.round((resolved / target) * 100) : null,
        surpassed: target != null && resolved > target,
      };
    });
  },
};

export default productivityService;
