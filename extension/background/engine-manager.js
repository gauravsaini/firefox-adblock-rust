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

export async function initialize() {
  await init();

  const cached = await loadEngine();
  if (cached) {
    try {
      const fs = new WasmFilterSet(false);
      engine = WasmEngine.fromFilterSet(fs, false);
      engine.deserialize(new Uint8Array(cached));
      engineReady = true;
      return;
    } catch (e) {
      console.warn("[adblock-rust] Cache deserialization failed, rebuilding:", e);
    }
  }

  await rebuildEngine();
}

export async function rebuildEngine() {
  const lists = await downloadAllEnabledLists();

  const filterSet = new WasmFilterSet(false);
  let totalRules = 0;
  for (const list of lists) {
    try {
      filterSet.addFilters(list.text, list.format);
      totalRules += list.text.split("\n").length;
    } catch (e) {
      console.warn(`[adblock-rust] Failed to parse ${list.id}:`, e);
    }
  }

  const { customRules } = await browser.storage.local.get("customRules");
  if (customRules) {
    filterSet.addFilters(customRules, "standard");
  }

  engine = WasmEngine.fromFilterSet(filterSet, true);
  engineReady = true;

  try {
    const serialized = engine.serialize();
    await saveEngine(serialized);
  } catch (e) {
    console.warn("[adblock-rust] Failed to cache engine:", e);
  }
}

export function setupPeriodicUpdate() {
  browser.alarms.create("update-filter-lists", { periodInMinutes: 24 * 60 });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "update-filter-lists") {
      await rebuildEngine();
    }
  });
}
