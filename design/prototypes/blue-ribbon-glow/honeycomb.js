// Builds the honeycomb background (decoration only) and runs its two live
// variants. No canvas, no libraries: one SVG tile as a CSS background, and
// transform-only motion.
(function () {
  const root = document.documentElement;

  // ---- 1. The tile: pointy-top hexagons, radius R. Width sqrt(3)R, height 3R.
  const R = 32;
  const W = Math.sqrt(3) * R;
  const H = 3 * R;
  const hex = (cx, cy) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 90);
      return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  const centers = [[0, 0], [W, 0], [W / 2, 1.5 * R], [0, 3 * R], [W, 3 * R]];
  const tile = (stroke, width) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${W.toFixed(2)}' height='${H}' viewBox='0 0 ${W.toFixed(2)} ${H}'>` +
        centers.map(([x, y]) => `<polygon points='${hex(x, y)}' fill='none' stroke='${stroke}' stroke-width='${width}'/>`).join("") +
        `</svg>`
    )}")`;
  function paintTiles() {
    const cs = getComputedStyle(root);
    root.style.setProperty("--hex-tile", tile(cs.getPropertyValue("--cell-line").trim(), 1.4));
    root.style.setProperty("--hex-tile-bright", tile(cs.getPropertyValue("--cell-line-bright").trim(), 1.8));
    root.style.setProperty("--hex-size", `${W.toFixed(2)}px ${H}px`);
  }

  // ---- 2. The DOM: fixed, aria-hidden, first child of <body>.
  const bg = document.createElement("div");
  bg.className = "bg";
  bg.setAttribute("aria-hidden", "true");
  bg.innerHTML = `
    <div class="bg-base"></div>
    <div class="bg-cells-glow"></div><div class="bg-cells"></div>
    <div class="bg-light sweep"><div class="lit lit-glow"></div><div class="lit"></div></div>
    <div class="bg-light spot"><div class="lit lit-glow"></div><div class="lit"></div></div>
    <div class="bg-depth"></div>`;
  document.body.prepend(bg);
  paintTiles();
  // Theme changes (OS or ?theme) need the tile recoloured.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintTiles);

  // ---- 3. Pause every animation while the tab is hidden.
  function syncVisibility() {
    if (document.visibilityState === "hidden") root.dataset.paused = "";
    else delete root.dataset.paused;
  }
  document.addEventListener("visibilitychange", syncVisibility);
  syncVisibility();

  // ---- 4. Reactive variant.
  if (root.dataset.bg !== "reactive") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer: fine)").matches;
  root.dataset.pointer = fine ? "fine" : "coarse";
  const set = (x, y) => {
    root.style.setProperty("--sx", `${Math.round(x)}px`);
    root.style.setProperty("--sy", `${Math.round(y)}px`);
  };
  // Rest position: behind the element that matters on this screen.
  function rest() {
    const t = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.querySelector("[data-spot-rest]");
    if (!t) return set(innerWidth / 2, innerHeight * 0.3);
    const r = t.getBoundingClientRect();
    set(r.left + r.width / 2, r.top + r.height / 2);
  }
  rest();
  addEventListener("resize", rest);
  if (!fine || reduce.matches) {
    // Touch, or reduced motion: no continuous tracking. The light only moves
    // when focus moves (and under reduced motion it isn't shown at all).
    document.addEventListener("focusin", rest);
    return;
  }
  // Mouse: ease toward the pointer, one rAF write per frame at most, and
  // stop the loop entirely once it has settled or the tab is hidden.
  let tx = innerWidth / 2, ty = innerHeight * 0.3, x = tx, y = ty, raf = 0;
  function step() {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    set(x, y);
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 && document.visibilityState === "visible"
      ? requestAnimationFrame(step) : 0;
  }
  addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: true });
})();
