# ZSmart Ticket Copilot — starter kit

Reads the open ZSmart v9 ticket in the browser, sends the text to an
**on-prem** backend + local LLM, and shows suggested resolution steps in a
Chrome/Edge side panel. No data leaves your network.

```
[Chrome/Edge side panel] -> [FastAPI backend] -> [local LLM chat + embeddings]
        ^ force-installed via GPO/Intune   \-> [PostgreSQL: audit log + pgvector KB]
```

The knowledge base is your **BSS resolution guide** (a Markdown file), ingested
as **one row per procedure**. Answering a ticket has three stages
(`ANSWER_MODE=route`, the default):

1. **Recall** — semantic search (pgvector cosine, exact scan) shortlists the
   most similar procedures for the whole captured ticket.
2. **Decide** — the local LLM **reads the whole ticket (comments included) and
   picks the one procedure** that fits, or says none do. This handles
   noisy/negated tickets ("no outstanding suspension or block") that pure
   similarity gets wrong, and needs **no changes to the guide**.
3. **Answer** — the chosen procedure's steps are returned **verbatim** from the
   guide (the model never rewrites them, so nothing is hallucinated).

Every request emits a live **stage trace** (candidates + scores, the LLM's
choice + reason) to the side panel and the backend log. The candidate list in
the panel is **clickable** — an agent can open any shortlisted procedure
immediately (no LLM wait), and picking a different one than the router chose is
logged as an override. If the LLM is unavailable, the answer degrades to a
similarity-gated closest match clearly marked **⚠️ unverified** — never a
confident wrong answer. Answer modes: `route` (default) or `verbatim` (gated
top match, no LLM, instant).

> **LLM speed matters:** routing puts the LLM in the loop, so answer latency is
> dominated by your LLM endpoint. On a slow CPU model the selection can take
> minutes (agents can still click a candidate meanwhile); use a GPU / faster
> model for interactive use.

Two operational tools close the loop: an **eval harness** ([dev/eval/](dev/eval/))
— `run_eval.py --route` is the **gating** end-to-end metric (real path, incl.
the LLM and the noisy golden cases); plain `run_eval.py` measures retrieval
recall only — and a **gap report** ([dev/gap_report.py](dev/gap_report.py)) that
mines unmatched / 👎 / overridden tickets into procedures still missing from
the guide. See [IMPROVEMENTS.md](IMPROVEMENTS.md) for the roadmap.

## 1. Database (PostgreSQL + pgvector)

```bash
cd deploy && docker compose up -d        # pgvector/pgvector:pg16
```
Or use an existing PostgreSQL 14+ server: `CREATE EXTENSION vector;` needs to
be allowed for the copilot database (the backend runs it on startup). Tables
and the HNSW index are created automatically.

## 2. Backend

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgres://copilot:change-me@localhost:5432/copilot
export LLM_BASE_URL=http://your-llm-host:11434/v1   # Ollama example
export LLM_MODEL=llama3.1:8b
export EMBED_MODEL=nomic-embed-text                 # ollama pull nomic-embed-text
export EMBED_DIM=768                                # must match the embed model
uvicorn main:app --host 0.0.0.0 --port 8080
```

Check `http://host:8080/healthz` (also reports KB size). Put it behind
IIS/nginx with TLS and Windows Integrated Auth for production; the
authenticated username should be forwarded in the `X-Remote-User` header.

## 3. Load the knowledge base (RAG)

The knowledge base is a Markdown guide. Author it with **one heading region per
procedure** — `#` for a category, `##` for a procedure, `###` for variants:

```markdown
# BSS
## SIM Card Replacement
1. Switch to back-office portal …
## Balance Adjustment, Adding a New Account / D.A. and Bundle Conversion
### Steps for balance adjustment
1. …
### Steps for adding a new account / new DA
1. …
```

Then ingest it:

```bash
python ingest.py BSS_steps.md            # --source LABEL to override the label
```

Chunking is **hierarchy-aware**: each chunk is the lowest heading region in a
branch (a `###` variant where present, else the `##` procedure), the heading
path is carried into the chunk, parent preamble is inherited by children, and
empty / placeholder sections are skipped. Re-running on the same source replaces
its rows, so editing the guide and re-ingesting is idempotent.

Single chunks can also be added live via `POST /api/ingest`
(`{source, section, content}`). With an empty KB everything still works —
answers just say no procedure matched and give generic guidance.

> **Migrating from an older build?** Recreate the knowledge table once —
> `DROP TABLE IF EXISTS kb_tickets, kb_chunks;` — restart the backend and
> re-run `ingest.py` (the schema simplified: no tsvector/indexes; the `audit`
> table auto-migrates its new columns on startup).

### Measure retrieval quality

```bash
# backend running + KB ingested
python dev/eval/run_eval.py          # recall@K, MRR, no-match accuracy
```

Edit [dev/eval/golden.jsonl](dev/eval/golden.jsonl) to add `ticket → expected
section` cases as your guide grows; run this after any change to chunking,
models, or `RAG_*` settings.

### Find missing procedures

```bash
python dev/gap_report.py --days 30   # clusters of unanswered / 👎 tickets
```

Each cluster is a candidate procedure to add to the guide. Requires
`STORE_TICKET_TEXT=1` (default).

## 4. Configure the extension

Edit these placeholders before loading:

| File              | Replace                                                  |
|-------------------|----------------------------------------------------------|
| `manifest.json`   | `zsmart.yourcompany.local` -> your real ZSmart hostname (both `host_permissions` and `content_scripts.matches`); backend hostname too |
| `sidepanel.js`    | `BACKEND_URL` / `FEEDBACK_URL` -> your backend address    |
| `selectors.json`  | CSS selectors for your ZSmart instance (see below)        |

Add three PNG icons in `extension/icons/` (16/48/128 px) — any square logo.

## 5. Map the selectors (15 minutes, once)

ZSmart v9 deployments differ, so field selectors ship as guesses. To map yours:

1. Open a ticket in ZSmart, press F12.
2. Click the element-picker (top-left of DevTools), click the ticket ID field.
3. Right-click the highlighted node -> Copy -> Copy selector.
4. Paste it as the **first** entry of that field's array in `selectors.json`.
5. Repeat for title, description, status, etc. ZSmart renders modules in
   iframes — that's fine, the content script runs in every frame.

Until selectors are mapped, the extension still works via the two fallbacks:
**highlight text on the page** (best) or **capture all visible text**.

## 6. Test locally (developer mode)

chrome://extensions -> enable Developer mode -> "Load unpacked" -> select the
`extension/` folder. Open ZSmart, open a ticket, click the toolbar icon.

## 7. Enterprise deployment (force-install)

### Pack and host (fully internal route)
1. chrome://extensions -> "Pack extension" -> produces `zsmart-copilot.crx`
   and a `.pem` key. **Guard the .pem** — it signs all future updates.
2. Note the extension ID (visible after loading the crx once).
3. Host the `.crx` and `deploy/update_manifest.xml` (with ID + URL filled in)
   on an internal HTTPS server.
4. On every release: bump `version` in manifest.json AND update_manifest.xml,
   repack with the same .pem, replace the .crx. Browsers update within hours.

### Push via GPO (Chrome)
1. Import Google's Chrome ADMX templates into your domain's Central Store.
2. Computer Config -> Policies -> Admin Templates -> Google Chrome ->
   Extensions -> **Configure the list of force-installed apps and extensions**.
3. Add: `EXTENSION_ID;https://tools.yourcompany.local/copilot/update_manifest.xml`
4. Scope the GPO to the help desk OU / security group. `gpupdate /force` to test.

### Push via Intune (Chrome or Edge)
Devices -> Configuration profiles -> Settings Catalog -> search
"ExtensionInstallForcelist" (Chrome or Edge category) -> same
`id;update_url` string -> assign to the Entra ID group.

For Edge you can alternatively publish privately to Edge Add-ons and force
install by store ID — no self-hosting needed.

### Recommended hardening
- Keep `host_permissions` limited to the ZSmart + backend hostnames (already done).
- Set `ALLOWED_ORIGINS` on the backend to the real `chrome-extension://<id>` origin.
- TLS on the backend; SQLite audit DB on an access-controlled share or move to MSSQL.
- `SCRUB_PII=1` (default) redacts emails/phones/long account numbers before
  the text reaches the model and logs.

## 8. Next steps worth building

- **Keep the guide fresh**: re-run `ingest.py BSS_steps.md` whenever the guide
  is edited (idempotent per source), e.g. on a content-repo commit hook.
- **Mine knowledge gaps weekly**: run [dev/gap_report.py](dev/gap_report.py) to
  turn unanswered / 👎 tickets into a list of procedures to write, then add them
  to `BSS_steps.md` and re-ingest.
- **Track retrieval quality**: keep [dev/eval/golden.jsonl](dev/eval/golden.jsonl)
  growing and run [dev/eval/run_eval.py](dev/eval/run_eval.py) before shipping
  changes.
- See [IMPROVEMENTS.md](IMPROVEMENTS.md) for the full roadmap (re-ranking,
  streaming, write-back to ZSmart, tests, security hardening, …).
