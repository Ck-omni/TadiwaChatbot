import { prisma } from "../../../lib/prismaClient.js";
import { AppError } from "../../../utils/appError.js";

// The [start, end) UTC window covering one calendar day. Blocks are matched
// against this with startsAt < end && endsAt > start, so a block that
// crosses midnight still shows up on both days it touches.
function dayRangeOf(input) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new AppError("Invalid date", 400);
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function statusOf(block, now) {
  if (now >= block.endsAt) return "completed";
  if (now >= block.startsAt) return "current";
  return "upcoming";
}

export const scheduleService = {
  dayRangeOf,

  // A user's own "Personal Timeline" for one calendar day, each block
  // annotated with a live completed/current/upcoming status.
  async listForUser(userId, date) {
    const { start, end } = dayRangeOf(date);
    const blocks = await prisma.shiftBlock.findMany({
      where: { userId, startsAt: { lt: end }, endsAt: { gt: start } },
      orderBy: { startsAt: "asc" },
    });

    const now = new Date();
    return blocks.map((b) => ({ ...b, status: statusOf(b, now) }));
  },

  // Everyone else (active users only) with at least one block touching this
  // day — "online" means a block covers this exact instant, "away" means
  // they're scheduled today but not in a block right now. Never a real
  // presence signal (no heartbeat/websocket) — purely derived from the schedule.
  async listPeers(date, excludeUserId) {
    const { start, end } = dayRangeOf(date);
    const blocks = await prisma.shiftBlock.findMany({
      where: {
        startsAt: { lt: end },
        endsAt: { gt: start },
        userId: { not: excludeUserId },
        user: { isActive: true },
      },
      include: { user: { select: { id: true, fullName: true, role: true } } },
      orderBy: { startsAt: "asc" },
    });

    const now = new Date();
    const byUser = new Map();
    for (const b of blocks) {
      const existing = byUser.get(b.userId);
      const onShiftNow = now >= b.startsAt && now < b.endsAt;
      if (!existing) {
        byUser.set(b.userId, { userId: b.userId, fullName: b.user.fullName, role: b.user.role, onShiftNow });
      } else if (onShiftNow) {
        existing.onShiftNow = true;
      }
    }

    return Array.from(byUser.values()).map((p) => ({
      userId: p.userId,
      fullName: p.fullName,
      role: p.role,
      status: p.onShiftNow ? "online" : "away",
    }));
  },

  async create({ userId, startsAt, endsAt, task, createdByUserId }) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError("Invalid start/end time", 400);
    }
    if (end <= start) {
      throw new AppError("End time must be after start time", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return prisma.shiftBlock.create({
      data: { userId, startsAt: start, endsAt: end, task, createdByUserId },
    });
  },

  async update(id, updates) {
    const existing = await prisma.shiftBlock.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Shift block not found", 404);
    }

    const start = updates.startsAt ? new Date(updates.startsAt) : existing.startsAt;
    const end = updates.endsAt ? new Date(updates.endsAt) : existing.endsAt;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError("Invalid start/end time", 400);
    }
    if (end <= start) {
      throw new AppError("End time must be after start time", 400);
    }

    return prisma.shiftBlock.update({
      where: { id },
      data: {
        startsAt: start,
        endsAt: end,
        task: updates.task ?? existing.task,
      },
    });
  },

  async remove(id) {
    const existing = await prisma.shiftBlock.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Shift block not found", 404);
    }
    await prisma.shiftBlock.delete({ where: { id } });
  },
};

export default scheduleService;
