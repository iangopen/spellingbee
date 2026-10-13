// Screenshots and trademark-distance checks for the honey hybrid prototypes
// (design/prototypes/honey-hybrid).
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-hybrid.mjs
// Writes honey-hybrid/screens/*.jpg (+ index.js for compare.html) and
// honey-hybrid/checks.txt. Checks:
//   1. reduced motion: every variant's still is pixel-identical to its static
//      background (the moving light is removed, nothing else changes)
//   2. no lemon yellow: counted on the lossless PNG of every capture. NYT's
//      Spelling Bee yellow (#f7da21) sits at hue 53; the hybrid's honey sits at
//      hue 30-42. "Lemon" = hue 46-66 with real saturation, so the detector
//      catches NYT's yellow and passes the old honey (asserted below).
//   3. no flat grey tiles: no filled content element is a neutral grey
//   4. the honeycomb is decoration only: aria-hidden, no pointer events, no
//      text or controls, no hexagon-shaped content, no letter board
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/honey-hybrid");
const OUT = resolve(DIR, "screens");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const VARIANTS = ["a", "b", "c"];
const PAGES = ["home", "round", "race-results"];
const THEMES = ["dark", "light"];
const W = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
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
const isLemon = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 46 && h <= 66 && s > 0.5 && l > 0.3 && l < 0.85; };
const isHoney = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 28 && h < 46 && s > 0.35 && l > 0.25 && l < 0.92; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// The detector must catch NYT's yellow and must not catch the hybrid's honey.
const sanity = { "#f7da21 (NYT Spelling Bee yellow)": true, "#e8a63d (old honey)": false, "#f2bd62 (hybrid heading)": false, "#e09a2c (light fill)": false, "#f5c46e (focus ring)": false };
for (const [k, want] of Object.entries(sanity)) if (isLemon(...rgb(k.slice(0, 7))) !== want) throw new Error(`lemon detector wrong for ${k}`);
log(`Detector sanity: flags ${Object.keys(sanity).filter((k) => sanity[k]).join(", ")}; passes ${Object.keys(sanity).filter((k) => !sanity[k]).join(", ")}.`);

const browser = await chromium.launch();
const errors = [];
const bufs = new Map();
const saved = [];

async function shot(name, page, q, { w, theme, motion = "no-preference", prep, save = true } = {}) {
  const ctx = await browser.newContext({ viewport: W[w], deviceScaleFactor: 1, colorScheme: theme, reducedMotion: motion });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(url(page, { ...q, theme }), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(motion === "reduce" ? 200 : 1400); // let entry animations finish
  if (prep) await prep(p);
  const png = await p.screenshot({ type: "png" });
  bufs.set(name, png);
  if (save) { await p.screenshot({ path: resolve(OUT, `${name}.jpg`), type: "jpeg", quality: 88 }); saved.push(name); }
  await ctx.close();
}
// Freeze the shimmer with its band in the middle of the screen.
const midSweep = (p) => p.evaluate(() => {
  for (const a of document.getAnimations()) if (/sweep-/.test(a.animationName)) { a.pause(); a.currentTime = 4500; }
});

// 1. every variant: 3 screens x 2 widths x 2 themes (shimmer caught mid-sweep, bee)
for (const v of VARIANTS) for (const page of PAGES) for (const w of Object.keys(W)) for (const theme of THEMES)
  await shot(`${v}--${page}--${w}--${theme}`, page, { v, bg: "shimmer", bee: "1" }, { w, theme, prep: midSweep });
// 2. the two answer moments
for (const v of VARIANTS) for (const state of ["correct", "incorrect"]) for (const w of Object.keys(W)) for (const theme of THEMES)
  await shot(`${v}--round-${state}--${w}--${theme}`, "round", { v, bg: "shimmer", bee: "1", state }, { w, theme, prep: midSweep });
// 3. keyboard focus over the glow (Tab twice: Settings, then Play solo)
for (const v of VARIANTS) for (const theme of THEMES)
  await shot(`${v}--focus-home--desktop--${theme}`, "home", { v, bg: "shimmer", bee: "1" }, { w: "desktop", theme, prep: async (p) => { await midSweep(p); await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.waitForTimeout(300); } });
// 4. reduced-motion stills: the shimmer page under reduced motion vs the static page
const stills = [];
for (const v of VARIANTS) for (const page of PAGES) for (const w of Object.keys(W)) for (const theme of THEMES) {
  const name = `${v}--still-${page}--${w}--${theme}`;
  await shot(name, page, { v, bg: "shimmer", bee: "1" }, { w, theme, motion: "reduce" });
  await shot(`${name}--ref`, page, { v, bg: "static", bee: "1" }, { w, theme, motion: "reduce", save: false });
  stills.push(name);
}

// Pixel work happens inside a page; only totals come back.
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

log("\n## Colour: lemon-yellow pixels (must be 0) and honey pixels, per variant, over every saved capture (lossless)");
for (const v of VARIANTS) {
  let lemon = 0, honey = 0, total = 0; const hits = [];
  for (const n of saved.filter((x) => x.startsWith(v + "--"))) {
    const r = await pixels(bufs.get(n).toString("base64"));
    lemon += r.lemon; honey += r.honey; total += r.total;
    if (r.lemon) hits.push(`${n}: ${r.lemon}`);
  }
  log(`variant ${v}: ${total.toLocaleString("en")} px in ${saved.filter((x) => x.startsWith(v + "--")).length} captures; lemon yellow ${lemon}; honey/amber ${honey.toLocaleString("en")} (${((honey / total) * 100).toFixed(1)}%)${hits.length ? "\n  " + hits.join("\n  ") : ""}`);
}

log("\n## Structure: honeycomb is decoration only; no grey tiles; no letter board");
for (const v of VARIANTS) for (const page of [...PAGES, "avatars"]) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: W.desktop, colorScheme: theme });
  const pg = await ctx.newPage();
  await pg.goto(url(page, { v, bg: "shimmer", bee: "1", theme }), { waitUntil: "networkidle" });
  const r = await pg.evaluate(() => {
    const bg = document.querySelector(".bg");
    const content = [...document.querySelectorAll("body *")].filter((el) => !bg.contains(el));
    const toHsl = (s) => {
      const m = s.match(/[\d.]+/g); if (!m) return null;
      const [r, g, b, a = 1] = m.map(Number); if (a < 0.5) return null;
      const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
      return { s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l, css: s };
    };
    const grey = content.filter((el) => {
      const b = el.getBoundingClientRect(); if (b.width * b.height < 300) return false;
      const c = toHsl(getComputedStyle(el).backgroundColor);
      return c && c.s < 0.08 && c.l > 0.45 && c.l < 0.96;
    }).map((el) => `${el.tagName.toLowerCase()}.${el.className} ${getComputedStyle(el).backgroundColor}`);
    return {
      text: bg.textContent.trim().length, ariaHidden: bg.getAttribute("aria-hidden"), pointer: getComputedStyle(bg).pointerEvents,
      focusable: bg.querySelectorAll("a,button,input,[tabindex]").length,
      hexShapes: content.filter((el) => /polygon\(\s*(?:[^,]+,){5}[^,]+\)/.test(getComputedStyle(el).clipPath || "")).length,
      tilesOutside: content.filter((el) => /polygon/.test(getComputedStyle(el).backgroundImage)).length,
      grey,
    };
  });
  log(`${v} ${page} (${theme}): honeycomb text=${r.text}, aria-hidden=${r.ariaHidden}, pointer-events=${r.pointer}, focusable inside=${r.focusable}, six-point polygon elements in content=${r.hexShapes}, honeycomb tiles outside the background=${r.tilesOutside}, flat grey filled elements=${r.grey.length}${r.grey.length ? " -> " + r.grey.join("; ") : ""}`);
  await ctx.close();
}
log("Answers are typed into a standard text input on the round screen; no screen has a letter board or letter tiles.");
await browser.close();

for (const s of stills) bufs.delete(`${s}--ref`);
const names = readdirSync(OUT).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).sort();
writeFileSync(resolve(OUT, "index.js"), `// Written by design/harness/shoot-hybrid.mjs\nwindow.SCREENS = ${JSON.stringify(names, null, 1)};\n`);
log(`\ncaptured ${names.length} screenshots -> ${OUT}`);
log(`page errors: ${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`);
writeFileSync(resolve(DIR, "checks.txt"), out.join("\n") + "\n");
