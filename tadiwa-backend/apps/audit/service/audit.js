import { getCopilotDb } from "../../../lib/copilotDb.js";
import { AppError } from "../../../utils/appError.js";

// Chrome-extension usage rows only — ticket_embedding is a pgvector column
// (1536-dim) meant for offline gap-mining, not for a list UI, so it's never
// selected here.
const SELECT_COLUMNS = `
  request_id, ts, username, capture_source, ticket_chars, suggestion_chars,
  kb_hits, rating, matched_section, choice, override_section, session_id
`;

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export const auditService = {
  // filters: { username, captureSource, rating, from, to }, all optional.
  async list(filters = {}, { limit = DEFAULT_LIMIT } = {}) {
    const { username, captureSource, rating, from, to } = filters;

    const clamped = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const where = [];
    const params = [];

    if (username) {
      params.push(`%${username}%`);
      where.push(`username ILIKE $${params.length}`);
    }
    if (captureSource) {
      params.push(captureSource);
      where.push(`capture_source = $${params.length}`);
    }
    if (rating) {
      params.push(rating);
      where.push(`rating = $${params.length}`);
    }
    if (from) {
      const parsed = new Date(from);
      if (Number.isNaN(parsed.getTime())) throw new AppError("Invalid 'from' date", 400);
      params.push(parsed.toISOString());
      where.push(`ts >= $${params.length}`);
    }
    if (to) {
      const parsed = new Date(to);
      if (Number.isNaN(parsed.getTime())) throw new AppError("Invalid 'to' date", 400);
      params.push(parsed.toISOString());
      where.push(`ts <= $${params.length}`);
    }

    params.push(clamped);
    const limitPlaceholder = `$${params.length}`;

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `
      SELECT ${SELECT_COLUMNS}
      FROM audit
      ${whereClause}
      ORDER BY ts DESC
      LIMIT ${limitPlaceholder}
    `;

    let result;
    try {
      result = await getCopilotDb().query(sql, params);
    } catch (err) {
      throw new AppError(`Could not read audit log: ${err.message}`, 502);
    }

    return result.rows.map((row) => ({
      requestId: row.request_id,
      ts: row.ts,
      username: row.username,
      captureSource: row.capture_source,
      ticketChars: row.ticket_chars,
      suggestionChars: row.suggestion_chars,
      kbHits: row.kb_hits,
      rating: row.rating,
      matchedSection: row.matched_section,
      choice: row.choice,
      overrideSection: row.override_section,
      sessionId: row.session_id,
    }));
  },
};

export default auditService;
