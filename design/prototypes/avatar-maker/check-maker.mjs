// Behaviour check for the avatar maker prototype, opened straight from disk (file://).
//   PW_MODULE=<playwright/index.mjs> node design/prototypes/avatar-maker/check-maker.mjs
// Keyboard: Tab order, Enter/Space on an arrow, Left/Right/Home/End with focus staying put,
// wrapping at both ends. Touch: tap on a phone context. Names: "Next bee colour, 2 of 8".
// Targets >= 44px, measured with elementFromPoint at the centre and the four inner corners.
// The visible focus ring. The polite live region: exactly one text change per step. Reduced
// motion: no hop animation under the OS setting or ?motion=reduce. The token halo filter is
// applied. No page errors and no request leaves file://.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const here = path.dirname(fileURLToPath(import.meta.url));
const URL_ = pathToFileURL(path.join(here, "index.html")).href;

let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${what}`); };
const b = await chromium.launch();

async function open(opts = {}, query = "") {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const p = await ctx.newPage();
  const errors = [], offDisk = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) offDisk.push(r.url()); });
  await p.goto(URL_ + query);
  await p.evaluate(() => {
    window.__liveChanges = 0;
    new MutationObserver((m) => { window.__liveChanges += m.length ? 1 : 0; }).observe(document.getElementById("desc"), { childList: true, characterData: true, subtree: true });
  });
  return { ctx, p, errors, offDisk };
}
const row = (p, r) => p.locator(`[data-row="${r}"]`);
const text = (p, r) => row(p, r).locator("[data-value]").innerText();
const count = (p, r) => row(p, r).locator("[data-count]").innerText();
const desc = (p) => p.locator("#desc").innerText();
const focusedLabel = (p) => p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.id);

// ---------------------------------------------------------------- keyboard (desktop)
console.log("\n## keyboard, 1280 x 900");
let { ctx, p, errors, offDisk } = await open();
check(await desc(p) === "Honey bee", `starts as the mascot: "${await desc(p)}"`);
check(await p.locator("#desc").getAttribute("aria-live") === "polite", "the description is a polite live region");
check(await p.locator("#preview").getAttribute("role") === "img" && await p.locator("#preview").getAttribute("aria-labelledby") === "desc", "the preview is an image named by the description");
const prevC = row(p, "color").locator(".arrow").first(), nextC = row(p, "color").locator(".arrow").last();
check(await prevC.getAttribute("aria-label") === "Previous bee colour, 1 of 8" && await nextC.getAttribute("aria-label") === "Next bee colour, 1 of 8", `arrow names: "${await prevC.getAttribute("aria-label")}", "${await nextC.getAttribute("aria-label")}"`);

// Tab order from the top of the maker
await p.locator("#maker-h").evaluate((h) => { h.tabIndex = -1; h.focus(); });
const order = [];
for (let i = 0; i < 6; i++) { await p.keyboard.press("Tab"); order.push(await focusedLabel(p)); }
check(JSON.stringify(order) === JSON.stringify(["Previous bee colour, 1 of 8", "Next bee colour, 1 of 8", "Previous cosmetic, 1 of 8", "Next cosmetic, 1 of 8", "surprise", "name"]), `Tab order: ${order.join(" → ")}`);

await nextC.focus();
await p.waitForTimeout(400); // the arrow's box-shadow transition (0.25s, as the app's .btn) has to finish
const ring = await nextC.evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow }; });
check(ring.style === "solid" && ring.width === "3px" && ring.shadow.includes("7px"), `keyboard focus shows the app's ring: outline ${ring.style} ${ring.width}, box-shadow ${ring.shadow}`);
let live0 = await p.evaluate(() => window.__liveChanges);
await p.keyboard.press("Enter");
check(await text(p, "color") === "Red" && await count(p, "color") === "2 of 8" && await desc(p) === "Red bee", `Enter on Next: ${await text(p, "color")}, ${await count(p, "color")}, "${await desc(p)}"`);
check(await focusedLabel(p) === "Next bee colour, 2 of 8", `focus stays on the button, whose name now says "${await focusedLabel(p)}"`);
check((await p.evaluate(() => window.__liveChanges)) - live0 === 1, "one live-region change per step");
await p.keyboard.press(" ");
check(await count(p, "color") === "3 of 8", `Space steps too (${await count(p, "color")})`);
await p.keyboard.press("ArrowRight");
check(await count(p, "color") === "4 of 8" && await focusedLabel(p) === "Next bee colour, 4 of 8", `→ steps and focus stays (${await count(p, "color")})`);
await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
check(await count(p, "color") === "2 of 8", `← steps back (${await count(p, "color")})`);
await p.keyboard.press("End");
check(await text(p, "color") === "Grey" && await count(p, "color") === "8 of 8", `End: ${await text(p, "color")} ${await count(p, "color")}`);
await p.keyboard.press("ArrowRight");
check(await count(p, "color") === "1 of 8", `wraps 8 → 1 (${await count(p, "color")})`);
await p.keyboard.press("ArrowLeft");
check(await count(p, "color") === "8 of 8", `wraps 1 → 8 (${await count(p, "color")})`);
await p.keyboard.press("Home");
check(await count(p, "color") === "1 of 8", `Home: ${await count(p, "color")}`);
const scrollY0 = await p.evaluate(() => scrollY);
await p.keyboard.press("ArrowDown");
check(await count(p, "color") === "1 of 8", "↓ does nothing to the row (no vertical trap)");
void scrollY0;

// cosmetic row, then the description phrase
const nextK = row(p, "cosmetic").locator(".arrow").last();
await nextK.focus();
await p.keyboard.press("Enter");
await nextC.focus(); for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowRight");
check(await desc(p) === "Blue bee wearing a crown", `description: "${await desc(p)}"`);
await p.locator('input[name="set"][value="spelling"]').check();
check(await desc(p) === "Blue bee wearing a graduation cap" && await text(p, "cosmetic") === "Graduation cap", `the other set at the same index: "${await desc(p)}"`);
await p.locator('input[name="set"][value="playful"]').check();

// Surprise me never repeats the current pair
const before = await desc(p);
let changed = true;
for (let i = 0; i < 12; i++) { const was = await desc(p); await p.locator("#surprise").click(); if (await desc(p) === was) changed = false; }
check(changed, `Surprise me always changes the bee (12 presses, from "${before}")`);

// names show on the tokens
await p.locator("#name").fill("Zoë");
check((await p.locator("#roster .player-row").first().innerText()).includes("Zoë") && (await p.locator("[data-you-name]").innerText()) === "Zoë", "the name field updates the tokens");
const rosterText = await p.locator("#roster .player-row").first().evaluate((li) => li.querySelector(".player-name").textContent);
check(/^Zoë, [a-z]+ bee/.test(rosterText), `waiting-room row reads "${rosterText}"`);

// the halo is on every token and the preview
const filters = await p.evaluate(() => [...document.querySelectorAll(".art-box .art")].map((a) => getComputedStyle(a).filter));
check(filters.length > 30 && filters.every((f) => f.includes("av-halo")), `token halo filter on all ${filters.length} avatars`);

// targets >= 44px: the layout box, and a 44px circle probed with elementFromPoint (Chrome's
// hit test honours border-radius, so the rounded corners are not counted): the centre, the
// four points 22px out on the axes and the four diagonals at the same radius.
const targets = await p.evaluate(() => [...document.querySelectorAll(".arrow, #surprise, #name")].map((el) => {
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, k = 21.5, d = k / Math.SQRT2;
  const pts = [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k], [d, d], [d, -d], [-d, d], [-d, -d]];
  const hit = pts.every(([x, y]) => el.contains(document.elementFromPoint(cx + x, cy + y)));
  return { id: el.getAttribute("aria-label") ?? el.id, w: Math.round(r.width), h: Math.round(r.height), hit };
}));
check(targets.every((t) => t.w >= 44 && t.h >= 44 && t.hit), `every control >= 44 x 44 and hit where drawn: ${targets.map((t) => `${t.w}x${t.h}${t.hit ? "" : " MISS"}`).join(", ")}`);

// hop animation runs normally (motion allowed)
await nextC.click();
const anim = await p.locator("#preview .art-box").evaluate((el) => getComputedStyle(el).animationName);
check(anim === "hop", `with motion allowed, a step hops (animation "${anim}")`);
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
check(offDisk.length === 0, `no request leaves the disk${offDisk.length ? ": " + offDisk.join(", ") : ""}`);
await ctx.close();

// ---------------------------------------------------------------- touch (phone)
console.log("\n## touch, 390 x 844");
({ ctx, p, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }));
await row(p, "cosmetic").locator(".arrow").last().tap();
await row(p, "cosmetic").locator(".arrow").last().tap();
check(await text(p, "cosmetic") === "Party hat" && await count(p, "cosmetic") === "3 of 8", `two taps on Next cosmetic: ${await text(p, "cosmetic")}, ${await count(p, "cosmetic")}`);
await row(p, "color").locator(".arrow").first().tap();
check(await text(p, "color") === "Grey", `a tap on Previous colour wraps to ${await text(p, "color")}`);
check(await desc(p) === "Grey bee wearing a party hat", `"${await desc(p)}"`);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check(overflow <= 0, `no horizontal scroll at phone width (overflow ${overflow}px)`);
const phoneTargets = await p.evaluate(() => [...document.querySelectorAll(".arrow")].map((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height); }));
check(phoneTargets.every((s) => s >= 44), `arrows at phone width: ${phoneTargets.map(Math.round).join(", ")} px`);
check(errors.length === 0, "no page errors on the phone");
await ctx.close();

// ---------------------------------------------------------------- reduced motion
console.log("\n## reduced motion");
({ ctx, p } = await open({ reducedMotion: "reduce" }));
await row(p, "color").locator(".arrow").last().click();
let a = await p.locator("#preview .art-box").evaluate((el) => getComputedStyle(el).animationName);
check(a === "none", `OS reduce: no hop (animation "${a}"), and the step still lands (${await desc(p)})`);
await ctx.close();
({ ctx, p } = await open({}, "?motion=reduce"));
await row(p, "color").locator(".arrow").last().click();
const d = await p.locator("#preview .art-box").evaluate((el) => getComputedStyle(el).animationDuration);
check(d === "1e-06s" || d === "0.001ms" || parseFloat(d) < 0.001, `in-app override: the hop collapses to ${d}`);
await ctx.close();

await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails ? 1 : 0);
