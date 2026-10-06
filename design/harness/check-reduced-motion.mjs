// Reduced motion must leave a STILL page that is the same page: the shimmer gone, every
// animation resting, nothing moving. For every screen, in both themes and at both widths,
// three EXACT comparisons (no tolerance since 2026-10-07):
//   1. the OS setting (reducedMotion: "reduce"): two screenshots 2s apart are pixel-identical;
//   2. the in-app switch as a player has it, i.e. a stored preference that main.tsx puts on
//      <html> before the first paint, on an OS that allows motion: identical to (1), so the two
//      paths suppress exactly the same things;
//   3. the in-app switch flipped mid-session (after load, as from Settings): from then on
//      nothing moves (two screenshots 1s apart are identical).
// (3) is deliberately NOT compared with (1): animations that already played before the
// toggle (the miss shake, the correct light-up) leave the field's ring anti-aliased a few
// pixels differently (32 px, max delta 17-19, measured 2026-10-07) with nothing moving.
// Until 2026-10-07 this check allowed 0.2% of the page to differ; the 8 cases it tolerated
// were the tier bars' shared compositing layer re-rastering after load (fixed: will-change on
// .tier-bar), the hero sticker rasterising differently from one load to the next under the
// Settings scrim (fixed: will-change on .sticker), and the mid-session comparison above.
// Text carets are hidden first (a blinking caret is the only thing that legitimately changes).
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://127.0.0.1:5199] node design/harness/check-reduced-motion.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:5199";
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
// Exact: every differing pixel fails, and is printed with where it is.
const TOLERANCE = 0;
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
// The stored preference: main.tsx calls applyReduceMotion() before React renders, so the
// attribute is on <html> before the first paint. The harness has no main.tsx, so this sets it
// the moment <html> exists, which is the same moment.
const storedSwitch = () => {
  const set = () => document.documentElement && (document.documentElement.setAttribute("data-reduce-motion", "true"), true);
  if (!set()) new MutationObserver((_, o) => { if (set()) o.disconnect(); }).observe(document, { childList: true });
};
let n = 0, bad = 0;

async function shot(p) {
  return p.screenshot({ fullPage: true });
}
async function open(url, screen, vp, rm, inits) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: rm });
  const p = await ctx.newPage();
  for (const f of [seed, noCaret, ...inits]) await p.addInitScript(f);
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready); // a late font swap would read as motion
  if (screen === "settings") await p.click(".settings-toggle");
  return { ctx, p };
}
// ONLY=<screen> narrows the run while debugging.
for (const theme of ["dark", "light"]) for (const [wname, vp] of Object.entries(VIEWS)) for (const screen of SCREENS.filter((x) => !process.env.ONLY || x === process.env.ONLY)) {
  const url = `${APP}/?screen=${screen}&theme=${theme}`;
  // 1. OS setting
  const os = await open(url, screen, vp, "reduce", []);
  await os.p.waitForTimeout(500);
  const a1 = await shot(os.p);
  await os.p.waitForTimeout(2000);
  const a2 = await shot(os.p);
  await os.ctx.close();
  // 2. in-app switch, stored (on before the first paint)
  const stored = await open(url, screen, vp, "no-preference", [storedSwitch]);
  await stored.p.waitForTimeout(500);
  const b1 = await shot(stored.p);
  await stored.ctx.close();
  // 3. in-app switch flipped mid-session
  const mid = await open(url, screen, vp, "no-preference", []);
  await mid.p.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "true"));
  await mid.p.waitForTimeout(1800);
  const c1 = await shot(mid.p);
  await mid.p.waitForTimeout(1000);
  const c2 = await shot(mid.p);
  await mid.ctx.close();

  n++;
  const v = [await verdict("OS: t=0.5s vs t=2.5s", a1, a2), await verdict("OS vs stored in-app switch", a1, b1), await verdict("switch flipped mid-session: +1.8s vs +2.8s", c1, c2)];
  if (v.some((x) => !x.ok)) { bad++; console.log(`FAIL ${theme} ${wname} ${screen}: ${v.map((x) => x.text).join("; ")}`); }
}
await b.close();
console.log(`\n${bad === 0 ? "PASS" : "FAIL"} ${n - bad}/${n} screen configurations are pixel-identical: still under the OS setting, the same page under the stored in-app switch, and still after the switch is flipped mid-session`);
process.exit(bad === 0 ? 0 : 1);
