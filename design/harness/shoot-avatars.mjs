// Before/after viewport captures of every screen that shows an avatar (avatar maker, 2026-10-15):
// lobby, waiting room, the elimination token row (the in-game scoreboard), race results and
// elimination results, at desktop and phone width, dark and light. Each screen gets the top of
// the page and, when the avatars are below the fold, a second capture scrolled to them.
// Viewport captures only, never fullPage.
//   PW_MODULE=... APP_URL=http://127.0.0.1:5199 OUT_DIR=docs/review/avatar-ui/after node design/harness/shoot-avatars.mjs
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const BASE = (process.env.APP_URL ?? "http://127.0.0.1:5199").replace(/\/$/, "");
const OUT = resolve(process.env.OUT_DIR ?? "docs/review/avatar-ui/after");
mkdirSync(OUT, { recursive: true });
// [name, harness screen, selector of the avatars on it]
const SCREENS = [
  ["lobby", "lobby", ".avatar-maker, .avatar-picker"],
  ["waiting-room", "waiting-room", ".player-list"],
  ["scoreboard", "elim-watch", ".ptoken"],
  ["race-results", "race-results", ".lanes"],
  ["elim-results", "elim-results", ".avatar-badge"],
];
const VIEWS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const b = await chromium.launch();
let n = 0;
for (const [name, screen, sel] of SCREENS) for (const [w, vp] of Object.entries(VIEWS)) for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?screen=${screen}&theme=${theme}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}--${w}--${theme}.png` });
  n++;
  const el = p.locator(sel).first();
  if (await el.count()) {
    const below = await el.evaluate((e) => e.getBoundingClientRect().bottom > innerHeight);
    if (below) {
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/${name}--${w}--${theme}--avatars.png` });
      n++;
    }
  }
  await ctx.close();
}
await b.close();
console.log(`${n} captures in ${OUT}`);
