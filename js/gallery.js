// Minimal lightbox controller
(function(){
  const openers = document.querySelectorAll('[data-open]');
  const byId = id => document.getElementById(id);

  openers.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const d = byId(btn.getAttribute('data-open'));
      if (!d) return;
      d.showModal();
      wire(d);
    });
  });

  function wire(d){
    if (d._wired) return; d._wired = true;

    const view = d.querySelector('[data-viewport] img');
    const thumbs = Array.from(d.querySelectorAll('[data-thumbs] [data-src]')).map(b => b.getAttribute('data-src'));
    let i = 0;
    const set = n => { i = (n + thumbs.length) % thumbs.length; view.src = thumbs[i]; };

    d.querySelector('[data-prev]')?.addEventListener('click', ()=> set(i-1));
    d.querySelector('[data-next]')?.addEventListener('click', ()=> set(i+1));
    d.querySelector('[data-thumbs]')?.addEventListener('click', e=>{
      const b = e.target.closest('button[data-src]'); if(!b) return;
      const idx = thumbs.indexOf(b.getAttribute('data-src')); if (idx > -1) set(idx);
    });

    d.addEventListener('click', e=>{
      const r = d.getBoundingClientRect();
      if (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) d.close();
    });
    d.querySelector('[data-close]')?.addEventListener('click', ()=> d.close());
    d.addEventListener('keydown', e=>{
      if (e.key==='Escape') d.close();
      if (e.key==='ArrowLeft') set(i-1);
      if (e.key==='ArrowRight') set(i+1);
    });
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