// Builds the brand files from the SAME drawing the app uses (src/lib/beeArt.ts):
//   public/favicon.svg           the rosette mark
//   public/favicon-32.png        32px favicon fallback
//   public/apple-touch-icon.png  180px, solid background
//   public/icon-192.png, icon-512.png, icon-maskable-512.png   manifest icons
//   public/og-card.png           1200x630 share card
//   PREVIEW=<dir>                also writes art-sheet.png there (avatars, mascot, rosette, both themes)
//
// The app draws with theme tokens (var(--bee-body), ...). A file cannot read the
// page's CSS, so the tokens are replaced here with the dark palette's values from
// src/index.css, read FROM that file, so the icons cannot drift from the app.
//
//   PW_MODULE=<playwright/index.mjs> node design/harness/build-brand-assets.mjs
// Playwright is deliberately not a repo dependency (see design/README.md); the generated
// files are committed, so a normal build never needs it.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AVATAR_KEYS } from "../../src/lib/avatars.ts";
import { CLIP_ID, avatarSvg, rosetteSvg } from "../../src/lib/beeArt.ts";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const PUBLIC = resolve("public");
mkdirSync(PUBLIC, { recursive: true });

// --- palette: parsed from src/index.css (the :root block is dark, [data-theme="light"] light) ---
const css = readFileSync(resolve("src/index.css"), "utf8");
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="light"]'));
const lightBlock = css.slice(css.indexOf(':root[data-theme="light"]'));
const DARK = tokens(rootBlock);
const LIGHT = { ...DARK, ...tokens(lightBlock) };

let uid = 0;
const concrete = (svg, pal) =>
  svg
    .replace(/var\(--([a-z0-9-]+)\)/g, (_, k) => {
      if (!pal[k]) throw new Error(`token --${k} is not defined in src/index.css`);
      return pal[k];
    })
    .split(CLIP_ID)
    .join(`clip${++uid}`);
const sized = (svg, px) => svg.replace('width="100%" height="100%"', `width="${px}" height="${px}"`);

// --- the files ---
const rosetteDark = concrete(rosetteSvg(), DARK);
writeFileSync(resolve(PUBLIC, "favicon.svg"), sized(rosetteDark, 64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ') + "\n");

const browser = await chromium.launch();
async function png(html, file, w, h, { transparent = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // A real file:// page, not setContent: about:blank may not load local fonts, and the
  // first share card silently fell back to a system face because of that.
  const htmlFile = resolve(mkdtempSync(resolve(tmpdir(), "brand-")), "page.html");
  writeFileSync(htmlFile, html);
  await p.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: transparent });
  await ctx.close();
}
const page = (body, bg, extra = "") =>
  `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:${bg}}${extra}</style>${body}`;
const center = (inner) => `<div style="width:100%;height:100%;display:grid;place-items:center">${inner}</div>`;

const bgDark = DARK["bg-top"];
await png(page(center(sized(rosetteDark, 32)), "transparent"), resolve(PUBLIC, "favicon-32.png"), 32, 32, { transparent: true });
// Solid backgrounds for the icons the OS draws on its own: the honey page colour, the rosette filling ~78%.
await png(page(center(sized(rosetteDark, 140)), bgDark), resolve(PUBLIC, "apple-touch-icon.png"), 180, 180);
await png(page(center(sized(rosetteDark, 150)), bgDark), resolve(PUBLIC, "icon-192.png"), 192, 192);
await png(page(center(sized(rosetteDark, 400)), bgDark), resolve(PUBLIC, "icon-512.png"), 512, 512);
// Maskable: the safe zone is the inner 80% circle, so the mark sits inside ~58% of the canvas.
await png(page(center(sized(rosetteDark, 300)), bgDark), resolve(PUBLIC, "icon-maskable-512.png"), 512, 512);

// --- share card: dark honeycomb, the rosette, the name in the hand face, the tagline ---
const fontUrl = (f) => pathToFileURL(resolve("src/assets/fonts", f)).href;
const hexTile = (() => {
  const W = 28, R = W / Math.sqrt(3), H = 3 * R;
  const hex = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 90); return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`; }).join(" ");
  const cells = [[0, 0], [W, 0], [W / 2, 1.5 * R], [0, 3 * R], [W, 3 * R]];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 ${W} ${H.toFixed(3)}' preserveAspectRatio='none'>${cells.map(([x, y]) => `<polygon points='${hex(x, y)}' fill='none' stroke='${DARK["cell-line"]}' stroke-width='1.4'/>`).join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
const card = `
<style>
@font-face{font-family:"Caveat Brush";src:url("${fontUrl("caveat-brush-letters.woff2")}") format("woff2")}
@font-face{font-family:"Atkinson Hyperlegible";font-weight:400;src:url("${fontUrl("atkinson-hyperlegible-400-latin.woff2")}") format("woff2")}
@font-face{font-family:"Atkinson Hyperlegible";font-weight:700;src:url("${fontUrl("atkinson-hyperlegible-700-latin.woff2")}") format("woff2")}
.card{position:relative;width:1200px;height:630px;overflow:hidden;color:${DARK.text};font-family:"Atkinson Hyperlegible",sans-serif;
  background:radial-gradient(90% 80% at 30% 30%,${DARK["bg-glow"]},transparent 62%),linear-gradient(180deg,${DARK["bg-top"]},${DARK["bg-bottom"]})}
.cells{position:absolute;inset:0;background-image:${hexTile};background-size:28px 49px;opacity:.9}
.panel{position:absolute;left:70px;top:70px;right:70px;bottom:70px;border-radius:44px 34px 42px 32px/34px 44px 32px 40px;background:${DARK.panel};
  box-shadow:inset 0 0 0 2px ${DARK["panel-edge"]},0 24px 50px -24px #000;border:3px solid ${DARK.sketch}}
.rosette{position:absolute;left:120px;top:140px;width:340px;height:340px;filter:drop-shadow(5px 8px 0 ${DARK["ink-shadow"]})}
h1{position:absolute;left:500px;top:166px;margin:0;white-space:nowrap;font:400 126px/0.95 "Caveat Brush",cursive;letter-spacing:.01em;color:${DARK.heading};transform:rotate(-1.5deg)}
.line{position:absolute;left:506px;top:312px;width:500px;height:13px;background:${DARK.heading};opacity:.75;border-radius:8px}
p{position:absolute;left:504px;margin:0;font-size:38px;font-weight:700;letter-spacing:-.01em}
.p1{top:372px}.p2{top:432px;font-size:30px;font-weight:400;color:${DARK.muted}}
</style>
<div class="card"><div class="cells"></div><div class="panel"></div>
  <div class="rosette">${sized(concrete(rosetteSvg(), DARK), 340)}</div>
  <h1>Spelling Bee</h1><div class="line"></div>
  <p class="p1">Hear it. Spell it. Beat the clock.</p>
  <p class="p2">Solo, or race your friends.</p></div>`;
await png(page(card, "#000", "html,body{width:1200px;height:630px}"), resolve(PUBLIC, "og-card.png"), 1200, 630);

// --- preview sheet of every drawing, both themes (for review, not shipped) ---
if (process.env.PREVIEW) {
  mkdirSync(process.env.PREVIEW, { recursive: true });
  const row = (pal) =>
    [...AVATAR_KEYS.map((k) => concrete(avatarSvg(k), pal)), concrete(rosetteSvg(), pal)]
      .map((s) => `<div style="width:150px;height:170px">${sized(s, 150)}</div>`)
      .join("");
  const sheet = (pal, bg) => `<div style="display:flex;gap:6px;padding:20px;background:${bg}">${row(pal)}</div>`;
  await png(page(sheet(DARK, DARK["bg-top"]) + sheet(LIGHT, LIGHT["bg-top"]), "#888"), resolve(process.env.PREVIEW, "art-sheet.png"), 1500, 420);
}
await browser.close();
console.log("wrote favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, og-card.png" + (process.env.PREVIEW ? " and the preview sheet" : ""));
