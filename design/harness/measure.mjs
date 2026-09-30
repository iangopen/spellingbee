// Contrast of every visible text element, control edge and focus ring against
// the WORST pixel actually behind it ("worst" = the pixel giving the lowest
// ratio: the brightest glow for light text, the darkest line for dark text).
//
//   TARGET=prototype (default)  design/prototypes/blue-ribbon-glow, honeycomb
//                               lit to its peak everywhere (?peak=1)
//                               -> that folder's contrast.md / contrast.json
//   TARGET=app                  the REAL screens rendered by design/harness
//                               (run `npx vite --config design/harness/vite.config.ts`
//                               first; APP_URL overrides http://localhost:5199)
//                               -> design/baseline/contrast-app.md / .json
//
//   PW_MODULE=<playwright/index.mjs> [TARGET=app] node design/harness/measure.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

//   TARGET=hybrid               design/prototypes/honey-hybrid, all three
//                               variants (?v=a|b|c), bee on, ?peak=1
//                               -> contrast-a.md / -b.md / -c.md (+ .json)
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const TARGET = ["app", "hybrid"].includes(process.env.TARGET) ? process.env.TARGET : "prototype";
const VIEWS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const THEMES = ["dark", "light"];

const PROTO_DIR = resolve(TARGET === "hybrid" ? "design/prototypes/honey-hybrid" : "design/prototypes/blue-ribbon-glow");
const APP_URL = process.env.APP_URL || "http://localhost:5199";
const APP_SCREENS = ["home", "difficulty", "sp-round", "sp-correct", "sp-incorrect", "sp-results", "settings",
  "lobby", "waiting-room", "race-round", "race-locked", "race-roundend", "race-results",
  "elim-watch", "elim-myturn", "elim-results"];

const RUNS = [];
if (TARGET === "prototype") {
  for (const page of ["home", "round", "race-results"]) for (const theme of THEMES) for (const w of Object.keys(VIEWS))
    for (const bee of ["0", "1"]) for (const state of page === "round" ? ["", "correct", "incorrect"] : [""])
      RUNS.push({ page, theme, w, bee, state });
} else if (TARGET === "hybrid") {
  // The bee is part of the brief, so only bee=1 is measured.
  for (const v of ["a", "b", "c"]) for (const page of ["home", "round", "race-results"]) for (const theme of THEMES) for (const w of Object.keys(VIEWS))
    for (const state of page === "round" ? ["", "correct", "incorrect"] : [""])
      RUNS.push({ v, page, theme, w, bee: "1", state });
} else {
  for (const page of APP_SCREENS) for (const theme of THEMES) for (const w of Object.keys(VIEWS)) RUNS.push({ page, theme, w });
}
const urlFor = (r) => TARGET !== "app"
  ? `${pathToFileURL(resolve(PROTO_DIR, r.page + ".html")).href}?${new URLSearchParams({ ...(r.v ? { v: r.v } : {}), bg: "shimmer", peak: "1", bee: r.bee, theme: r.theme, ...(r.state ? { state: r.state } : {}) })}`
  : `${APP_URL}/?screen=${r.page}&theme=${r.theme}`;

// Worst-pixel sampler, run inside the page (Playwright serialises it).
const SAMPLE = async ({ png, targets }) => {
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + png; });
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return targets.map((t) => {
    if (!t.color) return { ...t, fg: null, worst: null, wp: null };
    const f = parse(t.color);
    let worst = Infinity, wp = null;
    const test = (px, py) => {
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
      const k = (py * img.width + px) * 4;
      const br = d[k], bg = d[k + 1], bb = d[k + 2];
      const fr = f.r * f.a + br * (1 - f.a), fg = f.g * f.a + bg * (1 - f.a), fb = f.b * f.a + bb * (1 - f.a);
      const a = L(fr, fg, fb), b = L(br, bg, bb);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < worst) { worst = ratio; wp = hex(br, bg, bb); }
    };
    if (t.rects) for (const [l, tp, rr, bt] of t.rects)
      for (let py = Math.floor(tp); py < Math.ceil(bt); py++) for (let px = Math.floor(l); px < Math.ceil(rr); px++) test(px, py);
    if (t.band) {
      // Pixels whose distance OUTSIDE the element's rounded outline is between
      // `inner` and `outer` (the band the edge or ring actually touches).
      const [l, tp, rr, bt, inner, outer, rad0] = t.band;
      const cx = (l + rr) / 2, cy = (tp + bt) / 2, hw = (rr - l) / 2, hh = (bt - tp) / 2;
      const rad = Math.min(rad0, hw, hh);
      const sdf = (px, py) => {
        const qx = Math.abs(px + 0.5 - cx) - (hw - rad), qy = Math.abs(py + 0.5 - cy) - (hh - rad);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      };
      for (let py = Math.floor(tp - outer - 1); py < Math.ceil(bt + outer + 1); py++)
        for (let px = Math.floor(l - outer - 1); px < Math.ceil(rr + outer + 1); px++) {
          const dist = sdf(px, py);
          if (dist >= inner && dist <= outer) test(px, py); // inner < 0 = reaches inside the edge
        }
    }
    return { ...t, fg: hex(f.r, f.g, f.b), worst: +worst.toFixed(2), wp };
  });
};

// Controls whose edge must meet 3:1 (1.4.11): anything marked data-ui, plus
// every text-like form control.
const EDGE_SELECTOR = '[data-ui], input:not([type=range]):not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea';

const browser = await chromium.launch();
const rows = [];

for (const r of RUNS) {
  const ctx = await browser.newContext({ viewport: VIEWS[r.w], deviceScaleFactor: 1, colorScheme: r.theme, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(urlFor(r), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  if (TARGET === "app" && r.page === "settings") await p.click(".settings-toggle");
  await p.waitForTimeout(300);

  // 1. Collect targets while everything is visible.
  const targets = await p.evaluate((EDGE_SELECTOR) => {
    const out = [];
    const visible = (el) => {
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
        if (e.classList.contains("sr-only")) return false;
      }
      return true;
    };
    const large = (cs) => { const s = parseFloat(cs.fontSize), wgt = Number(cs.fontWeight); return s >= 24 || (s >= 18.66 && wgt >= 700); };
    // With a modal dialog open, everything behind it is inert and dimmed on
    // purpose: measure only what is inside the dialog.
    const modal = document.querySelector("dialog:modal");
    const inScope = (el) => !modal || modal.contains(el);
    const nameOf = (el) => (el.dataset.ui || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || el.id || el.tagName).replace(/\s+/g, " ").trim().slice(0, 32);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (!t || !n.parentElement || n.parentElement.closest("svg, script, style, option")) continue;
      if (!visible(n.parentElement) || !inScope(n.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((b) => b.width > 1 && b.height > 1).map((b) => [b.left, b.top, b.right, b.bottom]);
      if (!rects.length) continue;
      const cs = getComputedStyle(n.parentElement);
      out.push({ kind: "text", label: t.slice(0, 48), color: cs.color, need: large(cs) ? 3 : 4.5, rects });
    }
    for (const inp of document.querySelectorAll("input")) {
      if (!inp.value || !visible(inp) || !inScope(inp) || ["range", "radio", "checkbox", "hidden"].includes(inp.type)) continue;
      const b = inp.getBoundingClientRect(), cs = getComputedStyle(inp);
      out.push({ kind: "text", label: `typed "${inp.value}"`, color: cs.color, need: large(cs) ? 3 : 4.5, rects: [[b.left + 16, b.top + 10, b.right - 60, b.bottom - 10]] });
    }
    for (const el of new Set(document.querySelectorAll(EDGE_SELECTOR))) {
      if (!visible(el) || !inScope(el)) continue;
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (parseFloat(cs.borderTopWidth) === 0) continue;
      el.dataset.edge = "";
      out.push({ kind: "edge", label: nameOf(el), color: cs.borderTopColor, need: 3, band: [b.left, b.top, b.right, b.bottom, -3, 2, parseFloat(cs.borderTopLeftRadius) || 0] });
    }
    for (const el of document.querySelectorAll("a[href], button, input, select")) {
      if (!visible(el) || !inScope(el)) continue;
      const b = el.getBoundingClientRect();
      const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      el.dataset.ringIdx = String(out.length);
      // Colour is read later, while the control is actually focused.
      out.push({ kind: "ring", idx: out.length, label: `focus ring: ${nameOf(el)}`, color: null, need: 3, band: [b.left, b.top, b.right, b.bottom, 3, 6, rad + 3] });
    }
    return out;
  }, EDGE_SELECTOR);

  // 2. Hide all text, icons, edges and rings; keep panels, scrims and the background.
  await p.addStyleTag({ content: `*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;outline-color:transparent!important}
    [data-edge]{border-color:transparent!important} *:focus{outline:none!important}` });
  await p.evaluate(() => { const s = [...document.querySelectorAll("style")].pop(); s.id = "measure-hide"; document.activeElement && document.activeElement.blur(); });
  await p.waitForTimeout(100);
  const png = (await p.screenshot()).toString("base64");

  // 3. Worst pixel per text / edge target.
  let results = await p.evaluate(SAMPLE, { png, targets });

  // 4. Focus rings in the REAL focused state: focus each control keyboard-style,
  // read its outline colour with the hiding style off, then hide the ring and
  // sample what it sits on. A control with no outline when focused is reported.
  for (let i = 0; i < results.length; i++) {
    if (results[i].kind !== "ring") continue;
    const info = await p.evaluate((idx) => {
      const el = document.querySelector(`[data-ring-idx="${idx}"]`);
      const hide = document.getElementById("measure-hide");
      if (!el) return null;
      hide.disabled = true;
      el.focus({ focusVisible: true, preventScroll: true });
      const cs = getComputedStyle(el);
      const res = { focused: document.activeElement === el, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
      hide.disabled = false;
      return res;
    }, results[i].idx);
    if (!info || !info.focused) { results[i] = { ...results[i], note: "could not focus" }; continue; }
    if (info.style === "none" || !info.width) { results[i] = { ...results[i], worst: null, note: "no outline when focused (focus shown some other way)" }; continue; }
    await p.waitForTimeout(60);
    const shot = (await p.screenshot()).toString("base64");
    const [res] = await p.evaluate(SAMPLE, { png: shot, targets: [{ ...targets[i], color: info.color }] });
    results[i] = { ...res, focused: true };
  }

  for (const res of results) rows.push({ ...r, ...res });
  await ctx.close();
}
await browser.close();

// One row per (theme, screen, kind, label, need): the minimum over widths,
// bee variants and states. Rings with no outline are listed separately.
function report(rows, v) {
const key = (x) => [x.theme, x.page, x.kind, x.label, x.need].join("|");
const agg = new Map();
for (const x of rows) {
  const k = key(x), cur = agg.get(k);
  const where = `${x.w}${x.bee === "1" ? ", bee" : ""}${x.state ? `, ${x.state}` : ""}`;
  if (!cur || (x.worst !== null && (cur.worst === null || x.worst < cur.worst))) agg.set(k, { ...x, where });
}
const all = [...agg.values()];
const list = all.filter((x) => x.worst !== null).sort((a, b) => a.theme.localeCompare(b.theme) || a.page.localeCompare(b.page) || a.kind.localeCompare(b.kind) || a.worst - b.worst);
const noOutline = all.filter((x) => x.kind === "ring" && x.worst === null);
const fails = list.filter((x) => x.worst < x.need);
const pages = TARGET === "app" ? APP_SCREENS : ["home", "round", "race-results"];
const VNAME = { a: "a, Hive (the old palette throughout)", b: "b, Honey and ribbon (honey leads, ribbon blue accent)", c: "c, Split (honey glow in dark, the old flat palette in light)" };
const title = TARGET === "hybrid" ? `Contrast over the honey honeycomb: variant ${VNAME[v]}` : TARGET === "prototype" ? "Contrast over the glowing honeycomb" : "Contrast baseline: the current app";
const intro = TARGET === "hybrid"
  ? "Every visible text element, control edge (including the answer field and every input border) and focus ring, measured against the **worst pixel behind it** with the honeycomb lit to its peak everywhere (`?peak=1`, the shimmer's full brightness on every cell). Each row is the minimum over desktop and phone and, on the round screen, the playing, correct and missed states. Bee on."
  : TARGET === "prototype"
  ? "Every visible text element, control edge and focus ring, measured against the **worst pixel behind it** with the honeycomb lit to its peak everywhere (`?peak=1`, the shimmer and reactive light's full brightness). Each row is the minimum over desktop and phone, bee and no bee, and, on the round screen, the playing, correct and missed states."
  : "The REAL screens (rendered from `src/` by `design/harness`, network modules stubbed), measured the same way as the prototype: every visible text element, control edge and focus ring against the **worst pixel behind it**. Each row is the minimum over desktop and phone.";
let md = `# ${title}\n\nGenerated by \`design/harness/measure.mjs\` (TARGET=${TARGET}). ${intro} Required: text 4.5:1, large text 3:1, edges and focus rings 3:1.\n\n**${list.length} measured pairs, ${fails.length} failing.** ${noOutline.length} focusable controls show focus without an outline (listed at the end). (${rows.length} raw measurements across ${RUNS.filter((r) => !v || r.v === v).length} renders.)\n`;
for (const theme of THEMES) for (const page of pages) {
  const sub = list.filter((y) => y.theme === theme && y.page === page);
  if (!sub.length) continue;
  md += `\n## ${theme}, ${page}\n\n| | Element | Text / edge colour | Worst pixel behind | Ratio | Needs | Worst case at |\n|---|---|---|---|---|---|---|\n`;
  for (const x of sub)
    md += `| ${x.worst >= x.need ? "PASS" : "**FAIL**"} | ${x.kind === "text" ? "" : `*${x.kind}:* `}${x.label.replace(/\|/g, "/")} | \`${x.fg}\` | \`${x.wp}\` | ${x.worst.toFixed(2)}:1 | ${x.need}:1 | ${x.where} |\n`;
}
if (noOutline.length) {
  md += `\n## Controls with no outline when focused\n\nFocus is shown some other way (a border colour, a background change). The contrast of that indicator isn't measured by this script.\n\n| Theme | Screen | Control |\n|---|---|---|\n`;
  for (const x of noOutline) md += `| ${x.theme} | ${x.page} | ${x.label.replace("focus ring: ", "")} |\n`;
}
const outDir = TARGET === "app" ? resolve("design/baseline") : PROTO_DIR;
const base = TARGET === "hybrid" ? `contrast-${v}` : TARGET === "prototype" ? "contrast" : "contrast-app";
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, `${base}.md`), md);
writeFileSync(resolve(outDir, `${base}.json`), JSON.stringify(all, null, 1));
console.log(`${TARGET}${v ? " " + v : ""}: ${list.length} measured pairs, ${fails.length} failing, ${noOutline.length} focusable without an outline`);
for (const f of fails) console.log(`FAIL ${f.theme} ${f.page} ${f.kind} "${f.label}" ${f.fg} on ${f.wp} = ${f.worst} (need ${f.need}) @ ${f.where}`);
}
if (TARGET === "hybrid") for (const v of ["a", "b", "c"]) report(rows.filter((x) => x.v === v), v);
else report(rows);
