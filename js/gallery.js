// js/gallery.js — artwork pop-ups (one layout for every work)
(function () {
  const INTERVAL = 4000; // ms per image when autoplaying
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialogs = new Map();
  document.querySelectorAll('dialog.lb').forEach(d => dialogs.set(d.id, d));

  function setup(dialog) {
    if (dialog._wired) return;
    dialog._wired = true;

    const img = dialog.querySelector('[data-viewport] img');
    const thumbs = Array.from(dialog.querySelectorAll('[data-thumbs] button'));
    const count = dialog.querySelector('[data-count]');
    let index = 0;

    // —— Autoplay (only for works with more than one image) ——
    let timer = null;
    let playing = false;
    let auto = null, bar = null, playBtn = null;

    if (thumbs.length > 1) {
      auto = document.createElement('div');
      auto.className = 'lb-auto';
      auto.innerHTML =
        '<button class="lb-play" type="button" aria-label="Pause slideshow">❚❚</button>' +
        '<div class="lb-progress" aria-hidden="true"><span></span></div>';
      auto.style.setProperty('--lb-interval', INTERVAL + 'ms');
      (count || dialog.querySelector('[data-thumbs]')).after(auto);
      bar = auto.querySelector('.lb-progress span');
      playBtn = auto.querySelector('.lb-play');
      playBtn.addEventListener('click', () => (playing ? stop() : start()));
    }

    function restartBar() {
      if (!bar) return;
      bar.classList.remove('is-running');
      void bar.offsetWidth; // restart the CSS animation
      if (playing) bar.classList.add('is-running');
    }

    function start() {
      if (!auto) return;
      playing = true;
      auto.classList.remove('is-paused');
      playBtn.textContent = '❚❚';
      playBtn.setAttribute('aria-label', 'Pause slideshow');
      schedule();
    }

    function stop() {
      playing = false;
      clearTimeout(timer);
      if (!auto) return;
      auto.classList.add('is-paused');
      bar.classList.remove('is-running');
      playBtn.textContent = '▶';
      playBtn.setAttribute('aria-label', 'Play slideshow');
    }

    function schedule() {
      clearTimeout(timer);
      restartBar();
      if (playing) timer = setTimeout(() => show(index + 1, true), INTERVAL);
    }

    function show(i, fromAuto) {
      if (!thumbs.length) return;
      index = (i + thumbs.length) % thumbs.length;
      const btn = thumbs[index];

      if (img.getAttribute('src') !== btn.dataset.src && dialog.open && !reduceMotion.matches) {
        img.classList.add('is-swapping');
        setTimeout(() => {
          img.src = btn.dataset.src;
          img.alt = btn.dataset.alt || '';
          img.classList.remove('is-swapping');
        }, 200);
      } else {
        img.src = btn.dataset.src;
        img.alt = btn.dataset.alt || '';
      }

      thumbs.forEach(b => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (count) count.textContent = `${index + 1} / ${thumbs.length}`;

      // A manual pick restarts the countdown so it doesn't jump right away
      if (fromAuto || playing) schedule();
    }

    thumbs.forEach((b, i) => b.addEventListener('click', () => show(i)));
    dialog.querySelector('[data-prev]')?.addEventListener('click', () => show(index - 1));
    dialog.querySelector('[data-next]')?.addEventListener('click', () => show(index + 1));
    dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));

    // Click on the empty space around the artwork closes
    const stage = dialog.querySelector('[data-viewport]');
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target === stage) dialog.close();
    });

    dialog.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      if (e.key === ' ' && auto && e.target === dialog) { e.preventDefault(); playing ? stop() : start(); }
    });

    dialog.addEventListener('close', stop);

    dialog._show = show;
    dialog._start = () => { if (!reduceMotion.matches) start(); else stop(); };
  }

  function open(id) {
    const dialog = dialogs.get(id);
    if (!dialog) return;
    setup(dialog);
    dialog._show(0);
    dialog.showModal();
    dialog._start();
  }

  document.querySelectorAll('.card-link[data-open]').forEach(btn => {
    btn.addEventListener('click', () => open(btn.dataset.open));
  });

  // Open from a link like arts.html#lb-swan
  if (location.hash) open(location.hash.slice(1));
})();
