# Roadmap — ZSmart Ticket Copilot

Prioritized backlog of improvements not yet built. Effort is a rough size
(S = hours, M = a day or two, L = several days). Pick from the top.

## Shipped
- Markdown knowledge base, hierarchy-aware chunking, one procedure = one row,
  idempotent re-ingest ([backend/ingest.py](backend/ingest.py))
- **LLM routing** (`ANSWER_MODE=route`): semantic shortlist → LLM reads the full
  ticket (comments included) and picks the procedure → steps returned
  **verbatim** ([backend/main.py](backend/main.py)). Fixes noisy-ticket
  misclassification without touching the docs.
- **Honest failure path**: LLM unavailable → similarity-gated fallback marked
  `fallback:true`, rendered ⚠️ "unverified" (never a confident ✅); no confident
  answer for uncovered tickets.
- **Live stage trace**: `/api/suggest/stream` (SSE) drives the "How it worked"
  log (candidates + scores, LLM choice + reason); `/api/suggest` returns the
  same as `trace`; stages logged to stdout.
- **Clickable candidates**: agents can open any shortlisted procedure instantly
  (`GET /api/procedure`); picking a different one than the router logs an
  override — the strongest routing-quality signal.
- Routing outcome (`matched_section`, `choice`, `override_section`) recorded in
  `audit`; gap mining keys on it ([dev/gap_report.py](dev/gap_report.py)).
- Retrieval + end-to-end eval harness ([dev/eval/](dev/eval/)); `--route` is the
  gating metric (exercises the real path incl. the LLM), retrieval recall is a
  supporting metric. `RAG_MIN_SIM` tuned to 0.68 for nomic-embed-text.
- Unit tests for the pure functions ([backend/tests/](backend/tests/)).
- nomic-embed-text task prefixes; simple exact vector retrieval (a keyword+RRF
  hybrid arm was tried and removed — it never rescued a case and boosted
  distractors; see the note in `retrieve_similar`).
- Containerized stack (db + backend + Ollama embeddings); fresh-DB startup fix;
  configurable `LLM_TIMEOUT`; startup warning when `ALLOWED_ORIGINS=*`.

## ⚠️ Top production blocker — LLM throughput
The internal Mistral-7B server measured **~2 tokens/sec** (CPU llama.cpp) and
serializes requests. Routing needs only a tiny output ("N - reason") but a large
prompt prefill, so selection still takes minutes and can time out (the ⚠️
fallback covers this honestly, and clickable candidates keep agents productive,
but the reasoned pick is the product). Owner is addressing on the LLM side:
GPU offload / faster serving / smaller model. Until then `ANSWER_MODE=verbatim`
is the instant, LLM-free mode.

## Routing & retrieval quality
- **Grow the golden set** (S, ongoing) — add `ticket → expected procedure` cases
  (incl. `route_only` noisy ones) as real tickets arrive; run `run_eval.py --route`
  before shipping changes.
- **Keyword arm, reintroduced deliberately** (S) — only if eval ever shows an
  exact-token miss (error codes, `OBSSM`) that semantic search fails; add as a
  separate recall arm, never as a fused ranking.
- **Query cleanup before embedding** (S–M) — strip signatures/UI labels from the
  visible-text capture fallback; improves shortlist quality on messy captures.

## Answer trust & safety
- **Stronger PII redaction** (M) — `scrub()` is regex-only (emails / phones /
  long digit runs); it misses names, addresses, and other account-ID formats.
- **Audit retention / purge job** (S) — `STORE_TICKET_TEXT=1` retains scrubbed
  ticket text + embeddings for gap mining; schedule a purge past N days.
- **Security hardening** (M) — lock `ALLOWED_ORIGINS` to the pinned extension id
  (warned at startup); `X-Remote-User` must be set by the auth proxy; add rate
  limiting; auth on `/api/ingest`.

## UX / workflow
- **Auto-suggest on ticket open** (M) — detect a ticket in the active tab and
  pre-fetch the shortlist instead of requiring Capture → Ask.
- **Write-back to ZSmart** (L) — post the accepted resolution into the ZSmart
  deal/process record (needs ZSmart-side integration or UI automation).
  Re-assess prompt-injection risk before adding any write action.
- **Multi-turn follow-up** (M) — "that didn't work, what next?" grounded in the
  same procedure; currently one-shot.

## Engineering / ops
- **Embedding cache** (S–M) — identical tickets are re-embedded every call.
- **Observability** (M) — a small dashboard over `audit`: latency, match rate,
  override rate, 👎 rate, top procedures.
- **CI** (S) — run `pytest backend/tests` + `run_eval.py` (against a compose
  stack) on changes.

## Knowledge base growth
- **Multi-document KB** (S) — `kb_chunks.source` already supports it; just
  `ingest.py` more `.md` files.
- **Metadata filtering** (M) — if procedures need filtering by fault type /
  region, add columns to `kb_chunks`.
- **Multi-language** (M) — verify the embedding model + LLM handle local-language
  tickets; consider a translation step.
- **KB governance / versioning** (M) — review workflow before guide edits go live.
