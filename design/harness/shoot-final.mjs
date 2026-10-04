// Side-by-sides for review: the approved prototype ("light" homemade strength) on the left, the
// finished app on the right, for home, difficulty, round and race results, at desktop and phone
// width, in both themes. Output: docs/review/final-vs-prototype--<page>--<width>--<theme>.jpg.
// The app side is the REAL components with mocked state (design/harness), shimmer caught
// mid-sweep like the prototype's own screenshots.
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-final.mjs   (harness on :5199)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const HARNESS = process.env.HARNESS_URL ?? "http://localhost:5199";
const OUT = resolve("docs/review");
mkdirSync(OUT, { recursive: true });
const PROTO = resolve("design/prototypes/homemade/screens");
const PAGES = [["home", "home"], ["difficulty", "difficulty"], ["round", "sp-round"], ["race-results", "race-results"]];
const VIEW = {
  desktop: (page) => (page === "difficulty" ? { width: 1280, height: 960 } : { width: 1280, height: 800 }),
  phone: (page) => (page === "difficulty" ? { width: 390, height: 1000 } : { width: 390, height: 844 }),
};
const b = await chromium.launch();
const cmp = await b.newPage();
for (const theme of ["dark", "light"]) for (const w of ["desktop", "phone"]) for (const [proto, screen] of PAGES) {
  const ctx = await b.newContext({ viewport: VIEW[w](proto), colorScheme: theme });
  const p = await ctx.newPage();
  await p.goto(`${HARNESS}/?screen=${screen}&theme=${theme}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { for (const a of document.getAnimations()) if (/sweep-/.test(a.animationName)) { a.pause(); a.currentTime = 4500; } });
  const mine = (await p.screenshot()).toString("base64");
  await ctx.close();
  const theirs = readFileSync(resolve(PROTO, `light--${proto}--${w}--${theme}.jpg`)).toString("base64");
  const colW = w === "phone" ? 390 : 800;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:${theme === "dark" ? "#0e0b07" : "#efe4cb"};color:${theme === "dark" ? "#f5efe3" : "#2c2419"};font:700 16px system-ui,sans-serif}
    .row{display:flex;gap:16px;align-items:flex-start}.c{width:${colW}px}.c p{margin:0 0 8px}.c img{display:block;width:100%;border-radius:8px;box-shadow:0 0 0 1px rgba(128,128,128,.4)}</style>
    <div class="row"><div class="c"><p>Prototype (approved, homemade light)</p><img src="data:image/jpeg;base64,${theirs}"></div><div class="c"><p>Finished app (real components, mocked state)</p><img src="data:image/png;base64,${mine}"></div></div>`;
  const tmp = resolve(OUT, "_sbs.html");
  writeFileSync(tmp, html);
  await cmp.setViewportSize({ width: colW * 2 + 48, height: 600 });
  await cmp.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await cmp.screenshot({ path: resolve(OUT, `final-vs-prototype--${proto}--${w}--${theme}.jpg`), type: "jpeg", quality: 84, fullPage: true });
}
import { rmSync } from "node:fs";
rmSync(resolve(OUT, "_sbs.html"), { force: true });
await b.close();
console.log("wrote 16 side-by-sides to docs/review/");
