# Security

ZSmart Ticket Copilot handles **customer PII** (names, numbers, account data
read from trouble tickets). It is designed to run **entirely on-prem** — no data
leaves your network — but that guarantee depends on deploying it correctly. This
document is the threat model and the hardening checklist.

> Audience: whoever deploys and operates the copilot. Read this **before**
> rolling it past a pilot. Deployment steps live in [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Security posture

- **Internal use only.** Not intended for, or hardened for, internet exposure.
- **Defense rests on the network + reverse proxy**, not on the app. The backend
  has no authentication of its own (see §4).
- **PII genuinely leaves the page**: ticket text is sent to the backend, then to
  the LLM, and is logged. The protections are *transport encryption*,
  *access control*, *redaction*, and *retention limits* — not avoidance.

## 2. Data flow & where PII lives

```
ZSmart page (PII)
  │  content.js reads ticket text (structured / selection / visible-text)
  ▼
side panel  ──HTTPS──►  reverse proxy (TLS + SSO)  ──►  backend /api/suggest
                                                          │  scrub() regex redaction
                                                          ├──►  LLM endpoint (prompt with ticket text)
                                                          └──►  Postgres audit (scrubbed text + embedding)
```

PII is **at rest** in: the Postgres `audit` table (when `STORE_TICKET_TEXT=1`)
and anywhere your **LLM endpoint** logs prompts. PII is **in transit** on every
hop above.

## 3. Trust boundaries

| Boundary | Trusted? | Notes |
|---|---|---|
| Agent browser ↔ extension | trusted | force-installed, signed by your `.pem` |
| Extension ↔ backend | **must be TLS** | carries raw ticket PII + auth cookies |
| Agent ↔ extension login | trusted (client-side gate) | side panel requires signing in against the Omni Helpdesk console (`tadiwa-backend`) before capture/ask work; the resulting email is then sent as `X-Remote-User` on every request (see [extension/sidepanel.js](extension/sidepanel.js)). This is a **UI gate, not app-layer verification** — the backend still doesn't cryptographically check that header (§4 threat #3 is unchanged) |
| Reverse proxy ↔ backend | trusted (localhost) | proxy sets `X-Remote-User` |
| Backend ↔ LLM endpoint | internal | PII in the prompt; check the endpoint's logging |
| Backend ↔ Postgres | internal | PII at rest; access-control the DB |

## 4. Threat model

### Highest priority — the backend, not the extension
The largest exposure is an **unauthenticated backend with open CORS**. The
extension is a thin client; the backend is where customer data concentrates.

| # | Vector | Impact | Mitigation |
|---|---|---|---|
| 1 | **Cleartext transport** — `BACKEND_URL`/`FEEDBACK_URL` are `http://` in [sidepanel.js](extension/sidepanel.js); `credentials: include` also sends auth cookies | Ticket PII + credentials sniffable on the LAN | **HTTPS everywhere**; terminate TLS at the proxy |
| 2 | **`ALLOWED_ORIGINS=*`** (default in [main.py](backend/main.py)) | Any internal page the agent visits can call the API; the unauthenticated **`/api/ingest`** lets an attacker poison the KB (inject misleading procedures) | Lock CORS to the pinned `chrome-extension://<id>`; put **all** endpoints behind the SSO proxy |
| 3 | **No app-layer auth** — `X-Remote-User` is a trusted header ([main.py](backend/main.py) `request_user`). The extension now signs the agent in first and sends their real email here, but that's still just a value the *client* sets — the backend never verifies it | Anyone who can reach the backend directly (bypassing the extension) is "authenticated" as whoever they claim in the header | Never expose port 8080; the proxy must set `X-Remote-User` and **strip any inbound copy** — do not treat the extension's login as a substitute for this |
| 3b | **`DOMAIN_API_KEY` unset** — the `X-Api-Key` checkpoint ([main.py](backend/main.py) `require_api_key`) is disabled by default | Every route (including `/api/ingest`) is reachable with no key at all; a startup log warns loudly when this is the case | Set `DOMAIN_API_KEY` in production; never rely on the default |
| 4 | **`.pem` signing key theft** | Attacker pushes a malicious *force-installed* update that exfiltrates every captured ticket | Store the `.pem` offline / access-controlled; treat as a code-signing key |
| 5 | **PII at rest** — `STORE_TICKET_TEXT=1` keeps scrubbed text + embeddings in `audit` | Standing pool of partially-redacted PII; embeddings are theoretically invertible | Restrict DB access; add a retention purge; set `STORE_TICKET_TEXT=0` if gap-mining isn't needed |
| 6 | **LLM endpoint logging** | If the internal LLM logs prompts, it retains a copy of (regex-scrubbed) PII | Confirm the endpoint does not retain prompts, or that its logs are access-controlled |

### Extension / capture surface
| # | Vector | Impact | Mitigation |
|---|---|---|---|
| 7 | **Over-broad `matches`/`host_permissions`** | If widened past the ZSmart host, the content script runs everywhere and can scrape any site | Keep `content_scripts.matches` + `host_permissions` to the exact ZSmart + backend hostnames ([manifest.json](extension/manifest.json)) |
| 8 | **Visible-text fallback** grabs up to 30k chars of `innerText` ([content.js](extension/content.js)) | Captures more PII than the ticket (other customers' data elsewhere on the page) | Map [selectors.json](extension/selectors.json) so structured/selection capture wins; treat visible-text as last resort |
| 9 | **Regex-only redaction** — `scrub()` catches emails/phones/long digits only | Names, addresses, non-standard account IDs reach the LLM and logs | Strengthen `scrub()` (NER / dictionaries); minimise what is captured |
| 10 | **Prompt injection via ticket content** | A customer writes "ignore instructions…" in a ticket; model emits junk advice | Low impact today (output only shown to the agent). **Re-assess before adding write-back or tool use.** |

## 5. What the code already does right — keep it this way

- **No XSS sink.** The side panel renders the model answer with `textContent`
  and the ticket via a textarea `value` — never `innerHTML`. Malicious ticket or
  KB text cannot execute script in the panel. Do not switch to `innerHTML`.
- **No web-page access to the extension.** No `externally_connectable`; the
  content script only answers extension messages — a hostile page cannot drive
  captures or use the extension's privileges.
- **Minimal permissions.** `sidePanel, contextMenus, activeTab, scripting,
  storage`. `storage` is **not** used to persist ticket text (capture is
  in-memory only). Do not start caching ticket text in `chrome.storage`.
- **PII redaction on by default.** `SCRUB_PII=1`.

## 6. Hardening checklist (do before production)

- [ ] `BACKEND_URL` / `FEEDBACK_URL` and the backend are **HTTPS**
- [ ] `DOMAIN_API_KEY` set to a real secret (never left unset — check the
      startup log for the "checkpoint is disabled" warning); the extension
      sends it as `X-Api-Key` on every request
- [ ] `ALLOWED_ORIGINS` = the pinned `chrome-extension://<id>` (never `*`)
- [ ] Backend reachable **only** via the TLS + SSO proxy; port 8080 not exposed
- [ ] Proxy sets `X-Remote-User` and strips any client-supplied copy
- [ ] Extension `matches` / `host_permissions` scoped to ZSmart + backend hosts
- [ ] `selectors.json` mapped so visible-text fallback is rarely used
- [ ] `.pem` signing key backed up offline and access-controlled
- [ ] LLM endpoint confirmed not to retain prompts (or logs locked down)
- [ ] `STORE_TICKET_TEXT` reviewed against data policy; retention purge scheduled
- [ ] `SCRUB_PII=1`; redaction strengthened if names/addresses are common
- [ ] Postgres access-controlled; `pgdata` on backed-up, encrypted storage

## 7. Key & secret management

- **`.pem`** signs every extension update and defines the extension id — its
  theft is the highest-impact compromise. Store offline, restrict access, never
  commit it.
- **`POSTGRES_PASSWORD`**, `LLM_API_KEY` — keep in `deploy/.env` (git-ignored),
  not in the image or source.
- **`DOMAIN_API_KEY`** — the shared secret the extension sends as `X-Api-Key`
  on every backend call ([main.py](backend/main.py) `require_api_key`). Same
  handling as the two above: `.env`/secrets manager, never hardcoded or
  committed. Rotate by updating it on the backend and in whatever config the
  extension reads it from **together** — a mismatch locks the extension out
  until both sides agree again.

## 8. Reporting

Report suspected vulnerabilities or data-handling issues to your internal
security team / the system owner — do not file them in any public tracker, as
this is an internal tool handling customer PII.
