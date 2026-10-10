// js/gallery.js — artwork pop-ups (one layout for every work)
(function () {
  const dialogs = new Map();
  document.querySelectorAll('dialog.lb').forEach(d => dialogs.set(d.id, d));

  function setup(dialog) {
    if (dialog._wired) return;
    dialog._wired = true;

    const img = dialog.querySelector('[data-viewport] img');
    const thumbs = Array.from(dialog.querySelectorAll('[data-thumbs] button'));
    const count = dialog.querySelector('[data-count]');
    let index = 0;

    function show(i) {
      if (!thumbs.length) return;
      index = (i + thumbs.length) % thumbs.length;
      const btn = thumbs[index];
      img.src = btn.dataset.src;
      img.alt = btn.dataset.alt || '';
      thumbs.forEach(b => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (count) count.textContent = `${index + 1} / ${thumbs.length}`;
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
    });

    dialog._show = show;
  }

  function open(id) {
    const dialog = dialogs.get(id);
    if (!dialog) return;
    setup(dialog);
    dialog._show(0);
    dialog.showModal();
  }

  document.querySelectorAll('.card-link[data-open]').forEach(btn => {
    btn.addEventListener('click', () => open(btn.dataset.open));
  });

  // Open from a link like arts.html#lb-swan
  if (location.hash) open(location.hash.slice(1));
})();
