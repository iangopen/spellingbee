// A keyboard-only pass of the REAL built app (vite preview): home, difficulty, a full round,
// results and settings. Every interaction is a key press; the only thing read from the page
// is where focus is (and the spoken word, from a speech spy, because the answer is spelled
// aloud, not shown). It prints what each press landed on, so a trap, a lost focus or a bad
// order shows up as text, then asserts the important facts.
// Multiplayer is not entered: it would sign a guest in on the live Supabase project.
//
//   npm run build && npx vite preview --port 4173
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:4173/spellingbee/] node design/harness/keyboard-real-app.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:4173/spellingbee/";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.addInitScript(() => {
  window.__spoken = [];
  const fake = { speaking: false, pending: false, getVoices: () => [], cancel() {}, addEventListener() {}, removeEventListener() {},
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend?.({}), 300); } };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
});

let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${what}`); };
const where = () => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "<body>";
  const name = a.getAttribute("aria-label") || a.getAttribute("placeholder") || a.textContent?.trim().replace(/\s+/g, " ").slice(0, 34) || a.className;
  return `${a.tagName.toLowerCase()} "${name}"`;
});
const key = (k) => p.keyboard.press(k);
async function tabTo(re, max = 14) {
  const seen = [];
  for (let i = 0; i < max; i++) { await key("Tab"); const w = await where(); seen.push(w); if (re.test(w)) return seen; }
  return seen;
}

console.log("\n## home");
await p.goto(APP, { waitUntil: "networkidle" });
console.log(`  on load, focus is: ${await where()}`);
const toSingle = await tabTo(/Singleplayer/);
console.log(`  Tab order to Singleplayer: ${toSingle.join("  ->  ")}`);
check(/Singleplayer/.test(toSingle.at(-1)), "Singleplayer is reachable by Tab");
check(toSingle.length <= 3, `and is within ${toSingle.length} Tab presses of the top of the page`);
await key("Enter");
await p.waitForSelector(".tier-bar");

console.log("\n## difficulty");
console.log(`  after Enter on Singleplayer, focus is: ${await where()}`);
const afterNav = await where();
check(/Spelling Bee/.test(afterNav), "after the screen change focus is on the new screen's heading, not lost to <body>");
const chips = await tabTo(/Practice mode/, 6);
console.log(`  Tab to the practice chip: ${chips.join("  ->  ")}`);
await key("Space");
check(await p.locator('.mode-chip[aria-pressed="true"]').count() === 1, "Space toggles Practice mode (aria-pressed true)");
check((await p.locator(".mode-hint").innerText()).includes("No clock"), "the hint line says what it did");
await key("Space");
check(await p.locator('.mode-chip[aria-pressed="true"]').count() === 0, "Space toggles it back off");
const bars = [];
for (let i = 0; i < 10; i++) { await key("Tab"); bars.push(await where()); }
console.log(`  Tab through Hide definition and the bars: ${bars.join("  ->  ")}`);
check(bars.filter((x) => /Novice|Easy|Building|Medium|Advanced|Hard|Expert|Master/.test(x)).length === 8, "all eight tier bars are Tab stops, in order");
await tabTo(/Novice/, 16).then(() => {});
// focus is wherever the loop left it; go to Novice explicitly with Shift+Tab / Tab until it is focused
for (let i = 0; i < 20 && !/Novice/.test(await where()); i++) await key("Shift+Tab");
check(/Novice/.test(await where()), "Novice can be focused by keyboard");
await key("Enter");

console.log("\n## round");
await p.waitForSelector(".answer-field");
await p.waitForFunction(() => window.__spoken.length >= 2);
console.log(`  focus on the new word: ${await where()}`);
check(/Your spelling|Type the word/.test(await where()), "the answer field has focus as soon as the word arrives");
const wordNow = () => p.evaluate(() => window.__spoken[window.__spoken.length - 1]);
await p.keyboard.type("zzzzqq");
await key("Enter");
await p.waitForSelector(".feedback.incorrect");
console.log(`  after a wrong answer, focus is: ${await where()}`);
check(/Your spelling|Type the word/.test(await where()), "focus stays in the answer field through the feedback (it is readOnly, not disabled)");
check((await p.locator('[role="status"]').first().innerText()).startsWith("Incorrect"), "the status region announces the outcome");
const n0 = await p.evaluate(() => window.__spoken.length);
await p.waitForFunction((n) => window.__spoken.length >= n + 2, n0, { timeout: 8000 });
await p.waitForSelector(".answer-field:not([readonly])");
// reach Hear it again and Skip by keyboard
const round = [];
for (let i = 0; i < 6; i++) { await key("Tab"); round.push(await where()); }
console.log(`  Tab order on the round: ${round.join("  ->  ")}`);
check(round.some((x) => /Hear it again/.test(x)) && round.some((x) => /Skip/.test(x)), "Hear it again and Skip are both reachable");
// Quit: two-step confirm by keyboard
for (let i = 0; i < 20 && !/Quit/.test(await where()); i++) await key("Shift+Tab");
await key("Enter");
console.log(`  Enter on Quit -> focus is: ${await where()}`);
check(/Keep playing/.test(await where()), "the quit confirm puts focus on 'Keep playing' (the safe choice)");
await key("Enter");
console.log(`  Enter on Keep playing -> focus is: ${await where()}`);
check(/Quit/.test(await where()), "and focus returns to the Quit link");

// play the rest of the game by keyboard alone
console.log("\n## finishing the game by keyboard");
for (let guard = 0; guard < 40 && (await p.locator(".results-screen").count()) === 0; guard++) {
  if ((await p.locator(".answer-field:not([readonly])").count()) === 0) { await p.waitForTimeout(150); continue; }
  const w = await wordNow();
  const at = await where();
  if (!/Your spelling|Type the word/.test(at)) { await p.locator(".answer-field").focus(); } // the one non-keyboard nudge, noted in the report
  await p.keyboard.type(w);
  await key("Enter");
  await p.waitForFunction(() => document.querySelector(".results-screen") || document.querySelector(".answer-field[readonly]"), null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(1250);
}
await p.waitForSelector(".results-screen", { timeout: 15000 });

console.log("\n## results");
console.log(`  focus on the results screen: ${await where()}`);
check(/Play again/.test(await where()), "focus lands on 'Play again' when the game ends");
await key("Tab");
console.log(`  next Tab: ${await where()}`);
check(/Change difficulty/.test(await where()), "Tab reaches 'Change difficulty'");
await key("Enter");
await p.waitForSelector(".tier-bar");
console.log(`  Enter on Change difficulty -> focus is: ${await where()}`);

console.log("\n## settings");
for (let i = 0; i < 24 && !/Settings/.test(await where()); i++) await key("Shift+Tab");
check(/Settings/.test(await where()), "the Settings button is reachable by keyboard");
await key("Enter");
await p.waitForSelector("dialog[open]");
console.log(`  focus on open: ${await where()}`);
check(/Close settings/.test(await where()), "focus moves into the dialog, on Close");
const stops = [];
for (let i = 0; i < 16; i++) { await key("Tab"); stops.push(await where()); }
console.log(`  Tab stops in the dialog: ${[...new Set(stops)].join("  |  ")}`);
const behind = await p.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !a.closest("dialog"); });
check(!behind, "after 16 Tabs focus is still not on the page behind");
await key("Escape");
await p.waitForSelector("dialog[open]", { state: "detached" });
console.log(`  Escape -> focus is: ${await where()}`);
check(/Settings/.test(await where()), "Escape closes and focus returns to the Settings button");

check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails === 0 ? 0 : 1);
