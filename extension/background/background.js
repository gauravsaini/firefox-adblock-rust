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
  const stored = await browser.storage.local.get(["enabled", "cosmeticEnabled"]);
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
    browser.browserAction.setBadgeText({ text: "OFF" });
    browser.browserAction.setBadgeBackgroundColor({ color: "#999" });
  } else {
    browser.browserAction.setBadgeText({ text: "" });
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "getStatus":
      return Promise.resolve({
        enabled,
        ready: isReady(),
        blockedCount: sender.tab ? getBlockedCount(sender.tab.id) : 0,
      });

    case "getBlockedCount": {
      const count = getBlockedCount(message.tabId);
      return Promise.resolve({ count });
    }

    case "getFilterLists":
      return getEnabledLists().then((lists) => ({ filterLists: lists }));

    case "toggleEnabled":
      enabled = !enabled;
      browser.storage.local.set({ enabled });
      updateBadge();
      if (enabled) {
        initialize();
        setupRequestListener();
      }
      return Promise.resolve({ enabled });

    case "whitelistSite":
      if (message.domain) {
        browser.storage.local.get("customRules").then(({ customRules }) => {
          const rules = customRules || "";
          const newRules = rules + "\n@@||" + message.domain + "^$document";
          browser.storage.local.set({ customRules: newRules });
          rebuildEngine();
        });
      }
      return Promise.resolve({ ok: true });

    case "getCosmeticResources":
      return browser.storage.local.get("cosmeticEnabled").then(({ cosmeticEnabled }) =>
        waitForReady().then(() => {
          if (!isReady() || cosmeticEnabled === false) return null;
          try {
            const engine = getEngine();
            engine.enableTag("cosmetic");
            return engine.urlCosmeticResources(message.url);
          } catch (e) {
            return null;
          }
        }),
      );

    case "getHiddenClassIdSelectors":
      if (!isReady()) return Promise.resolve([]);
      try {
        const engine = getEngine();
        return Promise.resolve(
          engine.hiddenClassIdSelectors(
            message.classes,
            message.ids,
            message.exceptions || [],
          ),
        );
      } catch (e) {
        return Promise.resolve([]);
      }

    case "rebuildEngine":
      return rebuildEngine().then(() => ({ ok: true }));

    case "activatePicker": {
      const tabId = message.tabId;
      return browser.scripting
        .executeScript({ target: { tabId }, files: ["content/tool-overlay.js"] })
        .then(() =>
          browser.scripting.executeScript({
            target: { tabId },
            files: ["content/zapper.js"],
          }),
        )
        .then(() => ({ ok: true }))
        .catch((e) => {
          console.error("Failed to inject picker:", e);
          return { ok: false, error: e.message };
        });
    }

    case "createRule": {
      const rule = message.rule;
      if (!rule) return Promise.resolve({ ok: true });
      return browser.storage.local.get("customRules").then(({ customRules }) => {
        const updated = (customRules || "") + "\n" + rule;
        return browser.storage.local.set({ customRules: updated });
      }).then(() => rebuildEngine()).then(() => ({ ok: true }));
    }

    default:
      return false;
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!enabled) return;
  const count = getBlockedCount(tabId);
  if (count > 0) {
    browser.browserAction.setBadgeText({ text: String(count), tabId });
    browser.browserAction.setBadgeBackgroundColor({ color: "#e74c3c", tabId });
  } else {
    browser.browserAction.setBadgeText({ text: "", tabId });
  }
});

browser.webNavigation?.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId === 0) {
    resetBlockedCount(tabId);
    browser.browserAction.setBadgeText({ text: "", tabId });
  }
});

start().catch((e) => console.error("[adblock-rust] Startup failed:", e));
