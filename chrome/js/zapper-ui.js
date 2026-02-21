// Adblock Rust - Picker UI (uBOL-style slider interface)
// Runs inside the isolated iframe. Communicates via MessageChannel port.

(function () {

  // ---- DOM refs ----
  const svgOcean     = document.getElementById('svg-ocean');
  const svgIslands   = document.getElementById('svg-islands');
  const overlay      = document.getElementById('overlay');
  const panel        = document.getElementById('panel');
  const quitBtn      = document.getElementById('quit-btn');
  const slider       = document.getElementById('slider');
  const matchCount   = document.getElementById('match-count');
  const candidateUl  = document.getElementById('candidate-list');
  const btnPick      = document.getElementById('btn-pick');
  const btnPreview   = document.getElementById('btn-preview');
  const btnCreate    = document.getElementById('btn-create');
  const moreBtn      = document.getElementById('btn-more');
  const lessBtn      = document.getElementById('btn-less');
  const moreOrLess   = document.getElementById('more-or-less');

  // ---- State ----
  let port            = null;
  let selectorPartsDB = new Map();   // address (int) → selector part string
  let sliderParts     = [];          // array of address arrays (pre-computed combos)
  let sliderPartsPos  = -1;
  let currentHostname = '';
  let isPaused        = false;       // true when picker dialog is open
  let isPreviewing    = false;
  let msgIdCounter    = 1;
  let pendingMsgId    = null;
  let listExpanded    = false;       // More/Less toggle

  // ---- Port messaging ----
  function send(msg) {
    if (!port) return;
    port.postMessage(msg);
  }

  function sendWithResponse(msg) {
    return new Promise(function (resolve) {
      const msgId = msgIdCounter++;
      pendingMsgId = msgId;
      msg.msgId = msgId;
      send(msg);
      // Response will come via handleMessage 'highlightResult'
      pendingResolvers.set(msgId, resolve);
    });
  }
  const pendingResolvers = new Map();

  // ---- SVG highlighting ----
  function updateSvg(ocean, islands) {
    svgOcean.setAttribute('d', (ocean || '') + (islands || ''));
    svgIslands.setAttribute('d', islands || 'M0 0');
  }

  // ---- Selector reconstruction from active list parts ----
  // Builds the CSS selector string from <li> elements whose <span>s have class 'on'
  function selectorFromCandidates() {
    const parts = [];
    let prevLi = null;
    const lis = candidateUl.querySelectorAll('li');

    for (const li of lis) {
      const onSpans = li.querySelectorAll('span.on');
      if (onSpans.length === 0) continue;

      if (prevLi !== null) {
        if (li.previousElementSibling === prevLi) {
          parts.unshift(' > ');
        } else {
          parts.unshift(' ');
        }
      }

      const row = [];
      for (const span of onSpans) {
        row.push(span.textContent);
      }
      parts.unshift(row.join(''));
      prevLi = li;
    }

    return parts.join('');
  }

  // ---- Slider logic ----
  function updateSlider(i) {
    if (i === sliderPartsPos) return;
    sliderPartsPos = i;

    // Clear all 'on' classes
    candidateUl.querySelectorAll('[data-part].on').forEach(function (el) {
      el.classList.remove('on');
    });

    // Activate parts at this slider position
    const addresses = sliderParts[i];
    if (!addresses) return;
    for (const address of addresses) {
      const span = candidateUl.querySelector('[data-part="' + address + '"]');
      if (span) span.classList.add('on');
    }

    const selector = selectorFromCandidates();
    highlightCandidate(selector);
  }

  slider.addEventListener('input', function () {
    updateSlider(Math.round(slider.valueAsNumber));
  });

  // ---- Candidate list interaction ----
  // Click a span → toggle that selector part; click <li> → toggle all its parts
  candidateUl.addEventListener('click', function (ev) {
    const target = ev.target;

    if (target.tagName === 'SPAN' && target.dataset.part !== undefined) {
      target.classList.toggle('on');
      const selector = selectorFromCandidates();
      highlightCandidate(selector);
      return;
    }

    if (target.tagName === 'LI') {
      const spans = target.querySelectorAll('span[data-part]');
      const allOn = Array.from(spans).every(function (s) { return s.classList.contains('on'); });
      spans.forEach(function (s) {
        s.classList.toggle('on', !allOn);
      });
      const selector = selectorFromCandidates();
      highlightCandidate(selector);
    }
  });

  // ---- Request highlight + count for current selector ----
  function highlightCandidate(selector) {
    if (!selector) {
      send({ what: 'unhighlight' });
      setCount(0, null);
      btnCreate.disabled = true;
      return;
    }

    const msgId = msgIdCounter++;
    pendingResolvers.set(msgId, function (result) {
      setCount(result.count, result.error);
      btnCreate.disabled = !result.count || Boolean(result.error);
      if (isPreviewing) {
        send({ what: 'previewSelector', selector: selector });
      }
    });
    send({ what: 'highlightFromSelector', selector: selector, msgId: msgId });
  }

  function setCount(count, error) {
    if (error) {
      matchCount.textContent = 'Error';
      matchCount.title = error;
    } else {
      matchCount.textContent = String(count);
      matchCount.title = '';
    }
  }

  // ---- Dialog show/hide ----
  function showDialog(msg) {
    isPaused = true;

    // Rebuild partsDB from serialized array
    selectorPartsDB = new Map(msg.partsDB);
    currentHostname  = msg.hostname;
    sliderParts      = msg.sliderParts || [];
    sliderPartsPos   = -1;
    isPreviewing     = false;
    btnPreview.classList.remove('active');

    // Build the candidate list UI
    const listParts  = msg.listParts || [];
    candidateUl.innerHTML = '';

    for (const parts of listParts) {
      const li = document.createElement('li');
      for (const address of parts) {
        const raw = selectorPartsDB.get(address) || '';
        const span = document.createElement('span');
        span.dataset.part = String(address);
        // For attribute parts with value, show just [attr] as label
        if ((address & 0xF) === 3 && raw.includes('=')) {
          const eqPos = raw.search(/\^?=/);
          span.textContent = raw.slice(0, eqPos) + ']';
        } else {
          span.textContent = raw;
        }
        li.appendChild(span);
      }
      candidateUl.appendChild(li);
    }

    // Configure slider
    const last = Math.max(0, sliderParts.length - 1);
    slider.min   = '0';
    slider.max   = String(last);
    slider.value = String(last);
    slider.disabled = last === 0;

    // Expand the list by default if few items, collapse if many
    listExpanded = listParts.length <= 5;
    applyListExpansion();

    panel.style.display = 'flex';
    overlay.style.pointerEvents = 'none'; // Allow clicks through SVG to panel

    updateSlider(last);
  }

  function hideDialog() {
    isPaused = false;
    isPreviewing = false;
    btnPreview.classList.remove('active');
    panel.style.display = 'none';
    overlay.style.pointerEvents = 'auto';
    send({ what: 'clearPreview' });
    send({ what: 'unhighlight' });
    setCount(0, null);
    btnCreate.disabled = true;
  }

  // ---- More / Less ----
  function applyListExpansion() {
    if (listExpanded) {
      candidateUl.classList.add('expanded');
      moreOrLess.classList.add('has-less');
      moreOrLess.classList.remove('has-more');
    } else {
      candidateUl.classList.remove('expanded');
      moreOrLess.classList.remove('has-less');
      moreOrLess.classList.add('has-more');
    }
  }

  moreBtn.addEventListener('click', function () {
    listExpanded = true;
    applyListExpansion();
  });
  lessBtn.addEventListener('click', function () {
    listExpanded = false;
    applyListExpansion();
  });

  // ---- Buttons ----
  quitBtn.addEventListener('click', function () {
    send({ what: 'quitTool' });
  });

  btnPick.addEventListener('click', function () {
    hideDialog();
    send({ what: 'unhighlight' });
  });

  btnPreview.addEventListener('click', function () {
    isPreviewing = !isPreviewing;
    btnPreview.classList.toggle('active', isPreviewing);
    const selector = selectorFromCandidates();
    if (isPreviewing && selector) {
      send({ what: 'previewSelector', selector: selector });
    } else {
      send({ what: 'previewSelector', selector: '' });
    }
  });

  btnCreate.addEventListener('click', function () {
    const selector = selectorFromCandidates();
    if (!selector || !currentHostname) return;
    send({ what: 'createRule', selector: selector, hostname: currentHostname });
  });

  // ---- Mouse tracking (hover highlight while not paused) ----
  var mstrackerTimer;
  document.addEventListener('mousemove', function (ev) {
    if (isPaused) return;
    if (mstrackerTimer !== undefined) return;
    var mx = ev.clientX, my = ev.clientY;
    mstrackerTimer = requestAnimationFrame(function () {
      mstrackerTimer = undefined;
      send({ what: 'highlightElementAtPoint', mx: mx, my: my });
    });
  }, { passive: true });

  // ---- SVG click = request candidates ----
  overlay.addEventListener('click', function (ev) {
    if (isPaused) return;
    send({ what: 'candidatesAtPoint', mx: ev.clientX, my: ev.clientY });
  });

  // Touch support
  (function () {
    var sx = 0, sy = 0, t0 = 0;
    overlay.addEventListener('touchstart', function (ev) {
      sx = ev.touches[0].screenX;
      sy = ev.touches[0].screenY;
      t0 = ev.timeStamp;
    }, { passive: true });

    overlay.addEventListener('touchend', function (ev) {
      var ex = ev.changedTouches[0].screenX;
      var ey = ev.changedTouches[0].screenY;
      var dist = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
      if (dist >= 32 || ev.timeStamp - t0 >= 200) return;
      if (isPaused) return;
      send({ what: 'candidatesAtPoint', mx: ev.changedTouches[0].pageX, my: ev.changedTouches[0].pageY });
      ev.preventDefault();
    });
  })();

  // ---- Keyboard ----
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (isPaused) {
        hideDialog();
      } else {
        send({ what: 'quitTool' });
      }
      ev.preventDefault();
    }
  }, true);

  // ---- Incoming messages from content script ----
  function handleMessage(msg) {
    if (!msg || !msg.what) return;

    switch (msg.what) {
      case 'startTool': {
        var w = msg.width || window.innerWidth;
        var h = msg.height || window.innerHeight;
        svgOcean.setAttribute('d', 'M0 0h' + w + 'v' + h + 'h-' + w + 'z');
        break;
      }

      case 'svgPaths':
        updateSvg(msg.ocean, msg.islands);
        break;

      case 'showPickerDialog':
        showDialog(msg);
        break;

      case 'highlightResult': {
        const resolver = pendingResolvers.get(msg.msgId);
        if (resolver) {
          pendingResolvers.delete(msg.msgId);
          resolver(msg);
        }
        break;
      }

      case 'quitTool':
        hideDialog();
        break;
    }
  }

  // ---- Bootstrap ----
  window.addEventListener('message', function (ev) {
    var msg = ev.data || {};
    if (msg.what !== 'startOverlay') return;
    if (!Array.isArray(ev.ports) || ev.ports.length === 0) return;

    port = ev.ports[0];
    port.onmessage = function (portEv) {
      handleMessage(portEv.data || {});
    };
    port.onmessageerror = function () {
      send({ what: 'quitTool' });
    };

    handleMessage({
      what: 'startTool',
      width: msg.width || window.innerWidth,
      height: msg.height || window.innerHeight,
    });
  }, { once: true });

})();
