# Tadiwa — Omni Helpdesk Assistant
## Requirements Gathering Specification (Draft v0.1)

> Status: **DRAFT — living document.** Sections marked `[TBD]` need input. Add/edit freely; this is meant to grow as the project is scoped out.

---

## 1. Document Purpose

This document captures the requirements for **Tadiwa**, an AI-assisted helpdesk/technician workspace built for Omni Contact (a contact center handling Econet Wireless Zimbabwe support). It is derived from:

- The existing codebase (React + Vite prototype, currently generated/scaffolded via Google AI Studio)
- Inferred intent from UI copy, mock data, and the hardcoded SOP knowledge base

It is **not yet validated with stakeholders** — treat the "As currently built" sections as observations to confirm, and the `[TBD]` sections as the actual gathering work still to do.

---

## 2. Background & Context

- **Client/Org:** Omni Contact — a back-office/technical support team supporting **Econet Wireless Zimbabwe** customers.
- **Product name:** "Tadiwa" (also "Omni Helpdesk Assistant" / "Omni HD Assistant").
- **What it appears to be today:** A single-page internal dashboard ("Tech Hub") for support technicians, combined with an embedded AI chat assistant (Tadiwa) that answers SOP/troubleshooting questions using Google's Gemini API.
- **Current build:** Prototype originating from Google AI Studio (`metadata.json`, `README.md` reference AI Studio / Cloud Run deployment). Frontend-only — React 19 + Vite 6 + TypeScript + Tailwind v4. No backend/database observed; all ticket, chat, schedule, and productivity data is **hardcoded/mock** in-component state.

---

## 3. Goals & Objectives — as inferred `[TO CONFIRM]`

1. Give Econet/Omni Contact technical support agents a **single workspace** for: SOP reference, shift schedule, team communication, and productivity tracking.
2. Reduce average handling time and improve SOP compliance by providing an **AI assistant (Tadiwa)** that answers procedural questions (SIM replacement, line reconnection, hanging orders, roaming/USSD issues, bundle/service management, balance adjustments, suspensions) instantly, instead of agents searching manuals.
3. Give team leads visibility into **technician productivity** and **SLA performance**.
4. Support **voice interaction** with the assistant (per `metadata.json` → `majorCapabilities: ["AI Chat", "Voice Interaction"]`, and microphone permission request) — not yet implemented in code.

`[TBD]` — Confirm which of these is the *primary* driver (compliance/SOP adherence? speed/AHT reduction? team management/reporting? training tool for new agents?) since it changes prioritization.

---

## 4. Stakeholders `[TBD]`

| Role | Name/Team | Interest |
|---|---|---|
| Product owner / sponsor | ? | |
| End users (primary) | Omni Contact back-office technicians (SIM, provisioning, billing) | Daily use of dashboard + AI assistant |
| End users (secondary) | Team leads/supervisors | Productivity & SLA visibility, shift management |
| Knowledge owner | ? (who maintains SOP accuracy for Econet systems) | Source of truth for the knowledge base |
| Client/vendor relationship | Omni Contact ↔ Econet Wireless Zimbabwe | Contractual/compliance context — does Econet need to approve or audit this tool? |
| IT/Security | ? | Data handling, access control, hosting |

---

## 5. Current State — What Exists in the Repo Today (As-Is)

### 5.1 Application shell
- Single React app (`src/App.tsx`) rendering a `Dashboard` with a floating `AIAssistant` chat widget overlaid.
- Styled as a dark, glassmorphism-style dashboard (Tailwind CSS v4).

### 5.2 Dashboard (`src/components/Dashboard.tsx`)
Sidebar navigation with 4 real tabs + 2 stubs:
- **Tech Hub (Overview)** — stat cards (Active Techs, Avg Productivity, Next Week Target, Queue Health — all hardcoded), a grid of 4 "Core Resolutions & SOPs" cards (SIM Replacement, Line Reconnection, Hanging Orders, Roaming/USSD), 3 "Quick Action" reference cards (Services, Balance, Blocks/Suspension), and a "Team Comms" mini chat panel (local-only, in-memory, resets on refresh).
- **Schedule** — static personal shift timeline + a static "Shift Peers" presence list (hardcoded names/status).
- **Productivity** — static weekly leaderboard table (technician, tickets, SLA%, trend) + a projected-target summary card.
- **History** — static list of 3 sample interaction log entries.
- **Settings** — two toggle switches (Natural Voice, Auto-Listen After Greeting) that are **visual only** (not wired to state/persistence) + a "Save Workspace Preferences" button with no handler.
- **Help Center** — placeholder screen.

**None of this data is persisted or backed by an API.** Refreshing the page resets everything to the hardcoded defaults.

### 5.3 AI Assistant (`src/components/AIAssistant.tsx`)
- Floating chat widget (open/close/minimize).
- Calls Google Gemini directly from the **browser** via `@google/genai`, model `gemini-3-flash-preview`, using `process.env.GEMINI_API_KEY`.
- System prompt embeds a **hardcoded SOP knowledge base** (SIM replacement, line reconnection, hanging orders, roaming/USSD, adding GPRS/telephony, balance adjustments, suspensions).
- No conversation persistence, no logging, no escalation workflow, no voice I/O despite the mic permission declared in `metadata.json`.
- There is a **second**, more detailed knowledge base + system prompt in `src/constants/tadiwaContext.ts` (`TADIWA_CONTEXT`, `TADIWA_SYSTEM_PROMPT`) that is **not currently imported/used** by `AIAssistant.tsx` — the assistant uses its own inline, shorter `SYSTEM_INSTRUCTION` instead. This looks like an inconsistency/leftover to reconcile.

### 5.4 Known gaps / risks in the current build
- **Security:** Gemini API key is used client-side (`process.env.GEMINI_API_KEY` bundled into the browser app) — fine for an AI Studio sandbox, **not safe for a real production deployment** (key would be exposed to anyone who opens dev tools). Needs a backend proxy if this goes to production.
- **No backend/data layer** — no ticketing system integration, no database, no auth, no multi-user sync (team chat, schedule, and productivity are per-browser-session mock data).
- **No authentication/authorization** — anyone who loads the app is "Omni Agent."
- Two divergent knowledge bases/system prompts exist in the code.
- No tests, no CI, no error monitoring.

---

## 6. Proposed Scope Areas for Requirements Gathering

Below are the functional areas to gather detailed requirements for. Each has starter questions — please fill in answers/notes inline or let me know and I'll update this doc.

### 6.1 AI Assistant (Tadiwa)
- `[TBD]` What is the authoritative knowledge base source of truth — a document, a wiki, Econet's SOP manual, or should it be a CMS the ops team can edit without a code deploy?
- `[TBD]` Should Tadiwa be restricted to Econet SOPs only, or also handle general IT helpdesk topics (password resets, hardware, etc.)?
- `[TBD]` Does it need to distinguish between different query types (customer-facing bundle/pricing info vs. internal technical/system procedures)?
- `[TBD]` Escalation behavior: what should happen when Tadiwa doesn't know an answer — current prompt says "escalate to senior supervisor," should this trigger an actual in-app escalation/ticket?
- `[TBD]` Voice interaction — is this required for v1? (mic permission is declared but unused). Input only (speech-to-text query) or full voice conversation (TTS replies too)?
- `[TBD]` Should chat history persist per agent (for QA/audit and continuity across sessions)?
- `[TBD]` Any requirement to log AI conversations for compliance/quality review by team leads?
- `[TBD]` Rate limits / cost controls on Gemini API usage?
- `[TBD]` Language requirements — English only, or Shona/Ndebele support given the Zimbabwe context?

### 6.2 Ticketing / Case Management
- Currently there is **no real ticketing integration** — "History," "Quick Actions," and resolution steps reference ticket IDs but nothing creates/reads/updates actual tickets.
- `[TBD]` Does Omni Contact already use an external ticketing system (Zendesk, Freshdesk, in-house Econet back-office tool)? Should Tadiwa integrate with it (read ticket context, auto-log resolutions), or is this dashboard meant to stand alone?
- `[TBD]` What ticket data fields matter (customer ID/MSISDN, issue type, priority, SLA clock, resolution notes)?

### 6.3 Team Communication ("Team Comms")
- `[TBD]` Is a built-in team chat actually required, or does the org already use Slack/Teams/WhatsApp for this? (Building real-time chat is a significant scope item — needs backend, websockets, presence, persistence.)
- `[TBD]` If required: who can post (all agents? leads only for broadcasts?), is there a channel/thread structure, retention requirements?

### 6.4 Scheduling
- `[TBD]` Is shift scheduling meant to be authored elsewhere (HR/WFM tool) and just displayed here, or should agents/leads manage schedules within this app?
- `[TBD]` Timezone handling, shift swap requests, break/lunch tracking — needed?

### 6.5 Productivity & SLA Reporting
- `[TBD]` Source of truth for tickets-resolved and SLA% — manual entry, or pulled from the real ticketing/telephony system?
- `[TBD]` Who should see whose productivity data (self only, team lead sees team, org-wide leaderboard)?
- `[TBD]` What SLA definitions/targets apply (per Econet contract)?

### 6.6 Users, Roles & Access
- `[TBD]` User roles needed (Agent / Team Lead / Admin / Read-only Auditor)?
- `[TBD]` Authentication method — SSO (Econet/Omni corporate identity), email/password, or none for internal-network-only use?
- `[TBD]` Multi-tenant consideration — is this Omni Contact-only, or could it serve other Econet lines of business / other clients later?

### 6.7 Data, Integration & Hosting
- `[TBD]` Where will this be hosted long-term? (Currently structured for Google AI Studio/Cloud Run — is that the intended production home, or does it need to move to Omni/Econet infrastructure?)
- `[TBD]` Any data residency/compliance requirements (customer data, PII) given this touches Econet customer SIM/account operations?
- `[TBD]` Integration needs with Econet's Back-Office Portal / Individual Portal / HLR systems referenced in the SOPs — is that automation in scope, or does Tadiwa remain purely advisory (tells the agent what to click, doesn't do it)?

### 6.8 Non-Functional Requirements `[TBD]`
- Expected concurrent users / scale.
- Availability requirements (is this used during live customer calls — does downtime block support operations?).
- Performance expectations for AI response latency.
- Browser/device support (desktop only? agents on specific hardware?).
- Accessibility requirements.
- Audit/logging requirements for compliance.

---

## 7. Assumptions (to validate)
- This is an **internal tool** for Omni Contact technicians, not customer-facing.
- Current hardcoded names (Tinashe, Blessing K., Sharon Z., etc.) and metrics are **sample/demo data only**, not real personnel.
- The project is early-stage/prototype and open to significant re-architecture (e.g., adding a real backend) before production use.

## 8. Out of Scope (unless added later)
- Direct write-access automation into Econet's actual back-office/provisioning systems (Tadiwa currently only *describes* steps, doesn't execute them).
- Customer-facing self-service (this is agent-facing only, based on current UI).

## 9. Success Metrics `[TBD]`
- e.g., reduction in Average Handling Time, SOP adherence rate, agent satisfaction/adoption rate, reduction in escalations — needs definition.

## 10. Open Items / Next Steps
1. Validate Section 3 (Goals) and Section 5 (As-Is) with product owner.
2. Fill in `[TBD]` items across Section 6, prioritized by what's needed for the next milestone.
3. Decide on the knowledge-base inconsistency (`tadiwaContext.ts` vs. inline prompt in `AIAssistant.tsx`) — which one is canonical going forward.
4. Decide production architecture (backend for API key security, data persistence, auth) before any real deployment.

---
*Generated from a review of the current codebase on 2026-08-17. Add your notes under the `[TBD]` markers or new sections as needed.*
