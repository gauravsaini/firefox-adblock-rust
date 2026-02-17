(function () {
  "use strict";

  const pageUrl = window.location.href;
  let cosmeticStyleEl = null;
  let exceptions = new Set();

  async function applyCosmeticFilters() {
    try {
      const result = await browser.runtime.sendMessage({
        type: "getCosmeticResources",
        url: pageUrl,
      });

      if (!result) return;

      if (result.exceptions && result.exceptions.length > 0) {
        result.exceptions.forEach((e) => exceptions.add(e));
      }

      if (result.generichide) return;

      if (result.hide_selectors && result.hide_selectors.length > 0) {
        injectCSS(result.hide_selectors);
      }

      if (result.style_selectors && Object.keys(result.style_selectors).length > 0) {
        injectStyleSelectors(result.style_selectors);
      }

      if (result.injected_script) {
        injectScript(result.injected_script);
      }

      window.__adblockRustExceptions = Array.from(exceptions);
    } catch (e) {
      // Extension context invalidated or not ready
    }
  }

  function injectCSS(selectors) {
    if (selectors.length === 0) return;

    const css = selectors.join(",\n") + " { display: none !important; }";

    if (!cosmeticStyleEl) {
      cosmeticStyleEl = document.createElement("style");
      cosmeticStyleEl.id = "adblock-rust-cosmetic";
      cosmeticStyleEl.type = "text/css";
    }
    cosmeticStyleEl.textContent += css + "\n";

    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(cosmeticStyleEl);
    }
  }

  function injectStyleSelectors(styleSelectors) {
    let css = "";
    for (const [selector, rules] of Object.entries(styleSelectors)) {
      css += `${selector} { ${rules.join("; ")} !important; }\n`;
    }
    if (css) {
      const el = document.createElement("style");
      el.id = "adblock-rust-style-selectors";
      el.type = "text/css";
      el.textContent = css;
      const target = document.head || document.documentElement;
      if (target) target.appendChild(el);
    }
  }

  function injectScript(scriptContent) {
    try {
      const script = document.createElement("script");
      script.textContent = scriptContent;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      // CSP may block inline scripts
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCosmeticFilters, {
      once: true,
    });
  } else {
    applyCosmeticFilters();
  }
})();
