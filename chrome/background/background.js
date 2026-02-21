import {
  initialize,
  setupPeriodicUpdate,
  getEngine,
  isReady,
  waitForReady,
  rebuildEngine,
} from "./engine-manager.js";
import {
  setupRequestListener,
  getBlockedCount,
  resetBlockedCount,
} from "./request-handler.js";
import { getEnabledLists } from "./filter-lists.js";

let enabled = true;

async function start() {
  const stored = await chrome.storage.local.get(["enabled", "cosmeticEnabled"]);
  enabled = stored.enabled !== false;

  if (enabled) {
    setupRequestListener();
    await initialize();
    setupPeriodicUpdate();
  }

  updateBadge();
}

function updateBadge() {
  if (!enabled) {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#999" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "getStatus":
        sendResponse({
          enabled,
          ready: isReady(),
          blockedCount: sender.tab ? getBlockedCount(sender.tab.id) : 0,
        });
        break;

      case "getBlockedCount": {
        const count = getBlockedCount(message.tabId);
        sendResponse({ count });
        break;
      }

      case "getFilterLists":
        const lists = await getEnabledLists();
        sendResponse({ filterLists: lists });
        break;

      case "toggleEnabled":
        enabled = !enabled;
        await chrome.storage.local.set({ enabled });
        updateBadge();

        // Handle DNR state change based on master switch
        const { dnrEnabled } = await chrome.storage.local.get("dnrEnabled");
        const shouldEnableDNR = enabled && dnrEnabled !== false;

        // Update ruleset state
        chrome.declarativeNetRequest.updateEnabledRulesets({
          [shouldEnableDNR ? "enableRulesetIds" : "disableRulesetIds"]: [
            "default_ruleset",
          ],
        });

        if (enabled) {
          await initialize();
          setupRequestListener();
        }
        sendResponse({ enabled });
        break;

      case "toggleDNR":
        if (!enabled) return; // Ignore if master switch is off
        const dnrOn = message.enabled;
        chrome.declarativeNetRequest.updateEnabledRulesets({
          [dnrOn ? "enableRulesetIds" : "disableRulesetIds"]: [
            "default_ruleset",
          ],
        });
        sendResponse({ ok: true });
        break;

      case "whitelistSite":
        if (message.domain) {
          const { customRules } = await chrome.storage.local.get("customRules");
          const rules = customRules || "";
          const newRules = rules + "\n@@||" + message.domain + "^$document";
          await chrome.storage.local.set({ customRules: newRules });
          await rebuildEngine();
        }
        sendResponse({ ok: true });
        break;

      case "getCosmeticResources":
        const { cosmeticEnabled } =
          await chrome.storage.local.get("cosmeticEnabled");

        await waitForReady(); // Wait for engine to initialize on cold starts

        if (!isReady() || cosmeticEnabled === false) {
          sendResponse(null);
          return;
        }
        try {
          const engine = getEngine();
          engine.enableTag("cosmetic"); // Ensure tag is enabled if not already
          sendResponse(engine.urlCosmeticResources(message.url));
        } catch (e) {
          sendResponse(null);
        }
        break;

      case "getHiddenClassIdSelectors":
        const { cosmeticEnabled: ce } =
          await chrome.storage.local.get("cosmeticEnabled");

        await waitForReady();

        if (!isReady() || ce === false) {
          sendResponse([]);
          return;
        }
        try {
          const engine = getEngine();
          sendResponse(
            engine.hiddenClassIdSelectors(
              message.classes,
              message.ids,
              message.exceptions || [],
            ),
          );
        } catch (e) {
          sendResponse([]);
        }
        break;

      case "rebuildEngine":
        await rebuildEngine();
        sendResponse({ ok: true });
        break;

      case "activatePicker":
        const tabId = message.tabId;
        try {
          // Step 1: inject iframe overlay manager (sets self.adblockOverlay)
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content/tool-overlay.js"],
          });
          // Step 2: inject zapper which calls adblockOverlay.install('zapper-ui.html', ...)
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content/zapper.js"],
          });
          sendResponse({ ok: true });
        } catch (e) {
          console.error("Failed to inject picker:", e);
          sendResponse({ ok: false, error: e.message });
        }
        break;

      case "createRule":
        const rule = message.rule;
        if (rule) {
          const { customRules } = await chrome.storage.local.get("customRules");
          const updated = (customRules || "") + "\n" + rule;
          await chrome.storage.local.set({ customRules: updated });
          await rebuildEngine();
        }
        sendResponse({ ok: true });
        break;

      default:
        sendResponse(false);
    }
  })();
  return true; // Keep channel open for async response
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!enabled) return;
  const count = getBlockedCount(tabId);
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

chrome.webNavigation?.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) {
    resetBlockedCount(tabId);
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

start().catch((e) => console.error("[adblock-rust] Startup failed:", e));
