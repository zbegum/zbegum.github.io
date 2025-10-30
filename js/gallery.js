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
