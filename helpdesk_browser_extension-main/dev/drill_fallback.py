"""Fallback drill: run the suggest pipeline against a DEAD LLM endpoint to
verify the failure path stays honest — a similarity-gated fallback clearly
marked unverified (fallback=true), or NO_MATCH; never a confident wrong answer.

Run inside the compose network with the LLM pointed at a dead port:

  docker compose run --rm -e LLM_CHAT_URL=http://127.0.0.1:9/none -e LLM_TIMEOUT=5 \
      backend python dev/drill_fallback.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from pgvector.asyncpg import register_vector

import main

COVERED = ("TITLE: SIM replacement. DESCRIPTION: Customer lost SIM card, wants a "
           "replacement, new ICCID linked to the same number.")
UNCOVERED = ("How do I reset my corporate Outlook email password and set up an "
             "out-of-office reply?")


async def drive(pool, label, ticket):
    print(f"===== {label} =====")
    async for ev in main.run_suggest(pool, ticket, "drill", "fallback-drill"):
        if ev["stage"] == "answer":
            print(f"  fallback={ev['fallback']}  choice={ev['choice']}  "
                  f"matched={ev['matched_section']}")
            print(f"  reason: {ev['reason']}")
        elif ev["stage"] == "error":
            print(f"  [error] {ev['detail'][:100]}")


async def run():
    async def _init(conn):
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await register_vector(conn)

    pool = await asyncpg.create_pool(main.DATABASE_URL, init=_init)
    await drive(pool, "covered ticket — expect fallback=True, gated closest match", COVERED)
    await drive(pool, "uncovered ticket — expect fallback=True, choice=0, NO_MATCH", UNCOVERED)
    await pool.close()


if __name__ == "__main__":
    asyncio.run(run())
