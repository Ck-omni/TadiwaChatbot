import { prisma } from "../../../lib/prismaClient.js";
import { AppError } from "../../../utils/appError.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CATEGORIES = 4; // matches CategoryDonutChart's direct-label cap

// Normalizes any date-ish input to that week's Monday, 00:00 UTC. Same
// definition as apps/productivity/service/productivity.js's weekStartOf —
// duplicated rather than imported so this app doesn't reach into another
// domain's internals for a ten-line pure function.
function weekStartOf(input) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new AppError("Invalid date", 400);
  }
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);
  return utc;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// One point per day, Monday-Sunday, of escalations actually resolved that day.
async function getWeeklyResolutions(weekStart) {
  const counts = await Promise.all(
    DAY_LABELS.map(async (_, i) => {
      const dayStart = addDays(weekStart, i);
      const dayEnd = addDays(weekStart, i + 1);
      return prisma.escalation.count({
        where: { status: "RESOLVED", resolvedAt: { gte: dayStart, lt: dayEnd } },
      });
    })
  );
  return DAY_LABELS.map((label, i) => ({ label, value: counts[i] }));
}

// Chatbot-suggested KB section per request, this week, from the Chrome
// extension's `audit` rows (see helpdesk_browser_extension-main/backend/
// main.py — it writes straight into this app's own `audit` table).
// Best-effort: if the query fails, the rest of the dashboard shouldn't go
// down with it — just report an empty breakdown.
async function getTicketCategories(weekStart, weekEnd) {
  let rows;
  try {
    rows = await prisma.$queryRaw`
      SELECT COALESCE(matched_section, 'No KB Match') AS section, COUNT(*)::int AS count
      FROM audit
      WHERE ts >= ${weekStart} AND ts < ${weekEnd}
      GROUP BY section
      ORDER BY count DESC
    `;
  } catch {
    return [];
  }

  const top = rows.slice(0, MAX_CATEGORIES).map((r) => ({ label: r.section, value: r.count }));
  const rest = rows.slice(MAX_CATEGORIES).reduce((sum, r) => sum + r.count, 0);
  if (rest > 0) top.push({ label: "Other", value: rest });
  return top;
}

export const dashboardService = {
  weekStartOf,

  async getSummary(weekStartInput) {
    const weekStart = weekStartOf(weekStartInput);
    const weekEnd = addDays(weekStart, 7);
    const nextWeekStart = addDays(weekStart, 7);

    const [techCount, weeklyResolutions, nextWeekTargetRows, queueRows, ticketCategories] = await Promise.all([
      prisma.user.count({ where: { isActive: true, role: { in: ["AGENT", "TEAM_LEAD"] } } }),
      getWeeklyResolutions(weekStart),
      prisma.productivityTarget.aggregate({
        where: { weekStart: nextWeekStart },
        _sum: { target: true },
      }),
      // Queue health: of escalations opened in the last rolling 7 days, what
      // share are no longer sitting OPEN. A rolling window (not the
      // Mon-Sun weekStart) since "how's the queue right now" is a live
      // question, not a per-week report.
      prisma.escalation.groupBy({
        by: ["status"],
        where: { createdAt: { gte: addDays(new Date(), -7) } },
        _count: { _all: true },
      }),
      getTicketCategories(weekStart, weekEnd),
    ]);

    const totalResolvedThisWeek = weeklyResolutions.reduce((sum, d) => sum + d.value, 0);
    const avgProductivity = techCount > 0 ? Math.round(totalResolvedThisWeek / techCount) : 0;

    const queueTotal = queueRows.reduce((sum, r) => sum + r._count._all, 0);
    const queueOpen = queueRows.find((r) => r.status === "OPEN")?._count._all ?? 0;
    const queueHealth = queueTotal > 0 ? Math.round(((queueTotal - queueOpen) / queueTotal) * 100) : 100;

    return {
      weekStart,
      activeTechs: techCount,
      avgProductivity,
      nextWeekTarget: nextWeekTargetRows._sum.target ?? 0,
      queueHealth,
      weeklyResolutions,
      ticketCategories,
    };
  },
};

export default dashboardService;
