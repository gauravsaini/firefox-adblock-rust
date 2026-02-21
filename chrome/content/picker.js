(function () {
  if (window.adblockRustPickerActive) {
    // If clicked again while active, simply remove UI and exit (toggle off)
    const cleanupEvent = new Event("adblockRustPickerCleanup");
    document.dispatchEvent(cleanupEvent);
    return;
  }
  window.adblockRustPickerActive = true;

  // Create UI overlay
  const overlay = document.createElement("div");
  overlay.className = "adblock-rust-picker-overlay";
  document.body.appendChild(overlay);

  const highlighter = document.createElement("div");
  highlighter.className = "adblock-rust-highlighter";
  document.body.appendChild(highlighter);

  const dialog = document.createElement("div");
  dialog.className = "adblock-rust-dialog";
  dialog.style.display = "none";
  dialog.innerHTML = `
    <h3>Block Element</h3>
    <div class="adblock-rust-options-list" style="max-height: 150px; overflow-y: auto; margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 4px;"></div>
    <div class="adblock-rust-buttons">
      <button class="adblock-rust-btn adblock-rust-btn-cancel">Cancel</button>
      <button class="adblock-rust-btn adblock-rust-btn-preview">Preview</button>
      <button class="adblock-rust-btn adblock-rust-btn-create">Create</button>
    </div>
  `;
  document.body.appendChild(dialog);

  let currentElement = null;
  let isPaused = false;
  let generatedOptions = [];

  // Helper: Get optimized selectors
  function getSelectors(el) {
    const options = [];

    // 1. ID Selector (Best)
    if (el.id) {
      options.push({
        type: "ID",
        selector: "##" + "#" + CSS.escape(el.id),
        raw: "#" + CSS.escape(el.id),
      });
    }

    // 2. Class Selector (Good)
    if (el.className && typeof el.className === "string") {
      const classes = el.className
        .split(/\s+/)
        .filter((c) => c.trim() && !c.startsWith("adblock-rust"));
      if (classes.length > 0) {
        // Try single classes first if they seem unique-ish
        classes.forEach((c) => {
          options.push({
            type: "Class",
            selector: "##" + "." + CSS.escape(c),
            raw: "." + CSS.escape(c),
          });
        });
        // Combined classes
        if (classes.length > 1) {
          const combined = "." + classes.map((c) => CSS.escape(c)).join(".");
          options.push({
            type: "Classes",
            selector: "##" + combined,
            raw: combined,
          });
        }
      }
    }

    // 3. Structural/Tag Selector (Fallback)
    // Simple Nth-child path
    let path = [];
    let curr = el;
    let valid = true;
    while (curr && curr !== document.body) {
      let tag = curr.tagName.toLowerCase();
      let sibling = curr;
      let nth = 1;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === curr.tagName) nth++;
      }
      if (nth > 1) tag += `:nth-of-type(${nth})`;
      path.unshift(tag);
      curr = curr.parentElement;
      if (!curr) {
        valid = false;
        break;
      }
    }
    if (valid && path.length > 0) {
      const structural = path.join(" > ");
      // Only offer path if it's not a naked generic tag
      if (structural !== "div" && structural !== "span") {
        options.push({
          type: "Path",
          selector: "##" + structural,
          raw: structural,
        });
      }
    }

    return options;
  }

  function renderOptions(options) {
    const container = dialog.querySelector(".adblock-rust-options-list");
    container.innerHTML = "";

    if (options.length === 0) {
      container.innerHTML =
        '<div style="padding:10px; color:#718096;">No good selectors found.</div>';
      return;
    }

    options.forEach((opt, idx) => {
      // Check how many elements this matches
      let matchCount = 0;
      try {
        matchCount = document.querySelectorAll(opt.raw).length;
      } catch (e) {}

      const row = document.createElement("div");
      row.style.padding = "8px";
      row.style.borderBottom = "1px solid #edf2f7";
      row.style.cursor = "pointer";
      row.style.fontSize = "12px";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      if (idx === 0) row.style.backgroundColor = "#f7fafc";

      row.innerHTML = `
            <input type="radio" name="picker_selector" value="${idx}" ${idx === 0 ? "checked" : ""}>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis;">
                <div style="font-weight:600; color:#2d3748;">${opt.raw}</div>
                <div style="color:#718096; font-size:11px;">Matches ${matchCount} element(s)</div>
            </div>
          `;

      row.addEventListener("click", () => {
        row.querySelector("input").checked = true;
        // Highlight selected
        try {
          const all = document.querySelectorAll(opt.raw);
          // Visual feedback could go here (e.g. outline all matches)
        } catch (e) {}
      });

      container.appendChild(row);
    });

    generatedOptions = options;
  }

  function onMouseOver(e) {
    if (
      isPaused ||
      e.target === overlay ||
      e.target === highlighter ||
      dialog.contains(e.target)
    )
      return;

    currentElement = e.target;
    // Don't highlight our own UI
    if (currentElement.closest(".adblock-rust-dialog")) return;

    const rect = currentElement.getBoundingClientRect();
    highlighter.style.top = rect.top + window.scrollY + "px";
    highlighter.style.left = rect.left + window.scrollX + "px";
    highlighter.style.width = rect.width + "px";
    highlighter.style.height = rect.height + "px";
  }

  function onClick(e) {
    // Allow interactions inside our own dialog UI
    if (dialog.contains(e.target) || e.target.closest(".adblock-rust-dialog")) {
      return;
    }

    // Crucially, intercept and stop ALL other clicks on the page while Zapper is active.
    // This prevents links from opening, videos from playing, etc.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // If dialog is already open (paused), ignore clicks outside of it
    if (isPaused) return;

    // Ignore clicks on our overlay/highlighter elements
    if (e.target === overlay || e.target === highlighter) return;

    isPaused = true;
    const targetEl = currentElement || e.target;
    const options = getSelectors(targetEl);
    renderOptions(options);

    // Position dialog near click but stay on screen
    const rect = currentElement.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    // Boundary checks
    if (top + 200 > document.body.scrollHeight)
      top = rect.top + window.scrollY - 220;
    if (left + 300 > document.body.scrollWidth)
      left = document.body.scrollWidth - 310;
    if (top < 0) top = 10;
    if (left < 0) left = 10;

    dialog.style.top = top + "px";
    dialog.style.left = left + "px";
    dialog.style.bottom = "auto"; // override default
    dialog.style.right = "auto"; // override default
    dialog.style.display = "flex";
  }

  // Preview state
  let previewStyleEl = null;
  let isPreviewing = false;

  function stopPreview() {
    if (previewStyleEl) {
      previewStyleEl.remove();
      previewStyleEl = null;
    }
    isPreviewing = false;
    const btn = dialog.querySelector(".adblock-rust-btn-preview");
    if (btn) {
      btn.textContent = "Preview";
      btn.classList.remove("active");
    }
  }

  function startPreview(selector) {
    if (!previewStyleEl) {
      previewStyleEl = document.createElement("style");
      previewStyleEl.id = "adblock-rust-preview-style";
      document.head.appendChild(previewStyleEl);
    }
    previewStyleEl.textContent = `${selector} { display: none !important; opacity: 0 !important; }`;
    isPreviewing = true;
    const btn = dialog.querySelector(".adblock-rust-btn-preview");
    if (btn) {
      btn.textContent = "Stop Preview";
      btn.classList.add("active");
    }
  }

  // Actions
  dialog
    .querySelector(".adblock-rust-btn-create")
    .addEventListener("click", () => {
      const selectedIdx = parseInt(
        dialog.querySelector('input[name="picker_selector"]:checked')?.value ||
          0,
      );
      const option = generatedOptions[selectedIdx];

      if (option) {
        const hostname = window.location.hostname;
        const rule = `${hostname}${option.selector}`;

        // Apply immediately and execute scroll-lock heuristic (port of uBOL-home)
        try {
          const removedElems = document.querySelectorAll(option.raw);
          const getStyleValue = (elem, prop) => {
            const style = window.getComputedStyle(elem);
            return style ? style[prop] : "";
          };

          let maybeScrollLocked = false;

          removedElems.forEach((el) => {
            el.style.display = "none";

            // Heuristic to detect scroll-locking
            let curr = el;
            while (
              curr !== null &&
              !maybeScrollLocked &&
              curr !== document.body
            ) {
              maybeScrollLocked =
                parseInt(getStyleValue(curr, "zIndex"), 10) >= 1000 ||
                getStyleValue(curr, "position") === "fixed";
              curr = curr.parentElement;
            }
          });

          // If we likely removed a modal overlay, try to unlock the scroll bars
          if (maybeScrollLocked) {
            const doc = document;
            if (getStyleValue(doc.body, "overflowY") === "hidden") {
              doc.body.style.setProperty("overflow", "auto", "important");
            }
            if (getStyleValue(doc.body, "position") === "fixed") {
              doc.body.style.setProperty("position", "initial", "important");
            }
            if (getStyleValue(doc.documentElement, "position") === "fixed") {
              doc.documentElement.style.setProperty(
                "position",
                "initial",
                "important",
              );
            }
            if (getStyleValue(doc.documentElement, "overflowY") === "hidden") {
              doc.documentElement.style.setProperty(
                "overflow",
                "auto",
                "important",
              );
            }

            // Add a generic cosmetic rule to keep it unlocked permanently
            chrome.runtime.sendMessage({
              type: "createRule",
              rule: `${hostname}##body:style(overflow: auto !important; position: initial !important;)`,
            });
            chrome.runtime.sendMessage({
              type: "createRule",
              rule: `${hostname}##html:style(overflow: auto !important; position: initial !important;)`,
            });
          }
        } catch (e) {}

        chrome.runtime.sendMessage({ type: "createRule", rule });
      }
      cleanup();
    });

  dialog
    .querySelector(".adblock-rust-btn-cancel")
    .addEventListener("click", () => {
      isPaused = false;
      stopPreview();
      dialog.style.display = "none";
    });

  dialog
    .querySelector(".adblock-rust-btn-preview")
    .addEventListener("click", () => {
      if (isPreviewing) {
        stopPreview();
      } else {
        const selectedIdx = parseInt(
          dialog.querySelector('input[name="picker_selector"]:checked')
            ?.value || 0,
        );
        const option = generatedOptions[selectedIdx];
        if (option) {
          startPreview(option.raw);
        }
      }
    });

  // Update preview live if active and user clicks a different ratio button
  dialog
    .querySelector(".adblock-rust-options-list")
    .addEventListener("change", (e) => {
      if (isPreviewing && e.target.name === "picker_selector") {
        const selectedIdx = parseInt(e.target.value);
        const option = generatedOptions[selectedIdx];
        if (option) {
          startPreview(option.raw); // Updates the existing style
        }
      }
    });

  function cleanup() {
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("click", onClick, true);
    document.removeEventListener("keyup", onEsc);
    document.removeEventListener("adblockRustPickerCleanup", cleanup);

    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (highlighter && highlighter.parentNode)
      highlighter.parentNode.removeChild(highlighter);
    if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);

    stopPreview();

    window.adblockRustPickerActive = false;
  }

  document.addEventListener("adblockRustPickerCleanup", cleanup);

  function onEsc(e) {
    if (e.key === "Escape") {
      if (isPaused) {
        isPaused = false;
        dialog.style.display = "none";
      } else {
        cleanup();
      }
    }
  }

  window.addEventListener("mouseover", onMouseOver);
  window.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onEsc);
})();
