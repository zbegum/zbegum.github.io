// js/gallery.js
(function () {
  const openers = document.querySelectorAll('.card-link[data-open]');
  const dialogsById = new Map();

  document.querySelectorAll('dialog.lb').forEach(d => {
    dialogsById.set(d.id, d);
    // Close on backdrop click
    d.addEventListener('click', e => {
      if (e.target === d) d.close();
    });
    // Close buttons
    d.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => d.close());
    });
  });

  openers.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open');
      const dlg = dialogsById.get(id);
      if (!dlg) return;
      setupGallery(dlg);
      dlg.showModal();
      // ensure first layout sizing
      centerControlsToImage(dlg);
    });
  });

  function setupGallery(dialog) {
    if (dialog._wired) return; // init once
    dialog._wired = true;

    const body = dialog.querySelector('[data-gallery]');
    const viewport = body?.querySelector('[data-viewport]');
    const img = viewport?.querySelector('img');
    const prev = dialog.querySelector('[data-prev]');
    const next = dialog.querySelector('[data-next]');

    // Gather all thumb containers in this dialog (aside, vertical rail, overview)
    const thumbGroups = Array.from(dialog.querySelectorAll('[data-thumbs]'));
    // Flatten all buttons to build the ordered src list (unique by src order)
    const allThumbButtons = thumbGroups.flatMap(g => Array.from(g.querySelectorAll('button[data-src]')));
    let sources = [];

    if (allThumbButtons.length) {
      const seen = new Set();
      allThumbButtons.forEach(b => {
        const s = b.getAttribute('data-src');
        if (s && !seen.has(s)) { seen.add(s); sources.push(s); }
      });
    } else if (img?.getAttribute('src')) {
      sources = [img.getAttribute('src')];
    }

    // If the main <img> isn't in the list yet, prepend it
    const mainSrc = img?.getAttribute('src');
    if (mainSrc && !sources.includes(mainSrc)) sources.unshift(mainSrc);

    let index = Math.max(0, sources.indexOf(mainSrc || sources[0]));

    function setCurrent(i) {
      if (!img) return;
      index = (i + sources.length) % sources.length;
      const newSrc = sources[index];
      if (img.getAttribute('src') !== newSrc) img.setAttribute('src', newSrc);

      // Update aria-current across ALL groups
      thumbGroups.forEach(group => {
        const btns = Array.from(group.querySelectorAll('button[data-src]'));
        btns.forEach(b => {
          const isActive = b.getAttribute('data-src') === newSrc;
          if (isActive) b.setAttribute('aria-current', 'true');
          else b.removeAttribute('aria-current');
        });
      });

      // Recenter controls to current image width (after it loads/layouts)
      if (img.complete) centerControlsToImage(dialog);
      else img.onload = () => centerControlsToImage(dialog);
    }

    // Thumb clicks
    thumbGroups.forEach(group => {
      group.addEventListener('click', e => {
        const btn = e.target.closest('button[data-src]');
        if (!btn) return;
        const s = btn.getAttribute('data-src');
        const nextIdx = sources.indexOf(s);
        if (nextIdx >= 0) setCurrent(nextIdx);
      });
    });

    // Prev/Next
    prev?.addEventListener('click', e => { e.preventDefault(); setCurrent(index - 1); });
    next?.addEventListener('click', e => { e.preventDefault(); setCurrent(index + 1); });

    // Keyboard
    dialog.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setCurrent(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setCurrent(index + 1); }
      if (e.key === 'Escape') { dialog.close(); }
    });

    // Initial highlight + sizing
    setCurrent(index);

    // Resize handler (mobile rotations, etc.)
    window.addEventListener('resize', () => centerControlsToImage(dialog));
  }

  function centerControlsToImage(dialog) {
    const viewport = dialog.querySelector('[data-viewport]');
    const img = viewport?.querySelector('img');
    const ctrls = viewport?.querySelector('.lb-ctrls');
    if (!viewport || !img || !ctrls) return;

    // Compute visible image width inside its container
    // Use getBoundingClientRect to account for object-fit:contain
    const imgRect = img.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();

    // Clamp to viewport width to avoid overflow; set as CSS variable
    const effectiveWidth = Math.min(imgRect.width, vpRect.width);
    viewport.style.setProperty('--img-w', `${Math.round(effectiveWidth)}px`);
  }

  // Progressive enhancement: open via hash e.g., arts.html#lb-swan
  if (location.hash && dialogsById.has(location.hash.substring(1))) {
    const dlg = dialogsById.get(location.hash.substring(1));
    setupGallery(dlg);
    dlg.showModal();
    centerControlsToImage(dlg);
  }
})();

(function () {
  // Helpers
  const getThumbs = (dialog) =>
    Array.from(dialog.querySelectorAll('[data-thumbs] button'));

  const getCurrentIndex = (dialog, thumbs) => {
    // 1) use cached index if present
    if (dialog.dataset.currentIndex)
      return parseInt(dialog.dataset.currentIndex, 10);

    // 2) else use aria-current
    const byAria = thumbs.findIndex(b => b.getAttribute('aria-current') === 'true');
    if (byAria >= 0) return byAria;

    // 3) fallback: match main image src
    const main = dialog.querySelector('[data-viewport] img');
    const src = main?.getAttribute('src') || '';
    const bySrc = thumbs.findIndex(b => b.getAttribute('data-src') === src);
    return bySrc >= 0 ? bySrc : 0;
  };

  const setActive = (dialog, idx) => {
    const thumbs = getThumbs(dialog);
    if (!thumbs.length) return;

    // wrap index
    idx = (idx + thumbs.length) % thumbs.length;
    const target = thumbs[idx];

    // update main image
    const main = dialog.querySelector('[data-viewport] img');
    const newSrc = target.getAttribute('data-src');
    if (main && newSrc) main.src = newSrc;

    // update aria-current
    thumbs.forEach(b => b.removeAttribute('aria-current'));
    target.setAttribute('aria-current', 'true');

    // remember current
    dialog.dataset.currentIndex = String(idx);

    // keep active thumb visible (works for vertical rail or strips)
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };

  // Click on a thumbnail -> activate it
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-thumbs] button');
    if (!btn) return;
    const dialog = btn.closest('dialog.lb');
    if (!dialog) return;

    const thumbs = getThumbs(dialog);
    const idx = thumbs.indexOf(btn);
    if (idx >= 0) setActive(dialog, idx);
  });

  // Prev / Next buttons -> advance and sync highlight
  document.addEventListener('click', (e) => {
    const isPrev = e.target.closest('[data-prev]');
    const isNext = e.target.closest('[data-next]');
    if (!isPrev && !isNext) return;

    const dialog = e.target.closest('dialog.lb');
    if (!dialog) return;

    const thumbs = getThumbs(dialog);
    if (!thumbs.length) return;

    const curr = getCurrentIndex(dialog, thumbs);
    const delta = isNext ? 1 : -1;
    setActive(dialog, curr + delta);
  });

  // Optional: initialize each dialog once (sets first thumb active if none)
  window.addEventListener('load', () => {
    document.querySelectorAll('dialog.lb').forEach(dialog => {
      const thumbs = getThumbs(dialog);
      if (thumbs.length && !dialog.querySelector('[data-thumbs] button[aria-current="true"]')) {
        setActive(dialog, 0);
      }
    });
  });
})();