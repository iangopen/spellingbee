// Hovering a tier bar must repaint THAT bar and nothing else: no flash of the background,
// no re-raster of the other bars. Difficulty screen, both widths, both themes, the shimmer
// frozen (paused mid-sweep) so the background is still and any change is the hover's.
//
// Two measurements per bar, each taken from the compositor's own frames (CDP screencast):
//   1. pixels: frames recorded while the pointer enters the bar, rests, and leaves are
//      compared with the frame before the hover. Every pixel outside the hovered bar's box
//      (plus the 3px it slides and a 4px margin for its anti-aliased edge) must be unchanged.
//   2. repaint: with Chrome's paint flashing on, the repainted (green) area in any frame must
//      fit inside the hovered bar's box, so the hover cannot force a re-raster elsewhere.
// The bug this guards (2026-10-07): the eight bars shared one squashed compositing layer, and
// a hover split it, re-rastering the hovered bar and every bar after it (about 115,000 px,
// background visible through the gaps) twice per hover. Fix: will-change on .tier-bar.
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://127.0.0.1:5199] node design/harness/check-hover-flash.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:5199";
const VIEWS = { desktop: { width: 1100, height: 900 }, phone: { width: 390, height: 1000 } };
const b = await chromium.launch();
const cmp = await (await b.newContext()).newPage();
await cmp.evaluate(() => {
  window.load = (s) => new Promise((o) => { const i = new Image(); i.onload = () => o(i); i.src = "data:image/png;base64," + s; });
  window.px = (im) => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const t = c.getContext("2d"); t.drawImage(im, 0, 0); return t.getImageData(0, 0, im.width, im.height).data; };
});
// changed pixels outside `keep` (x, y, w, h in screenshot pixels) between `base` and `frame`
const changedOutside = (base, frame, keep) => cmp.evaluate(async ([base, frame, keep]) => {
  const [A, B] = await Promise.all([window.load(base), window.load(frame)]);
  const a = window.px(A), d = window.px(B), w = A.width; const [kx, ky, kw, kh] = keep;
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < a.length; i += 4) {
    const X = (i / 4) % w, Y = (i / 4 / w) | 0;
    if (X >= kx && X < kx + kw && Y >= ky && Y < ky + kh) continue;
    if (a[i] !== d[i] || a[i + 1] !== d[i + 1] || a[i + 2] !== d[i + 2]) { n++; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  }
  return { n, box: n ? `(${x0},${y0})-(${x1},${y1})` : "" };
}, [base, frame, keep]);
// paint-flash green (Chrome draws repainted rects as translucent green) outside `keep`
const greenOutside = (frame, keep) => cmp.evaluate(async ([frame, keep]) => {
  const B = await window.load(frame); const d = window.px(B), w = B.width; const [kx, ky, kw, kh] = keep;
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    const X = (i / 4) % w, Y = (i / 4 / w) | 0;
    if (X >= kx && X < kx + kw && Y >= ky && Y < ky + kh) continue;
    if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 40) { n++; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  }
  return { n, box: n ? `(${x0},${y0})-(${x1},${y1})` : "" };
}, [frame, keep]);

async function record(p, cdp, act) {
  const frames = [];
  const on = async (f) => { frames.push(f.data); await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); };
  cdp.on("Page.screencastFrame", on);
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await p.waitForTimeout(250);
  await act();
  await cdp.send("Page.stopScreencast");
  cdp.off("Page.screencastFrame", on);
  return frames;
}

// One fresh page per bar: Chrome's paint-flash overlay redraws the previous rect when it is
// switched back on, so reusing a page would charge one bar's repaint to the next.
async function openDifficulty(theme, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  await p.goto(`${APP}/?screen=difficulty&theme=${theme}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500); // past first-load raster
  await p.evaluate(() => { for (const a of document.getAnimations()) if (/sweep/.test(a.animationName)) { a.pause(); a.currentTime = 4500; } });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("DOM.enable"); await cdp.send("Overlay.enable");
  return { ctx, p, cdp };
}

let bad = 0, checked = 0;
for (const theme of ["dark", "light"]) for (const [w, vp] of Object.entries(VIEWS)) {
  const first = await openDifficulty(theme, vp);
  const n = await first.p.locator(".tier-bar").count();
  await first.ctx.close();
  for (let i = 0; i < n; i++) {
    const { ctx, p, cdp } = await openDifficulty(theme, vp);
    const bar = p.locator(".tier-bar").nth(i);
    await bar.scrollIntoViewIfNeeded();
    await p.waitForTimeout(200);
    const r = await bar.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    const keep = [Math.floor(r[0] - 4), Math.floor(r[1] - 4), Math.ceil(r[2] + 3 + 8), Math.ceil(r[3] + 8)];
    const out = [vp.width - 6, r[1] + r[3] / 2];
    await p.mouse.move(...out);
    await p.waitForTimeout(300);
    const hover = async () => { await p.mouse.move(r[0] + r[2] / 2, r[1] + r[3] / 2, { steps: 3 }); await p.waitForTimeout(400); await p.mouse.move(...out, { steps: 3 }); await p.waitForTimeout(400); };
    // 1. pixels
    const frames = await record(p, cdp, hover);
    let worst = { n: 0, box: "" };
    for (let k = 1; k < frames.length; k++) { const m = await changedOutside(frames[0], frames[k], keep); if (m.n > worst.n) worst = m; }
    // 2. repaint
    await cdp.send("Overlay.setShowPaintRects", { result: true });
    await p.waitForTimeout(300);
    const pf = await record(p, cdp, hover);
    let green = 0, greenBox = "";
    for (const f of pf) { const g = await greenOutside(f, keep); if (g.n > green) { green = g.n; greenBox = g.box; } }
    await ctx.close();
    checked++;
    const ok = worst.n === 0 && green === 0;
    if (!ok) bad++;
    console.log(`${ok ? "  ok" : "FAIL"}  ${theme} ${w} bar ${i + 1}/${n}: ${frames.length} frames, ${worst.n} px changed outside the bar${worst.box ? " in " + worst.box : ""}; ${green} px repainted outside it${greenBox ? " in " + greenBox : ""}`);
  }
}
await b.close();
console.log(`\n${bad === 0 ? "PASS" : "FAIL"} ${checked - bad}/${checked} tier-bar hovers repaint only the hovered bar (shimmer frozen, both widths and themes)`);
process.exit(bad ? 1 : 0);
