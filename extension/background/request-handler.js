import { getEngine, isReady } from "./engine-manager.js";

const blockedCounts = {};

function mapResourceType(type) {
  const typeMap = {
    main_frame: "document",
    sub_frame: "subdocument",
    stylesheet: "stylesheet",
    script: "script",
    image: "image",
    font: "font",
    object: "object",
    xmlhttprequest: "xmlhttprequest",
    ping: "ping",
    media: "media",
    websocket: "websocket",
    other: "other",
    imageset: "image",
    xbl: "other",
    xml_dtd: "other",
    xslt: "other",
    beacon: "ping",
    csp_report: "other",
    speculative: "other",
  };
  return typeMap[type] || "other";
}

export function getBlockedCount(tabId) {
  return blockedCounts[tabId] || 0;
}

export function resetBlockedCount(tabId) {
  blockedCounts[tabId] = 0;
}

export function setupRequestListener() {
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!isReady()) return {};

      const engine = getEngine();
      if (!engine) return {};

      if (
        details.url.startsWith("moz-extension://") ||
        details.url.startsWith("about:")
      ) {
        return {};
      }

      const sourceUrl = details.originUrl || details.documentUrl || details.url;
      const requestType = mapResourceType(details.type);

      try {
        const result = engine.check(details.url, sourceUrl, requestType);

        if (result.matched && !result.exception) {
          if (details.tabId >= 0) {
            blockedCounts[details.tabId] =
              (blockedCounts[details.tabId] || 0) + 1;
          }

          if (result.redirect) {
            return { redirectUrl: result.redirect };
          }
          return { cancel: true };
        }

        if (result.rewritten_url) {
          return { redirectUrl: result.rewritten_url };
        }
      } catch (e) {
        // Request check failed — allow through
      }

      return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    delete blockedCounts[tabId];
  });
}
