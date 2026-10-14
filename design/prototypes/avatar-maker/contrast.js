// Silhouette contrast for every maker avatar (2 sets x 8 colours x 8 cosmetics), both themes,
// against every background a token sits on. Runs in the browser from disk (contrast.html);
// measure-contrast.mjs drives it headless and writes contrast.json / contrast.md.
//
// WHAT IS MEASURED (WCAG 1.4.11, non-text, 3:1). The thing a player must see is the bee's
// shape. Each avatar is rasterised at 3 px per viewBox unit with the theme's real token
// values (read from maker.css). Its silhouette is every pixel at >= 50% opacity. For every
// point on the silhouette's EDGE we take the best contrast, against the background, of any
// silhouette pixel within 4 units (12 px) inward: the outline stroke (2.9 units) or the fill
// just inside it. That edge point "reads" if that is >= 3:1. An avatar's figure is its WORST
// edge point, so a single invisible stretch of outline fails it. Anti-aliasing can't fail a
// point: the window always reaches fully opaque pixels.
//
// THE TOKEN HALO (the fix, 2026-10-13). The first run (contrast-before.md: the drawing alone,
// antennae left out) failed all 128 dark-theme avatars, the mascot's colour included: the
// cocoa stripes run into the cocoa outline, and on a dark panel that stretch of edge is 1.08:1.
// Tokens therefore draw the art through the #av-halo filter (index.html): feMorphology
// dilate, radius 1 CSS px (a RECTANGULAR kernel), flooded with --av-halo, under the drawing.
// This file models that filter exactly, at two box sizes: 30 px (the smallest token, the halo
// widest relative to the bee) and 140 px (the maker preview, the halo thinnest), and keeps the
// worse. The antennae are now INCLUDED in the silhouette. --av-halo is transparent in the
// light theme, so there the drawing is measured as it is.
(function () {
  "use strict";
  const { COLORS, SETS, makerSvg, CLIP_ID } = window.BeeMaker;
  const SCALE = 3, R = 12, VB = [12, 4, 76, 90];
  const W = VB[2] * SCALE, H = VB[3] * SCALE;

  const HALO_CSS_PX = 1, BOXES = [30, 140];
  const TOKENS = ["--av-halo", "--bee-body", "--bee-stripe", "--bee-wing", "--bee-line", "--bee-cheek", "--bee-eye", "--bee-leaf", "--mark",
    "--panel-solid", "--panel", "--bg-top", "--bg-bottom", "--av-1", "--av-2", "--av-3", "--av-4", "--av-5", "--av-6", "--av-7"];
  // The honeycomb's brightest line at its peak, from src/index.css (--cell-line-bright); the
  // panel is translucent, so the worst pixel behind it is this line, not the page colour.
  const CELL_BRIGHT = { dark: "rgba(255, 205, 120, 0.74)", light: "rgba(196, 124, 20, 0.46)" };

  function parse(c) {
    c = c.trim();
    if (c.startsWith("#")) return { rgb: [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255), a: 1 };
    const m = c.match(/rgba?\(([^)]+)\)/);
    const p = m[1].split(",").map((s) => parseFloat(s));
    return { rgb: p.slice(0, 3).map((v) => v / 255), a: p[3] ?? 1 };
  }
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const over = (top, under) => top.rgb.map((v, i) => v * top.a + under[i] * (1 - top.a));
  const hex = (rgb) => "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

  function readTokens(theme) {
    const root = document.documentElement;
    if (theme === "light") root.dataset.theme = "light"; else delete root.dataset.theme;
    const cs = getComputedStyle(root);
    return Object.fromEntries(TOKENS.map((t) => [t, cs.getPropertyValue(t).trim()]));
  }

  function backgrounds(tok, theme) {
    const solid = parse(tok["--panel-solid"]).rgb, panel = parse(tok["--panel"]);
    const bgB = parse(tok["--bg-bottom"]).rgb, bgT = parse(tok["--bg-top"]).rgb;
    const cell = over(parse(CELL_BRIGHT[theme]), bgT);
    return [
      { id: "disc", label: "Token disc, tile and lane token (--panel-solid)", rgb: solid },
      { id: "panel", label: "Panel over the page (--panel over --bg-bottom)", rgb: over(panel, bgB) },
      { id: "peak", label: "Panel over the honeycomb's brightest line at its peak", rgb: over(panel, cell) },
    ];
  }

  function resolve(svg, tok) {
    return svg
      .replace(/var\((--[a-z0-9-]+)\)/g, (_, name) => tok[name] || "magenta")
      .split(CLIP_ID).join("c")
      .replace('width="100%" height="100%"', `width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"`);
  }

  function parseMaybe(c) { return !c || c === "transparent" ? { rgb: [0, 0, 0], a: 0 } : parse(c); }

  /** art over its halo: rectangular dilate of alpha by r raster px (separable max), flooded */
  function withHalo(px, halo, r) {
    if (halo.a === 0 || r < 1) return px;
    const n = W * H, a0 = new Float32Array(n), tmp = new Float32Array(n), dil = new Float32Array(n);
    for (let i = 0; i < n; i++) a0[i] = px[i * 4 + 3] / 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let m = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < W) m = Math.max(m, a0[y * W + xx]); } tmp[y * W + x] = m;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let m = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < H) m = Math.max(m, tmp[yy * W + x]); } dil[y * W + x] = m;
    }
    const out = new Uint8ClampedArray(px.length);
    for (let i = 0; i < n; i++) {
      const a = a0[i], h = dil[i] * halo.a, oa = a + h * (1 - a);
      for (let k = 0; k < 3; k++) out[i * 4 + k] = oa ? ((px[i * 4 + k] / 255) * a + halo.rgb[k] * h * (1 - a)) / oa * 255 : 0;
      out[i * 4 + 3] = oa * 255;
    }
    return out;
  }

  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const disk = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) disk.push(dy * W + dx);

  async function raster(svg) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H).data;
  }

  /** worst edge contrast of one raster against one background */
  function silhouette(px, bg) {
    const n = W * H, mask = new Uint8Array(n), con = new Float32Array(n), bl = lum(bg);
    for (let i = 0; i < n; i++) {
      const a = px[i * 4 + 3] / 255;
      if (a < 0.5) continue;
      mask[i] = 1;
      const c = [0, 1, 2].map((k) => (px[i * 4 + k] / 255) * a + bg[k] * (1 - a));
      con[i] = ratio(lum(c), bl);
    }
    let worst = Infinity, edges = 0, failing = 0, worstAt = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - W] || !mask[i + W];
      if (!edge) continue;
      edges++;
      let best = 0;
      for (const d of disk) {
        const j = i + d;
        if (j < 0 || j >= n || !mask[j]) continue;
        const dx = (j % W) - x;
        if (dx > R || dx < -R) continue; // wrapped round a row end
        if (con[j] > best) best = con[j];
      }
      if (best < 3) failing++;
      if (best < worst) { worst = best; worstAt = [+(x / SCALE + VB[0]).toFixed(1), +(y / SCALE + VB[1]).toFixed(1)]; }
    }
    return { worst: +worst.toFixed(2), edges, failing, worstAt };
  }

  async function run() {
    const out = { method: "worst silhouette edge point (antennae included, through the token halo); best contrast within 4 viewBox units inward; 3 px per unit; worst of 30 px and 140 px boxes", themes: {} };
    for (const theme of ["dark", "light"]) {
      const tok = readTokens(theme), bgs = backgrounds(tok, theme), halo = parseMaybe(tok["--av-halo"]);
      // raster px per CSS px in a square box of side b: the 76 x 90 viewBox is height-limited
      const radii = halo.a === 0 ? [0] : BOXES.map((b) => Math.max(1, Math.round(HALO_CSS_PX * (VB[3] / b) * SCALE)));
      const T = (out.themes[theme] = {
        backgrounds: bgs.map((b) => ({ id: b.id, label: b.label, hex: hex(b.rgb) })),
        halo: halo.a === 0 ? null : { hex: hex(halo.rgb), radiiRasterPx: radii, vs: bgs.map((b) => ({ bg: b.id, ratio: +ratio(lum(halo.rgb), lum(b.rgb)).toFixed(2) })) },
        antennae: bgs.map((b) => ({ bg: b.id, ratio: +ratio(lum(parse(tok["--bee-line"]).rgb), lum(b.rgb)).toFixed(2) })),
        bodyVsOutline: COLORS.map((c, i) => {
          const body = parse(i === 0 ? tok["--bee-body"] : tok[`--av-${i}`]).rgb;
          return { color: c.name, hex: hex(body), ratio: +ratio(lum(body), lum(parse(tok["--bee-line"]).rgb)).toFixed(2) };
        }),
        sets: {},
      });
      for (const set of Object.keys(SETS)) {
        const cells = [];
        for (let c = 0; c < 8; c++) for (let k = 0; k < 8; k++) {
          const raw = await raster(resolve(makerSvg(c, k, set), tok));
          const per = radii.flatMap((r) => { const px = withHalo(raw, halo, r); return bgs.map((b) => ({ bg: b.id, haloPx: r, ...silhouette(px, b.rgb) })); });
          const w = per.reduce((m, p) => (p.worst < m.worst ? p : m));
          cells.push({ color: COLORS[c].name, cosmetic: SETS[set].items[k].name, c, k, worst: w.worst, worstBg: w.bg, worstAt: w.worstAt, failingEdges: w.failing, edges: w.edges, per });
        }
        T.sets[set] = cells;
      }
    }
    delete document.documentElement.dataset.theme;
    out.failures = [];
    for (const [theme, T] of Object.entries(out.themes)) for (const [set, cells] of Object.entries(T.sets)) for (const x of cells) if (x.worst < 3) out.failures.push({ theme, set, color: x.color, cosmetic: x.cosmetic, worst: x.worst, bg: x.worstBg, at: x.worstAt });
    return out;
  }

  function table(cells, set) {
    const items = SETS[set].items;
    let h = `<table><caption></caption><thead><tr><th scope="col">Colour \\ cosmetic</th>${items.map((i) => `<th scope="col">${i.name}</th>`).join("")}</tr></thead><tbody>`;
    for (let c = 0; c < 8; c++) {
      h += `<tr><th scope="row">${COLORS[c].name}</th>`;
      for (let k = 0; k < 8; k++) {
        const x = cells[c * 8 + k];
        h += `<td class="${x.worst < 3 ? "fail" : "pass"}" title="worst on ${x.worstBg} at ${x.worstAt}">${x.worst.toFixed(2)}${x.worst < 3 ? " ✗" : ""}</td>`;
      }
      h += "</tr>";
    }
    return h + "</tbody></table>";
  }

  async function main() {
    const status = document.getElementById("status");
    const t0 = performance.now();
    const res = await run();
    res.ms = Math.round(performance.now() - t0);
    window.__contrast = res;
    const out = document.getElementById("out");
    let html = `<p><b>${res.failures.length === 0 ? "0 failures" : res.failures.length + " failures"}</b> across ${2 * 2 * 64} measurements (2 themes × 2 sets × 64), each the worst of 3 backgrounds. Took ${res.ms} ms.</p>`;
    for (const [theme, T] of Object.entries(res.themes)) {
      html += `<h2>${theme === "dark" ? "Dark" : "Light"} theme</h2><p class="bgs">Backgrounds: ${T.backgrounds.map((b) => `${b.label} <code>${b.hex}</code>`).join("; ")}.</p>`;
      for (const set of Object.keys(SETS)) html += `<h3>${SETS[set].label}</h3>` + table(T.sets[set], set).replace("<caption></caption>", `<caption>${theme} theme, ${SETS[set].label}: worst silhouette edge contrast</caption>`);
      html += `<p>Body against the outline (the spec's 3:1 rule): ${T.bodyVsOutline.map((b) => `${b.color} ${b.ratio}`).join(", ")}.</p>`;
      html += `<p>Antennae (--bee-line, every bee including the mascot) against the backgrounds: ${T.antennae.map((a) => `${a.bg} ${a.ratio}`).join(", ")}.</p>`;
    }
    out.innerHTML = html;
    status.textContent = "Done.";
    document.body.dataset.done = "1";
  }
  main().catch((e) => { document.getElementById("status").textContent = "Error: " + e.message; document.body.dataset.done = "error"; });
})();
