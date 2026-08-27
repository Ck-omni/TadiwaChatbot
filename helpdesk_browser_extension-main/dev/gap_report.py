#!/usr/bin/env python3
"""
Knowledge-gap report for the ZSmart Ticket Copilot.

Every /api/suggest request is logged in the `audit` table with the routing
outcome (`matched_section`, NULL when no procedure matched), the 👍/👎 rating,
the agent's override (if they picked a different candidate), and — when
STORE_TICKET_TEXT=1 — the scrubbed ticket text plus its embedding. Tickets that
matched NO procedure, or got a 👎, signal that the guide is missing something.

This script pulls those tickets in a time window, greedily clusters them by
embedding similarity, and prints the clusters largest-first — each cluster is a
candidate procedure to ADD to BSS_steps.md. It is the worklist for the guide
maintainer.

Usage:
  python gap_report.py [--days 30] [--threshold 0.6] [--top 15]

Uses DATABASE_URL (same as main.py / ingest.py).
"""

import argparse
import asyncio
import math
import os

import asyncpg
from pgvector.asyncpg import register_vector

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://copilot:copilot@localhost:5432/copilot")


def cosine(a, b) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def cluster(rows, threshold):
    """Greedy single-pass clustering by cosine similarity to a cluster's first
    member (its representative)."""
    clusters = []
    for row in rows:
        vec = list(row["ticket_embedding"])
        best, best_sim = None, -1.0
        for cl in clusters:
            sim = cosine(vec, cl["rep"])
            if sim > best_sim:
                best, best_sim = cl, sim
        if best is not None and best_sim >= threshold:
            best["members"].append(row)
        else:
            clusters.append({"rep": vec, "members": [row]})
    return clusters


async def run(args):
    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)
    rows = await conn.fetch(
        """
        SELECT request_id, ts, matched_section, rating, ticket_text, ticket_embedding
        FROM audit
        WHERE ts >= now() - ($1::int * interval '1 day')
          AND ticket_text IS NOT NULL
          AND ticket_embedding IS NOT NULL
          AND (matched_section IS NULL OR rating = 'down')
        ORDER BY ts DESC
        """,
        args.days,
    )
    await conn.close()

    if not rows:
        print(f"No unanswered/down-rated tickets with stored text in the last "
              f"{args.days} days.\n(Is STORE_TICKET_TEXT enabled? Has the copilot "
              "been used since?)")
        return

    clusters = cluster(rows, args.threshold)
    clusters.sort(key=lambda c: len(c["members"]), reverse=True)

    no_hit = sum(1 for r in rows if r["matched_section"] is None)
    downs = sum(1 for r in rows if r["rating"] == "down")
    print(f"{len(rows)} candidate-gap tickets in {args.days}d "
          f"({no_hit} no-match, {downs} down-rated) → {len(clusters)} clusters\n")

    for i, cl in enumerate(clusters[:args.top], 1):
        members = cl["members"]
        rep = members[0]["ticket_text"].replace("\n", " ").strip()
        print(f"#{i}  ({len(members)} ticket{'s' if len(members) > 1 else ''})")
        print(f"    e.g. {rep[:200]}")
        print()

    shown = min(args.top, len(clusters))
    if shown < len(clusters):
        print(f"… {len(clusters) - shown} smaller clusters not shown (raise --top).")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=int, default=30, help="look-back window (default 30)")
    p.add_argument("--threshold", type=float, default=0.6,
                   help="cosine similarity to group tickets (default 0.6)")
    p.add_argument("--top", type=int, default=15, help="clusters to show (default 15)")
    asyncio.run(run(p.parse_args()))
