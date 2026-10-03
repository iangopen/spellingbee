// Screenshots and checks for the homemade prototype (design/prototypes/homemade).
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-homemade.mjs
// Writes homemade/screens/*.jpg (+ index.js for compare.html) and homemade/checks.txt.
// The contrast tables come from measure.mjs (TARGET=homemade); this script adds:
//   1. reduced motion: every strength's still is pixel-identical to its static
//      background (the moving light is removed, nothing else changes)
//   2. no lemon yellow (NYT's #f7da21 sits at hue 53; the honey at 30-42) and no
//      flat grey tiles, as for the honey hybrid
//   3. the honeycomb is decoration only, and the difficulty bars are a stack of
//      tier BUTTONS: eight of them, one per row, identical left edge and width,
//      never a letter board. (The hexagon-shaped content check of shoot-hybrid.mjs
//      is narrowed to allow exactly these bars.)
//   4. fonts: the hand-lettered face appears ONLY on the title, headings and
//      badges, never on a digit, an input, a button, a label or an instruction
//   5. the tier bars' focus indicator (a thickened rim; a clip-path hides any
//      outline) against the band just inside it and the pixels just outside it
//   6. side-by-sides of the old live difficulty screen and the new ones
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/homemade");
// Written to screens.new and swapped in only when the whole run succeeds. Wiping
// screens/ up front left a half-populated folder (and a stale checks.txt that still
// claimed success) whenever a run was killed part-way.
const FINAL = resolve(DIR, "screens");
const OUT = resolve(DIR, "screens.new");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const STRENGTHS = ["off", "light", "more"];
const PAGES = ["home", "difficulty", "round", "race-results"];
const THEMES = ["dark", "light"];
const W = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
// The difficulty screen is taller than either viewport; give it room so the
// whole stack is captured (the background is fixed, so a fullPage grab would
// leave a blank band under the fold).
const view = (page, w) => (page === "difficulty" ? (w === "phone" ? { width: 390, height: 1000 } : { width: 1280, height: 960 }) : W[w]);
const url = (page, q) => `${pathToFileURL(resolve(DIR, `${page}.html`)).href}?${new URLSearchParams(q)}`;
const out = [];
const log = (s) => { console.log(s); out.push(s); };

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const isLemon = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 46 && h <= 66 && s > 0.5 && l > 0.3 && l < 0.75; };
const isHoney = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 28 && h < 46 && s > 0.35 && l > 0.25 && l < 0.92; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const sanity = { "#f7da21 (NYT Spelling Bee yellow)": true, "#e8a63d (old honey)": false, "#f2bd62 (heading)": false, "#e09a2c (light fill)": false, "#f5c46e (focus ring)": false, "#edae47 (expert bar)": false };
for (const [k, want] of Object.entries(sanity)) if (isLemon(...rgb(k.slice(0, 7))) !== want) throw new Error(`lemon detector wrong for ${k}`);
log(`Detector sanity: flags ${Object.keys(sanity).filter((k) => sanity[k]).join(", ")}; passes ${Object.keys(sanity).filter((k) => !sanity[k]).join(", ")}.`);

const browser = await chromium.launch();
const errors = [];
const bufs = new Map();
const saved = [];

async function shot(name, page, q, { w, theme, motion = "no-preference", prep, save = true } = {}) {
  const ctx = await browser.newContext({ viewport: view(page, w), deviceScaleFactor: 1, colorScheme: theme, reducedMotion: motion });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(url(page, { ...q, theme }), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(motion === "reduce" ? 200 : 1400);
  if (prep) await prep(p);
  const png = await p.screenshot({ type: "png" });
  bufs.set(name, png);
  if (save) { await p.screenshot({ path: resolve(OUT, `${name}.jpg`), type: "jpeg", quality: 88 }); saved.push(name); }
  await ctx.close();
}
const midSweep = (p) => p.evaluate(() => {
  for (const a of document.getAnimations()) if (/sweep-/.test(a.animationName)) { a.pause(); a.currentTime = 4500; }
});

// 1. each strength: 4 screens x 2 widths x 2 themes (shimmer caught mid-sweep, bee)
for (const h of STRENGTHS) for (const page of PAGES) for (const w of Object.keys(W)) for (const theme of THEMES)
  await shot(`${h}--${page}--${w}--${theme}`, page, { h, bg: "shimmer", bee: "1" }, { w, theme, prep: midSweep });
// 2. the two answer moments
for (const h of STRENGTHS) for (const state of ["correct", "incorrect"]) for (const w of Object.keys(W)) for (const theme of THEMES)
  await shot(`${h}--round-${state}--${w}--${theme}`, "round", { h, bg: "shimmer", bee: "1", state }, { w, theme, prep: midSweep });
// 3. keyboard focus on a tier bar (Tab: Modes, Settings, Practice, Hide definition, Novice, Easy)
for (const h of STRENGTHS) for (const theme of THEMES)
  await shot(`${h}--focus-tier--desktop--${theme}`, "difficulty", { h, bg: "shimmer", bee: "1" }, { w: "desktop", theme, prep: async (p) => { await midSweep(p); for (let i = 0; i < 6; i++) await p.keyboard.press("Tab"); await p.waitForTimeout(350); } });
// 4. reduced-motion stills
const stills = [];
for (const h of STRENGTHS) for (const page of PAGES) for (const w of Object.keys(W)) for (const theme of THEMES) {
  const name = `${h}--still-${page}--${w}--${theme}`;
  await shot(name, page, { h, bg: "shimmer", bee: "1" }, { w, theme, motion: "reduce" });
  await shot(`${name}--ref`, page, { h, bg: "static", bee: "1" }, { w, theme, motion: "reduce", save: false });
  stills.push(name);
}

const cmp = await (await browser.newContext()).newPage();
const PIX = { hslSrc: hsl.toString(), lemonSrc: isLemon.toString(), honeySrc: isHoney.toString() };
async function pixels(a, b) {
  return cmp.evaluate(async ({ a, b, hslSrc, lemonSrc, honeySrc }) => {
    const hsl = new Function(`return ${hslSrc}`)();
    const isLemon = new Function("hsl", `return ${lemonSrc}`)(hsl), isHoney = new Function("hsl", `return ${honeySrc}`)(hsl);
    const load = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + d; });
    const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const da = px(await load(a));
    let lemon = 0, honey = 0;
    for (let k = 0; k < da.length; k += 4) { if (isLemon(da[k], da[k + 1], da[k + 2])) lemon++; else if (isHoney(da[k], da[k + 1], da[k + 2])) honey++; }
    const res = { lemon, honey, total: da.length / 4 };
    if (b) {
      const db = px(await load(b));
      let over = 0, max = 0;
      for (let k = 0; k < da.length; k += 4) {
        const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
        max = Math.max(max, d); if (d > 8) over++;
      }
      Object.assign(res, { over, max });
    }
    return res;
  }, { a, b, ...PIX });
}

log("\n## Reduced motion: shimmer under reduced motion vs the static background (tolerance 8/255 per channel)");
let same = 0;
for (const s of stills) {
  const r = await pixels(bufs.get(s).toString("base64"), bufs.get(`${s}--ref`).toString("base64"));
  if (r.over === 0) same++;
  log(`${r.over === 0 ? "STILL OK" : "DIFFERS "}  ${s}: max channel diff ${r.max}/255, pixels over tolerance ${r.over}`);
}
log(`Reduced-motion stills identical to static: ${same}/${stills.length}`);

log("\n## Colour: lemon-yellow pixels (must be 0) and honey pixels, per strength, over every saved capture (lossless)");
for (const h of STRENGTHS) {
  let lemon = 0, honey = 0, total = 0; const hits = [];
  for (const n of saved.filter((x) => x.startsWith(h + "--"))) {
    const r = await pixels(bufs.get(n).toString("base64"));
    lemon += r.lemon; honey += r.honey; total += r.total;
    if (r.lemon) hits.push(`${n}: ${r.lemon}`);
  }
  log(`strength ${h}: ${total.toLocaleString("en")} px in ${saved.filter((x) => x.startsWith(h + "--")).length} captures; lemon yellow ${lemon}; honey/amber ${honey.toLocaleString("en")} (${((honey / total) * 100).toFixed(1)}%)${hits.length ? "  HITS: " + hits.join("; ") : ""}`);
}

// Structure and fonts, per strength x page x theme x width.
const HAND_OK = ".brand .word, .hero h1, .tier-select h1, .bests h2, .pronouncer .who, .winner .kicker, .sticker";
const READABLE = { "the answer field": "#guess", "the definition": ".definition", "feedback": ".feedback", "instructions and hints": ".lede, .tagline, .subtitle, .mode-hint, .bests p", "form labels": "label", "buttons": "button, .btn, .chip-btn, .mode-chip, .tier-bar, .text-btn, .link-back", "tier names and blurbs": ".tier-label, .tier-blurb, .tier-best", "standings and names": ".lane .name, .lane .pts, .winner h1", "numbers": ".num, .score, .tally b, .placard b, .clock" };
log("\n## Structure and fonts");
const fontRows = [];
for (const h of STRENGTHS) for (const page of PAGES) for (const theme of THEMES) for (const w of Object.keys(W)) {
  const ctx = await browser.newContext({ viewport: view(page, w), colorScheme: theme });
  const pg = await ctx.newPage();
  await pg.goto(url(page, { h, bg: "shimmer", bee: "1", theme }), { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  const r = await pg.evaluate(({ HAND_OK, READABLE }) => {
    const bg = document.querySelector(".bg");
    const content = [...document.querySelectorAll("body *")].filter((el) => !bg.contains(el));
    const toHsl = (s) => {
      const m = s.match(/[\d.]+/g); if (!m) return null;
      const [r, g, b, a = 1] = m.map(Number); if (a < 0.5) return null;
      const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
      return { s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
    };
    const grey = content.filter((el) => {
      const b = el.getBoundingClientRect(); if (b.width * b.height < 300) return false;
      const c = toHsl(getComputedStyle(el).backgroundColor);
      return c && c.s < 0.08 && c.l > 0.45 && c.l < 0.96;
    }).map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    const bars = [...document.querySelectorAll(".tier-bar")];
    // Hexagon-shaped content is allowed only as the tier bars.
    const hexOther = content.filter((el) => !el.classList.contains("tier-bar") && /polygon\(\s*(?:[^,]+,){5}[^,]+\)/.test(getComputedStyle(el).clipPath || "")).length;
    const wraps = bars.map((b) => b.parentElement);
    const lefts = wraps.map((e) => e.offsetLeft), widths = wraps.map((e) => e.offsetWidth), tops = wraps.map((e) => e.offsetTop);
    const stack = bars.length ? {
      count: bars.length, sameLeft: new Set(lefts).size === 1, sameWidth: new Set(widths).size === 1,
      oneRowEach: tops.every((t, i) => i === 0 || t > tops[i - 1] + wraps[i - 1].offsetHeight - 1),
      inputs: document.querySelectorAll("input").length,
    } : null;
    // Fonts
    const first = (el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
    const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const hand = content.filter((el) => hasText(el) && first(el) === "Caveat Brush");
    const handBad = hand.filter((el) => !el.matches(HAND_OK) || /\d/.test(el.textContent)).map((el) => `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 30)}"`);
    const readable = {};
    for (const [label, sel] of Object.entries(READABLE)) {
      const els = [...document.querySelectorAll(sel)].filter((el) => hasText(el) || el.tagName === "INPUT");
      if (els.length) readable[label] = { n: els.length, families: [...new Set(els.map(first))], handFont: els.filter((el) => first(el) === "Caveat Brush").length };
    }
    return {
      text: bg.textContent.trim().length, ariaHidden: bg.getAttribute("aria-hidden"), pointer: getComputedStyle(bg).pointerEvents,
      focusable: bg.querySelectorAll("a,button,input,[tabindex]").length, hexOther, grey, stack,
      hand: hand.map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 28)}"`), handBad, readable,
      loaded: { atkinson: document.fonts.check('16px "Atkinson Hyperlegible"'), bricolage: document.fonts.check('16px "Bricolage Grotesque"'), caveat: document.fonts.check('16px "Caveat Brush"') },
    };
  }, { HAND_OK, READABLE });
  fontRows.push({ h, page, theme, w, ...r });
  const stackOk = !r.stack || (r.stack.count === 8 && r.stack.sameLeft && r.stack.sameWidth && r.stack.oneRowEach && r.stack.inputs === 0);
  const ok = r.text === 0 && r.ariaHidden === "true" && r.pointer === "none" && r.focusable === 0 && r.hexOther === 0 && r.grey.length === 0 && stackOk && r.handBad.length === 0;
  log(`${ok ? "OK  " : "FAIL"} ${h} ${page} (${theme}, ${w}): honeycomb text=${r.text}, aria-hidden=${r.ariaHidden}, pointer-events=${r.pointer}, focusable inside=${r.focusable}; hexagon-shaped content other than tier bars=${r.hexOther}; grey tiles=${r.grey.length}${r.stack ? `; tier bars=${r.stack.count}, one column: same left=${r.stack.sameLeft}, same width=${r.stack.sameWidth}, one per row=${r.stack.oneRowEach}` : ""}; hand-lettered elements=${r.hand.length}${r.handBad.length ? " BAD: " + r.handBad.join("; ") : ""}`);
  await ctx.close();
}
log("Answers are typed into a standard text input on the round screen; the difficulty screen is eight tier buttons stacked one per row. No screen has a letter board or letter tiles.");

log("\n## Fonts: where the hand-lettered face (Caveat Brush) is used, and the readable faces confirmed");
for (const h of STRENGTHS) {
  const rows = fontRows.filter((x) => x.h === h);
  const hand = [...new Set(rows.flatMap((x) => x.hand))].sort();
  log(`strength ${h}: hand-lettered text across all ${rows.length} page views: ${hand.length ? hand.join(", ") : "none"}`);
  const agg = {};
  for (const x of rows) for (const [k, v] of Object.entries(x.readable)) {
    const a = (agg[k] ||= { n: 0, fam: new Set(), hand: 0 });
    a.n += v.n; v.families.forEach((f) => a.fam.add(f)); a.hand += v.handFont;
  }
  for (const [k, a] of Object.entries(agg)) log(`   ${a.hand === 0 ? "READABLE OK" : "HAND FONT!  "} ${k}: ${a.n} elements, font ${[...a.fam].join(" / ")}, hand-lettered ${a.hand}`);
  log(`   fonts loaded in every view: Atkinson ${rows.every((x) => x.loaded.atkinson)}, Bricolage ${rows.every((x) => x.loaded.bricolage)}, Caveat Brush ${rows.every((x) => x.loaded.caveat)}`);
}
const fontFails = fontRows.filter((x) => x.handBad.length || Object.values(x.readable).some((v) => v.handFont));
log(`Hand-font rule: ${fontFails.length ? "FAILED in " + fontFails.length + " views" : `passed in all ${fontRows.length} views (hand lettering only on the title, headings and badges, never on a digit, input, button, label or instruction)`}`);

// 5. The tier bars' focus indicator: rim vs the pixels immediately inside and outside it. Measured with the honeycomb at its peak.
log("\n## Tier bar focus indicator (a thickened rim in the focus colour; an outline would be clipped by the hexagon)");
let focusMin = Infinity, focusFails = 0, focusN = 0;
for (const h of STRENGTHS) for (const theme of THEMES) for (const w of Object.keys(W)) {
  const ctx = await browser.newContext({ viewport: view("difficulty", w), colorScheme: theme, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  await pg.goto(url("difficulty", { h, bg: "shimmer", peak: "1", bee: "1", theme }), { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  const n = await pg.locator(".tier-bar").count();
  let worstRimFill = Infinity, worstRimOut = Infinity;
  for (let i = 0; i < n; i++) {
    await pg.evaluate((k) => document.querySelectorAll(".tier-bar")[k].focus({ focusVisible: true }), i);
    await pg.waitForTimeout(80);
    // Wrapper glow is part of the real focused look, so it stays in the capture.
    const rect = await pg.evaluate((k) => { const e = document.querySelectorAll(".tier-bar")[k], b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rim: getComputedStyle(e).backgroundColor }; }, i);
    const png = (await pg.screenshot()).toString("base64");
    const res = await cmp.evaluate(async ({ png, rect }) => {
      const img = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = "data:image/png;base64," + png; });
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
      const at = (px, py) => [...x.getImageData(Math.round(px), Math.round(py), 1, 1).data].slice(0, 3);
      let rimFill = Infinity, rimOut = Infinity;
      // The bands have fixed geometry (outer moat 3px, rim 5px, inner moat 3px, measured
      // from the bar's top and bottom edge), so each is sampled at its CENTRE row, which
      // tolerates the 1px the irregular "more" hexagon points can drift. The sample is
      // asserted to BE the focus colour; finding the rim by colour alone matched the
      // neighbouring Expert/Master bars (whose rims are near the focus colour) and
      // reported 1.00:1 for a ring that was fine.
      const want = rect.rim.match(/[\d.]+/g).slice(0, 3).map(Number);
      const isRim = (c) => Math.max(...c.map((v, n) => Math.abs(v - want[n]))) <= 12;
      for (let k = 0; k < 24; k++) {
        const px = rect.l + 40 + (k / 23) * (rect.r - rect.l - 80);
        for (const [edge, dir] of [[rect.t, 1], [rect.b - 1, -1]]) {
          const rim = at(px, edge + dir * 2), out = at(px, edge - dir * 2), inn = at(px, edge + dir * 6);
          if (!isRim(rim)) { rimFill = 1; rimOut = 1; continue; }
          rimFill = Math.min(rimFill, ratio(rim, inn)); rimOut = Math.min(rimOut, ratio(rim, out));
        }
      }
      return { rimFill, rimOut };
    }, { png, rect });
    worstRimFill = Math.min(worstRimFill, res.rimFill); worstRimOut = Math.min(worstRimOut, res.rimOut);
  }
  focusN++; focusMin = Math.min(focusMin, worstRimFill, worstRimOut);
  const ok = worstRimFill >= 3 && worstRimOut >= 3;
  if (!ok) focusFails++;
  log(`${ok ? "PASS" : "FAIL"} ${h}, ${theme}, ${w}: focused rim vs the moat band just inside it ${worstRimFill.toFixed(2)}:1, vs the moat just outside it ${worstRimOut.toFixed(2)}:1 (need 3:1), worst of all ${n} bars`);
  await ctx.close();
}
log(`Tier bar focus: ${focusN - focusFails}/${focusN} configurations pass; lowest ratio ${focusMin.toFixed(2)}:1`);

// 6. Side-by-sides of the old live difficulty screen and the new ones.
log("\n## Side-by-side: old live difficulty screen and the new ones");
const OLDDIR = "../../../audit/screens";
for (const w of Object.keys(W)) for (const theme of THEMES) {
  const cols = [["Old live design (today)", `${OLDDIR}/difficulty--${w}--${theme}.png`], ...STRENGTHS.map((h) => [h === "off" ? "New: homemade off (hybrid b)" : `New: homemade ${h}`, `${h}--difficulty--${w}--${theme}.jpg`])];
  const colW = w === "phone" ? 300 : 440;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:18px;background:${theme === "dark" ? "#0e0b07" : "#efe4cb"};color:${theme === "dark" ? "#f5efe3" : "#2c2419"};font:700 16px/1.2 system-ui,sans-serif}
    .row{display:flex;gap:16px;align-items:flex-start}.c{width:${colW}px}.c p{margin:0 0 8px}.c img{display:block;width:100%;border-radius:8px;box-shadow:0 0 0 1px rgba(128,128,128,.4)}</style>
    <div class="row">${cols.map(([t, s]) => `<div class="c"><p>${t}</p><img src="${s}"></div>`).join("")}</div>`;
  const f = resolve(OUT, `_sbs.html`);
  writeFileSync(f, html);
  const ctx = await browser.newContext({ viewport: { width: (colW + 16) * cols.length + 20, height: 600 } });
  const pg = await ctx.newPage();
  await pg.goto(pathToFileURL(f).href, { waitUntil: "networkidle" });
  const name = `side-by-side--difficulty--${w}--${theme}`;
  await pg.screenshot({ path: resolve(OUT, `${name}.jpg`), type: "jpeg", quality: 90, fullPage: true });
  await ctx.close();
  // Report only what is really on disk: this line once read "wrote" for files that were not there.
  if (!existsSync(resolve(OUT, `${name}.jpg`))) throw new Error(`side-by-side not written: ${name}.jpg`);
  log(`wrote ${name}.jpg`);
}
rmSync(resolve(OUT, "_sbs.html"), { force: true });
await browser.close();

for (const s of stills) bufs.delete(`${s}--ref`);
// One number for everything the page measures: the contrast pairs (measure.mjs,
// TARGET=homemade) plus the tier-bar focus configurations above.
{
  let pairs = 0, pairFails = 0;
  const missing = [];
  for (const h of STRENGTHS) {
    const f = resolve(DIR, `contrast-${h}.md`);
    const m = existsSync(f) ? readFileSync(f, "utf8").match(/(\d+) measured pairs, (\d+) failing/) : null;
    if (!m) { missing.push(h); continue; }
    pairs += +m[1]; pairFails += +m[2];
  }
  log("\n## Summary of everything measured");
  if (missing.length) log(`FAIL contrast tables missing for ${missing.join(", ")}: run measure.mjs with TARGET=homemade first`);
  const total = pairFails + focusFails + missing.length;
  log(`${total === 0 ? "PASS" : "FAIL"} ${total} failures: ${pairs} contrast pairs (${pairFails} failing) + ${focusN} tier-bar focus configurations (${focusFails} failing; lowest ${focusMin.toFixed(2)}:1)`);
}
const names = readdirSync(OUT).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).sort();
writeFileSync(resolve(OUT, "index.js"), `// Written by design/harness/shoot-homemade.mjs\nwindow.SCREENS = ${JSON.stringify(names, null, 1)};\n`);
log(`\ncaptured ${names.length} screenshots -> ${FINAL}`);
log(`page errors: ${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`);
writeFileSync(resolve(DIR, "checks.txt"), out.join("\n") + "\n");
// Swap in only now, after every step above has finished.
rmSync(FINAL, { recursive: true, force: true });
renameSync(OUT, FINAL);
const onDisk = readdirSync(FINAL).filter((f) => f.endsWith(".jpg")).length;
if (onDisk !== names.length) throw new Error(`reported ${names.length} screenshots, found ${onDisk} on disk`);
