document.addEventListener("DOMContentLoaded", async () => {
  const listContainer = document.getElementById("filter-lists");
  const customUrlInput = document.getElementById("custom-list-url");
  const addListBtn = document.getElementById("btn-add-list");
  const updateListsBtn = document.getElementById("btn-update-lists");
  const customRulesEl = document.getElementById("custom-rules");
  const saveRulesBtn = document.getElementById("btn-save-rules");
  const whitelistContainer = document.getElementById("whitelist");
  const exportBtn = document.getElementById("btn-export");
  const importBtn = document.getElementById("btn-import");
  const importFile = document.getElementById("import-file");
  const statusMsg = document.getElementById("status-message");

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = "status-message " + type;
    setTimeout(() => {
      statusMsg.className = "status-message";
    }, 3000);
  }

  const CATEGORY_LABELS = {
    ads: "Ad Blocking",
    privacy: "Privacy",
    security: "Security",
    fixes: "Compatibility Fixes",
    youtube: "YouTube",
    annoyances: "Annoyances",
    custom: "Custom Lists",
  };

  // Load filter lists
  async function loadFilterLists() {
    const { filterLists } = await browser.storage.local.get("filterLists");
    listContainer.innerHTML = "";
    if (!filterLists) return;

    // Group by category
    const groups = {};
    for (const list of filterLists) {
      const cat = list.category || (list.id.startsWith("custom-") ? "custom" : "ads");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(list);
    }

    // Render by category
    const categoryOrder = ["ads", "privacy", "security", "fixes", "youtube", "annoyances", "custom"];
    for (const cat of categoryOrder) {
      if (!groups[cat] || groups[cat].length === 0) continue;
      const heading = document.createElement("h3");
      heading.className = "category-heading";
      heading.textContent = CATEGORY_LABELS[cat] || cat;
      listContainer.appendChild(heading);

      for (const list of groups[cat]) {
        const item = document.createElement("div");
        item.className = "filter-list-item";
        item.innerHTML = `
          <label>
            <input type="checkbox" data-id="${list.id}" ${list.enabled ? "checked" : ""}>
            <span>${list.name}</span>
          </label>
          ${list.id.startsWith("custom-") ? `<button class="remove-btn" data-id="${list.id}">&times;</button>` : ""}
        `;
        listContainer.appendChild(item);
      }
    }

    // Checkbox toggle
    listContainer.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const { filterLists: lists } = await browser.storage.local.get("filterLists");
        const list = lists.find((l) => l.id === cb.dataset.id);
        if (list) {
          list.enabled = cb.checked;
          await browser.storage.local.set({ filterLists: lists });
          showStatus("List toggled. Click 'Update all lists' to apply.", "success");
        }
      });
    });

    // Remove custom list
    listContainer.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { filterLists: lists } = await browser.storage.local.get("filterLists");
        const updated = lists.filter((l) => l.id !== btn.dataset.id);
        await browser.storage.local.set({ filterLists: updated });
        loadFilterLists();
        showStatus("List removed.", "success");
      });
    });
  }

  // Add custom list
  addListBtn.addEventListener("click", async () => {
    const url = customUrlInput.value.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      showStatus("Invalid URL", "error");
      return;
    }
    const { filterLists } = await browser.storage.local.get("filterLists");
    const lists = filterLists || [];
    const id = "custom-" + Date.now();
    lists.push({ id, name: url, url, enabled: true });
    await browser.storage.local.set({ filterLists: lists });
    customUrlInput.value = "";
    loadFilterLists();
    showStatus("Custom list added.", "success");
  });

  // Update all lists
  updateListsBtn.addEventListener("click", async () => {
    updateListsBtn.disabled = true;
    updateListsBtn.textContent = "Updating...";
    try {
      await browser.runtime.sendMessage({ type: "rebuildEngine" });
      showStatus("Filter lists updated and engine rebuilt.", "success");
    } catch (e) {
      showStatus("Update failed: " + e.message, "error");
    }
    updateListsBtn.disabled = false;
    updateListsBtn.textContent = "Update all lists now";
  });

  // Load custom rules
  const { customRules } = await browser.storage.local.get("customRules");
  if (customRules) {
    customRulesEl.value = customRules;
  }

  // Save custom rules
  saveRulesBtn.addEventListener("click", async () => {
    await browser.storage.local.set({ customRules: customRulesEl.value });
    showStatus("Custom rules saved. Click 'Update all lists' to apply.", "success");
  });

  // Load whitelist
  async function loadWhitelist() {
    const { customRules: rules } = await browser.storage.local.get("customRules");
    whitelistContainer.innerHTML = "";
    if (!rules) return;

    const whitelistRules = rules
      .split("\n")
      .filter((r) => r.startsWith("@@||") && r.endsWith("^$document"));

    for (const rule of whitelistRules) {
      const domain = rule.replace("@@||", "").replace("^$document", "");
      const item = document.createElement("div");
      item.className = "whitelist-item";
      item.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" data-domain="${domain}">&times;</button>
      `;
      whitelistContainer.appendChild(item);
    }

    whitelistContainer.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { customRules: r } = await browser.storage.local.get("customRules");
        const rule = "@@||" + btn.dataset.domain + "^$document";
        const updated = r
          .split("\n")
          .filter((line) => line !== rule)
          .join("\n");
        await browser.storage.local.set({ customRules: updated });
        loadWhitelist();
        showStatus("Domain removed from whitelist.", "success");
      });
    });
  }

  // Export
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

  // Import
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await browser.storage.local.set(data);
      showStatus("Settings imported. Rebuilding engine...", "success");
      await browser.runtime.sendMessage({ type: "rebuildEngine" });
      location.reload();
    } catch (err) {
      showStatus("Import failed: " + err.message, "error");
    }
  });

  // Initial load
  loadFilterLists();
  loadWhitelist();
});
