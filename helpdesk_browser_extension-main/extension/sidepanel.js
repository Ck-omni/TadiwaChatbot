// ZSmart Ticket Copilot — side panel logic

// Tell background.js this panel is open, and let it know when it closes.
// chrome.sidePanel has no isOpen()/close() — a port's onDisconnect firing is
// the standard trick for detecting a real close (not just switching panels).
chrome.runtime.connect({ name: "zsmart-copilot-panel" });

// The floating action button (fab.js) toggles the panel by asking us to
// close ourselves — there is no chrome.sidePanel.close().
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "CLOSE_COPILOT_PANEL") window.close();
});

// Local testing: point at the backend on localhost. Set these to your real
// backend hostname (https) for deployment — see README §4.
const BACKEND_URL = "http://localhost:8080/api/suggest";
const STREAM_URL = "http://localhost:8080/api/suggest/stream";
const FEEDBACK_URL = "http://localhost:8080/api/feedback";
const PROCEDURE_URL = "http://localhost:8080/api/procedure";

// Same account system as the Omni Helpdesk web console (tadiwa-backend) —
// signing in here uses the same email/password as that app. Local testing
// default; point at your real backend hostname (https) for deployment.
const AUTH_LOGIN_URL = "http://localhost:3004/api/auth/login";
const AUTH_ME_URL = "http://localhost:3004/api/auth/me";
const AUTH_REFRESH_URL = "http://localhost:3004/api/auth/refresh";
const AUTH_LOGOUT_URL = "http://localhost:3004/api/auth/logout";
const AUTH_STORAGE_KEY = "copilotAuth";

const el = (id) => document.getElementById(id);
let lastCapture = null;
let lastRequestId = null;
let lastMatchedSection = null;
let userPick = null; // section the agent clicked in the candidate list, if any
let currentSession = null; // { accessToken, refreshToken, email, fullName } once signed in

// ---- Auth (Omni Helpdesk console account) ----------------------------------
// Gates the whole panel behind a login so every suggestion is attributable
// to a real person, and forwards that identity to the copilot backend as
// X-Remote-User — the same header it already trusts when a reverse proxy
// sets it (see backend/main.py's request_user()). Only the token/email are
// ever stored — never ticket text, per SECURITY.md §5.

function readAuthStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => resolve(result[AUTH_STORAGE_KEY] || null));
  });
}

function writeAuthStorage(session) {
  return new Promise((resolve) => {
    if (session) chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session }, resolve);
    else chrome.storage.local.remove([AUTH_STORAGE_KEY], resolve);
  });
}

async function authApiPost(url, body, accessToken) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.success) throw new Error((data && data.message) || `Request failed (${res.status})`);
  return data.data;
}

async function authApiGet(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.success) throw new Error((data && data.message) || `Request failed (${res.status})`);
  return data.data;
}

// Header carried on every copilot-backend request once signed in; throws if
// somehow called pre-auth so a request can never silently go out unattributed.
function identityHeaders() {
  if (!currentSession) throw new Error("Please sign in first.");
  return { "X-Remote-User": currentSession.email };
}

function showLoginView() {
  el("loginView").hidden = false;
  el("appView").hidden = true;
  el("userChip").hidden = true;
  el("logoutBtn").hidden = true;
}

function showAppView(session) {
  el("loginView").hidden = true;
  el("appView").hidden = false;
  const chip = el("userChip");
  chip.hidden = false;
  chip.textContent = session.fullName || session.email;
  chip.title = session.email;
  el("logoutBtn").hidden = false;
}

async function login(email, password) {
  const data = await authApiPost(AUTH_LOGIN_URL, { email, password });
  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    email: data.user.email,
    fullName: data.user.fullName,
  };
  await writeAuthStorage(session);
  currentSession = session;
  return session;
}

async function logout() {
  const session = currentSession;
  currentSession = null;
  await writeAuthStorage(null);
  showLoginView();
  // Best-effort server-side revoke — the end state the user wants (signed
  // out of this panel) is already true locally either way.
  if (session && session.refreshToken) {
    authApiPost(AUTH_LOGOUT_URL, { refreshToken: session.refreshToken }, session.accessToken).catch(() => {});
  }
}

// On load: never just trust stale storage. An expired access token gets one
// refresh attempt; if that also fails (revoked, deactivated, backend down),
// the stored session is cleared and the login form shows — same policy the
// web console's AuthContext uses.
async function initAuth() {
  const stored = await readAuthStorage();
  if (!stored) {
    showLoginView();
    return;
  }

  try {
    const me = await authApiGet(AUTH_ME_URL, stored.accessToken);
    currentSession = { ...stored, fullName: me.fullName, email: me.email };
    await writeAuthStorage(currentSession);
    showAppView(currentSession);
  } catch (_) {
    try {
      const { accessToken } = await authApiPost(AUTH_REFRESH_URL, { refreshToken: stored.refreshToken });
      const me = await authApiGet(AUTH_ME_URL, accessToken);
      currentSession = { ...stored, accessToken, fullName: me.fullName, email: me.email };
      await writeAuthStorage(currentSession);
      showAppView(currentSession);
    } catch (__) {
      await writeAuthStorage(null);
      showLoginView();
    }
  }
}

function setStatus(text, busy = false) {
  const s = el("status");
  if (!text) { s.hidden = true; return; }
  s.hidden = false;
  s.textContent = text;
  s.className = "status" + (busy ? " busy" : "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ask every frame in the tab to capture, then pick the richest answer.
async function captureFromPage() {
  const tab = await getActiveTab();
  if (!tab) throw new Error("No active tab found.");

  const responses = [];
  // Enumerate every frame the extension can touch (ZSmart nests modules in
  // iframes), then ask each frame's content script for a capture.
  const allFrames = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => true,
  });

  for (const f of allFrames) {
    try {
      const resp = await chrome.tabs.sendMessage(
        tab.id,
        { type: "CAPTURE_TICKET" },
        { frameId: f.frameId }
      );
      if (resp) responses.push(resp);
    } catch (_) {
      /* frame without content script (cross-origin or not matched) */
    }
  }

  if (!responses.length) {
    throw new Error(
      "Couldn't reach the page. Make sure a ZSmart tab is active and the extension's host permission matches your ZSmart URL."
    );
  }
  return responses;
}

function assembleTicketText(responses, mode) {
  // Highlighted text wins if present (or if the user forced selection mode).
  const withSelection = responses.find((r) => r.selection && r.selection.length > 10);
  if (mode === "selection") {
    if (!withSelection) throw new Error("No text is highlighted on the page.");
    return { text: withSelection.selection, source: "selection", fields: null };
  }
  if (withSelection) {
    return { text: withSelection.selection, source: "selection", fields: null };
  }

  // Best structured capture across frames.
  const structured = responses
    .filter((r) => r.structured && r.structured.hits > 0)
    .sort((a, b) => b.structured.hits - a.structured.hits)[0];
  if (structured && structured.structured.hits >= 2) {
    const f = structured.structured.fields;
    const text = Object.entries(f)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join("\n");
    return { text, source: "structured", fields: f };
  }

  // Fallback: frame with the most visible text.
  const visible = responses.sort((a, b) => b.visibleLength - a.visibleLength)[0];
  if (visible && visible.visibleLength > 100) {
    return { text: visible.visible, source: "visible-text", fields: null };
  }
  throw new Error("Couldn't find ticket text on this page. Try highlighting the ticket and using 'Highlighted text only'.");
}

async function onCapture() {
  if (!currentSession) { setStatus("Please sign in first."); return; }
  setStatus("Reading ticket…", true);
  el("captureBtn").disabled = true;
  try {
    const mode = document.querySelector("input[name=mode]:checked").value;
    const responses = await captureFromPage();
    const result = assembleTicketText(responses, mode);
    lastCapture = result;

    el("ticketText").value = result.text;
    el("ticketPreview").hidden = false;
    el("askBtn").disabled = false;

    const id = result.fields && result.fields.ticketId;
    const badge = el("ticketBadge");
    badge.hidden = !id;
    if (id) badge.textContent = id.split("\n")[0];

    const info = el("captureInfo");
    info.hidden = false;
    info.textContent =
      result.source === "structured"
        ? "Captured via field mapping."
        : result.source === "selection"
        ? "Captured your highlighted text."
        : "Captured visible page text (tune selectors.json for cleaner capture).";
    setStatus("");
  } catch (e) {
    setStatus(e.message || String(e));
  } finally {
    el("captureBtn").disabled = false;
  }
}

// ---- Live activity log ("How it worked") ----------------------------------
function clearActivity() {
  el("activity").innerHTML = "";
  el("activityCard").hidden = false;
}

function addAct(text, cls) {
  const d = document.createElement("div");
  d.className = "act-item" + (cls ? " " + cls : "");
  d.textContent = text;
  const a = el("activity");
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function addCandidates(cands) {
  const wrap = document.createElement("div");
  wrap.className = "act-cands";
  if (!cands.length) {
    wrap.textContent = "(no candidates found)";
  } else {
    cands.forEach((c) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "act-cand";
      const score = c.sim != null ? `  ·  ${c.sim.toFixed(2)}` : "";
      row.textContent = `${c.n}. ${c.section}${score}`;
      row.title = "Show this procedure's steps";
      row.addEventListener("click", () => pickCandidate(c.section));
      wrap.appendChild(row);
    });
  }
  el("activity").appendChild(wrap);
  el("activity").scrollTop = el("activity").scrollHeight;
}

// Agent clicked a candidate: show that procedure immediately (no LLM needed).
// If the router answered (or later answers) differently, log the override —
// the strongest "the router picked wrong" signal we can collect.
async function pickCandidate(section) {
  try {
    const res = await fetch(`${PROCEDURE_URL}?section=${encodeURIComponent(section)}`, {
      headers: identityHeaders(),
    });
    if (!res.ok) throw new Error(`Couldn't load procedure (${res.status}).`);
    const data = await res.json();
    userPick = section;
    const hdr = el("matchedHeader");
    hdr.hidden = false;
    hdr.classList.remove("warn");
    hdr.textContent = `${section} — picked by you`;
    el("answer").textContent = data.suggestion || "(empty)";
    el("answerCard").hidden = false;
    addAct(`👆 You picked: ${section}`, "ok");
    if (lastRequestId && lastMatchedSection && lastMatchedSection !== section) {
      sendOverride(section);
    }
  } catch (e) {
    setStatus(e.message || String(e));
  }
}

async function sendOverride(section) {
  try {
    await fetch(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...identityHeaders() },
      body: JSON.stringify({
        request_id: lastRequestId,
        rating: "down",
        override_section: section,
      }),
    });
  } catch (_) {}
}

// Turn one pipeline stage event into a line in the activity log.
function handleStage(ev) {
  switch (ev.stage) {
    case "embedding":
      addAct("🔎 Reading the ticket and searching the guide…");
      break;
    case "retrieved":
      addAct(`📋 Top ${ev.candidates.length} matches — click one to view it, or wait for the assistant's pick:`);
      addCandidates(ev.candidates);
      break;
    case "selecting":
      addAct("🤔 Assistant is choosing the right procedure…");
      break;
    case "selected":
      if (ev.fallback) {
        addAct(
          ev.choice > 0
            ? `⚠️ Unverified — assistant offline; closest match: ${ev.section}`
            : "⚠️ Assistant offline — no candidate is a confident match",
          "warn"
        );
      } else if (ev.choice > 0) {
        addAct(`✅ Chose: ${ev.section}`, "ok");
      } else {
        addAct("🚫 Assistant found no matching procedure", "warn");
      }
      if (ev.reason) addAct(`💬 ${ev.reason}`, "reason");
      break;
    case "error":
      addAct(`⚠️ ${ev.detail}`, "warn");
      break;
  }
}

function renderAnswer(data) {
  lastRequestId = data.request_id || null;
  lastMatchedSection = data.matched_section || null;

  // The agent already picked a procedure themselves — don't overwrite their
  // view; just note the router's verdict and log the override if it differed.
  if (userPick) {
    if (lastMatchedSection && lastMatchedSection !== userPick) {
      addAct(`ℹ️ Assistant would have chosen: ${lastMatchedSection}`, "reason");
      sendOverride(userPick);
    }
    return;
  }

  const hdr = el("matchedHeader");
  hdr.classList.toggle("warn", !!data.fallback);
  if (data.matched_section) {
    hdr.hidden = false;
    hdr.textContent =
      (data.fallback ? "⚠️ UNVERIFIED (assistant offline) — " : "") + data.matched_section;
  } else {
    hdr.hidden = true;
  }
  el("answer").textContent = data.suggestion || "(empty response)";
  el("answerCard").hidden = false;
  el("fbThanks").hidden = true;
  el("fbUp").classList.remove("picked");
  el("fbDown").classList.remove("picked");
}

async function onAsk() {
  if (!lastCapture) return;
  if (!currentSession) { setStatus("Please sign in first."); return; }
  setStatus("Working…", true);
  el("askBtn").disabled = true;
  el("answerCard").hidden = true;
  userPick = null;
  lastMatchedSection = null;
  clearActivity();
  const payload = {
    ticket_text: el("ticketText").value,
    extra_context: el("extraContext").value || null,
    capture_source: lastCapture.source,
  };
  try {
    // Preferred path: stream the pipeline stages live.
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...identityHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let answered = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 2);
        if (!line.startsWith("data:")) continue;
        const payloadStr = line.slice(5).trim();
        if (payloadStr === "[DONE]") continue;
        let ev;
        try { ev = JSON.parse(payloadStr); } catch (_) { continue; }
        if (ev.stage === "answer") { renderAnswer(ev); answered = true; }
        else handleStage(ev);
      }
    }
    if (!answered) throw new Error("stream ended without an answer");
    setStatus("");
  } catch (streamErr) {
    // Fallback: non-streaming endpoint; render its trace, then the answer.
    try {
      addAct("(live stream unavailable — falling back)", "warn");
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...identityHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Backend error ${res.status}. ${detail.slice(0, 200)}`);
      }
      const data = await res.json();
      if (Array.isArray(data.trace)) {
        data.trace.forEach((ev) => { if (ev.stage !== "answer") handleStage(ev); });
      }
      renderAnswer(data);
      setStatus("");
    } catch (e) {
      setStatus(e.message || String(e));
    }
  } finally {
    el("askBtn").disabled = false;
  }
}

async function sendFeedback(value, btn) {
  if (!lastRequestId || !currentSession) return;
  try {
    await fetch(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...identityHeaders() },
      body: JSON.stringify({ request_id: lastRequestId, rating: value }),
    });
  } catch (_) {}
  el("fbUp").classList.remove("picked");
  el("fbDown").classList.remove("picked");
  btn.classList.add("picked");
  el("fbThanks").hidden = false;
}

el("captureBtn").addEventListener("click", onCapture);
el("askBtn").addEventListener("click", onAsk);
el("copyBtn").addEventListener("click", () =>
  navigator.clipboard.writeText(el("answer").textContent)
);
el("editToggle").addEventListener("click", () => {
  const ta = el("ticketText");
  ta.readOnly = !ta.readOnly;
  el("editToggle").textContent = ta.readOnly ? "Edit" : "Done";
});
el("fbUp").addEventListener("click", (e) => sendFeedback("up", e.currentTarget));
el("fbDown").addEventListener("click", (e) => sendFeedback("down", e.currentTarget));

// Triggered by the context-menu flow in background.js.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "PANEL_TRIGGER_CAPTURE") {
    document.querySelector("input[name=mode][value=selection]").checked = true;
    onCapture();
  }
});

el("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = el("loginEmail").value.trim();
  const password = el("loginPassword").value;
  const errEl = el("loginError");
  errEl.hidden = true;
  const btn = el("loginBtn");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const session = await login(email, password);
    el("loginPassword").value = "";
    showAppView(session);
  } catch (err) {
    errEl.hidden = false;
    errEl.textContent = err.message || "Could not sign in.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

el("logoutBtn").addEventListener("click", () => logout());

initAuth();
