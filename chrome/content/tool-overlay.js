// Adblock Rust - iframe overlay manager (adapted from uBlock Origin Lite)
// Creates an isolated iframe with secret attributes immune to host page CSS.
// Establishes MessageChannel and handles SVG ocean/islands highlighting.

(function adblockRustOverlay() {

if (self.adblockOverlay) {
  self.adblockOverlay.stop();
  self.adblockOverlay = undefined;
}

self.adblockOverlay = {
  frame: null,
  port: null,
  highlightedElements: [],
  onmessage: null,

  // Random secret attribute so host page CSS can't target our iframe
  secretAttr: (function () {
    let s = String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    while (s.length < 12) {
      s += (Math.floor(Math.random() * 2147483647) + 2147483647)
        .toString(36)
        .slice(2);
    }
    return s;
  })(),

  // Add page-level event listeners for scroll/resize/keyboard
  start() {
    self.addEventListener('scroll', this._onViewportChanged, { passive: true });
    self.addEventListener('resize', this._onViewportChanged, { passive: true });
    self.addEventListener('keydown', this._onKeyPressed, true);
  },

  stop() {
    self.removeEventListener('scroll', this._onViewportChanged, { passive: true });
    self.removeEventListener('resize', this._onViewportChanged, { passive: true });
    self.removeEventListener('keydown', this._onKeyPressed, true);
    if (this.frame) {
      this.frame.remove();
      this.frame = null;
    }
    if (this.port) {
      this.port.onmessage = null;
      this.port.onmessageerror = null;
      this.port = null;
    }
    this.onmessage = null;
    self.adblockOverlay = undefined;
  },

  // Standalone event handlers (use self.adblockOverlay explicitly, not `this`,
  // because they fire as raw addEventListener callbacks where `this` is wrong)
  _onViewportChanged() {
    self.adblockOverlay && self.adblockOverlay.highlightUpdate();
  },

  // Escape key on page: notify tool handler first (to clean up preview CSS etc.), then stop
  _onKeyPressed(ev) {
    if (ev.key !== 'Escape' && ev.which !== 27) return;
    ev.stopPropagation();
    ev.preventDefault();
    const ov = self.adblockOverlay;
    if (!ov) return;
    if (ov.onmessage) ov.onmessage({ what: 'quitTool' });
    ov.stop();
  },

  // Robustly get bounding rect; falls back through children for zero-size elements
  getElementBoundingClientRect(elem) {
    let rect = typeof elem.getBoundingClientRect === 'function'
      ? elem.getBoundingClientRect()
      : { height: 0, left: 0, top: 0, width: 0 };

    if (rect.width !== 0 && rect.height !== 0) return rect;

    let left = rect.left, right = left + rect.width,
        top = rect.top, bottom = top + rect.height;
    for (const child of elem.children) {
      const cr = this.getElementBoundingClientRect(child);
      if (cr.width === 0 || cr.height === 0) continue;
      if (cr.left < left) left = cr.left;
      if (cr.right > right) right = cr.right;
      if (cr.top < top) top = cr.top;
      if (cr.bottom > bottom) bottom = cr.bottom;
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  },

  // Recompute and send SVG ocean+islands paths to iframe for rendering
  highlightUpdate() {
    if (!this.port) return;
    const ow = self.innerWidth;
    const oh = self.innerHeight;
    const islands = [];
    for (const elem of this.highlightedElements) {
      const rect = this.getElementBoundingClientRect(elem);
      // Skip fully off-screen elements
      if (rect.left > ow) continue;
      if (rect.top > oh) continue;
      if (rect.left + rect.width < 0) continue;
      if (rect.top + rect.height < 0) continue;
      // Island rectangle drawn CW: creates a hole via SVG evenodd fill rule
      islands.push(
        `M${rect.left} ${rect.top}h${rect.width}v${rect.height}h-${rect.width}z`
      );
    }
    this.port.postMessage({
      what: 'svgPaths',
      // Ocean = outer viewport rect + island rects combined (evenodd creates holes)
      ocean: `M0 0h${ow}v${oh}h-${ow}z`,
      islands: islands.join(''),
    });
  },

  highlightElements(iter) {
    this.highlightedElements = Array.from(iter || []).filter(
      function (a) { return a instanceof Element && a !== self.adblockOverlay.frame; }
    );
    this.highlightUpdate();
  },

  // Temporarily disable pointer-events on our frame so elementFromPoint
  // sees through it to the actual page elements underneath.
  elementFromPoint(x, y) {
    if (x !== undefined) {
      this._lastX = x;
      this._lastY = y;
    } else if (this._lastX !== undefined) {
      x = this._lastX;
      y = this._lastY;
    } else {
      return null;
    }
    if (!this.frame) return null;

    this.frame.style.setProperty('pointer-events', 'none', 'important');
    let elem = document.elementFromPoint(x, y);
    this.frame.style.setProperty('pointer-events', 'auto', 'important');

    if (elem === document.body || elem === document.documentElement || elem === null) {
      return null;
    }
    return elem;
  },

  highlightElementAtPoint(x, y) {
    const elem = this.elementFromPoint(x, y);
    this.highlightElements(elem ? [elem] : []);
  },

  // Route messages arriving from the iframe via the port
  onPortMessage(data) {
    if (!data || !data.what) return;
    const msg = data;

    switch (msg.what) {
      case 'quitTool':
        // Let tool handler clean up first (e.g. remove preview CSS), then stop
        if (this.onmessage) this.onmessage(msg);
        this.stop();
        break;

      case 'highlightElementAtPoint':
        // Iframe reports mouse position → find element → send SVG paths back
        this.highlightElementAtPoint(msg.mx, msg.my);
        break;

      case 'unhighlight':
        this.highlightElements([]);
        break;

      default:
        // Delegate to tool-specific handler (zapper.js installs via install())
        if (this.onmessage) {
          this.onmessage(msg);
        }
        break;
    }
  },

  // Install the iframe overlay for a given extension page URL.
  // - pageUrl: path relative to extension root (e.g. 'zapper-ui.html')
  // - onmessage: handler for tool-specific messages (zapElementAtPoint, createRule, etc.)
  install(pageUrl, onmessage) {
    const overlay = this;

    return new Promise(function (resolve) {
      const frame = document.createElement('iframe');

      // Set all isolation styles with !important so host page CSS can't override.
      function applyFrameStyles() {
        const s = frame.style;
        s.setProperty('background', 'transparent', 'important');
        s.setProperty('border', '0', 'important');
        s.setProperty('border-radius', '0', 'important');
        s.setProperty('box-shadow', 'none', 'important');
        s.setProperty('color-scheme', 'light dark', 'important');
        s.setProperty('display', 'block', 'important');
        s.setProperty('filter', 'none', 'important');
        s.setProperty('height', '100vh', 'important');
        s.setProperty('left', '0', 'important');
        s.setProperty('margin', '0', 'important');
        s.setProperty('max-height', 'none', 'important');
        s.setProperty('max-width', 'none', 'important');
        s.setProperty('min-height', 'unset', 'important');
        s.setProperty('min-width', 'unset', 'important');
        s.setProperty('opacity', '1', 'important');
        s.setProperty('outline', '0', 'important');
        s.setProperty('padding', '0', 'important');
        s.setProperty('pointer-events', 'auto', 'important');
        s.setProperty('position', 'fixed', 'important');
        s.setProperty('top', '0', 'important');
        s.setProperty('transform', 'none', 'important');
        s.setProperty('visibility', 'visible', 'important');
        s.setProperty('width', '100%', 'important');
        s.setProperty('z-index', '2147483647', 'important');
      }

      frame.setAttribute(overlay.secretAttr, '');
      applyFrameStyles();

      const extensionUrl = chrome.runtime.getURL(pageUrl);
      // Extension origin for postMessage origin check in the iframe
      const extensionOrigin = chrome.runtime.getURL('/').replace(/\/$/, '');

      function onLoad() {
        frame.onload = null;
        const channel = new MessageChannel();
        const port = channel.port1;

        port.onmessage = function (ev) {
          overlay.onPortMessage(ev.data || {});
        };
        // If port errors, treat as quit
        port.onmessageerror = function () {
          overlay.stop();
        };

        // Send port2 to the iframe along with initial viewport info
        frame.contentWindow.postMessage(
          {
            what: 'startOverlay',
            url: document.baseURI,
            width: self.innerWidth,
            height: self.innerHeight,
          },
          extensionOrigin,
          [channel.port2]
        );

        frame.contentWindow.focus();
        overlay.onmessage = onmessage;
        overlay.port = port;
        overlay.frame = frame;

        // Start page-level listeners (scroll, resize, Escape key)
        overlay.start();

        resolve(true);
      }

      // Double-load trick: iframe first loads about:blank (bypassing page CSP
      // frame-src restrictions), then we navigate it to the extension URL.
      frame.onload = function () {
        frame.onload = onLoad;
        frame.contentWindow.location = extensionUrl;
      };

      // Append to <html> root (not <body>) to avoid body overflow:hidden affecting it
      document.documentElement.append(frame);
    });
  },
};

})();
