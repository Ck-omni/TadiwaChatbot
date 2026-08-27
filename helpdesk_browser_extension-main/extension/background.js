// ZSmart Ticket Copilot — service worker

// Clicking the toolbar icon opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Right-click on highlighted text -> "Suggest resolution for selection".
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "zsmart-copilot-selection",
    title: "Suggest resolution for selected text",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "zsmart-copilot-selection" || !tab) return;
  await chrome.sidePanel.open({ tabId: tab.id });
  // Give the panel a moment to load, then tell it to run a capture.
  setTimeout(() => {
    chrome.runtime
      .sendMessage({ type: "PANEL_TRIGGER_CAPTURE", tabId: tab.id })
      .catch(() => {});
  }, 400);
});

// ---------------------------------------------------------------------------
// Floating-action-button toggle (fab.js, injected into every tab).
//
// chrome.sidePanel has open() but deliberately no close()/isOpen() — the
// panel closes itself. So we track state with a long-lived port: sidepanel.js
// connects on load, and the port's onDisconnect fires when the panel is
// actually closed (see https://github.com/w3c/webextensions/issues/521).
// A connected port also keeps this service worker alive for as long as the
// panel is open, so a plain in-memory flag stays accurate without needing
// chrome.storage.
let copilotOpen = false;

function broadcastCopilotState() {
  chrome.runtime.sendMessage({ type: "COPILOT_STATE", open: copilotOpen }).catch(() => {});
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "zsmart-copilot-panel") return;
  copilotOpen = true;
  broadcastCopilotState();
  port.onDisconnect.addListener(() => {
    copilotOpen = false;
    broadcastCopilotState();
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "GET_COPILOT_STATE") {
    sendResponse({ open: copilotOpen });
    return;
  }

  if (msg.type === "TOGGLE_COPILOT") {
    if (copilotOpen) {
      // Ask the panel to close itself (window.close() from inside it — the
      // only reliable way, since there's no sidePanel.close()).
      chrome.runtime.sendMessage({ type: "CLOSE_COPILOT_PANEL" }).catch(() => {});
    } else if (sender.tab && sender.tab.id != null) {
      // Must run synchronously off the click's user gesture — no await
      // before this call, or Chrome may reject it with
      // "sidePanel.open() may only be called in response to a user gesture".
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(console.error);
    }
    return;
  }
});
