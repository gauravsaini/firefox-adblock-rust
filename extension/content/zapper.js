// Adblock Rust - Element Picker/Zapper (uBOL-style slider architecture)
// Requires tool-overlay.js to have run first (sets self.adblockOverlay).

(async function adblockRustZapper() {

const overlay = self.adblockOverlay;
if (overlay === undefined) return;
if (overlay.file === 'zapper-ui.html') return;
overlay.file = 'zapper-ui.html';

/******************************************************************************/

// Attributes that get stored as [attr] without value (complex/URL values)
const ATTR_VALUE_EXCLUDED = ['sizes', 'srcset', 'href', 'src', 'action', 'data'];
// Selectors too generic to be useful
const EXCLUDED_SELECTORS = ['div', 'span', 'section', 'article', 'p', 'li', 'ul', 'ol', 'a', 'main', 'header', 'footer', 'nav', 'aside'];

/******************************************************************************/

// Build a CSS selector string from a partsDB Map and an array of addresses.
// Addresses encode: listIndex (8 bits) | partIndex (8 bits) | descriptor (4 bits)
// Descriptor: 0=tag, 1=id, 2=class, 3=attr, 4=nth-of-type
function selectorFromAddresses(partsDB, addresses) {
  const parts = [];
  let majorLast = -1;
  for (const address of addresses) {
    const major = address >>> 12;
    if (majorLast !== -1) {
      const delta = majorLast - major;
      if (delta > 1) {
        parts.push(' ');       // descendant combinator (gap in ancestors)
      } else if (delta === 1) {
        parts.push(' > ');     // child combinator (adjacent ancestors)
      }
    }
    majorLast = major;
    const part = partsDB.get(address);
    // Attribute parts: show just [name] not [name="value"] in selector
    parts.push((address & 0xF) === 3 ? `[${attrNameFromPart(part)}]` : part);
  }
  return parts.join('');
}

function attrNameFromPart(part) {
  // '[attr="val"]' → 'attr'   '[attr]' → 'attr'
  const eqPos = part.search(/\^?=/);
  if (eqPos !== -1) return part.slice(1, eqPos);
  return part.slice(1, -1);
}

/******************************************************************************/

// Generate candidates database for an element and its ancestors.
// Returns { partsDB (serialized), listParts, sliderParts, hostname }
function candidatesAtPoint(elem) {
  if (!(elem instanceof Element)) return null;

  const partsDB = new Map();
  const listParts = [];
  let curr = elem;

  while (curr && curr !== document.body) {
    const tagName = curr.localName;
    const addressMajor = listParts.length << 12;

    // Descriptor 0: tag name
    partsDB.set(addressMajor, CSS.escape(tagName));
    const parts = [addressMajor];

    // Descriptor 1: id
    if (typeof curr.id === 'string' && curr.id !== '') {
      const address = addressMajor | (parts.length << 4) | 1;
      partsDB.set(address, `#${CSS.escape(curr.id)}`);
      parts.push(address);
    }

    // Descriptor 2: classes
    for (const name of curr.classList.values()) {
      if (!name.trim()) continue;
      const address = addressMajor | (parts.length << 4) | 2;
      partsDB.set(address, `.${CSS.escape(name)}`);
      parts.push(address);
    }

    // Descriptor 3: attributes (skip id/class/style)
    for (const name of curr.getAttributeNames()) {
      if (name === 'id' || name === 'class' || name === 'style') continue;
      if (parts.length > 20) break; // cap attribute count per element
      const address = addressMajor | (parts.length << 4) | 3;
      if (ATTR_VALUE_EXCLUDED.includes(name)) {
        // Store [attr] without value
        partsDB.set(address, `[${CSS.escape(name)}]`);
      } else {
        let value = curr.getAttribute(name) || '';
        const nl = value.search(/[\n\r]/);
        if (nl !== -1) value = value.slice(0, nl);
        if (value.length > 100) {
          // Value too long - store without value
          partsDB.set(address, `[${CSS.escape(name)}]`);
        } else {
          partsDB.set(address, `[${CSS.escape(name)}="${CSS.escape(value)}"]`);
        }
      }
      parts.push(address);
    }

    // Descriptor 4: :nth-of-type (only if needed for disambiguation)
    const parentNode = curr.parentNode;
    if (parentNode) {
      const partsSel = selectorFromAddresses(partsDB, parts);
      try {
        const matches = parentNode.querySelectorAll(`:scope > ${partsSel}`);
        if (matches.length > 1) {
          let i = 1;
          let sib = curr;
          while ((sib = sib.previousElementSibling)) {
            if (sib.localName === tagName) i++;
          }
          const address = addressMajor | (parts.length << 4) | 4;
          partsDB.set(address, `:nth-of-type(${i})`);
          parts.push(address);
        }
      } catch (e) {}
    }

    listParts.push(parts);
    curr = curr.parentElement;
  }

  if (listParts.length === 0) return null;

  const sliderParts = buildSliderParts(partsDB, listParts);

  return {
    partsDB: Array.from(partsDB),
    listParts,
    sliderParts,
  };
}

/******************************************************************************/

// Build pre-computed slider positions: each position is an array of addresses
// that together form a CSS selector. Sorted from most specific to least specific.
function buildSliderParts(partsDB, listParts) {
  const n = listParts.length;

  // Generate all combinations of ancestor chains
  const sliderCandidates = [];
  for (let i = 0; i < n; i++) {
    sliderCandidates.push(listParts[i]);
    for (let j = i + 1; j < n; j++) {
      sliderCandidates.push([
        ...listParts[j],
        ...sliderCandidates[sliderCandidates.length - 1],
      ]);
    }
  }

  // For each candidate chain, extract meaningful selector paths
  const sliderMap = new Map();
  for (const candidates of sliderCandidates) {
    const hasId = candidates.some(a => (a & 0xF) === 1);
    const hasNth = candidates.some(a => (a & 0xF) === 4);
    const hasClass = candidates.some(a => (a & 0xF) === 2);
    const hasAttr = candidates.some(a => (a & 0xF) === 3);

    if (hasId) {
      // ID-only path: fastest, most specific
      const path = candidates.filter(a => (a & 0xF) === 1);
      sliderMap.set(JSON.stringify(path), 0);
    }
    if (hasNth) {
      // Tag + nth-of-type path: structurally precise
      const path = candidates.filter(a => { const t = a & 0xF; return t === 0 || t === 4; });
      sliderMap.set(JSON.stringify(path), 0);
    }
    if (hasClass) {
      // Tag + class path: semantic, maintainable
      const path = candidates.filter(a => { const t = a & 0xF; return t === 0 || t === 2; });
      sliderMap.set(JSON.stringify(path), 0);
    }
    if (hasAttr) {
      // Tag + attribute path
      const path = candidates.filter(a => { const t = a & 0xF; return t === 0 || t === 3; });
      sliderMap.set(JSON.stringify(path), 0);
    }
  }
  sliderMap.delete('[]');

  // Score and deduplicate: prefer fewer elements matched = more specific
  const elemToIdMap = new Map();
  const resultSetMap = new Map();
  let elemId = 1;

  for (const json of sliderMap.keys()) {
    const addresses = JSON.parse(json);
    const selector = selectorFromAddresses(partsDB, addresses);
    if (EXCLUDED_SELECTORS.includes(selector)) continue;

    let elems;
    try {
      elems = document.querySelectorAll(selector);
    } catch (e) { continue; }
    if (elems.length === 0) continue;

    const resultSet = [];
    for (const el of elems) {
      if (!elemToIdMap.has(el)) elemToIdMap.set(el, elemId++);
      resultSet.push(elemToIdMap.get(el));
    }
    const resultSetKey = JSON.stringify(resultSet.sort((a, b) => a - b));

    const current = resultSetMap.get(resultSetKey);
    if (current) {
      if (current.length < addresses.length) continue;
      if (current.length === addresses.length) {
        // Prefer class-based selectors over structural ones
        if (!addresses.some(a => (a & 0xF) === 2) && current.some(a => (a & 0xF) === 2)) continue;
      }
    }
    resultSetMap.set(resultSetKey, addresses);
  }

  // Sort: most specific (deepest + most parts) first → slider max = most specific
  return Array.from(resultSetMap.values()).sort((a, b) => {
    const amajor = (a[a.length - 1] || 0) >>> 12;
    const bmajor = (b[b.length - 1] || 0) >>> 12;
    if (amajor !== bmajor) return bmajor - amajor;
    const amajor0 = (a[0] || 0) >>> 12;
    const bmajor0 = (b[0] || 0) >>> 12;
    if (amajor0 !== bmajor0) return bmajor0 - amajor0;
    if (a.length !== b.length) return b.length - a.length;
    return 0;
  });
}

/******************************************************************************/

// Active preview style element
let previewStyleEl = null;

function setPreviewSelector(selector) {
  if (!previewStyleEl) {
    previewStyleEl = document.createElement('style');
    previewStyleEl.id = 'adblock-rust-preview';
    document.head.appendChild(previewStyleEl);
  }
  if (selector) {
    previewStyleEl.textContent = `${selector} { display: none !important; }`;
  } else {
    previewStyleEl.textContent = '';
  }
}

function clearPreview() {
  if (previewStyleEl) {
    previewStyleEl.remove();
    previewStyleEl = null;
  }
}

/******************************************************************************/

// Scroll-lock defeat: detects modal overlays and unlocks body scroll
function defeatScrollLock(elemToRemove) {
  const getStyleValue = (el, prop) => {
    const style = window.getComputedStyle(el);
    return style ? style[prop] : '';
  };

  let maybeScrollLocked = elemToRemove.shadowRoot instanceof DocumentFragment;
  if (!maybeScrollLocked) {
    let curr = elemToRemove;
    do {
      maybeScrollLocked =
        parseInt(getStyleValue(curr, 'zIndex'), 10) >= 1000 ||
        getStyleValue(curr, 'position') === 'fixed';
      curr = curr.parentElement;
    } while (curr !== null && !maybeScrollLocked);
  }

  if (!maybeScrollLocked) return;

  const doc = document;
  if (getStyleValue(doc.body, 'overflowY') === 'hidden') {
    doc.body.style.setProperty('overflow', 'auto', 'important');
  }
  if (getStyleValue(doc.body, 'position') === 'fixed') {
    doc.body.style.setProperty('position', 'initial', 'important');
  }
  if (getStyleValue(doc.documentElement, 'position') === 'fixed') {
    doc.documentElement.style.setProperty('position', 'initial', 'important');
  }
  if (getStyleValue(doc.documentElement, 'overflowY') === 'hidden') {
    doc.documentElement.style.setProperty('overflow', 'auto', 'important');
  }

  const hostname = window.location.hostname;
  chrome.runtime.sendMessage({
    type: 'createRule',
    rule: `${hostname}##body:style(overflow: auto !important; position: initial !important;)`,
  });
  chrome.runtime.sendMessage({
    type: 'createRule',
    rule: `${hostname}##html:style(overflow: auto !important; position: initial !important;)`,
  });
}

/******************************************************************************/

function onMessage(msg) {
  switch (msg.what) {

    case 'candidatesAtPoint': {
      // Iframe clicked an element: generate selector candidates and show picker dialog
      const elem = overlay.elementFromPoint(msg.mx, msg.my);
      if (!elem) break;
      const result = candidatesAtPoint(elem);
      if (!result) break;
      overlay.highlightElements([elem]);
      overlay.port.postMessage({
        what: 'showPickerDialog',
        partsDB: result.partsDB,
        listParts: result.listParts,
        sliderParts: result.sliderParts,
        hostname: window.location.hostname,
      });
      break;
    }

    case 'highlightFromSelector': {
      // Iframe wants to highlight elements matching a selector + get count
      const { selector, msgId } = msg;
      // Empty selector = just clear highlights (querySelectorAll('') throws)
      if (!selector) {
        overlay.highlightElements([]);
        if (overlay.port && msgId != null) {
          overlay.port.postMessage({ what: 'highlightResult', count: 0, error: null, msgId });
        }
        break;
      }
      let count = 0;
      let error = null;
      let elems = [];
      try {
        elems = Array.from(document.querySelectorAll(selector));
        count = elems.length;
      } catch (e) {
        error = String(e);
      }
      overlay.highlightElements(elems);
      if (overlay.port && msgId != null) {
        overlay.port.postMessage({
          what: 'highlightResult',
          count,
          error,
          msgId,
        });
      }
      break;
    }

    case 'previewSelector': {
      setPreviewSelector(msg.selector || '');
      break;
    }

    case 'clearPreview': {
      clearPreview();
      break;
    }

    case 'createRule': {
      const { selector, hostname } = msg;
      if (!selector || !hostname) break;
      clearPreview();
      // Apply scroll-lock defeat if the currently highlighted element warrants it
      const highlightedEl = overlay.highlightedElements && overlay.highlightedElements[0];
      if (highlightedEl) defeatScrollLock(highlightedEl);
      // Create cosmetic filter rule: hostname##selector
      const rule = `${hostname}##${selector}`;
      chrome.runtime.sendMessage({ type: 'createRule', rule });
      // Immediately hide matching elements on this page
      try {
        const toHide = document.querySelectorAll(selector);
        for (const el of toHide) el.style.setProperty('display', 'none', 'important');
      } catch (e) {}
      overlay.stop();
      break;
    }

    case 'quitTool':
      clearPreview();
      break;

    default:
      break;
  }
}

/******************************************************************************/

await overlay.install('zapper-ui.html', onMessage);

/******************************************************************************/

})();
