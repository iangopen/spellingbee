// Touch auto-submit, in a browser, against the REAL built app (vite preview), with mobile
// emulation: a 390x844 phone viewport, touch, and isMobile, which makes Chromium report
// "(pointer: coarse) and (hover: none)". Checks (singleplayer, practice mode so no word times
// out while the script types):
//   - the media query really matches on the phone context and not on the desktop one;
//   - Settings shows "Submit automatically when correct", on by default, on the phone only;
//   - a partial word does not submit; the last letter submits it with no Enter;
//   - a wrong word does not submit, and Enter still sends it;
//   - a trailing space (predictive text inserts "word " in one go) still submits;
//   - nothing submits while an IME composition is open; committing it submits;
//   - an auto-submit sounds and announces exactly like an Enter (submit tick + chime = 3
//     oscillators; the role="status" text is "Correct. Score N.");
//   - switching it off in Settings mid-game turns it off at once;
//   - on the desktop context typing the word submits nothing until Enter.
// Real phone SPEECH cannot be tested here: emulation changes the viewport and input, not
// the speech engine (this uses a fake one to learn the word).
//
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://127.0.0.1:4173/spellingbee/] [SHOTS=<dir>] node design/harness/check-touch-autosubmit.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:4173/spellingbee/";
const SHOTS = process.env.SHOTS;
const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${what}`); };

// A fake speechSynthesis that "speaks" instantly and records the text, so the script knows
// the word; and an oscillator counter for the sounds.
const initScript = () => {
  window.__speech = [];
  window.__osc = 0;
  const fake = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [],
    speak(u) { window.__speech.push(u.text); setTimeout(() => { u.onstart?.({}); setTimeout(() => u.onend?.({}), 20); }, 0); },
    cancel() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { createOscillator() { window.__osc++; return super.createOscillator(); } };
};

const b = await chromium.launch();

async function open(contextOptions) {
  const ctx = await b.newContext(contextOptions);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(initScript);
  await p.goto(APP, { waitUntil: "networkidle" });
  return { ctx, p, errors };
}

const word = (p) => p.evaluate(() => window.__speech.filter((t) => t && !t.includes(" ")).at(-1));
const status = (p) => p.locator('[role="status"][aria-live="polite"].sr-only').innerText();
const resolved = (p) => p.locator(".feedback.correct, .feedback.incorrect").count();

// Waits for a fresh, unlocked word and returns it.
async function nextWord(p, prev) {
  await p.waitForSelector(".answer-field:not([readonly])");
  await p.waitForFunction((pv) => { const w = window.__speech.filter((t) => t && !t.includes(" ")).at(-1); return w && w !== pv; }, prev ?? null, { timeout: 15000 });
  return word(p);
}
async function waitResolved(p, kind) {
  await p.waitForSelector(`.feedback.${kind}`, { timeout: 4000 });
}
async function waitNext(p) {
  await p.waitForSelector(".feedback.correct, .feedback.incorrect", { state: "detached", timeout: 6000 });
}
async function startPractice(p) {
  await p.getByRole("button", { name: "Singleplayer" }).click();
  await p.waitForSelector(".tier-bar");
  await p.getByRole("button", { name: "Practice mode" }).click();
  await p.click('.tier-bar[data-tier="novice"]');
}
// Closing Settings hands focus back to the gear from the dialog's "close" event, a few ms
// AFTER the open attribute goes. Typing before that loses the rest of the word to the gear
// (and Enter then reopens Settings), so wait until the dialog is gone and focus has landed.
async function closeSettings(p) {
  await p.getByRole("button", { name: "Close settings" }).click();
  await p.waitForFunction(() => !document.querySelector("dialog") && document.activeElement?.classList.contains("settings-toggle"));
}
const autoSwitch = (p) => p.getByRole("switch", { name: /Submit automatically when correct/ });

// ---------------------------------------------------------------- phone
console.log("\n## phone (390x844, touch, isMobile)");
const phone = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
let p = phone.p;
check(await p.evaluate((q) => matchMedia(q).matches, TOUCH_QUERY), `the phone context matches ${TOUCH_QUERY}`);

await p.getByRole("button", { name: "Settings", exact: true }).click();
await p.waitForSelector("dialog[open]");
check(await autoSwitch(p).count() === 1, 'Settings shows "Submit automatically when correct"');
check((await autoSwitch(p).getAttribute("aria-checked", { timeout: 2000 }).catch(() => null)) === "true", "it is on by default");
if (SHOTS && await autoSwitch(p).count()) {
  await autoSwitch(p).scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${SHOTS}/settings-autosubmit-phone.png` });
}
await closeSettings(p);

await startPractice(p);

// 1. partial, then the last letter
let w = await nextWord(p);
let osc0 = await p.evaluate(() => window.__osc);
await p.locator(".answer-field").pressSequentially(w.slice(0, -1));
await p.waitForTimeout(500);
check(await resolved(p) === 0 && !(await p.locator(".answer-field").getAttribute("readonly") !== null), `a partial word ("${w.slice(0, -1)}") is not submitted`);
await p.locator(".answer-field").pressSequentially(w.slice(-1));
let ok = await waitResolved(p, "correct").then(() => true, () => false);
check(ok, `typing the last letter of "${w}" submits it with no Enter`);
await p.waitForTimeout(600);
const autoOsc = (await p.evaluate(() => window.__osc)) - osc0;
const autoStatus = ok ? await status(p) : "";
check(/^Correct\. Score \d+\.$/.test(autoStatus), `screen-reader status after auto-submit reads like Enter's ("${autoStatus}")`);
check(autoOsc === 3, `auto-submit sounds like Enter: submit tick + chime = 3 oscillators (${autoOsc})`);
// Without auto-submit (old code) the word would wait forever in practice mode: Enter moves
// on, so every later check still reports.
if (!ok) await p.keyboard.press("Enter");
await waitNext(p).catch(() => {});

// 2. wrong word, then Enter
w = await nextWord(p, w);
await p.locator(".answer-field").pressSequentially("zzzzqq");
await p.waitForTimeout(600);
check(await resolved(p) === 0, "a wrong word is not submitted");
await p.keyboard.press("Enter");
check(await waitResolved(p, "incorrect").then(() => true, () => false), "Enter still submits (the wrong word is marked incorrect)");
await waitNext(p).catch(() => {});

// 3. trailing space from predictive text: the whole word plus a space in one input
w = await nextWord(p, w);
await p.locator(".answer-field").fill(w + " ");
ok = await waitResolved(p, "correct").then(() => true, () => false);
check(ok, `"${w} " (trailing space, one input event) submits as correct`);
if (ok) await waitNext(p);
else { await p.keyboard.press("Enter"); await waitNext(p).catch(() => {}); }

// 4. IME composition: nothing while composing, submit on commit
w = await nextWord(p, w);
const cdp = await p.context().newCDPSession(p);
await p.locator(".answer-field").focus();
await cdp.send("Input.imeSetComposition", { text: w, selectionStart: w.length, selectionEnd: w.length });
await p.waitForTimeout(600);
const composedValue = await p.locator(".answer-field").inputValue();
check(composedValue === w && await resolved(p) === 0, `nothing submits while a composition holds "${composedValue}"`);
await cdp.send("Input.insertText", { text: w });
ok = await waitResolved(p, "correct").then(() => true, () => false);
check(ok, "committing the composition submits it");
if (ok) await waitNext(p);
else { await p.keyboard.press("Enter"); await waitNext(p).catch(() => {}); }

// 5. switched off mid-game
w = await nextWord(p, w);
await p.getByRole("button", { name: "Settings", exact: true }).click();
await p.waitForSelector("dialog[open]");
await autoSwitch(p).click({ timeout: 2000 }).catch(() => {});
check((await autoSwitch(p).getAttribute("aria-checked", { timeout: 2000 }).catch(() => null)) === "false", "the switch turns off");
await closeSettings(p);
await p.locator(".answer-field").pressSequentially(w);
await p.waitForTimeout(600);
check(await resolved(p) === 0, "with the switch off, the correct word waits for Enter");
await p.keyboard.press("Enter");
ok = await waitResolved(p, "correct").then(() => true, () => false);
const why = ok ? "" : await p.evaluate(() => ({ value: document.querySelector(".answer-field")?.value, feedback: document.querySelector(".feedback")?.textContent, focus: document.activeElement?.className, practice: document.body.innerText.includes("practice") }));
check(ok, `and Enter submits it${ok ? "" : ` (typed "${w}"; ${JSON.stringify(why)})`}`);
await waitNext(p).catch(() => {});
check(phone.errors.length === 0, `no page errors on the phone${phone.errors.length ? ": " + phone.errors.join(" | ") : ""}`);
await phone.ctx.close();

// ---------------------------------------------------------------- desktop
console.log("\n## desktop (1000x900, mouse)");
const desk = await open({ viewport: { width: 1000, height: 900 } });
p = desk.p;
check(!(await p.evaluate((q) => matchMedia(q).matches, TOUCH_QUERY)), `the desktop context does not match ${TOUCH_QUERY}`);
await p.getByRole("button", { name: "Settings", exact: true }).click();
await p.waitForSelector("dialog[open]");
check(await autoSwitch(p).count() === 0, "Settings has no auto-submit switch on desktop");
await closeSettings(p);
await startPractice(p);
w = await nextWord(p);
osc0 = await p.evaluate(() => window.__osc);
await p.locator(".answer-field").pressSequentially(w);
await p.waitForTimeout(600);
check(await resolved(p) === 0, "on desktop the typed word waits for Enter");
await p.keyboard.press("Enter");
ok = await waitResolved(p, "correct").then(() => true, () => false);
await p.waitForTimeout(600);
const enterOsc = (await p.evaluate(() => window.__osc)) - osc0;
const enterStatus = ok ? await status(p) : "";
check(ok && /^Correct\. Score \d+\.$/.test(enterStatus), `Enter submits it ("${enterStatus}")`);
check(enterOsc === autoOsc, `Enter and auto-submit make the same sounds (${enterOsc} vs ${autoOsc} oscillators)`);
check(enterStatus.replace(/\d+/, "N") === autoStatus.replace(/\d+/, "N"), "and the same screen-reader announcement");
check(desk.errors.length === 0, `no page errors on desktop${desk.errors.length ? ": " + desk.errors.join(" | ") : ""}`);

await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails === 0 ? 0 : 1);
