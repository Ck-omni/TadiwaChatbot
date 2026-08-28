"""
Load a Markdown knowledge guide into the pgvector knowledge base
(knowledge_base_entries — tadiwa-backend's own table; see main.py's SCHEMA
for why this service writes into it directly rather than a separate
kb_chunks table).

Author the guide as Markdown with one heading region per procedure, e.g.:

    # BSS                          <- category (H1)
    ## SIM Card Replacement        <- procedure (H2)
    1. ...steps...
    ## Balance Adjustment ...      <- procedure (H2)
    ### Steps for balance adjustment   <- variant (H3)
    ...
    ### Steps for adding a new account
    ...

Then:

    python ingest.py BSS_steps.md [--source LABEL]

Chunking is HIERARCHY-AWARE: each chunk is the lowest heading region in a
branch (an H3 variant where present, else the H2 procedure). The heading path
(category > procedure > variant) is carried into the chunk so it stays in the
embedding and in citations, and any preamble text under a parent heading is
inherited by its child chunks. Empty / placeholder sections are skipped.

Re-running on the same --source first deletes that source's existing rows, so
editing the guide and re-ingesting is idempotent.

Uses the same env vars as main.py (DATABASE_URL, EMBED_BASE_URL, EMBED_MODEL,
EMBED_DIM, SCRUB_PII).
"""

import argparse
import asyncio
import os
import re
import sys

import asyncpg
import httpx
from pgvector.asyncpg import register_vector

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tadiwa")
EMBED_BASE_URL = os.getenv("EMBED_BASE_URL", os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
LLM_API_KEY = os.getenv("LLM_API_KEY", "local")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import scrub, SCRUB_PII, EMBED_DOC_PREFIX  # reuse redaction + prefix

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
MIN_BODY_CHARS = 10
# A section whose body matches this (case-insensitive) is a placeholder, not a
# real procedure — skip it so gap-mining flags it as missing.
PLACEHOLDER_RE = re.compile(r"no steps?\s+(were|was)?\s*provided", re.IGNORECASE)


def _body_is_real(body: str) -> bool:
    """True if the body has real procedure content (not empty / placeholder)."""
    stripped = body.strip()
    if len(re.sub(r"[^0-9A-Za-z]", "", stripped)) < MIN_BODY_CHARS:
        return False
    if PLACEHOLDER_RE.search(stripped):
        return False
    return True


def parse_markdown(md: str) -> list[dict]:
    """Parse Markdown into leaf chunks.

    Returns a list of {"path": [titles...], "body": str}. A leaf is a heading
    with no child heading; its body includes the preamble text inherited from
    each ancestor heading (the text directly under that ancestor before its
    first child heading).
    """
    lines = md.splitlines()

    # Collect headings with their level, title, and own body (text until the
    # next heading of any level).
    nodes: list[dict] = []  # {level, title, body, children: int}
    current_body: list[str] = []
    for line in lines:
        m = HEADING_RE.match(line)
        if m:
            if nodes:
                nodes[-1]["body"] = "\n".join(current_body).strip()
            nodes.append({"level": len(m.group(1)), "title": m.group(2).strip(),
                          "body": "", "children": 0})
            current_body = []
        else:
            current_body.append(line)
    if nodes:
        nodes[-1]["body"] = "\n".join(current_body).strip()
    else:
        return []

    # Mark how many child headings each node has (a child = a later heading of
    # greater level, before any heading of <= this node's level).
    for i, node in enumerate(nodes):
        for j in range(i + 1, len(nodes)):
            if nodes[j]["level"] <= node["level"]:
                break
            if nodes[j]["level"] == node["level"] + 1:
                node["children"] += 1

    # Emit a chunk for every leaf heading, inheriting ancestor preambles.
    chunks: list[dict] = []
    stack: list[dict] = []  # ancestor chain by level
    for i, node in enumerate(nodes):
        while stack and stack[-1]["level"] >= node["level"]:
            stack.pop()
        stack.append(node)
        if node["children"] > 0:
            continue  # not a leaf; its body is preamble inherited by children
        path = [a["title"] for a in stack]
        preamble = "\n\n".join(a["body"] for a in stack[:-1] if a["body"].strip())
        body = (preamble + "\n\n" + node["body"]).strip() if preamble else node["body"].strip()
        chunks.append({"path": path, "body": body})
    return chunks


async def embed(client: httpx.AsyncClient, text: str) -> list[float]:
    r = await client.post(
        f"{EMBED_BASE_URL.rstrip('/')}/embeddings",
        json={"model": EMBED_MODEL, "input": text[:8000]},
        headers={"Authorization": f"Bearer {LLM_API_KEY}"},
    )
    r.raise_for_status()
    vec = r.json()["data"][0]["embedding"]
    if len(vec) != EMBED_DIM:
        raise SystemExit(
            f"Embedding dim {len(vec)} != EMBED_DIM {EMBED_DIM}. "
            "Set EMBED_DIM to match your embedding model and recreate kb_chunks."
        )
    return vec


async def run(args) -> None:
    with open(args.md_path, encoding="utf-8-sig") as f:
        md = f.read()
    source = args.source or os.path.basename(args.md_path)

    chunks = parse_markdown(md)
    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)
    deleted = await conn.execute("DELETE FROM knowledge_base_entries WHERE source=$1", source)
    if deleted != "DELETE 0":
        print(f"Re-ingest: cleared existing rows for source '{source}'.")

    ok = skipped = 0
    async with httpx.AsyncClient(timeout=60) as client:
        for chunk in chunks:
            section = " › ".join(chunk["path"])
            if not _body_is_real(chunk["body"]):
                print(f"  skip  {section}  (empty / placeholder)")
                skipped += 1
                continue
            # One procedure = ONE row, always. Splitting a procedure across
            # rows would let the router return half its steps verbatim.
            body = scrub(chunk["body"]) if SCRUB_PII else chunk["body"]
            # Drop Markdown horizontal-rule dividers so they don't show in
            # the verbatim output returned to agents.
            body = re.sub(r"(?m)^\s*-{3,}\s*$", "", body).strip()
            if not body:
                print(f"  skip  {section}  (empty after cleanup)")
                skipped += 1
                continue
            # embed() truncates its INPUT at 8000 chars; the stored (and
            # returned) content is always the full procedure.
            vec = await embed(client, f"{EMBED_DOC_PREFIX}{section}\n{body}")
            # topic is knowledge_base_entries' pre-existing required column
            # (tadiwa's own KB UI) — give it the heading path too, same as
            # main.py's /api/ingest does for single-chunk submissions.
            await conn.execute(
                """INSERT INTO knowledge_base_entries (topic, source, section, content, embedding, is_active)
                   VALUES ($1,$2,$3,$4,$5,true)""",
                section, source, section, body, vec,
            )
            ok += 1
            print(f"  ok    {section}")

    await conn.close()
    print(f"Done: {ok} chunks ingested, {skipped} sections skipped, from '{source}'.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("md_path", help="path to the Markdown guide, e.g. BSS_steps.md")
    p.add_argument("--source", help="source label stored on each chunk (default: filename)")
    asyncio.run(run(p.parse_args()))
