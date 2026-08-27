// ZSmart Ticket Copilot — floating action button
//
// Injected into every tab (see manifest.json content_scripts, "<all_urls>")
// so the copilot side panel can be opened/closed from any page, not just
// ZSmart. Lives in a closed shadow DOM so the host page's CSS/JS can't see
// or touch it, and vice versa.

(() => {
  if (window.__zsmartCopilotFab) return; // don't double-inject (e.g. re-run on SPA nav)
  window.__zsmartCopilotFab = true;

  const POS_KEY = "copilotFabPos";
  const DEFAULT_POS = { right: 24, bottom: 24 };
  const SIZE = 52;

  const host = document.createElement("div");
  host.id = "zsmart-copilot-fab-host";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .fab {
        position: fixed;
        width: ${SIZE}px;
        height: ${SIZE}px;
        border-radius: 50%;
        border: none;
        background: #1a73e8;
        color: #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,.35);
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        touch-action: none;
        user-select: none;
        transition: background .15s ease;
      }
      .fab:active { cursor: grabbing; }
      .fab.open { background: #188038; }
      .fab.dragging { transition: none; }
      .fab svg { width: 26px; height: 26px; pointer-events: none; }
      .dot {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #34a853;
        border: 2px solid #fff;
        display: none;
      }
      .fab.open .dot { display: block; }
    </style>
    <button class="fab" type="button" title="Toggle Ticket Copilot" aria-label="Toggle Ticket Copilot">
      <span class="dot"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
  `;
  const btn = shadow.querySelector(".fab");

  function clamp(pos) {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      right: Math.min(Math.max(pos.right, 4), Math.max(4, vw - SIZE - 4)),
      bottom: Math.min(Math.max(pos.bottom, 4), Math.max(4, vh - SIZE - 4)),
    };
  }

  function applyPos(pos) {
    btn.style.right = `${pos.right}px`;
    btn.style.bottom = `${pos.bottom}px`;
  }

  let currentPos = DEFAULT_POS;
  applyPos(currentPos); // paint immediately; storage (async) corrects it below
  try {
    chrome.storage.local.get(POS_KEY, (res) => {
      if (res && res[POS_KEY]) {
        currentPos = clamp(res[POS_KEY]);
        applyPos(currentPos);
      }
    });
  } catch (_) {
    /* extension context invalidated */
  }

  // ---- Drag to reposition; a plain click (no movement) toggles the panel --
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, startRight = 0, startBottom = 0;

  btn.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startRight = currentPos.right;
    startBottom = currentPos.bottom;
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      moved = true;
      btn.classList.add("dragging");
    }
    if (!moved) return;
    currentPos = clamp({ right: startRight - dx, bottom: startBottom - dy });
    applyPos(currentPos);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    btn.classList.remove("dragging");
    if (moved) {
      try { chrome.storage.local.set({ [POS_KEY]: currentPos }); } catch (_) {}
    } else {
      toggleCopilot();
    }
  }

  btn.addEventListener("pointerup", endDrag);
  btn.addEventListener("pointercancel", () => {
    dragging = false;
    btn.classList.remove("dragging");
  });
  // Keep it on-screen if the viewport is resized after being dragged.
  window.addEventListener("resize", () => applyPos((currentPos = clamp(currentPos))));

  // ---- Talk to the background service worker -----------------------------
  function toggleCopilot() {
    try {
      chrome.runtime.sendMessage({ type: "TOGGLE_COPILOT" });
    } catch (_) {
      /* extension context invalidated (extension reloaded/updated) */
    }
  }

  function setOpenVisual(open) {
    btn.classList.toggle("open", !!open);
  }

  try {
    chrome.runtime.sendMessage({ type: "GET_COPILOT_STATE" }, (res) => {
      if (res) setOpenVisual(res.open);
    });
  } catch (_) {}

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "COPILOT_STATE") setOpenVisual(msg.open);
    });
  } catch (_) {}
})();
