const fs = require("fs");
const path = require("path");
const fetch = require("cross-fetch");

// Map of filter lists to fetch
const FILTER_LISTS = [
  { name: "easylist", url: "https://easylist.to/easylist/easylist.txt" },
  { name: "easyprivacy", url: "https://easylist.to/easylist/easyprivacy.txt" },
  {
    name: "ublock-filters",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
  },
  {
    name: "ublock-badware",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
  },
  {
    name: "ublock-privacy",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
  },
  {
    name: "ublock-unbreak",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",
  },
  {
    name: "brave-unbreak",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-unbreak.txt",
  },
];

const OUTPUT_DIR = path.join(__dirname, "../chrome/rules");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "ruleset.json");

async function main() {
  console.log("Fetching and compiling filter lists for DNR...");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Fetch all lists
  const filterTexts = [];
  for (const list of FILTER_LISTS) {
    console.log(`Fetching ${list.name}...`);
    try {
      const response = await fetch(list.url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      filterTexts.push(text);
    } catch (e) {
      console.warn(`Failed to fetch ${list.name}:`, e.message);
    }
  }

  console.log(`Parsing ${filterTexts.length} lists...`);

  const rules = [];
  let ruleId = 1;

  const lines = filterTexts.join("\n").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("["))
      continue;

    // 1. Simple blocking filters: ||example.com^
    if (trimmed.startsWith("||") && trimmed.endsWith("^")) {
      const domain = trimmed.slice(2, -1);
      // Valid domain check (alphanumeric, dots, hyphens)
      if (/^[a-z0-9.-]+$/.test(domain)) {
        rules.push({
          id: ruleId++,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: domain,
            resourceTypes: [
              "sub_frame",
              "script",
              "image",
              "xmlhttprequest",
              "media",
              "object",
            ],
          },
        });
      }
    }
    // 2. Exact match blocking: |http://example.com/ads.js|
    else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const url = trimmed.slice(1, -1);
      rules.push({
        id: ruleId++,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: url,
          resourceTypes: [
            "sub_frame",
            "script",
            "image",
            "xmlhttprequest",
            "media",
            "object",
          ],
        },
      });
    }

    // Limit to 25k rules to safely stay under Chrome's limit for a single static ruleset
    if (ruleId > 25000) break;
  }

  console.log(`Generated ${rules.length} DNR rules.`);

  if (rules.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rules, null, 2));
    console.log(`Saved ruleset to ${OUTPUT_FILE}`);
  } else {
    console.warn("No rules generated!");
  }
}

main().catch((e) => console.error(e));
