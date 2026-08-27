import pg from "pg";

// The Chrome extension's own backend ("ZSmart Ticket Copilot", see
// helpdesk_browser_extension-main/backend/main.py) writes usage rows to its
// own Postgres database — a separate DB from the one this Node backend uses
// for everything else (DATABASE_URL / the `tadiwa` DB). This pool talks to
// that database directly with raw SQL so the audit log can read real rows
// without duplicating them into Prisma's schema.
const { Pool } = pg;

let pool = null;

export function getCopilotDb() {
  if (!pool) {
    const connectionString = process.env.COPILOT_DATABASE_URL;
    if (!connectionString) {
      throw new Error("COPILOT_DATABASE_URL is not set — cannot read Chrome extension audit data.");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export default getCopilotDb;
