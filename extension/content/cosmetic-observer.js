(function () {
  "use strict";

  let pendingClasses = new Set();
  let pendingIds = new Set();
  let debounceTimer = null;
  let dynamicStyleEl = null;

  const DEBOUNCE_MS = 100;

  function collectClassesAndIds(nodes) {
    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      if (node.classList) {
        for (const cls of node.classList) {
          pendingClasses.add(cls);
        }
      }

      if (node.id) {
        pendingIds.add(node.id);
      }

      const children = node.querySelectorAll("[class], [id]");
      for (const child of children) {
        if (child.classList) {
          for (const cls of child.classList) {
            pendingClasses.add(cls);
          }
        }
        if (child.id) {
          pendingIds.add(child.id);
        }
      }
    }
  }

  function scheduleBatch() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(flushBatch, DEBOUNCE_MS);
  }

  async function flushBatch() {
    debounceTimer = null;

    if (pendingClasses.size === 0 && pendingIds.size === 0) return;

    const classes = Array.from(pendingClasses);
    const ids = Array.from(pendingIds);
    pendingClasses.clear();
    pendingIds.clear();

    const exceptions = window.__adblockRustExceptions || [];

    try {
      const selectors = await browser.runtime.sendMessage({
        type: "getHiddenClassIdSelectors",
        classes,
        ids,
        exceptions,
      });

      if (selectors && selectors.length > 0) {
        injectDynamicCSS(selectors);
      }
    } catch (e) {
      // Extension context invalidated
    }
  }

  function injectDynamicCSS(selectors) {
    if (!dynamicStyleEl) {
      dynamicStyleEl = document.createElement("style");
      dynamicStyleEl.id = "adblock-rust-dynamic";
      dynamicStyleEl.type = "text/css";
      const target = document.head || document.documentElement;
      if (target) target.appendChild(dynamicStyleEl);
    }
    const css = selectors.join(",\n") + " { display: none !important; }";
    dynamicStyleEl.textContent += css + "\n";
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        collectClassesAndIds(mutation.addedNodes);
      }
    }
    if (pendingClasses.size > 0 || pendingIds.size > 0) {
      scheduleBatch();
    }
  });

  function startObserver() {
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });

    collectClassesAndIds([document.documentElement]);
    if (pendingClasses.size > 0 || pendingIds.size > 0) {
      scheduleBatch();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, {
      once: true,
    });
  } else {
    startObserver();
  }
})();
