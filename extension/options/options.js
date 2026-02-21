document.addEventListener("DOMContentLoaded", async () => {
  // Navigation
  const navLinks = document.querySelectorAll(".nav-link");
  const tabPanes = document.querySelectorAll(".tab-pane");

  function switchTab(tabId) {
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.tab === tabId);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle("active", pane.id === tabId);
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => switchTab(link.dataset.tab));
  });

  // Status Message Helper
  const statusMsg = document.getElementById("status-message");
  function showStatus(msg, type = "success") {
    statusMsg.textContent = msg;
    statusMsg.className = `status-message ${type} visible`;
    setTimeout(() => {
      statusMsg.className = "status-message";
    }, 3000);
  }

  // --- General Settings ---
  const toggleEnable = document.getElementById("toggle-enable");
  const toggleCosmetic = document.getElementById("toggle-cosmetic");

  // Load initial state
  const storage = await browser.storage.local.get(["enabled", "cosmeticEnabled"]);

  toggleEnable.checked = storage.enabled !== false;
  toggleCosmetic.checked = storage.cosmeticEnabled !== false;

  // Toggle Handlers
  toggleEnable.addEventListener("change", async () => {
    const enabled = toggleEnable.checked;
    await browser.storage.local.set({ enabled });
    await browser.runtime.sendMessage({ type: "toggleEnabled", enabled });
    showStatus(enabled ? "Extension Enabled" : "Extension Disabled");
  });

  toggleCosmetic.addEventListener("change", async () => {
    const cosmeticEnabled = toggleCosmetic.checked;
    await browser.storage.local.set({ cosmeticEnabled });
    showStatus(
      cosmeticEnabled
        ? "Cosmetic Filtering Enabled"
        : "Cosmetic Filtering Disabled",
    );
  });

  // --- Filter Lists ---
  const listContainer = document.getElementById("filter-lists-container");
  const updateListsBtn = document.getElementById("btn-update-lists");
  const customListUrlInput = document.getElementById("custom-list-url");
  const addCustomListBtn = document.getElementById("btn-add-list");

  const CATEGORY_NAMES = {
    ads: "Ad Blocking",
    privacy: "Privacy & Tracking",
    security: "Malware & Security",
    fixes: "Annoyances & Fixes", // Combined for cleaner UI
    youtube: "YouTube",
    custom: "My Custom Lists",
  };

  async function loadFilterLists() {
    const { filterLists } = await browser.runtime.sendMessage({
      type: "getFilterLists",
    });
    listContainer.innerHTML = "";
    if (!filterLists) return;

    // Group by category
    const groups = {};
    for (const list of filterLists) {
      let cat = list.category || "ads";
      if (list.id.startsWith("custom-")) cat = "custom";
      // Merge some categories for UI simplicity
      if (cat === "annoyances" || cat === "fixes") cat = "fixes";

      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(list);
    }

    // Render groups
    const order = ["ads", "privacy", "security", "youtube", "fixes", "custom"];

    for (const cat of order) {
      if (!groups[cat]) continue;

      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("h2");
      title.textContent = CATEGORY_NAMES[cat] || cat;
      card.appendChild(title);

      groups[cat].forEach((list) => {
        const row = document.createElement("div");
        row.className = "control-group";
        row.style.borderBottom = "1px solid var(--border-color)";
        row.style.padding = "0.75rem 0";

        row.innerHTML = `
            <div>
               <div class="control-label">${list.name}</div>
               <!-- <div class="control-desc">${list.url}</div> -->
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                ${list.id.startsWith("custom-") ? `<button class="remove-btn" data-id="${list.id}">&times;</button>` : ""}
                <label class="switch">
                  <input type="checkbox" data-id="${list.id}" ${list.enabled ? "checked" : ""}>
                  <span class="slider"></span>
                </label>
            </div>
          `;
        card.appendChild(row);
      });

      listContainer.appendChild(card);
    }

    // Event Listeners for Toggles & Remove
    listContainer.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const { filterLists: currentLists } =
          await browser.storage.local.get("filterLists");
        const list = currentLists.find((l) => l.id === cb.dataset.id);
        if (list) {
          list.enabled = cb.checked;
          await browser.storage.local.set({ filterLists: currentLists });
          showStatus("List updated. Click 'Update Now' to apply.");
        }
      });
    });

    listContainer.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this custom list?")) return;
        const { filterLists: currentLists } =
          await browser.storage.local.get("filterLists");
        const updated = currentLists.filter((l) => l.id !== btn.dataset.id);
        await browser.storage.local.set({ filterLists: updated });
        loadFilterLists();
        showStatus("List removed.");
      });
    });
  }

  updateListsBtn.addEventListener("click", async () => {
    updateListsBtn.disabled = true;
    updateListsBtn.textContent = "Updating...";
    try {
      await browser.runtime.sendMessage({ type: "rebuildEngine" });
      showStatus("All lists updated successfully.");
    } catch (e) {
      showStatus("Update failed: " + e.message, "error");
    }
    updateListsBtn.disabled = false;
    updateListsBtn.textContent = "Update Now";
  });

  addCustomListBtn.addEventListener("click", async () => {
    const url = customListUrlInput.value.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return showStatus("Invalid URL", "error");
    }

    const { filterLists } = await browser.storage.local.get("filterLists");
    const lists = filterLists || [];
    const id = "custom-" + Date.now();
    lists.push({
      id,
      name: "Custom List",
      url,
      enabled: true,
      category: "custom",
    });
    await browser.storage.local.set({ filterLists: lists });

    customListUrlInput.value = "";
    loadFilterLists();
    showStatus("Custom list added.");
  });

  // --- My Rules ---
  const whitelistInput = document.getElementById("whitelist-input");
  const addWhitelistBtn = document.getElementById("btn-add-whitelist");
  const whitelistContainer = document.getElementById("whitelist-container");
  const customRulesArea = document.getElementById("custom-rules");
  const saveRulesBtn = document.getElementById("btn-save-rules");

  async function loadWhitelist() {
    const { customRules } = await browser.storage.local.get("customRules");
    whitelistContainer.innerHTML = "";
    if (!customRules) return;

    const lines = customRules.split("\n");
    const whitelist = lines.filter(
      (l) => l.startsWith("@@||") && l.endsWith("^$document"),
    );

    whitelist.forEach((rule) => {
      const domain = rule.substring(4, rule.length - 10); // remove @@|| and ^$document
      const item = document.createElement("div");
      item.className = "whitelist-item";
      item.innerHTML = `
               <span>${domain}</span>
               <button class="remove-btn" data-rule="${rule}">&times;</button>
            `;
      whitelistContainer.appendChild(item);
    });

    whitelistContainer.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { customRules: current } =
          await browser.storage.local.get("customRules");
        const updated = current
          .split("\n")
          .filter((l) => l !== btn.dataset.rule)
          .join("\n");
        await browser.storage.local.set({ customRules: updated });
        loadWhitelist();
      });
    });
  }

  addWhitelistBtn.addEventListener("click", async () => {
    const domain = whitelistInput.value.trim();
    if (!domain) return;

    const { customRules } = await browser.storage.local.get("customRules");
    const rule = `@@||${domain}^$document`;
    const updated = (customRules || "") + "\n" + rule;

    await browser.storage.local.set({ customRules: updated });
    whitelistInput.value = "";
    loadWhitelist();
    showStatus(`${domain} whitelisted.`);

    // Notify background to re-apply immediately if needed
    browser.runtime.sendMessage({ type: "whitelistSite", domain });
  });

  saveRulesBtn.addEventListener("click", async () => {
    const rules = customRulesArea.value;
    await browser.storage.local.set({ customRules: rules });
    showStatus("Custom rules saved. Rebuilding engine...");
    await browser.runtime.sendMessage({ type: "rebuildEngine" });
  });

  // Load Custom Rules text
  const { customRules } = await browser.storage.local.get("customRules");
  if (customRules) customRulesArea.value = customRules;

  // --- Advanced / Import Export ---
  const exportBtn = document.getElementById("btn-export");
  const importBtn = document.getElementById("btn-import");
  const importFile = document.getElementById("import-file");

  exportBtn.addEventListener("click", async () => {
    const data = await browser.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adblock-rust-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await browser.storage.local.set(data);
      showStatus("Settings imported. Reloading...");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      showStatus("Import failed: " + err.message, "error");
    }
  });

  // Initial Load
  loadFilterLists();
  loadWhitelist();
});
