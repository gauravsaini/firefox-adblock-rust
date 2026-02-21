document.addEventListener("DOMContentLoaded", async () => {
  const toggleEl = document.getElementById("toggle-enabled");
  const countEl = document.getElementById("blocked-count");
  const statusEl = document.getElementById("status");
  const whitelistBtn = document.getElementById("btn-whitelist");
  const optionsBtn = document.getElementById("btn-options");
  const pickerBtn = document.getElementById("btn-picker");

  // Get current tab
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  // Get status from background
  try {
    const { enabled, ready, blockedCount } = await browser.runtime
      .sendMessage({
        type: "getBlockedCount",
        tabId: tab.id,
      })
      .then((r) => ({ enabled: true, ready: true, blockedCount: r.count }));

    const statusResp = await browser.runtime.sendMessage({ type: "getStatus" });

    toggleEl.checked = statusResp.enabled;
    countEl.textContent = blockedCount || 0;
    statusEl.textContent = statusResp.ready
      ? "Protection active"
      : "Initializing...";
  } catch (e) {
    statusEl.textContent = "Error loading status";
  }

  // Toggle
  toggleEl.addEventListener("change", async () => {
    const resp = await browser.runtime.sendMessage({ type: "toggleEnabled" });
    statusEl.textContent = resp.enabled
      ? "Protection active"
      : "Protection disabled";
  });

  // Whitelist
  whitelistBtn.addEventListener("click", async () => {
    if (tab.url) {
      try {
        const url = new URL(tab.url);
        await browser.runtime.sendMessage({
          type: "whitelistSite",
          domain: url.hostname,
        });
        statusEl.textContent = `${url.hostname} whitelisted`;
        whitelistBtn.disabled = true;
        whitelistBtn.textContent = "Whitelisted";
      } catch (e) {
        statusEl.textContent = "Failed to whitelist";
      }
    }
  });

  // Picker
  pickerBtn.addEventListener("click", () => {
    // Send message to background to inject picker
    browser.runtime.sendMessage({ type: "activatePicker", tabId: tab.id });
    window.close(); // Close popup
  });

  // Options
  optionsBtn.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });
});
