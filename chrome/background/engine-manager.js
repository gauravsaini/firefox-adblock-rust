import init, { WasmFilterSet, WasmEngine } from "../pkg/adblock_wasm.js";
import { saveEngine, loadEngine } from "./storage.js";
import { downloadAllEnabledLists } from "./filter-lists.js";

let engine = null;
let engineReady = false;

export function getEngine() {
  return engine;
}

export function isReady() {
  return engineReady;
}

export async function waitForReady(timeoutMs = 10000) {
  if (engineReady) return;
  const start = Date.now();
  while (!engineReady && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

export async function initialize() {
  await init();

  // Try fast path: load serialized engine from cache, validate it against
  // current custom rules (so stale cache is detected and bypassed).
  const cached = await loadEngine();
  if (cached) {
    const { serialized, customRulesSnapshot } = cached;
    const { customRules = "" } = await chrome.storage.local.get("customRules");

    if (customRulesSnapshot === customRules && serialized instanceof Uint8Array) {
      try {
        // IMPORTANT: use same optimize flag as rebuildEngine (true)
        const fs = new WasmFilterSet(false);
        engine = WasmEngine.fromFilterSet(fs, true);
        engine.deserialize(serialized);
        engineReady = true;
        console.log("[adblock-rust] Engine loaded from cache.");
        return;
      } catch (e) {
        console.warn("[adblock-rust] Cache deserialize failed, rebuilding:", e);
      }
    } else {
      console.log("[adblock-rust] Cache stale (custom rules changed), rebuilding.");
    }
  }

  await rebuildEngine();
}

export async function rebuildEngine() {
  const lists = await downloadAllEnabledLists();

  const filterSet = new WasmFilterSet(false);
  for (const list of lists) {
    try {
      filterSet.addFilters(list.text, list.format);
    } catch (e) {
      console.warn(`[adblock-rust] Failed to parse ${list.id}:`, e);
    }
  }

  const { customRules = "" } = await chrome.storage.local.get("customRules");
  if (customRules) {
    filterSet.addFilters(customRules, "standard");
  }

  // Always use optimize: true — must match the flag used in initialize()
  engine = WasmEngine.fromFilterSet(filterSet, true);
  engineReady = true;

  // Persist serialized engine + snapshot of current custom rules so initialize()
  // can detect when a rebuild is needed on the next startup.
  try {
    const serialized = engine.serialize();
    await saveEngine({ serialized, customRulesSnapshot: customRules });
    console.log("[adblock-rust] Engine rebuilt and cached.");
  } catch (e) {
    console.warn("[adblock-rust] Failed to cache engine:", e);
  }
}

export function setupPeriodicUpdate() {
  chrome.alarms.create("update-filter-lists", { periodInMinutes: 24 * 60 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "update-filter-lists") {
      // Force-refresh all filter lists from network, then rebuild engine
      await downloadAllEnabledLists({ forceRefresh: true });
      await rebuildEngine();
    }
  });
}
