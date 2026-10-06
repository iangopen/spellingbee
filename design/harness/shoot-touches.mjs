// Touch-by-touch side-by-sides: each homemade touch of the approved prototype ("light"
// strength) next to the same touch in the app, cropped and shown at 2x, at desktop and
// phone width, in both themes. The earlier review (shoot-final.mjs) compared whole
// screens, where a lost touch is easy to miss; this compares one touch at a time.
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-touches.mjs [prefix] [touch,...]
// Needs the harness on :5199 (npx vite --config design/harness/vite.config.ts --port 5199).
// Output: docs/review/touches/<prefix><touch>--<width>--<theme>.jpg (prefix defaults to "").
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const HARNESS = process.env.HARNESS_URL ?? "http://localhost:5199";
const OUT = resolve("docs/review/touches");
mkdirSync(OUT, { recursive: true });
const PREFIX = process.argv[2] ?? "";
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;

// [touch, prototype page, app screen, prototype selector, app selector, padding]. A selector
// starting with "@" is a fixed page region "@x,y,w,h" (for the background touches).
const TOUCHES = [
  ["panel-outline-and-corners", "home", "home", ".bests h2", ".bests h2", 40],
  ["no-backdrop-blur", "round", "sp-round", ".pronouncer", ".pronouncer", 20],
  ["buttons-marker-shadow", "home", "home", ".hero .actions", ".hero .actions", 14],
  ["chips", "difficulty", "difficulty", ".mode-toggles", ".mode-toggles", 12],
  ["answer-field", "round", "sp-round", ".answer-field", ".answer-field", 16],
  ["placard-tilt", "round", "sp-round", ".placard", ".placard", 14],
  ["settings-button", "home", "home", ".icon-btn", ".settings-toggle", 16],
  ["hand-title-and-underline", "home", "home", ".hero h1", ".hero h1", 18],
  ["hand-kicker", "round", "sp-round", ".pronouncer .who", ".pronouncer .who", 14],
  ["sticker", "home", "home", ".hero .sticker", ".hero .sticker", 30],
  ["winner-underline", "race-results", "race-results", ".winner h1", ".winner h1", 20],
  ["page-grain", "home", "home", "@0,0,420,150", "@0,0,420,150", 0],
  ["calmer-glow", "home", "home", "@0,560,420,140", "@0,560,420,140", 0],
  ["bee-mascot", "home", "home", ".hero svg", ".hero .mascot", 8],
  ["rosette", "home", "home", ".bests .mark-svg", ".rosette-float", 8],
  ["avatar-token", "race-results", "race-results", ".lane .token", ".lane .token", 12],
  ["tier-bars", "difficulty", "difficulty", ".tier-stack", ".tier-stack", 8],
];
const VIEW = { desktop: { width: 1280, height: 960 }, phone: { width: 390, height: 1000 } };

const b = await chromium.launch();
async function grab(url, sel, pad, viewport) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  // the shimmer caught mid-sweep, the bee's hover at rest, entry animations at their end
  await p.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (/sweep/.test(a.animationName)) { a.pause(); a.currentTime = 4500; }
      else if (a.effect.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; }
      else a.finish();
    }
  });
  let clip;
  if (sel.startsWith("@")) {
    const [x, y, width, height] = sel.slice(1).split(",").map(Number);
    clip = { x, y, width: Math.min(width, viewport.width - x), height };
  } else {
    const r = await p.locator(sel).first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    });
    clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 };
    clip.width = Math.min(clip.width, viewport.width - clip.x);
  }
  const buf = await p.screenshot({ clip, fullPage: true });
  await ctx.close();
  return { b64: buf.toString("base64"), w: clip.width };
}

const cmp = await (await b.newContext({ deviceScaleFactor: 1 })).newPage();
let n = 0;
for (const [touch, page, screen, selP, selA, pad] of TOUCHES) {
  if (ONLY && !ONLY.includes(touch)) continue;
  for (const w of ["desktop", "phone"]) for (const theme of ["dark", "light"]) {
    const P = await grab(pathToFileURL(resolve("design/prototypes/homemade", `${page}.html`)).href + `?h=light&theme=${theme}`, selP, pad, VIEW[w]);
    const A = await grab(`${HARNESS}/?screen=${screen}&theme=${theme}`, selA, pad, VIEW[w]);
    const bg = theme === "dark" ? "#0e0b07" : "#efe4cb", fg = theme === "dark" ? "#f5efe3" : "#2c2419";
    // shown at 2x so the line quality (wobble, grain, blur) is visible
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:${bg};color:${fg};font:700 15px system-ui,sans-serif}
      .r{display:flex;gap:16px;align-items:flex-start}.r p{margin:0 0 6px}img{display:block;outline:1px solid rgba(128,128,128,.5)}</style>
      <p>${touch} · ${w} · ${theme}</p><div class="r"><div><p>Prototype (homemade light)</p><img style="width:${P.w * 2}px" src="data:image/png;base64,${P.b64}"></div>
      <div><p>App</p><img style="width:${A.w * 2}px" src="data:image/png;base64,${A.b64}"></div></div>`;
    const tmp = resolve(OUT, "_sbs.html");
    writeFileSync(tmp, html);
    await cmp.setViewportSize({ width: Math.ceil(2 * (P.w + A.w) + 60), height: 300 });
    await cmp.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
    await cmp.screenshot({ path: resolve(OUT, `${PREFIX}${touch}--${w}--${theme}.jpg`), type: "jpeg", quality: 82, fullPage: true });
    n++;
  }
}
rmSync(resolve(OUT, "_sbs.html"), { force: true });
await b.close();
console.log(`wrote ${n} side-by-sides to docs/review/touches/`);
