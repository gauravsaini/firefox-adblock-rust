(function () {
  "use strict";

  if (!window.location.hostname.includes("youtube.com")) return;

  console.log("[adblock-rust][yt-fix] YouTube ad fix loaded");

  // ====================================================================
  // PART 1: Aggressive cosmetic hiding of ALL known YouTube ad elements
  // Applied immediately at document_start, before YouTube JS runs
  // ====================================================================
  const YT_AD_CSS = `
    /* Video ad overlays */
    .ad-showing .video-ads,
    .ad-showing .ytp-ad-module,
    .ytp-ad-overlay-container,
    .ytp-ad-text-overlay,
    .ytp-ad-overlay-ad-info-button-container,
    .ytp-ad-player-overlay,
    .ytp-ad-player-overlay-layout,
    .ytp-ad-action-interstitial,
    .ytp-ad-action-interstitial-background-container,
    .ytp-ad-image-overlay,
    .ytp-ad-text,
    .ytp-ad-preview-container,
    .ytp-ad-skip-button-container,
    .ytp-ad-skip-ad-slot,
    .ytp-ad-companion-slot,
    .ytp-ad-persistent-progress-bar-container,
    .ytp-ad-visit-advertiser-button,

    /* Feed/sidebar ads */
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer,
    ytd-statement-banner-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-sparkles-text-search-renderer,
    ytd-promoted-video-renderer,
    ytd-display-ad-renderer,
    ytd-companion-slot-renderer,
    ytd-action-companion-ad-renderer,
    ytd-player-legacy-desktop-watch-ads-renderer,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],

    /* Masthead */
    #masthead-ad,
    #player-ads,
    #panels > ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],

    /* Search result ads */
    ytd-search-pyv-renderer,

    /* Misc promo */
    ytd-mealbar-promo-renderer,
    ytd-popup-container:has(> ytd-consent-bump-v2-lightbox),
    tp-yt-paper-dialog:has(> #mealbar-promo-renderer),

    /* Mobile web */
    ytm-promoted-sparkles-web-renderer,
    ytm-companion-ad-renderer,

    /* Premium upsell */
    ytd-popup-container:has(ytd-enforcement-message-view-model),

    /* Shorts ads */
    ytd-reel-video-renderer:has(> .ytd-ad-slot-renderer) {
      display: none !important;
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.id = "adblock-rust-yt-fix";
  styleEl.textContent = YT_AD_CSS;
  (document.head || document.documentElement).appendChild(styleEl);
  console.log("[adblock-rust][yt-fix] YouTube ad CSS injected");

  // ====================================================================
  // PART 2: Video ad skipper
  // When YouTube loads a video ad, this detects it and forces a skip.
  // ====================================================================
  function trySkipAd() {
    const player = document.querySelector("#movie_player");
    if (!player) return false;

    // Check if ad is playing
    if (!player.classList.contains("ad-showing")) return false;

    // Try clicking skip button
    const skipBtn =
      document.querySelector(".ytp-ad-skip-button-modern") ||
      document.querySelector(".ytp-ad-skip-button") ||
      document.querySelector(".ytp-skip-ad-button") ||
      document.querySelector('button.ytp-ad-skip-button-modern') ||
      document.querySelector('[id="skip-button:8"]') ||
      document.querySelector(".ytp-ad-skip-button-container button");

    if (skipBtn) {
      skipBtn.click();
      console.log("[adblock-rust][yt-fix] Clicked skip button");
      return true;
    }

    // No skip button — force-end the ad via the video element.
    // IMPORTANT: YouTube uses two <video> elements: html5-main-video (first in DOM)
    // and html5-ad-video. querySelector("video") returns the main video, which when
    // jumped-to-end fires "ended" on the main content before it ever plays, leaving
    // the player in a broken finished state. Always target the ad video specifically.
    const adVideo =
      player.querySelector(".html5-ad-video") ||
      player.querySelector("video.ad-video") ||
      Array.from(player.querySelectorAll("video")).find(
        (v) => !v.paused && v.readyState >= 2,
      ) ||
      player.querySelector("video");

    if (adVideo && adVideo.duration && isFinite(adVideo.duration)) {
      adVideo.currentTime = adVideo.duration;
      return true;
    }

    // Mute the ad at minimum
    if (adVideo && !adVideo.muted) {
      adVideo.muted = true;
    }

    return false;
  }

  // After ad-showing is removed, ensure the main video actually starts.
  // YouTube sometimes leaves the main video paused after a forced ad-end.
  function recoverMainVideo() {
    const player = document.querySelector("#movie_player");
    if (!player || player.classList.contains("ad-showing")) return;
    const mainVideo =
      player.querySelector(".html5-main-video") ||
      player.querySelector("video");
    if (mainVideo && mainVideo.paused && mainVideo.readyState >= 3) {
      mainVideo.play().catch(() => {});
    }
  }

  // ====================================================================
  // PART 3: MutationObserver on #movie_player to detect ad-showing
  // ====================================================================
  function watchForAds() {
    const player = document.querySelector("#movie_player");
    if (!player) {
      setTimeout(watchForAds, 500);
      return;
    }

    let wasShowingAd = false;
    const observer = new MutationObserver(() => {
      const isShowingAd = player.classList.contains("ad-showing");

      if (isShowingAd) {
        wasShowingAd = true;
        // Try immediately, then retry a few times
        if (!trySkipAd()) {
          let retries = 0;
          const interval = setInterval(() => {
            if (trySkipAd() || !player.classList.contains("ad-showing") || retries > 20) {
              clearInterval(interval);
            }
            retries++;
          }, 300);
        }
      } else if (wasShowingAd) {
        // ad-showing just cleared — kick the main video if it's stuck paused
        wasShowingAd = false;
        setTimeout(recoverMainVideo, 200);
      }
    });

    observer.observe(player, { attributes: true, attributeFilter: ["class"] });

    // Also check immediately in case ad is already playing
    if (player.classList.contains("ad-showing")) {
      trySkipAd();
    }
  }

  // ====================================================================
  // PART 4: Intercept YouTube's ad-related API calls
  // Override fetch/XHR to block ad config requests
  // ====================================================================
  function injectAdInterceptor() {
    const script = document.createElement("script");
    script.textContent = `(function() {
      'use strict';

      // --- Intercept fetch to block ad-related endpoints ---
      const origFetch = window.fetch;
      window.fetch = function(...args) {
        const url = (typeof args[0] === 'string') ? args[0] : args[0]?.url || '';
        if (url.includes('/pagead/') ||
            url.includes('/ptracking') ||
            url.includes('/api/stats/ads') ||
            url.includes('/api/stats/atr') ||
            url.includes('get_midroll_') ||
            url.includes('googleads.g.doubleclick.net') ||
            url.includes('googlesyndication.com/pagead/')) {
          console.log('[adblock-rust][yt-fix][fetch-block]', url.substring(0, 100));
          return Promise.resolve(new Response('', { status: 200 }));
        }
        return origFetch.apply(this, args);
      };

      // --- Intercept XHR to block ad-related endpoints ---
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__adblockUrl = url;
        if (typeof url === 'string' && (
            url.includes('/pagead/') ||
            url.includes('/ptracking') ||
            url.includes('/api/stats/ads') ||
            url.includes('/api/stats/atr') ||
            url.includes('get_midroll_') ||
            url.includes('googleads.g.doubleclick.net'))) {
          console.log('[adblock-rust][yt-fix][xhr-block]', url.substring(0, 100));
          // Replace with a no-op URL
          return origOpen.call(this, method, 'data:text/plain,', ...rest);
        }
        return origOpen.call(this, method, url, ...rest);
      };

      // --- Neuter YouTube's ad player config ---
      // YouTube uses playerResponse.adPlacements to decide what ads to show.
      // We intercept JSON.parse to strip ad data from player responses.
      const origParse = JSON.parse;
      JSON.parse = function(text, ...rest) {
        const result = origParse.call(this, text, ...rest);
        if (result && typeof result === 'object') {
          // Strip ad placements from player response
          if (result.adPlacements) {
            delete result.adPlacements;
          }
          if (result.playerAds) {
            delete result.playerAds;
          }
          if (result.adSlots) {
            delete result.adSlots;
          }
          // Strip ad data from initial player response
          if (result.playerResponse) {
            if (result.playerResponse.adPlacements) {
              delete result.playerResponse.adPlacements;
            }
            if (result.playerResponse.playerAds) {
              delete result.playerResponse.playerAds;
            }
            if (result.playerResponse.adSlots) {
              delete result.playerResponse.adSlots;
            }
          }
        }
        return result;
      };

      console.log('[adblock-rust][yt-fix] Ad interceptors injected (fetch, XHR, JSON.parse)');
    })();`;

    // Must inject into page context (not content script sandbox)
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // ====================================================================
  // PART 5: Handle YouTube SPA navigation
  // YouTube doesn't do full page loads — it's a single-page app.
  // We need to re-check on navigation.
  // ====================================================================
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log("[adblock-rust][yt-fix] SPA navigation detected:", lastUrl);
      // Re-inject CSS (YouTube may have removed our style element)
      if (!document.getElementById("adblock-rust-yt-fix")) {
        const s = document.createElement("style");
        s.id = "adblock-rust-yt-fix";
        s.textContent = YT_AD_CSS;
        (document.head || document.documentElement).appendChild(s);
      }
    }
  });

  // ====================================================================
  // BOOT
  // ====================================================================
  function boot() {
    injectAdInterceptor();
    watchForAds();
    urlObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    // Inject interceptor ASAP — before YouTube's JS runs
    injectAdInterceptor();
    document.addEventListener("DOMContentLoaded", () => {
      watchForAds();
      urlObserver.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    boot();
  }
})();
