// ZSmart Ticket Copilot — content script
// Runs in every frame of the ZSmart host (all_frames: true) because ZSmart v9
// typically renders modules inside iframes. The side panel broadcasts a
// capture request; every frame answers with whatever it can see, and the
// side panel picks the richest answer.

let SELECTORS = null;

async function loadSelectors() {
  if (SELECTORS) return SELECTORS;
  try {
    const url = chrome.runtime.getURL("selectors.json");
    const res = await fetch(url);
    SELECTORS = await res.json();
  } catch (_) {
    // Missing web_accessible_resources or bad JSON — degrade to the
    // selection / visible-text fallbacks instead of throwing.
    SELECTORS = { fields: {}, containerSelectors: [] };
  }
  return SELECTORS;
}

// Read the value of a field given a list of candidate selectors.
function readField(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const sel of candidates) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch (_) {
      continue; // tolerate a bad selector in the config
    }
    if (!nodes.length) continue;
    const parts = [];
    nodes.forEach((el) => {
      const v =
        el.value !== undefined && el.value !== "" && el.tagName !== "OPTION"
          ? el.value
          : el.innerText;
      const text = (v || "").trim();
      if (text) parts.push(text);
    });
    if (parts.length) return parts.join("\n").slice(0, 8000);
  }
  return null;
}

// Mode 1: structured capture via configured selectors.
async function captureStructured() {
  const cfg = await loadSelectors();
  const out = {};
  let hits = 0;
  for (const [name, candidates] of Object.entries(cfg.fields || {})) {
    const val = readField(candidates);
    if (val) {
      out[name] = val;
      hits++;
    }
  }
  return { fields: out, hits };
}

// Mode 2: user-highlighted text in this frame.
function captureSelection() {
  const sel = window.getSelection ? String(window.getSelection()) : "";
  return sel.trim().slice(0, 20000);
}

// Mode 3: all visible text in the most relevant container in this frame.
async function captureVisibleText() {
  const cfg = await loadSelectors();
  let root = null;
  for (const sel of cfg.containerSelectors || []) {
    try {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 100) {
        root = el;
        break;
      }
    } catch (_) {}
  }
  root = root || document.body;
  if (!root) return "";
  // innerText respects visibility, so hidden tabs/menus are excluded.
  return root.innerText.replace(/\n{3,}/g, "\n\n").trim().slice(0, 30000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "CAPTURE_TICKET") {
    (async () => {
      try {
        const structured = await captureStructured();
        const selection = captureSelection();
        const visible = await captureVisibleText();
        sendResponse({
          frameUrl: location.href,
          structured,
          selection,
          visibleLength: visible.length,
          visible,
        });
      } catch (e) {
        // Always respond — a missing sendResponse leaves the port open and
        // hangs the side panel's capture. Degrade to an empty result.
        sendResponse({
          frameUrl: location.href,
          error: String(e),
          structured: { fields: {}, hits: 0 },
          selection: "",
          visibleLength: 0,
          visible: "",
        });
      }
    })();
    return true; // async response
  }
});
