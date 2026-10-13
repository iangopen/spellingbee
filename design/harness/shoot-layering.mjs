// Before/after crops of every decoration that straddles a panel's drawn outline, at 2x:
// BEFORE from a harness build of the old code, AFTER from the current one, desktop and phone,
// dark and light. Output: docs/review/layering/<place>--<width>--<theme>.jpg.
//   PW_MODULE=... BEFORE_URL=http://127.0.0.1:5198 AFTER_URL=http://127.0.0.1:5199 node design/harness/shoot-layering.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const BEFORE = process.env.BEFORE_URL ?? "http://127.0.0.1:5198";
const AFTER = process.env.AFTER_URL ?? "http://127.0.0.1:5199";
const OUT = resolve(process.env.OUT_DIR ?? "docs/review/layering");
mkdirSync(OUT, { recursive: true });
const PLACES = [
  ["home-bee", "home", ".hero-mascot", 24],
  ["home-rosette", "home", ".rosette-float", 24],
  ["results-rosette", "sp-results", ".results-rosette", 24],
  ["home-sticker", "home", ".hero .sticker", 20],
  ["race-winner-sticker", "race-results", ".winner .sticker", 20],
];
const VIEWS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 900 } };
const b = await chromium.launch();
async function crop(base, screen, sel, pad, theme, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${base}/?screen=${screen}&theme=${theme}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const r = await p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(r.width + pad * 2, vp.width - Math.max(0, r.x - pad)), height: r.height + pad * 2 };
  const buf = await p.screenshot({ clip, fullPage: true });
  await ctx.close();
  return { b64: buf.toString("base64"), w: clip.width };
}
const cmp = await (await b.newContext()).newPage();
let n = 0;
for (const [place, screen, sel, pad] of PLACES) for (const [w, vp] of Object.entries(VIEWS)) for (const theme of ["dark", "light"]) {
  const A = await crop(BEFORE, screen, sel, pad, theme, vp), B = await crop(AFTER, screen, sel, pad, theme, vp);
  const bg = theme === "dark" ? "#0e0b07" : "#efe4cb", fg = theme === "dark" ? "#f5efe3" : "#2c2419";
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:${bg};color:${fg};font:700 15px system-ui,sans-serif}.r{display:flex;gap:16px}.r p{margin:0 0 6px}img{display:block;outline:1px solid rgba(128,128,128,.5)}</style>
    <p>${place} · ${w} · ${theme}</p><div class="r"><div><p>Before (outline over the art)</p><img style="width:${A.w * 2}px" src="data:image/png;base64,${A.b64}"></div><div><p>After</p><img style="width:${B.w * 2}px" src="data:image/png;base64,${B.b64}"></div></div>`;
  const tmp = resolve(OUT, "_sbs.html"); writeFileSync(tmp, html);
  await cmp.setViewportSize({ width: Math.ceil(2 * (A.w + B.w) + 60), height: 300 });
  await cmp.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await cmp.screenshot({ path: resolve(OUT, `${place}--${w}--${theme}.jpg`), type: "jpeg", quality: 84, fullPage: true });
  n++;
}
rmSync(resolve(OUT, "_sbs.html"), { force: true });
await b.close();
console.log(`wrote ${n} before/after crops to ${OUT}`);
