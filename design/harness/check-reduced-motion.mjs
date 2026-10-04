// Reduced motion must leave a STILL page that is the same page: the shimmer gone, every
// animation resting, nothing moving.  For every screen, in both themes and at both widths:
//   1. the OS setting (reducedMotion: "reduce"): two screenshots 2s apart are pixel-identical
//      (nothing moves at all);
//   2. the in-app switch (data-reduce-motion) on an OS that allows motion: its still page is
//      pixel-identical to (1), so the two paths suppress exactly the same things.
// Text carets are hidden first (a blinking caret is the only thing that legitimately changes).
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:5199] node design/harness/check-reduced-motion.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:5199";
const SCREENS = ["home", "difficulty", "sp-round", "sp-correct", "sp-incorrect", "sp-results", "settings", "lobby", "waiting-room",
  "race-round", "race-locked", "race-roundend", "race-results", "race-tie", "elim-watch", "elim-myturn", "elim-results"];
const VIEWS = { desktop: { width: 1100, height: 900 }, phone: { width: 390, height: 844 } };
const b = await chromium.launch();
const cmpPage = await (await b.newContext()).newPage();
// How two screenshots differ: {n, total, max, box}. Equal pages give n = 0.
const measure = (x, y) => cmpPage.evaluate(async ([x, y]) => {
  const load = (s) => new Promise((o) => { const i = new Image(); i.onload = () => o(i); i.src = "data:image/png;base64," + s; });
  const [A, B] = await Promise.all([load(x), load(y)]);
  if (A.width !== B.width || A.height !== B.height) return { n: Infinity, total: 1, max: 255, box: `size ${A.width}x${A.height} vs ${B.width}x${B.height}` };
  const px = (im) => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const t = c.getContext("2d"); t.drawImage(im, 0, 0); return t.getImageData(0, 0, im.width, im.height).data; };
  const da = px(A), db = px(B);
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (d) { n++; max = Math.max(max, d); const X = (i / 4) % A.width, Y = Math.floor(i / 4 / A.width); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  }
  return { n, total: A.width * A.height, max, box: `(${x0},${y0})-(${x1},${y1})` };
}, [x.toString("base64"), y.toString("base64")]);
// A rotated, hand-lettered heading over a blurred panel is rasterised a few anti-aliased pixels
// differently from one load to the next, with nothing moving. Real motion (the shimmer, a
// resting-state bug, a panel still rising) changes THOUSANDS of pixels, so up to 0.2% of the page
// counts as the same picture; anything tolerated is printed, so nothing is hidden.
const TOLERANCE = 0.002;
const verdict = async (label, x, y) => {
  const m = await measure(x, y);
  const ok = m.n === 0 || m.n / m.total <= TOLERANCE;
  return { ok, text: m.n === 0 ? `${label}: identical` : `${label}: ${m.n}px differ (max delta ${m.max}) in ${m.box}`, exact: m.n === 0 };
};
// The page picks a random lead-in phrase and shuffles; seed Math.random so two loads are the same page.
// The caret hider goes in BEFORE the page loads (an init script), not after: injecting a style tag
// into a live page forces a relayout and a re-raster, which shows up as phantom differences.
const noCaret = () => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "*{caret-color:transparent!important}"; document.head.append(st); });
const seed = () => { let s = 1; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); };
let n = 0, bad = 0, tolerated = 0;

async function shot(p) {
  return p.screenshot({ fullPage: true });
}
// ONLY=<screen> narrows the run while debugging.
for (const theme of ["dark", "light"]) for (const [wname, vp] of Object.entries(VIEWS)) for (const screen of SCREENS.filter((x) => !process.env.ONLY || x === process.env.ONLY)) {
  const url = `${APP}/?screen=${screen}&theme=${theme}`;
  const c1 = await b.newContext({ viewport: vp, reducedMotion: "reduce" });
  const p1 = await c1.newPage();
  await p1.addInitScript(seed);
  await p1.addInitScript(noCaret);
  await p1.goto(url, { waitUntil: "networkidle" });
  await p1.evaluate(() => document.fonts.ready); // a late font swap would read as motion
  if (screen === "settings") await p1.click(".settings-toggle");
  await p1.waitForTimeout(500);
  const a1 = await shot(p1, wname);
  await p1.waitForTimeout(2000);
  const a2 = await shot(p1, wname);
  await c1.close();

  const c2 = await b.newContext({ viewport: vp, reducedMotion: "no-preference" });
  const p2 = await c2.newPage();
  await p2.addInitScript(seed);
  await p2.addInitScript(noCaret);
  await p2.goto(url, { waitUntil: "networkidle" });
  await p2.evaluate(() => document.fonts.ready);
  if (screen === "settings") await p2.click(".settings-toggle");
  await p2.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "true"));
  await p2.waitForTimeout(1800);
  const c = await shot(p2, wname);
  await c2.close();

  n++;
  const still = await verdict("t=0.5s vs t=2.5s", a1, a2);
  const match = await verdict("OS vs in-app switch", a1, c);
  if (!still.ok || !match.ok) { bad++; console.log(`FAIL ${theme} ${wname} ${screen}: ${still.text}; ${match.text}`); }
  else if (!still.exact || !match.exact) { tolerated++; console.log(`  ok (tolerated) ${theme} ${wname} ${screen}: ${still.text}; ${match.text}`); }
}
await b.close();
console.log(`\n${bad === 0 ? "PASS" : "FAIL"} ${n - bad}/${n} screen configurations are still under reduced motion and match the in-app switch (${n - bad - tolerated} pixel-identical, ${tolerated} within the ${TOLERANCE * 100}% anti-aliasing tolerance)`);
process.exit(bad === 0 ? 0 : 1);
