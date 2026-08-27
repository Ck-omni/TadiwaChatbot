# DomA.I.n backend — task breakdown

Your side of the build: backend, DB, and security. Ruvarashe owns the Chrome
extension frontend; the *Integration & Handoff* section is where the two meet.

References below point at the current repo state so each task starts from
what already exists, not from scratch.

---

## Phase 1: Infrastructure, DB & Security

### 1. Local & Server Setup
Get the backend running locally first, then promote the same config to the
live DomA.I.n server.

- [ ] Install deps: `pip install -r backend/requirements.txt`
- [ ] Stand up Postgres + pgvector (local install or `deploy/docker-compose.yml`)
- [ ] Copy `.env.example` → `.env`, fill in `DATABASE_URL`, `LLM_BASE_URL`,
      `EMBED_BASE_URL`/`EMBED_MODEL`/`EMBED_DIM`
- [ ] Run locally: `uvicorn main:app --host 0.0.0.0 --port 8080 --env-file ../.env`
- [ ] Confirm `GET /healthz` returns `{"ok": true, ...}` with the right
      `kb_chunks` count
- [ ] Ingest the KB (`python ingest.py BSS_steps.md`) and sanity-check
      `/api/suggest` end-to-end with a sample ticket
- [ ] Once stable locally, repeat the same steps on the DomA.I.n server
      (see [DEPLOYMENT.md](DEPLOYMENT.md) for the production runbook —
      Docker Compose, TLS/SSO reverse proxy, force-install)
- [ ] Point `LLM_BASE_URL`/`EMBED_BASE_URL` at whatever the server's real LLM
      endpoint is (Ollama, vLLM, or an in-house wrapper — see
      `LLM_CHAT_STYLE` in `main.py` for the two supported dialects)

### 2. API Security
There is currently **no request-level auth** in `main.py` — only CORS via
`ALLOWED_ORIGINS`. This task adds the missing checkpoint.

- [x] Add a FastAPI middleware (or dependency) that runs before every route —
      `require_api_key` in `main.py`, registered via `@app.middleware("http")`
- [x] Read the DomA.I.n API key from an incoming header (`X-Api-Key`)
- [x] Compare against an expected value loaded from an env var
      (`DOMAIN_API_KEY`) — constant-time via `secrets.compare_digest`, never
      hardcoded
- [x] Reject with `401 Unauthorized` on a missing/invalid key, **before** any
      DB or LLM call runs — it's outer ASGI middleware, so it runs ahead of
      request validation and every route handler
- [x] Applies to all routes automatically (it's global middleware, not a
      per-route dependency) — `/api/suggest`, `/api/suggest/stream`,
      `/api/feedback`, `/api/ingest` all now require the key
- [x] `/healthz` stays key-free via a `PUBLIC_PATHS` exemption set
- [ ] Coordinate with Ruvarashe so her extension sends the key on every
      request (likely a header set in `sidepanel.js` / `background.js`) —
      **not done yet**, needs her side. CORS already allows the `X-Api-Key`
      header (`allow_headers` in `main.py`) so this is unblocked whenever
      she's ready
- [x] Documented in `SECURITY.md` (§4 threat model, §6 checklist, §7 key
      management) — header name is `X-Api-Key`, secret lives in `.env` /
      your secrets manager as `DOMAIN_API_KEY`

> **Local dev note:** `DOMAIN_API_KEY` is left unset in `.env` on purpose —
> the check is a no-op until it's set (a startup log warns loudly when this
> is the case), so existing local testing keeps working unchanged. Set it
> only once Ruvarashe's side is ready to send the header, otherwise the
> extension will start getting 401s.

### 3. Database Schema
Add operational tables alongside the existing `audit` / `kb_chunks` tables
(schema defined in `main.py`'s `SCHEMA` constant).

- [ ] Design `audit_logs`: who did what, when — decide whether this
      **replaces/extends** the existing `audit` table (which already has
      `request_id`, `ts`, `username`, `matched_section`, `choice`, `rating`,
      etc.) or is a genuinely separate table. Avoid duplicating what `audit`
      already tracks unless the business explicitly wants a distinct log
- [ ] Design `sla_stats`: response latency, LLM call duration, retrieval
      recall/hit-rate over time — whatever "how fast, what's breaking" means
      concretely once confirmed with the business
- [ ] Add both as `CREATE TABLE IF NOT EXISTS` blocks, following the existing
      pattern in `main.py` (idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS`
      for any later column additions)
- [ ] **Sync with Tasara** before finalizing columns — confirm the two tables
      capture every telemetry field the business actually needs; adjust the
      schema based on that conversation rather than guessing up front
- [ ] Wire the actual inserts: audit_logs on every `/api/suggest` call,
      sla_stats on a timer or per-request timing hook
- [ ] Re-run `dev/eval/run_eval.py` after any schema change that touches
      retrieval, to confirm nothing regressed

---

## Phase 2: Vector Pipeline & Conversational Logic

### 4. HelpDesk Ingestion Endpoint
A `POST /api/ingest` endpoint **already exists** (`main.py`) accepting
`{source, section, content}` for a single chunk. It now also accepts `tags`.

- [ ] Confirm the payload contract with Ruvarashe: does her form send
      `{source, section, content}`, or does it also need classification
      tags / metadata the current `IngestIn` model doesn't have yet? —
      **still open**; see the provisional decision below
- [x] Extended `IngestIn` with `tags: list[str]` (default empty, max 20
      tags, each ≤100 chars, blanks stripped by a `field_validator`) — the
      original task text explicitly named "domain knowledge **and
      classification tags**", so this is a grounded default, not a guess,
      but the exact field name/shape is still provisional pending Ruvarashe's
      actual form contract. Cheap to rename/reshape later (plain
      `TEXT[]` column, no other code depends on the name)
- [x] Locked down behind the API key middleware (Task 2) — it was already
      covered automatically, since `require_api_key` is global and
      `/api/ingest` isn't in `PUBLIC_PATHS`. Verified: 401 without a valid
      `X-Api-Key` when `DOMAIN_API_KEY` is set, 200 with it
- [x] Input validated: existing `Field(min_length=..., max_length=...)` on
      `source`/`section`/`content`, plus the new tag-count/tag-length
      validation above. Verified both a too-short `content` and an
      over-length tag return a structured `422` the frontend can parse and
      show directly
- [x] Clear success/error responses:
      - success now echoes back `{"ok", "id", "source", "section", "tags"}`
        so the frontend can confirm exactly what was stored
      - DB insert failures return a `500` with a specific message instead of
        an opaque stack trace (`try`/`except asyncpg.PostgresError`)
      - fixed a related gap in `embed()` (shared by this endpoint,
        `/api/suggest`, and `/api/retrieve`): a down embedding server used
        to raise an unhandled exception; now raises a clear `502 Embedding
        endpoint unreachable: ...`

Also added: tags are folded into the embedded text (`Tags: a, b\n` line
before the content) so they contribute to retrieval, not just stored for
display — reasonable given the stated goal is the AI answering questions
about the submitted content, but flag this to Ruvarashe/Tasara if tags were
meant as exact-match filters instead of a retrieval signal.

**Verified live end-to-end**: ingested a test chunk with tags → confirmed
the `tags` column persisted correctly in Postgres → confirmed
`/api/retrieve` immediately surfaced it as the top match (0.799 similarity)
for a query using its content and tags — no backend restart needed.

### 5. Automated Vectorization Pipeline
The embedding call already exists as the `embed()` helper in `main.py` and
is reused by both `ingest.py` (bulk) and the live suggest path.

- [x] Reuses `embed()` as-is — Task 4's endpoint calls the same helper,
      no duplicate `/v1/embeddings` call anywhere
- [x] Embeds with `EMBED_MODEL` via `EMBED_DOC_PREFIX`, same convention as
      `ingest.py` (`EMBED_QUERY_PREFIX` is for queries at answer-time, not
      relevant on the ingestion side)
- [x] Vector saved into `kb_chunks` — **for now**. Task 6 hasn't decided
      yet whether a genuinely separate DB is warranted; this isn't a
      preemptive decision, just "no change needed until Task 6 says
      otherwise"
- [x] Dimension guard inherited for free — new code calls the same `embed()`
      that already raises on `len(vec) != EMBED_DIM`; nothing bypasses it
- [x] **Decided**: re-submission is idempotent, scoped to `(source,
      section)` rather than whole-`source` (unlike `ingest.py`'s bulk
      replace) — replacing at the full-source grain would wipe out every
      *other* procedure previously submitted under that same source label,
      which is wrong for an endpoint that adds/edits one procedure at a
      time. `(source, section)` is this chunk's natural identity: same pair
      → replace (edit-in-place); no `section` → nothing to key off, so it
      appends. Response now includes `"replaced": true/false` so the
      frontend/worker can tell which happened

**Verified live**: submitted a chunk, resubmitted the same `(source,
section)` with edited content (`replaced: true`, confirmed only one row
survives in Postgres with the new content), then submitted a third chunk
under the same `source` but no `section` (`replaced: false`, appended
alongside rather than colliding).

### 6. Inference Point Integration
Connect newly-vectorized submissions to the existing retrieval path
(`retrieve_similar()` in `main.py`) so new docs are answerable immediately.

- [x] **Decided**: shared `kb_chunks`, immediate visibility — not the
      separate-DB route the spec text floated. Reasoning: "separate
      database" reads two ways — (a) a technical/performance boundary, or
      (b) a content-governance boundary (unvetted worker submissions held
      apart from the curated guide until reviewed). (b) would directly
      contradict this same task's later "confirm it answers immediately"
      test, so this needed a real decision, not an assumption — confirmed:
      go with immediate + shared, revisit a review/promotion step
      separately later if unvetted-content risk turns out to matter
- [x] N/A — the separate-pool path wasn't chosen
- [x] Shared path was already how Task 4/5 built `/api/ingest`: it inserts
      into `kb_chunks` with `source` as the distinguishing value, no new
      code needed here
- [x] Confirmed **live, no restart**: new content is visible to
      `/api/suggest`'s recall step immediately — `retrieve_similar()` runs a
      fresh query every request, there's no caching layer sitting in front
      of it to invalidate
- [x] **Tested exactly as specified**: ingested a brand-new fake procedure
      ("BSS › Roaming Data Cap Reset") via `/api/ingest`, then immediately
      (same running process, zero restart) sent a matching ticket through
      the **full** `/api/suggest` pipeline (not just the `/api/retrieve`
      debug endpoint) — it surfaced as the #1 candidate at 0.82 similarity,
      the LLM correctly selected it (`choice: 1`), and the verbatim steps
      came back unmodified. Cleaned up the test row afterward; `/healthz`
      confirms `kb_chunks` back at the baseline 14.

### 7. Multi-Turn Dialogue State
Built from scratch — no existing code to extend here, unlike Tasks 4–6.

- [x] **Decided**: `session_id` is backend-minted, same pattern as the
      existing `request_id` — the extension never generates one, it only
      ever echoes back whatever the response gives it. Simpler and avoids
      any client-side collision/spoofing concerns
- [x] **Decided**: Postgres, not in-memory — two new tables, `chat_sessions`
      (one row per conversation, `last_active_at` as the TTL clock) and
      `chat_turns` (one row per message, `ON DELETE CASCADE` off
      `chat_sessions`). Reasoning: this app already treats Postgres as the
      system of record for every single request (`audit`); an in-memory
      store would silently lose history on every restart and couldn't be
      traced the way this same task's last checkbox asks for — that's an
      inconsistency with the app's own design, not a coin flip
- [x] `SuggestIn` extended with optional `session_id: uuid.UUID | None`.
      `get_or_create_session()` resolves it every call: missing/unknown/past
      `SESSION_TTL_MINUTES` (default 60) → silently mints a new one, no
      error — the caller just adopts whatever id comes back. Prior turns
      (`SESSION_HISTORY_TURNS`, default 8) are loaded and spliced into
      `select_procedure()`'s messages, between the system prompt and the
      current ask, so the Decide-stage LLM call sees them
- [x] Expiry: `SESSION_TTL_MINUTES` is the **live** "still one conversation"
      check (query-time, enforced in `get_or_create_session`). Separately,
      `dev/purge_sessions.py` (new, mirrors `dev/gap_report.py`'s style) is
      the **retention** cleanup — deletes `chat_sessions` older than
      `SESSION_RETENTION_DAYS` (default 30), run periodically like the
      existing gap-mining script. These are deliberately two different
      windows: one governs conversation continuity, the other governs how
      long rows are kept at all
- [x] Traceability: `audit.session_id` (new column) links every request to
      its conversation; the SSE stream now emits an early `{"stage":
      "session", "session_id": ...}` event, and the final `answer` event
      (both endpoints) always includes `session_id`
- [ ] Coordinate with Ruvarashe on how the side panel carries `session_id`
      across follow-ups — **still open**, needs her side. The contract is
      simple: store whatever `session_id` came back from the last
      `/api/suggest[/stream]` call (in-memory in the panel's JS, not
      `chrome.storage` — see `SECURITY.md` §5 on not persisting ticket
      data), send it back on the next call in the same panel session, and
      start a new conversation (drop it) when the agent captures a
      different ticket

**A real bug found and fixed during testing, not just a feature add**:
the assistant's history turn was originally the FULL suggestion text (either
the verbatim procedure steps, or the literal `NO_MATCH` sentence). Live
testing showed this actively misleads the model — a follow-up that should
have matched a candidate at 0.757 similarity instead got refused, because
the LLM echoed its own prior "no match" phrasing back verbatim from history
rather than re-evaluating the new message. Fixed by storing a short decision
summary (`[routed to: <section>] <reason>` / `[no match] <reason>`) instead
of the full text — re-tested after the fix and the same follow-up correctly
routed.

**Verified live, in full**:
| Test | Result |
|---|---|
| Turn 1, no `session_id` | Fresh id minted, returned in response |
| Turn 2, same `session_id`, context-dependent follow-up | Same id kept; **after the fix**, correctly routed using turn 1's context (before the fix, incorrectly echoed turn 1's "no match") |
| Unknown/bogus `session_id` | Silently minted a new one, no error |
| Backdated `last_active_at` (past TTL) | Silently minted a new one — expiry enforced |
| `dev/purge_sessions.py --dry-run` | Correctly reported 0 eligible at 30 days, 3 eligible at 0 days |
| `dev/purge_sessions.py` (real run) | Deleted the 3 test sessions; `chat_turns` cascaded to 0 automatically |

All test data cleaned up afterward (sessions, turns, and their `audit` rows).

---

## Integration & Handoff Milestones

Shared checkpoints with Ruvarashe — backend and frontend proving they work
together.

### Connectivity Sync
- [ ] Ruvarashe's extension successfully calls your local backend
- [ ] Request without the API key is rejected (401)
- [ ] Request with a valid key succeeds
- [ ] Confirm CORS (`ALLOWED_ORIGINS`) is set to her actual extension origin,
      not `*`, once the extension ID is known

### Pipeline E2E
- [ ] She submits a document through the extension's ingestion form
- [ ] Your backend vectorizes and stores it (Tasks 4–6)
- [ ] Both of you verify the AI can answer a question sourced from that new
      document — a real query through `/api/suggest`, not just a DB check
- [ ] Capture this as a repeatable test case (candidate for
      `dev/eval/golden.jsonl` if it's a good general regression case)

### Production Deploy
- [ ] Push backend + DB live on the DomA.I.n server (Task 1's server steps)
- [ ] Confirm testers can reach it through the real extension build
- [ ] Confirm `sla_stats` (Task 3) is actively recording real traffic —
      not just populated in a local test
- [ ] Run through the [DEPLOYMENT.md](DEPLOYMENT.md) pre-production
      checklist (TLS/SSO in front of the backend, `ALLOWED_ORIGINS` pinned,
      `POSTGRES_PASSWORD` changed, etc.) before calling this done
