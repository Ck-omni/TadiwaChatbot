"""
ZSmart Ticket Copilot — on-prem backend (PostgreSQL + pgvector).

Extension -> this service -> local LLM. Nothing leaves the network.

This service shares its database with the Omni Helpdesk console
(tadiwa-backend) — both point at the same `tadiwa` Postgres database, not a
separate `copilot` database of its own. Table/column names below are the
ones actually used in `tadiwa`; a couple were renamed or already existed
under a different name there (see each table's note) so as not to collide
with tables tadiwa-backend already owns.

PostgreSQL stores:
  - audit               every request: who, when, which procedure was chosen
                   (or none), the 👍/👎 rating / agent override, and — for
                   knowledge-gap mining — the scrubbed ticket text + embedding.
                   Also read directly by tadiwa-backend (apps/audit,
                   apps/dashboard) for the console's audit log and dashboard.
  - knowledge_base_entries   one row per guide procedure, with a pgvector
                   embedding. This is tadiwa-backend's own knowledge-base
                   table (apps/knowledgeBase) — this service adds rows to it
                   under its original kb_chunks column names (source,
                   section, tags) rather than duplicating a second table;
                   tadiwa's own manually-authored entries just leave those
                   columns NULL.

How /api/suggest answers (ANSWER_MODE=route, the default):
  1. RECALL  — embed the full ticket, semantic (cosine) search shortlists the
               SELECT_CANDIDATES most similar procedures.
  2. DECIDE  — the local LLM reads the WHOLE ticket (comments included) plus
               the shortlist and picks ONE procedure, or none. Its only output
               is "<number> - <reason>".
  3. ANSWER  — the chosen procedure's steps are returned VERBATIM from the
               guide. The model never writes or edits steps.
  If the LLM is unavailable, the fallback is gated on RAG_MIN_SIM and clearly
  marked unverified (fallback=true) — never presented as a confident choice.
  ANSWER_MODE=verbatim skips the LLM and returns the gated top match (instant).

Every stage is emitted as a trace event: /api/suggest returns it as `trace`,
/api/suggest/stream forwards it live over SSE, and it is logged to stdout.

Environment variables:
  DATABASE_URL      postgres://user:secret@db-host:5432/tadiwa — the SAME
                    database tadiwa-backend uses (DATABASE_URL in its own
                    .env), not a separate `copilot` database.
  LLM_CHAT_STYLE    "openai" ({base}/chat/completions) or "custom_stream"
                    ({base}/chat/stream, {"messages":[...]}; in-house wrappers)
  LLM_CHAT_URL      optional full chat URL override
  LLM_BASE_URL      OpenAI-compatible chat endpoint base, e.g. http://llm:11434/v1
  LLM_MODEL         e.g. llama3.1:8b (label only for custom_stream)
  LLM_TIMEOUT       seconds for the chat call (default 300)
  EMBED_BASE_URL    OpenAI-compatible embeddings base (defaults to LLM_BASE_URL)
  EMBED_MODEL       e.g. nomic-embed-text (Ollama) / your vLLM embedding model
  EMBED_DIM         embedding dimension, must match the model (nomic = 768)
  ANSWER_MODE       "route" (default) | "verbatim" (no LLM)
  SELECT_CANDIDATES procedures shortlisted for the LLM to choose from (default 5)
  RAG_TOP_K         results returned by the /api/retrieve debug endpoint (default 4)
  RAG_MIN_SIM       minimum cosine similarity 0-1 for a confident match (default 0.35;
                    tune with dev/eval — nomic scores cluster high, ~0.68 works)
  LLM_API_KEY       usually unused locally (default "local")
  SCRUB_PII         "1" (default) to redact emails/phones/long digit runs
  STORE_TICKET_TEXT "1" (default) to keep scrubbed ticket text + embedding in
                    the audit log for knowledge-gap mining (see dev/gap_report.py)
  ALLOWED_ORIGINS   comma-separated; set to chrome-extension://<id> in prod
  DOMAIN_API_KEY    shared secret the caller must send as `X-Api-Key`. Unset
                    (default) disables the check — dev only; always set this
                    in production (SECURITY.md). /healthz is exempt.
  SESSION_TTL_MINUTES     minutes a session_id stays "active" for multi-turn
                          context before a stale one silently starts fresh
                          (default 60)
  SESSION_HISTORY_TURNS   prior turns spliced into the Decide-stage prompt
                          (default 8)
  SESSION_RETENTION_DAYS  days copilot_sessions/chat_turns rows are kept
                          before dev/purge_sessions.py deletes them (default 30)

Run:
  pip install -r requirements.txt
  uvicorn main:app --host 0.0.0.0 --port 8080
"""

import json
import logging
import os
import re
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pgvector.asyncpg import register_vector
from pydantic import BaseModel, Field, field_validator

# Walks up from this file's directory looking for `.env`, so `uvicorn main:app`
# picks up the repo-root .env regardless of the current working directory.
# Never overrides a variable the environment already set (e.g. in Docker/prod).
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("copilot")

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tadiwa")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:8b")
# Chat API dialect:
#   "openai"        -> POST {base}/chat/completions, standard OpenAI schema (default)
#   "custom_stream" -> POST {base}/chat/stream with {"messages":[...]} (no model
#                      field) and tolerant parsing of the streamed response.
#                      Matches in-house wrappers like the Mistral-7B "LLM API Server".
LLM_CHAT_STYLE = os.getenv("LLM_CHAT_STYLE", "openai")
LLM_CHAT_URL = os.getenv("LLM_CHAT_URL", "")  # optional full-URL override
EMBED_BASE_URL = os.getenv("EMBED_BASE_URL", LLM_BASE_URL)
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
RAG_MIN_SIM = float(os.getenv("RAG_MIN_SIM", "0.35"))
LLM_API_KEY = os.getenv("LLM_API_KEY", "local")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "300"))  # seconds for the chat call
# Answer strategy:
#   "route"    (default): retrieve candidates, let the LLM READ the full ticket
#              and pick the right procedure, then return its steps verbatim.
#              Robust to noisy tickets; needs no doc changes.
#   "verbatim": return the top-1 procedure by similarity, no LLM (instant).
ANSWER_MODE = os.getenv("ANSWER_MODE", "route")
# How many candidate procedures the recall step hands to the LLM to choose from.
SELECT_CANDIDATES = int(os.getenv("SELECT_CANDIDATES", "5"))
SCRUB_PII = os.getenv("SCRUB_PII", "1") == "1"
STORE_TICKET_TEXT = os.getenv("STORE_TICKET_TEXT", "1") == "1"
# nomic-embed-text (and many instruction-tuned embedders) are trained with task
# prefixes that sharpen query/document separation. Without them, similarities
# collapse into a high band and unrelated text clears RAG_MIN_SIM. Set both to
# "" for models that don't use prefixes.
EMBED_QUERY_PREFIX = os.getenv("EMBED_QUERY_PREFIX", "search_query: ")
EMBED_DOC_PREFIX = os.getenv("EMBED_DOC_PREFIX", "search_document: ")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
# Shared secret the caller (the extension backend, i.e. Ruvarashe's DomA.I.n
# extension) must send as `X-Api-Key`. Empty disables the check — dev only.
DOMAIN_API_KEY = os.getenv("DOMAIN_API_KEY", "")
# Reachable without the key — uptime monitoring shouldn't need the secret.
PUBLIC_PATHS = {"/healthz"}
# Multi-turn dialogue: how long a session_id stays "active" for context
# before a stale one silently starts a fresh session (no error — the caller
# just gets a new id back and the conversation resets).
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "60"))
# How many prior turns are spliced into the LLM's Decide-stage prompt.
SESSION_HISTORY_TURNS = int(os.getenv("SESSION_HISTORY_TURNS", "8"))
# How long chat_sessions/chat_turns rows are kept before dev/purge_sessions.py
# deletes them — a separate, longer window than SESSION_TTL_MINUTES (that one
# governs "still one conversation", this one governs "still worth keeping").
SESSION_RETENTION_DAYS = int(os.getenv("SESSION_RETENTION_DAYS", "30"))

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

-- This is tadiwa-backend's own `audit` table (prisma/schema.prisma's Audit
-- model) — this service is its only writer. Column names below match that
-- model (e.g. `email`, not `username`: the caller's email, forwarded via
-- X-Remote-User once the extension signs in against tadiwa-backend).
CREATE TABLE IF NOT EXISTS audit (
    request_id        UUID PRIMARY KEY,
    ts                TIMESTAMPTZ NOT NULL,
    email             TEXT NOT NULL,
    capture_source    TEXT,
    ticket_chars      INTEGER,
    suggestion_chars  INTEGER,
    kb_hits           INTEGER,
    rating            TEXT CHECK (rating IN ('up','down'))
);
-- Idempotent column adds for existing deployments.
-- Gap-mining: the scrubbed ticket text and its embedding let dev/gap_report.py
-- cluster unanswered tickets into "procedures still missing from the guide".
ALTER TABLE audit ADD COLUMN IF NOT EXISTS ticket_text      TEXT;
ALTER TABLE audit ADD COLUMN IF NOT EXISTS ticket_embedding vector({dim});
-- Routing outcome: which procedure was chosen (NULL = no match — the primary
-- gap-mining signal) and the agent's override if they picked a different one.
ALTER TABLE audit ADD COLUMN IF NOT EXISTS matched_section  TEXT;
ALTER TABLE audit ADD COLUMN IF NOT EXISTS choice           INTEGER;
ALTER TABLE audit ADD COLUMN IF NOT EXISTS override_section TEXT;
-- Links this request to its multi-turn conversation, if any (NULL for a
-- caller that never sends session_id — single-shot requests still work).
ALTER TABLE audit ADD COLUMN IF NOT EXISTS session_id       UUID;

-- Multi-turn dialogue state (Phase 2 §7). One row per conversation; the
-- extension carries session_id forward across follow-up messages in the
-- same panel session. last_active_at is the TTL clock (SESSION_TTL_MINUTES);
-- a session past it is treated as gone and a fresh one is minted silently.
--
-- Named copilot_sessions, not chat_sessions: tadiwa-backend already has a
-- `chat_sessions` table (its ChatSession model) for agent<->agent peer
-- messaging, with an incompatible shape (userId/recipientId FKs, no
-- username/TTL). This table is this service's own, kept distinct on purpose.
CREATE TABLE IF NOT EXISTS copilot_sessions (
    session_id     UUID PRIMARY KEY,
    username       TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per message either side of the conversation sent. Ordered by ts,
-- fed to the LLM's Decide-stage prompt as prior context (see select_procedure).
CREATE TABLE IF NOT EXISTS chat_turns (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES copilot_sessions(session_id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_turns_session_idx ON chat_turns(session_id, ts);

-- This is tadiwa-backend's own `knowledge_base_entries` table (prisma/
-- schema.prisma's KnowledgeBaseEntry model) — NOT a separate kb_chunks
-- table. `topic` is tadiwa's pre-existing required column (used as this
-- chunk's heading path, same value as `section`, so tadiwa's own
-- knowledge-base UI has something sensible to display); source/section/tags
-- are this service's original kb_chunks columns, added onto that table
-- (NULL/empty for entries authored directly through tadiwa's KB UI).
CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    id          SERIAL PRIMARY KEY,
    topic       TEXT NOT NULL,
    content     TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    updated_by  INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding   vector({dim})
);
-- No vector index on purpose: an exact sequential scan is correct and fast to
-- thousands of rows. Revisit (ivfflat/hnsw) only when the guide is much larger.
ALTER TABLE knowledge_base_entries ADD COLUMN IF NOT EXISTS source  TEXT;
ALTER TABLE knowledge_base_entries ADD COLUMN IF NOT EXISTS section TEXT;
-- Classification tags submitted alongside a chunk via POST /api/ingest
-- (bulk ingest.py leaves this NULL/empty — it has no tag input today).
ALTER TABLE knowledge_base_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{{}}';
""".format(dim=EMBED_DIM)

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s\-.]?){8,14}\d(?!\d)")
LONG_DIGITS_RE = re.compile(r"\b\d{10,}\b")


def scrub(text: str) -> str:
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = PHONE_RE.sub("[PHONE]", text)
    text = LONG_DIGITS_RE.sub("[NUMBER]", text)
    return text


def request_user(req: Request) -> str:
    """Behind IIS/nginx with Windows Integrated Auth, forward the user in a
    header. Falls back to 'unknown' in dev."""
    return req.headers.get("X-Remote-User") or req.headers.get("X-Forwarded-User") or "unknown"


async def get_or_create_session(pool, session_id: uuid.UUID | None, username: str) -> uuid.UUID:
    """Resolve the caller's session_id for multi-turn context.

    - None supplied -> mint a new one (first message in a conversation).
    - Supplied but unknown or past SESSION_TTL_MINUTES since last activity ->
      silently mint a NEW one. No error: an expired/garbage session_id just
      starts a fresh conversation, same as if none had been sent. The caller
      (extension) must adopt whatever id comes back in the response — it may
      not be the one it sent.
    - Supplied and still active -> bump last_active_at, return it unchanged.

    The UPDATE...RETURNING does the "is it still active" check and the
    activity-bump in one round trip, so there's no separate read-then-write
    race between two calls in the same session arriving close together.
    """
    async with pool.acquire() as conn:
        if session_id is not None:
            row = await conn.fetchrow(
                """UPDATE copilot_sessions SET last_active_at = now()
                   WHERE session_id = $1
                     AND last_active_at > now() - make_interval(mins => $2)
                   RETURNING session_id""",
                session_id, SESSION_TTL_MINUTES,
            )
            if row is not None:
                return row["session_id"]
        new_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO copilot_sessions (session_id, username) VALUES ($1, $2)",
            new_id, username,
        )
        return new_id


async def load_history(pool, session_id: uuid.UUID) -> list[dict]:
    """The last SESSION_HISTORY_TURNS turns of this session, oldest first,
    shaped as {"role", "content"} ready to splice into an LLM messages list."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT role, content FROM chat_turns WHERE session_id = $1
               ORDER BY ts DESC LIMIT $2""",
            session_id, SESSION_HISTORY_TURNS,
        )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


async def save_turn(pool, session_id: uuid.UUID, role: str, content: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO chat_turns (session_id, role, content) VALUES ($1,$2,$3)",
            session_id, role, content,
        )


async def init_pool(app: FastAPI) -> None:
    async def _init_conn(conn):
        # The vector extension must exist before we can register its type codec;
        # create it here so a brand-new database initialises correctly (the
        # pool's init hook runs before SCHEMA does).
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await register_vector(conn)

    app.state.pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=1, max_size=10, init=_init_conn
    )
    async with app.state.pool.acquire() as conn:
        await conn.execute(SCHEMA)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if "*" in ALLOWED_ORIGINS:
        log.warning(
            "ALLOWED_ORIGINS is '*' — any page can call this API, including the "
            "unauthenticated /api/ingest (KB poisoning risk). Fine for local dev; "
            "in production set ALLOWED_ORIGINS=chrome-extension://<id> (SECURITY.md)."
        )
    if not DOMAIN_API_KEY:
        log.warning(
            "DOMAIN_API_KEY is unset — the X-Api-Key checkpoint is disabled and "
            "every route (including /api/ingest) is reachable with no authentication "
            "at all. Fine for local dev; always set DOMAIN_API_KEY in production "
            "(SECURITY.md)."
        )
    await init_pool(app)
    yield
    await app.state.pool.close()


app = FastAPI(title="ZSmart Ticket Copilot backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    # X-Remote-User: the extension now signs the caller in against the Omni
    # Helpdesk console (tadiwa-backend) and sends their email here on every
    # request — see extension/sidepanel.js's identityHeaders(). request_user()
    # below already trusted this header from a reverse proxy; this just lets
    # the browser's CORS preflight actually allow the extension to set it too.
    allow_headers=["Content-Type", "X-Api-Key", "X-Remote-User"],
)


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    """Checkpoint in front of every route: the caller must send a valid
    `X-Api-Key` header matching DOMAIN_API_KEY. Runs as outer ASGI middleware,
    so a bad/missing key is rejected before request validation, DB, or LLM
    calls ever run — no wasted downstream work.

    DOMAIN_API_KEY unset -> disabled (see the startup warning in `lifespan`).
    /healthz is always exempt so uptime checks don't need the secret. CORS
    preflight (OPTIONS) is handled by CORSMiddleware, which sits outside this
    one, so it never reaches this check.
    """
    if not DOMAIN_API_KEY or request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    supplied = request.headers.get("X-Api-Key", "")
    if not secrets.compare_digest(supplied, DOMAIN_API_KEY):
        return JSONResponse({"detail": "missing or invalid API key"}, status_code=401)

    return await call_next(request)


async def embed(text: str) -> list[float]:
    """Embed via any OpenAI-compatible /v1/embeddings endpoint
    (Ollama, vLLM, text-embeddings-inference all support this)."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{EMBED_BASE_URL.rstrip('/')}/embeddings",
                json={"model": EMBED_MODEL, "input": text[:8000]},
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            )
            r.raise_for_status()
            vec = r.json()["data"][0]["embedding"]
    except httpx.HTTPError as e:
        # Was previously unhandled here (unlike call_chat_llm's equivalent
        # catch) -> a down embedding endpoint surfaced as an opaque 500 with
        # a raw traceback instead of a message the frontend can show.
        raise HTTPException(502, f"Embedding endpoint unreachable: {e}") from e
    if len(vec) != EMBED_DIM:
        raise HTTPException(
            500,
            f"Embedding dim {len(vec)} != EMBED_DIM {EMBED_DIM}. "
            "Set EMBED_DIM to match your embedding model and re-embed knowledge_base_entries.",
        )
    return vec


async def retrieve_similar(pool, query_vec, limit: int = RAG_TOP_K) -> list[asyncpg.Record]:
    """Exact semantic search over knowledge_base_entries: nearest procedures by
    cosine similarity, best first. No index needed at this scale — a
    sequential scan is exact and fast to thousands of rows. (A keyword/
    full-text arm was tried and removed: at this KB size it never surfaced
    anything the vector search missed, and its fusion ranking boosted
    distractor procedures. Reintroduce deliberately if dev/eval ever shows an
    exact-token miss.)

    Scoped to is_active rows with an embedding — entries authored directly
    through tadiwa's own knowledge-base UI have no embedding (and often no
    section) and so can't be semantically matched; only chunks this service
    itself ingested are ever candidates here."""
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT source, section, content,
                   1 - (embedding <=> $1) AS similarity
            FROM knowledge_base_entries
            WHERE is_active AND embedding IS NOT NULL
            ORDER BY embedding <=> $1
            LIMIT $2
            """,
            query_vec,
            limit,
        )


def recall_sources(rows) -> list[dict]:
    """Source list gated on RAG_MIN_SIM, for the /api/retrieve recall metric.

    Note the deliberate asymmetry: this gate is only for the recall *metric*
    (dev/eval). The live routing path (run_suggest) does NOT gate — it hands
    the similarity-ordered shortlist to the LLM, which decides relevance."""
    return [
        {"section": r["section"] or "(untitled)", "source": r["source"],
         "sim": round(r["similarity"], 3)}
        for r in rows
        if r["similarity"] >= RAG_MIN_SIM
    ]


class SuggestIn(BaseModel):
    ticket_text: str = Field(min_length=10, max_length=40000)
    extra_context: str | None = Field(default=None, max_length=2000)
    capture_source: str = "unknown"
    # Omit on the first message of a conversation; echo back whatever the
    # response returns on every follow-up so the LLM sees prior turns. An
    # unknown/expired id is not an error — see get_or_create_session.
    session_id: uuid.UUID | None = None


class FeedbackIn(BaseModel):
    request_id: uuid.UUID
    rating: str
    # Set when the agent clicked a different candidate than the routed one —
    # the strongest "the router picked wrong" signal we can collect.
    override_section: str | None = Field(default=None, max_length=500)


class IngestIn(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    section: str | None = Field(default=None, max_length=500)
    content: str = Field(min_length=10, max_length=20000)
    # Classification tags from the submission form. Shape is provisional —
    # TASKS.md Phase 2 §4 flags this as pending confirmation with Ruvarashe;
    # rename/reshape here + the `tags` column in SCHEMA if the real contract
    # differs (e.g. a single category string rather than a list).
    tags: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, v: list[str]) -> list[str]:
        cleaned = [t.strip() for t in v if t.strip()]
        if any(len(t) > 100 for t in cleaned):
            raise ValueError("each tag must be 100 characters or fewer")
        return cleaned


class RetrieveIn(BaseModel):
    ticket_text: str = Field(min_length=1, max_length=40000)


def _extract_chunk_text(raw: str) -> str:
    """Pull the text out of one streamed chunk, whatever its shape.
    Handles OpenAI deltas, {"content"/"token"/"text"/"response": ...},
    bare JSON strings, and plain text. Unrecognised JSON objects yield ''."""
    raw = raw.strip()
    if not raw or raw == "[DONE]":
        return ""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return raw  # plain text chunk
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        try:
            choice = obj["choices"][0]
            return (
                choice.get("delta", {}).get("content")
                or choice.get("message", {}).get("content")
                or choice.get("text")
                or ""
            )
        except (KeyError, IndexError, TypeError):
            pass
        for key in ("content", "token", "text", "response", "delta", "answer"):
            val = obj.get(key)
            if isinstance(val, str):
                return val
    return ""


async def call_chat_llm(messages: list[dict]) -> str:
    """Send a chat to the LLM in whichever dialect is configured."""
    headers = {"Authorization": f"Bearer {LLM_API_KEY}"}

    if LLM_CHAT_STYLE == "openai":
        url = LLM_CHAT_URL or f"{LLM_BASE_URL.rstrip('/')}/chat/completions"
        payload = {
            "model": LLM_MODEL,
            "messages": messages,
            "max_tokens": 900,
            "temperature": 0.2,
        }
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                r = await client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Local LLM unreachable: {e}") from e
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise HTTPException(502, "Unexpected response from local LLM.") from e

    # custom_stream: {"messages": [...]} to /chat/stream, no model field.
    url = LLM_CHAT_URL or f"{LLM_BASE_URL.rstrip('/')}/chat/stream"
    parts: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            async with client.stream(
                "POST", url, json={"messages": messages}, headers=headers
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:]
                    if line.strip() == "[DONE]":
                        break
                    parts.append(_extract_chunk_text(line))
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Local LLM unreachable: {e}") from e
    suggestion = "".join(parts).strip()
    if not suggestion:
        raise HTTPException(
            502,
            "LLM stream returned no parseable text. Capture one raw response "
            "from the /chat/stream endpoint and adjust _extract_chunk_text().",
        )
    return suggestion


NO_MATCH = "No matching procedure found in the guide for this ticket."


def _gist(content: str, limit: int = 110) -> str:
    """A compact one-line preview of a procedure for the selection prompt."""
    return " ".join(content.split())[:limit]


def _parse_choice(text: str, n: int) -> tuple[int, str]:
    """Tolerantly pull (choice, reason) from the LLM's reply. The first integer
    in 0..n is the choice; the text after the number/separator is the reason."""
    m = re.search(r"\d{1,2}", text)
    choice = int(m.group()) if m else 0
    if choice > n:
        choice = 0
    seps = " .:-–—)\t\n"
    reason = (text[m.end():] if m else text).lstrip(seps).strip()
    if not reason and m:  # reason may precede the number
        reason = text[: m.start()].strip(seps)
    return choice, reason[:300]


async def select_procedure(ticket: str, candidates: list, history: list[dict] | None = None) -> tuple[int, str]:
    """Ask the LLM to READ the full ticket (plus prior turns of this same
    conversation, if any) and choose the matching procedure.
    Returns (choice 1..N or 0, short reason)."""
    listing = "\n".join(f"{i}) {r['section']} — {_gist(r['content'])}"
                        for i, r in enumerate(candidates, 1))
    n = len(candidates)
    prompt = (
        "You route a support ticket to exactly ONE resolution procedure from the "
        "numbered list. Read the WHOLE ticket, including comments. Beware negations: "
        "'no outstanding suspension or block' means it is NOT a suspension/block case. "
        "Pick the procedure whose PURPOSE accomplishes what the customer actually "
        "needs done.\n\n"
        f"TICKET:\n{ticket}\n\n"
        f"PROCEDURES:\n{listing}\n\n"
        f"Answer with the single best number (1-{n}), or 0 if none fit, then a dash and "
        "a brief reason.\nExample: 2 - customer wants a new bundle added, which this "
        "procedure does."
    )
    # Prior turns of this session (if any) go between the system prompt and
    # the current ask, so a follow-up like "actually it's two-way, not
    # one-way" is read in context rather than as an isolated new ticket.
    messages = [
        {"role": "system", "content": "You route trouble tickets for a telecom BSS help desk to the correct resolution procedure. Be precise and terse. Reply in the format: <number> - <reason>."},
        *(history or []),
        {"role": "user", "content": prompt},
    ]
    reply = await call_chat_llm(messages)
    return _parse_choice(reply, n)


async def run_suggest(pool, ticket: str, username: str, capture_source: str, session_id: uuid.UUID):
    """Retrieve -> route -> answer pipeline. Yields stage events; the final
    'answer' event carries the result. Shared by /api/suggest and the SSE stream.

    session_id is already resolved (see get_or_create_session) by the caller
    before this generator starts, so it's valid/active for the whole call."""
    rid = uuid.uuid4().hex[:8]

    yield {"stage": "session", "session_id": str(session_id)}
    history = await load_history(pool, session_id)

    yield {"stage": "embedding"}
    try:
        qvec = await embed(EMBED_QUERY_PREFIX + ticket)
        candidates = list(await retrieve_similar(pool, qvec, limit=SELECT_CANDIDATES))
    except Exception as e:  # embed/db down → degrade to no-match
        log.warning("[%s] retrieval failed: %s", rid, e)
        qvec, candidates = None, []

    cand_view = [
        {"n": i + 1, "section": r["section"], "sim": round(r["similarity"], 3)}
        for i, r in enumerate(candidates)
    ]
    log.info("[%s] retrieved %d candidates: %s", rid, len(candidates),
             " | ".join(f"{c['section']}({c['sim']})" for c in cand_view) or "(none)")
    yield {"stage": "retrieved", "candidates": cand_view}

    choice, reason, matched_section, suggestion = 0, "", None, NO_MATCH
    fallback = False

    if candidates and ANSWER_MODE == "verbatim":
        top = candidates[0]
        if top["similarity"] >= RAG_MIN_SIM:
            choice, matched_section, suggestion = 1, top["section"], top["content"]
            reason = "top similarity match (verbatim mode, no LLM)"
    elif candidates:  # route (default)
        yield {"stage": "selecting", "count": len(candidates)}
        try:
            choice, reason = await select_procedure(ticket, candidates, history)
        except HTTPException as e:
            # The LLM could not decide. NEVER present the similarity top-1 as a
            # confident choice — that is exactly the failure routing exists to
            # fix. Gate it on RAG_MIN_SIM and mark the whole answer unverified.
            log.warning("[%s] LLM selection failed: %s", rid, e.detail)
            yield {"stage": "error", "detail": f"LLM unavailable: {e.detail}"}
            fallback = True
            top = candidates[0]
            if top["similarity"] >= RAG_MIN_SIM:
                choice, reason = 1, "unverified — assistant offline, closest match by similarity"
            else:
                choice, reason = 0, "assistant offline and no candidate is a confident match"
        if 1 <= choice <= len(candidates):
            picked = candidates[choice - 1]
            matched_section, suggestion = picked["section"], picked["content"]
        else:
            choice = 0
        log.info("[%s] chose #%d -> %s%s (%s)", rid, choice, matched_section or "NONE",
                 " [FALLBACK]" if fallback else "", reason)
        yield {"stage": "selected", "choice": choice, "section": matched_section,
               "reason": reason, "fallback": fallback}

    kb_hits = len(candidates)
    request_id = uuid.uuid4()
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO audit
                   (request_id, ts, email, capture_source,
                    ticket_chars, suggestion_chars, kb_hits,
                    ticket_text, ticket_embedding, matched_section, choice, session_id)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                request_id, datetime.now(timezone.utc), username, capture_source,
                len(ticket), len(suggestion or ""), kb_hits,
                ticket if STORE_TICKET_TEXT else None,
                qvec if STORE_TICKET_TEXT else None,
                matched_section, choice, session_id,
            )
    except Exception as e:
        log.warning("[%s] audit insert failed: %s", rid, e)

    # Persist this exchange so the NEXT call in the same session sees it as
    # history. Best-effort: a failure here shouldn't break the response the
    # agent is waiting on.
    #
    # The assistant turn is a SHORT decision summary, not the full verbatim
    # suggestion — storing the full text (whole procedure steps, or the
    # literal NO_MATCH sentence) turned out to actively mislead the next
    # turn's routing call: the model would pattern-match its own prior
    # phrasing back verbatim (e.g. repeat "no match" reflexively) instead of
    # re-evaluating the follow-up on its own merits. A compact "what we
    # concluded" note gives context without that anchoring effect, and keeps
    # the history cheap to keep re-sending every turn.
    assistant_note = (
        f"[routed to: {matched_section}] {reason}" if matched_section
        else f"[no match] {reason}"
    )
    try:
        await save_turn(pool, session_id, "user", ticket)
        await save_turn(pool, session_id, "assistant", assistant_note)
    except Exception as e:
        log.warning("[%s] saving chat turn failed: %s", rid, e)

    yield {
        "stage": "answer",
        "request_id": str(request_id),
        "session_id": str(session_id),
        "suggestion": suggestion,
        "matched_section": matched_section,
        "choice": choice,
        "reason": reason,
        "fallback": fallback,
        "kb_hits": kb_hits,
    }


def _prepare_ticket(body: SuggestIn) -> str:
    ticket = scrub(body.ticket_text) if SCRUB_PII else body.ticket_text
    if body.extra_context:
        note = scrub(body.extra_context) if SCRUB_PII else body.extra_context
        ticket = f"{ticket}\n\nAGENT NOTE: {note}"
    return ticket


@app.post("/api/suggest")
async def suggest(body: SuggestIn, req: Request):
    """Non-streaming: runs the full pipeline and returns the answer plus a
    `trace` of every stage (candidates, LLM choice + reason). Response
    includes `session_id` — send it back on the next call in the same
    conversation to give the LLM prior-turn context."""
    ticket = _prepare_ticket(body)
    username = request_user(req)
    session_id = await get_or_create_session(req.app.state.pool, body.session_id, username)
    events = [
        ev async for ev in run_suggest(
            req.app.state.pool, ticket, username, body.capture_source, session_id
        )
    ]
    answer = next((e for e in reversed(events) if e["stage"] == "answer"), None)
    if answer is None:
        raise HTTPException(500, "no answer produced")
    return {**{k: v for k, v in answer.items() if k != "stage"}, "trace": events}


@app.post("/api/suggest/stream")
async def suggest_stream(body: SuggestIn, req: Request):
    """Server-Sent Events: emits each pipeline stage as it happens so the UI can
    show progress live (session → searching → candidates → selecting → chosen
    → answer). The `session` event carries session_id early, so the panel can
    stash it before the answer arrives."""
    pool = req.app.state.pool
    ticket = _prepare_ticket(body)
    username, capture_source = request_user(req), body.capture_source
    session_id = await get_or_create_session(pool, body.session_id, username)

    async def gen():
        async for ev in run_suggest(pool, ticket, username, capture_source, session_id):
            yield f"data: {json.dumps(ev)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/feedback")
async def feedback(body: FeedbackIn, req: Request):
    if body.rating not in ("up", "down"):
        raise HTTPException(400, "rating must be 'up' or 'down'")
    async with req.app.state.pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE audit SET rating=$1, override_section=COALESCE($3, override_section) WHERE request_id=$2",
            body.rating,
            body.request_id,
            body.override_section,
        )
    if result == "UPDATE 0":
        raise HTTPException(404, "unknown request_id")
    return {"ok": True}


@app.post("/api/retrieve")
async def retrieve(body: RetrieveIn, req: Request):
    """Debug / eval endpoint: return the guide procedures semantic search would
    surface for this ticket, WITHOUT calling the LLM. Used by dev/eval (recall)."""
    ticket = scrub(body.ticket_text) if SCRUB_PII else body.ticket_text
    qvec = await embed(EMBED_QUERY_PREFIX + ticket)
    rows = await retrieve_similar(req.app.state.pool, qvec, limit=RAG_TOP_K)
    sources = recall_sources(rows)
    return {"kb_hits": len(sources), "sources": sources}


@app.get("/api/procedure")
async def procedure(section: str, req: Request):
    """Return one procedure's steps verbatim by exact section. Used by the
    panel's clickable candidate list ("not this one? pick another")."""
    async with req.app.state.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT source, section, content FROM knowledge_base_entries WHERE section = $1 AND is_active",
            section,
        )
    if row is None:
        raise HTTPException(404, "unknown section")
    return {"section": row["section"], "source": row["source"], "suggestion": row["content"]}


@app.post("/api/ingest")
async def ingest(body: IngestIn, req: Request):
    """Add one guide chunk to the knowledge base — the receiver for the
    HelpDesk submission form (domain knowledge + classification tags).
    Already behind the require_api_key checkpoint like every other route.
    Use ingest.py for bulk Markdown loading."""
    content = scrub(body.content) if SCRUB_PII else body.content
    # Tags are folded into the embedded text (best-effort retrieval signal)
    # and stored verbatim in their own column for exact filtering later.
    tag_line = f"Tags: {', '.join(body.tags)}\n" if body.tags else ""
    vec = await embed(EMBED_DOC_PREFIX + f"{body.section or ''}\n{tag_line}{content}")
    # Idempotency: (source, section) is this chunk's natural identity — a
    # HelpDesk worker re-submitting an edited version of the same procedure
    # should REPLACE it, not pile up duplicates that then compete with each
    # other (and the edited one) at retrieval time. Mirrors ingest.py's
    # per-source replace, just scoped to one procedure instead of a whole
    # document, since this endpoint adds/edits single chunks incrementally.
    # `section` is optional — with no natural key to match on, a missing
    # section always appends rather than guessing what to replace.
    replaced = False
    # knowledge_base_entries.topic is tadiwa's pre-existing required column
    # (used for its own KB UI) — give it the same value as section (falling
    # back to source when there's no section) so entries this service writes
    # still display sensibly there.
    topic = body.section or body.source
    try:
        async with req.app.state.pool.acquire() as conn:
            async with conn.transaction():
                if body.section:
                    deleted = await conn.execute(
                        "DELETE FROM knowledge_base_entries WHERE source=$1 AND section=$2",
                        body.source,
                        body.section,
                    )
                    replaced = deleted != "DELETE 0"
                row = await conn.fetchrow(
                    """INSERT INTO knowledge_base_entries
                       (topic, source, section, content, embedding, tags, is_active)
                       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id""",
                    topic,
                    body.source,
                    body.section,
                    content,
                    vec,
                    body.tags,
                )
    except asyncpg.PostgresError as e:
        log.warning("ingest insert failed for source=%s section=%s: %s", body.source, body.section, e)
        raise HTTPException(500, f"Could not save this chunk to the knowledge base: {e}") from e
    return {
        "ok": True, "id": row["id"], "source": body.source, "section": body.section,
        "tags": body.tags, "replaced": replaced,
    }


@app.get("/healthz")
async def healthz(req: Request):
    async with req.app.state.pool.acquire() as conn:
        kb_count = await conn.fetchval(
            "SELECT count(*) FROM knowledge_base_entries WHERE is_active AND embedding IS NOT NULL"
        )
    return {"ok": True, "model": LLM_MODEL, "embed_model": EMBED_MODEL, "kb_chunks": kb_count}
