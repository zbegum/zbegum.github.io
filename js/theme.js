// Dark/light toggle. The initial theme is applied by an inline <head> script
// (before first paint); this file wires up the button and saves the choice.
(function () {
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function sync() {
    const light = root.getAttribute("data-theme") === "light";
    btn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    btn.title = btn.getAttribute("aria-label");
  }

  function apply(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
    btn.classList.remove("is-switching");
    void btn.offsetWidth; // restart the icon animation
    btn.classList.add("is-switching");
  }

  btn.addEventListener("click", function () {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";

    if (reduceMotion.matches) return apply(next);

    // Circular reveal growing out of the toggle button
    if (document.startViewTransition) {
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

      root.classList.add("theme-vt");
      const transition = document.startViewTransition(function () { apply(next); });
      transition.finished.finally(function () { root.classList.remove("theme-vt"); });
      transition.ready.then(function () {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      });
      return;
    }

    // Fallback: crossfade colors
    root.classList.add("theme-anim");
    apply(next);
    setTimeout(function () { root.classList.remove("theme-anim"); }, 450);
  });

  sync();
})();
