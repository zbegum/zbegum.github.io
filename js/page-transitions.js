// Direction-aware page transitions between the nav pages.
// Runs in <head> so it's ready before the new page's first render.
(function () {
  const ORDER = { "": 0, "index.html": 0, "about.html": 0, "home.html": 0, "research.html": 1, "arts.html": 2 };

  function rank(url) {
    const page = new URL(url, location.href).pathname.split("/").pop();
    return page in ORDER ? ORDER[page] : null;
  }

  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation) return;
    const from = navigation.activation.from;
    if (!from || !from.url) return;
    const a = rank(from.url);
    const b = rank(navigation.activation.entry.url);
    if (a === null || b === null || a === b) return;
    e.viewTransition.types.add(b > a ? "forward" : "backward");
  });
})();
