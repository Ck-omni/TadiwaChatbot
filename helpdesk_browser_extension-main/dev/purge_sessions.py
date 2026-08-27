#!/usr/bin/env python3
"""
Retention purge for multi-turn dialogue state (Phase 2 §7).

SESSION_TTL_MINUTES (main.py) governs whether a session_id is still "the same
conversation" for LLM context — that's a short window (default 60 min) and is
enforced live, at query time, by get_or_create_session(). It is NOT a delete.

This script is the separate, longer-lived retention control: it deletes
chat_sessions (and, via ON DELETE CASCADE, their chat_turns) whose
last_active_at is older than SESSION_RETENTION_DAYS. Run it periodically
(cron / scheduled task) the same way dev/gap_report.py is a manual/periodic
tool rather than something main.py runs itself.

Usage:
  python purge_sessions.py [--days 30] [--dry-run]

Uses DATABASE_URL and SESSION_RETENTION_DAYS (same as main.py).
"""

import argparse
import asyncio
import os

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://copilot:copilot@localhost:5432/copilot")
SESSION_RETENTION_DAYS = int(os.getenv("SESSION_RETENTION_DAYS", "30"))


async def main(days: int, dry_run: bool) -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        if dry_run:
            count = await conn.fetchval(
                "SELECT count(*) FROM chat_sessions WHERE last_active_at < now() - make_interval(days => $1)",
                days,
            )
            print(f"Would delete {count} session(s) (and their turns via cascade) older than {days} day(s).")
            return

        # RETURNING gives an exact count without a second query; chat_turns
        # rows disappear automatically via the FK's ON DELETE CASCADE.
        deleted = await conn.fetch(
            """DELETE FROM chat_sessions
               WHERE last_active_at < now() - make_interval(days => $1)
               RETURNING session_id""",
            days,
        )
        print(f"Deleted {len(deleted)} session(s) (and their turns) older than {days} day(s).")
    finally:
        await conn.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--days", type=int, default=SESSION_RETENTION_DAYS,
                    help=f"delete sessions inactive longer than this (default {SESSION_RETENTION_DAYS}, from SESSION_RETENTION_DAYS)")
    p.add_argument("--dry-run", action="store_true", help="report the count without deleting")
    args = p.parse_args()
    asyncio.run(main(args.days, args.dry_run))
