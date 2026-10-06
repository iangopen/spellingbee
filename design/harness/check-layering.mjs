// Decorations sit ON TOP of a panel's drawn outline, never under it. Every panel draws its
// hand-drawn outline as .panel::after (a 2px border, inset -3px, wobbled by an SVG filter);
// anything that straddles a panel's edge (the bee mascot, the rosettes, the stickers, the
// fixed Settings button when content scrolls under it) must paint above that line, like a
// sticker placed on the card.
//
// How it is measured: the outline has pointer-events: none, so normal hit-testing skips it
// and would report the decoration whatever the paint order. For this check only, the
// outline is made hit-testable; elementFromPoint then follows real paint order, and a hit
// on the outline reports the panel itself. The script walks the CENTRE of every panel's
// outline band (2px outside each edge, every 3px, clear of the rounded corners) on every
// harness screen, both widths, both themes, and at every point where something other than
// the panel and its ancestors covers the band, the topmost element must be that thing (or
// inside it), not the panel. At phone width it also scrolls the page under the fixed
// Settings button and probes where the button crosses an outline.
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:5199] node design/harness/check-layering.mjs
// Exit 1 on any point where the outline paints over a decoration.
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:5199";
const SCREENS = ["home", "difficulty", "sp-round", "sp-correct", "sp-incorrect", "sp-results", "settings", "lobby", "waiting-room",
  "race-round", "race-locked", "race-roundend", "race-results", "race-tie", "elim-watch", "elim-myturn", "elim-knockout", "elim-results"];
const VIEWS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const HITTABLE_OUTLINE = ".panel::after { pointer-events: auto !important; }";

// Runs in the page: probe every panel's outline band, return every covered point.
function probe() {
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const out = [];
  for (const panel of document.querySelectorAll(".panel")) {
    const r = panel.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const corner = 30; // keep off the rounded corners, where the band curves away
    const pts = [];
    for (let x = r.left + corner; x <= r.right - corner; x += 3) { pts.push([x, r.top - 2, "top"], [x, r.bottom + 2, "bottom"]); }
    for (let y = r.top + corner; y <= r.bottom - corner; y += 3) { pts.push([r.left - 2, y, "left"], [r.right + 2, y, "right"]); }
    for (const [x, y, side] of pts) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const stack = document.elementsFromPoint(x, y);
      const pi = stack.indexOf(panel);
      if (pi < 0) continue; // the band is not hit here (covered by a sibling panel, or off a curve)
      // something other than the panel and its ancestors covers this point of the band
      const coverers = stack.filter((e) => e !== panel && !e.contains(panel) && !(e.closest(".bg")));
      if (!coverers.length) continue;
      const top = stack[0];
      const hit = coverers.find((e) => !panel.contains(e) || e.closest(".sticker, .mascot, .rosette, .art-box")) ?? coverers[0];
      // name the decoration, not the svg path inside it
      const decoration = hit.closest(".sticker, .mascot, .rosette, .art-box, .settings-toggle") ?? hit;
      const ok = top !== panel && !top.contains(panel);
      out.push({ ok, side, x: Math.round(x), y: Math.round(y), panel: name(panel), deco: name(decoration), top: name(top) });
    }
  }
  return out;
}

const b = await chromium.launch();
let points = 0, bad = 0;
const places = new Map(); // "screen width panel <- decoration" -> {ok, n}
for (const theme of ["dark", "light"]) for (const [w, vp] of Object.entries(VIEWS)) for (const screen of SCREENS) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); }), HITTABLE_OUTLINE);
  await p.goto(`${APP}/?screen=${screen}&theme=${theme}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  if (screen === "settings") await p.click(".settings-toggle");
  if (screen === "elim-knockout") await p.waitForTimeout(800);
  // at the top of the page, then (phone) scrolled in steps so the fixed Settings button crosses outlines
  const maxScroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const scrolls = w === "phone" && screen !== "settings" ? [0, ...Array.from({ length: Math.floor(maxScroll / 24) }, (_, i) => (i + 1) * 24)] : [0];
  for (const s of scrolls) {
    await p.evaluate((y) => window.scrollTo(0, y), s);
    const res = await p.evaluate(probe);
    for (const r of res) {
      points++;
      const key = `${w} ${screen}: ${r.panel} <- ${r.deco}`;
      const o = places.get(key) ?? { ok: 0, bad: 0, theme: new Set(), example: null };
      if (r.ok) o.ok++; else { o.bad++; bad++; o.example ??= `${theme} scroll ${s} ${r.side} (${r.x},${r.y}) topmost=${r.top}`; }
      o.theme.add(theme);
      places.set(key, o);
    }
  }
  await ctx.close();
}
await b.close();
for (const [k, o] of [...places].sort()) console.log(`${o.bad ? "FAIL" : "  ok"}  ${k}  (${o.ok} points above the outline, ${o.bad} under it)${o.example ? "  e.g. " + o.example : ""}`);
console.log(`\n${bad === 0 ? "PASS" : "FAIL"} ${places.size} decoration/outline overlaps, ${points} points probed, ${bad} where the outline paints over the decoration`);
process.exit(bad ? 1 : 0);
