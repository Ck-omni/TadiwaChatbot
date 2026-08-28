# Deployment runbook

Tailored to: **an existing internal LLM endpoint**, **containerized DB + backend**,
and **force-installing into Chrome that is not centrally managed**.

You run only one thing on-prem yourself: the **FastAPI backend**. It shares
its **PostgreSQL (pgvector)** database with the Omni Helpdesk console
(tadiwa-backend) rather than running its own — point it at that same
`tadiwa` database. The LLM/embeddings already exist — you just point the
backend at them.

```
[Agent Chrome + extension] --HTTPS--> [nginx/IIS: TLS + SSO] --> [backend] --> [your LLM endpoint]
                                                                      |
                                                        [tadiwa Postgres+pgvector]
                                                        (shared with tadiwa-backend)
```

---

## 1. Bring up the backend (Docker Compose)

On the server (Docker / Docker Desktop, or a small Linux VM / WSL2):

```bash
cd deploy
cp .env.example .env          # then edit .env (see below)
docker compose up -d --build
```

Edit `.env`:
- `DATABASE_URL` — point at the SAME Postgres instance/`tadiwa` database
  tadiwa-backend's own `DATABASE_URL` uses. This backend only ever adds rows
  to tables tadiwa-backend already owns (`audit`, `knowledge_base_entries`)
  plus two of its own (`copilot_sessions`, `chat_turns`) — see `main.py`'s
  module docstring.
- `LLM_BASE_URL`, `LLM_MODEL` — your existing endpoint. If it's an in-house
  streaming wrapper (not standard OpenAI `/chat/completions`), set
  `LLM_CHAT_STYLE=custom_stream` (and `LLM_CHAT_URL` if the path differs).
- `EMBED_BASE_URL`, `EMBED_MODEL`, **`EMBED_DIM`** — the embedding dimension
  **must** match both the model (nomic-embed-text = 768) and whatever
  dimension tadiwa's `knowledge_base_entries`/`audit` vector columns are
  already set to — they must agree, since this is a shared table.
- `ALLOWED_ORIGINS` — set after you know the extension id (step 4).

## 2. Load the knowledge base & verify

```bash
docker compose run --rm backend python ingest.py BSS_steps.md
#   → 14 chunks ingested, 1 sections skipped

curl -s http://localhost:8080/healthz            # {"kb_chunks": 14, ...}
docker compose run --rm backend python dev/eval/run_eval.py   # recall@K / MRR
```

Re-ingest any time the guide changes (idempotent per source):
```bash
docker compose run --rm backend python ingest.py BSS_steps.md
```

## 3. Front the backend with TLS + SSO  (the security boundary)

**The backend has no auth of its own** — it trusts the `X-Remote-User` header to
identify the agent. That is only safe behind a reverse proxy that (a) terminates
TLS and (b) sets `X-Remote-User` itself while **stripping any client-supplied
copy**. Never expose port 8080 directly to agents.

- **Windows / Active Directory shop → IIS** is the natural fit: enable
  **Windows Authentication** on the site, use **Application Request Routing
  (ARR)** to reverse-proxy to `http://127.0.0.1:8080`, and add an outbound rule
  that sets `X-Remote-User` from the authenticated `LOGON_USER`. TLS via your
  internal CA cert.
- **Linux → nginx** with Kerberos/SSO (`spnego`/`auth_request`) doing the same:
  `proxy_set_header X-Remote-User $remote_user;` and TLS.

Either way, set `ALLOWED_ORIGINS` in `.env` to your pinned extension origin
(step 4) and restart the backend.

## 4. Force-install into unmanaged Chrome — the secure way

"Chrome isn't managed, we just download" — you do **not** need Google Workspace
or full MDM. Chrome honors enterprise policy from the **Windows registry**, and
*force-install* is the secure mechanism: users (and malware) can't disable or
remove the extension, and it only ever updates from **your** signed source.

### a. Pack and pin the extension id
1. `chrome://extensions` → **Pack extension** → select `extension/` → produces
   `zsmart-copilot.crx` + a `.pem` key. **Guard the `.pem`** — it signs every
   future update and *defines the extension id*.
2. Load the `.crx` once to read its **extension id** (a 32-char string).
3. **Pin the id everywhere** by copying the public key into
   [extension/manifest.json](extension/manifest.json) as a top-level
   `"key": "<base64 public key>"`. Now the id is identical across rebuilds and
   dev loads — which is what lets you lock `ALLOWED_ORIGINS` to it.
4. Put that id into `ALLOWED_ORIGINS=chrome-extension://<id>` in `.env`.

### b. Host the CRX + update manifest
Host `zsmart-copilot.crx` and `deploy/update_manifest.xml` (fill in the id and
the CRX URL) on an internal **HTTPS** server.

### c. Apply the Chrome policy (registry)
Set these under `HKLM\SOFTWARE\Policies\Google\Chrome` on each agent PC:

```
ExtensionInstallForcelist\1 = "<id>;https://tools.you.local/copilot/update_manifest.xml"
ExtensionInstallAllowlist\1 = "<id>"
BlockExternalExtensions     = 1     # block sideloaded extensions
```

`ExtensionInstallForcelist` force-installs and locks it on; the allowlist +
`BlockExternalExtensions` stop anything else being added. This is the most
secure posture available without the Web Store.

### d. Push the registry keys (pick what you already have)
Even with "unmanaged" Chrome, you almost certainly have *one* of these to apply
a `.reg`/registry setting fleet-wide:
- **Intune / Entra** (if devices are Entra-joined even though Chrome isn't) —
  a Settings Catalog or registry policy.
- **Active Directory** — a GPO **startup script** or Group Policy Preferences
  registry item (no ADMX Central Store needed for raw registry).
- **RMM / PDQ Deploy / SCCM** — push the `.reg`.
- **Last resort** — apply a signed `.reg` during machine imaging.

> Alternative if you adopt Google Workspace later: publish the extension
> **Private** to the Chrome Web Store and force-install by store id — no
> self-hosting, store-signed. Not needed for the registry path above.

## 5. Ongoing operations

- **Guide updates** → edit `BSS_steps.md`, re-run the ingest command (step 2).
- **Find missing procedures** weekly:
  `docker compose run --rm backend python dev/gap_report.py --days 7`
- **Before any change** to chunking / models / `RAG_*`: run `run_eval.py` and
  watch recall@K.
- **Extension updates** → bump `version` in `manifest.json` *and*
  `update_manifest.xml`, repack with the **same `.pem`**, replace the CRX;
  browsers update within hours.
- **Data retention** → `STORE_TICKET_TEXT=1` keeps scrubbed ticket text +
  embeddings for gap-mining; add a periodic purge if your policy requires it.

## Pre-production checklist
- [ ] `ALLOWED_ORIGINS` locked to the pinned `chrome-extension://<id>` (not `*`)
- [ ] Backend reachable only via the TLS+SSO proxy; port 8080 not exposed
- [ ] Proxy sets `X-Remote-User` and strips any inbound copy
- [ ] `.pem` backed up and access-controlled
- [ ] `EMBED_DIM` matches both the embedding model and tadiwa's vector columns
- [ ] `DATABASE_URL` points at tadiwa's real Postgres (backup policy is
      whatever's already in place for that database — nothing new to manage)
- [ ] `run_eval.py` passes against the live KB
