// The REAL app's difficulty screen (design/harness, `npx vite --config design/harness/vite.config.ts`):
//   1. eight tier BUTTONS, one per row, same left edge and width (never a letter board)
//   2. tap target by elementFromPoint probing, because the clip-path IS the target and
//      getBoundingClientRect overstates it: at the bar's centre, the hit run must be >= 44px
//      tall, and a 44px-wide run must exist at the centre row
//   3. the focus rim against the bands just inside and outside it (tier-focus.mjs, the same
//      check shoot-homemade.mjs runs on the prototype, proven able to fail)
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://127.0.0.1:5199] node design/harness/check-tier-bars.mjs
import { pathToFileURL } from "node:url";
import { measureTierFocus } from "./tier-focus.mjs";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:5199";
const W = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 }, narrow: { width: 320, height: 800 } };
const view = (page, w) => (w === "phone" ? { width: 390, height: 1000 } : w === "narrow" ? { width: 320, height: 1000 } : { width: 1280, height: 960 });
const url = (page, q) => `${APP}/?screen=${page}&theme=${q.theme}&peak=1`;
const browser = await chromium.launch();
let fails = 0;
const log = (s) => console.log(s);

for (const theme of ["dark", "light"]) for (const w of Object.keys(W)) {
  const ctx = await browser.newContext({ viewport: view("difficulty", w) });
  const p = await ctx.newPage();
  await p.goto(url("difficulty", { theme }), { waitUntil: "networkidle" });
  const r = await p.evaluate(() => {
    const bars = [...document.querySelectorAll(".tier-bar")];
    const rects = bars.map((b) => b.getBoundingClientRect());
    const hit = (b, x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === b || b.contains(e)); };
    let minV = Infinity, minH = Infinity;
    bars.forEach((b, i) => {
      const t = rects[i], cx = (t.left + t.right) / 2, cy = (t.top + t.bottom) / 2;
      let v = 0; for (let y = Math.floor(t.top) - 4; y <= t.bottom + 4; y++) if (hit(b, cx, y)) v++;
      let h = 0; for (let x = Math.floor(t.left) - 4; x <= t.right + 4; x++) if (hit(b, x, cy)) h++;
      minV = Math.min(minV, v); minH = Math.min(minH, h);
    });
    return {
      count: bars.length,
      sameLeft: new Set(rects.map((x) => Math.round(x.left))).size === 1,
      sameWidth: new Set(rects.map((x) => Math.round(x.width))).size === 1,
      oneRow: rects.every((x, i) => i === 0 || x.top >= rects[i - 1].bottom - 1),
      minV, minH,
    };
  });
  const ok = r.count === 8 && r.sameLeft && r.sameWidth && r.oneRow && r.minV >= 44 && r.minH >= 44;
  if (!ok) fails++;
  log(`${ok ? "PASS" : "FAIL"} ${theme} ${w}: ${r.count} bars, same left ${r.sameLeft}, same width ${r.sameWidth}, one per row ${r.oneRow}; tap target at centre ${r.minV}px tall x ${r.minH}px wide (need >= 44)`);
  await ctx.close();
}

const cmp = await (await browser.newContext()).newPage();
const f = await measureTierFocus({ browser, cmp, url, view, W: { desktop: W.desktop, phone: W.phone }, STRENGTHS: ["app"], THEMES: ["dark", "light"], log });
fails += f.focusFails;
await browser.close();
log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures (focus lowest ${f.focusMin.toFixed(2)}:1)`);
process.exit(fails === 0 ? 0 : 1);
