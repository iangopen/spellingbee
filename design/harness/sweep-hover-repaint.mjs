// SEARCH (not a gate): does hovering or focusing any control repaint anything outside that
// control? For every harness screen at both widths, every hoverable/focusable control
// (buttons, links, chips, tier bars, the avatar picker, inputs, selects, ranges) is hovered,
// then focused from the keyboard, on a fresh page with Chrome's paint flashing on and the
// shimmer frozen. Any repainted (green) pixel outside the control's own box, grown by
// 26px for its focus ring and halo (their own paint rect) and its marker shadow, is
// reported with where it was. Dark theme only: repaint behaviour does not depend on colour.
// This is how the tier-bar flash class of bug is searched for everywhere else.
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://127.0.0.1:5199] node design/harness/sweep-hover-repaint.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:5199";
const SCREENS = (process.env.ONLY ?? "home,difficulty,sp-round,sp-correct,sp-incorrect,sp-results,settings,lobby,waiting-room,race-round,race-locked,race-roundend,race-results,race-tie,elim-watch,elim-myturn,elim-results").split(",");
const VIEWS = { desktop: { width: 1100, height: 900 }, phone: { width: 390, height: 900 } };
const CONTROLS = "button, a[href], .chip-btn, .mode-chip, .tier-bar, input, select, textarea, [role=radio], label";
const RING = 26; // the focus ring's own paint rect: Chrome repaints 26px around a control for its 3px outline (offset 3) and 13px halo (measured on the "Modes" link)
const b = await chromium.launch();
const cmp = await (await b.newContext()).newPage();
const greenOutside = (frame, keep) => cmp.evaluate(async ([frame, keep]) => {
  const im = await new Promise((o) => { const i = new Image(); i.onload = () => o(i); i.src = "data:image/png;base64," + frame; });
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const t = c.getContext("2d"); t.drawImage(im, 0, 0);
  const d = t.getImageData(0, 0, im.width, im.height).data, w = im.width; const [kx, ky, kw, kh] = keep;
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    const X = (i / 4) % w, Y = (i / 4 / w) | 0;
    if (X >= kx && X < kx + kw && Y >= ky && Y < ky + kh) continue;
    if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 40) { n++; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  }
  return { n, box: n ? `(${x0},${y0})-(${x1},${y1})` : "" };
}, [frame, keep]);

async function open(screen, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  if (process.env.ADDCSS) await p.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.append(st); }), process.env.ADDCSS);
  await p.goto(`${APP}/?screen=${screen}&theme=dark`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  if (screen === "settings") await p.click(".settings-toggle");
  await p.mouse.move(vp.width - 2, vp.height - 2);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { for (const a of document.getAnimations()) { if (/sweep/.test(a.animationName)) { a.pause(); a.currentTime = 4500; } else if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); } });
  return { ctx, p };
}
// the visible controls on a screen, as stable indexes into document.querySelectorAll(CONTROLS)
const listControls = (p) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e, i) => {
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  const name = e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (e.textContent?.trim() ? ` "${e.textContent.trim().slice(0, 18)}"` : e.getAttribute("aria-label") ? ` [${e.getAttribute("aria-label").slice(0, 18)}]` : "");
  return { i, name, ok: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.pointerEvents !== "none" && !e.disabled && !e.closest("[inert]") };
}).filter((c) => c.ok), CONTROLS);

const findings = [];
let tested = 0;
for (const [w, vp] of Object.entries(VIEWS)) for (const screen of SCREENS) {
  const first = await open(screen, vp);
  const controls = await listControls(first.p);
  await first.ctx.close();
  for (const c of controls) for (const how of ["hover", "focus"]) {
    const { ctx, p } = await open(screen, vp);
    const el = p.locator(CONTROLS).nth(c.i);
    try { await el.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch { await ctx.close(); continue; }
    await p.waitForTimeout(150);
    const r = await el.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    if (r[1] + r[3] < 0 || r[1] > vp.height) { await ctx.close(); continue; }
    const keep = [Math.floor(r[0] - RING), Math.floor(r[1] - RING), Math.ceil(r[2] + 2 * RING) + 1, Math.ceil(r[3] + 2 * RING) + 1]; // inclusive of the RING-th pixel
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("DOM.enable"); await cdp.send("Overlay.enable"); await cdp.send("Overlay.setShowPaintRects", { result: true });
    await p.waitForTimeout(300);
    const frames = [];
    cdp.on("Page.screencastFrame", async (f) => { frames.push(f.data); await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send("Page.startScreencast", { format: "png" });
    await p.waitForTimeout(200);
    // single jumps, so the pointer never passes over (and hovers) a neighbouring control on the way
    if (how === "hover") { await p.mouse.move(r[0] + r[2] / 2, r[1] + r[3] / 2); await p.waitForTimeout(400); await p.mouse.move(vp.width - 2, vp.height - 2); }
    else { await el.evaluate((e) => { e.blur(); }); await p.keyboard.press("Shift"); await el.focus(); await p.waitForTimeout(400); await el.evaluate((e) => e.blur()); }
    await p.waitForTimeout(400);
    await cdp.send("Page.stopScreencast");
    let worst = { n: 0, box: "" };
    for (const f of frames) { const g = await greenOutside(f, keep); if (g.n > worst.n) worst = g; }
    tested++;
    if (worst.n) { findings.push(`${w} ${screen} ${how} ${c.name}: ${worst.n} px repainted outside it in ${worst.box}`); console.log("FOUND " + findings.at(-1)); }
    await ctx.close();
  }
}
await b.close();
console.log(`\n${tested} hover/focus interactions measured, ${findings.length} repaint outside their control`);
