// Default filter lists — mirrors Brave's "default" and "default privacy" lists
// Source: https://github.com/brave/adblock-resources/blob/master/filter_lists/list_catalog.json
export const DEFAULT_LISTS = [
  // --- Brave Default Adblock Filters (uuid: "default") ---
  {
    id: "ublock-filters",
    name: "uBlock Origin Filters",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2020",
    name: "uBlock Origin Filters 2020",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2020.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2021",
    name: "uBlock Origin Filters 2021",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2021.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2022",
    name: "uBlock Origin Filters 2022",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2022.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2023",
    name: "uBlock Origin Filters 2023",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2023.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2024",
    name: "uBlock Origin Filters 2024",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2024.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2025",
    name: "uBlock Origin Filters 2025",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2025.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-2026",
    name: "uBlock Origin Filters 2026",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-2026.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-filters-general",
    name: "uBlock Origin Filters (general)",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters-general.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-badware",
    name: "uBlock Origin Badware",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
    enabled: true,
    category: "security",
  },
  {
    id: "ublock-resource-abuse",
    name: "uBlock Origin Resource Abuse",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt",
    enabled: true,
    category: "security",
  },
  {
    id: "ublock-quick-fixes",
    name: "uBlock Origin Quick Fixes",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "ublock-link-shorteners",
    name: "uBlock Origin Link Shorteners",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/ubo-link-shorteners.txt",
    enabled: true,
    category: "annoyances",
  },
  {
    id: "ublock-unbreak",
    name: "uBlock Origin Unbreak",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",
    enabled: true,
    category: "fixes",
  },
  {
    id: "easylist",
    name: "EasyList",
    url: "https://easylist.to/easylist/easylist.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "urlhaus",
    name: "URLhaus Malware Filter",
    url: "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-agh-online.txt",
    enabled: true,
    category: "security",
  },
  {
    id: "brave-unbreak",
    name: "Brave Unbreak",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-unbreak.txt",
    enabled: true,
    category: "fixes",
  },
  {
    id: "brave-specific",
    name: "Brave Specific Filters",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-specific.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "brave-social",
    name: "Brave Social Filters",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-social.txt",
    enabled: true,
    category: "annoyances",
  },
  {
    id: "brave-android-specific",
    name: "Brave Android Specific Filters",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-android-specific.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "brave-sugarcoat",
    name: "Brave Sugarcoat Rules",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-sugarcoat.txt",
    enabled: true,
    category: "fixes",
  },
  // --- Brave Default Privacy Filters (uuid: 4D715457) ---
  {
    id: "easyprivacy",
    name: "EasyPrivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt",
    enabled: true,
    category: "privacy",
  },
  {
    id: "ublock-privacy",
    name: "uBlock Origin Privacy",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
    enabled: true,
    category: "privacy",
  },

  // --- Brave First Party Filters (uuid: E99CBD02) ---
  {
    id: "brave-firstparty",
    name: "Brave First Party Filters",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-firstparty.txt",
    enabled: true,
    category: "ads",
  },
  {
    id: "brave-firstparty-regional",
    name: "Brave First Party Regional Filters",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-firstparty-regional.txt",
    enabled: true,
    category: "ads",
  },
];

// Optional lists — user can enable from options
export const OPTIONAL_LISTS = [
  // --- YouTube-specific lists ---
  {
    id: "yt-shorts",
    name: "YouTube Shorts Blocker",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/yt-shorts.txt",
    enabled: false,
    category: "youtube",
  },
  {
    id: "yt-playables",
    name: "YouTube Playables Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-playables.txt",
    enabled: false,
    category: "youtube",
  },
  {
    id: "yt-autodubbed",
    name: "YouTube Autodubbed Videos Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-autodubbed.txt",
    enabled: false,
    category: "youtube",
  },
  {
    id: "yt-endscreen",
    name: "YouTube End Video Elements Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-endscreen-elements.txt",
    enabled: false,
    category: "youtube",
  },
  {
    id: "yt-membersonly",
    name: "YouTube Members-Only Video Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-membersonly.txt",
    enabled: false,
    category: "youtube",
  },
  {
    id: "yt-thumbnails",
    name: "YouTube Thumbnail Image Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-nothumbnails.txt",
    enabled: false,
    category: "youtube",
  },

  // --- Annoyances ---
  {
    id: "cookie-notices",
    name: "Cookie Notice Blocker",
    url: "https://secure.fanboy.co.nz/fanboy-cookiemonster_ubo.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "ublock-annoyances-cookies",
    name: "uBlock Annoyances (Cookies)",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-cookies.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "brave-cookie-specific",
    name: "Brave Cookie Specific",
    url: "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/brave-cookie-specific.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "fanboy-annoyances",
    name: "Fanboy Annoyances",
    url: "https://secure.fanboy.co.nz/fanboy-annoyance_ubo.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "ublock-annoyances-others",
    name: "uBlock Annoyances (Others)",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "ai-suggestions",
    name: "AI Suggestions Blocker",
    url: "https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/fanboy-addon/fanboy_ai_suggestions.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "newsletter-popup",
    name: "Newsletter Popup Blocker",
    url: "https://secure.fanboy.co.nz/fanboy-newsletter.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "mobile-notifications",
    name: "Mobile App Promo Blocker",
    url: "https://secure.fanboy.co.nz/fanboy-mobile-notifications.txt",
    enabled: false,
    category: "annoyances",
  },
  {
    id: "social-media",
    name: "Social Media Blocker",
    url: "https://easylist.to/easylist/fanboy-social.txt",
    enabled: false,
    category: "annoyances",
  },
];

export async function fetchFilterList(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export async function getEnabledLists() {
  const stored = await chrome.storage.local.get("filterLists");
  if (stored.filterLists) {
    return stored.filterLists;
  }
  // Initialize with defaults + optional (disabled)
  const allLists = [...DEFAULT_LISTS, ...OPTIONAL_LISTS];
  await chrome.storage.local.set({ filterLists: allLists });
  return allLists;
}

export async function setFilterLists(lists) {
  await chrome.storage.local.set({ filterLists: lists });
}

export async function downloadAllEnabledLists() {
  const lists = await getEnabledLists();
  const results = [];
  for (const list of lists) {
    if (!list.enabled) continue;
    try {
      const text = await fetchFilterList(list.url);
      results.push({ id: list.id, text, format: "standard" });
      console.log(
        `[adblock-rust] Downloaded ${list.name} (${text.split("\n").length} lines)`,
      );
    } catch (e) {
      console.warn(`[adblock-rust] Failed to download ${list.name}:`, e);
    }
  }
  return results;
}
