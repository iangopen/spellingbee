// Drives the REAL built app (vite preview) through a full singleplayer game and checks,
// in a browser, the things unit tests cannot:
//   1. SOUND: every outcome sounds exactly once (the miss bell, the correct chime, the
//      submit tick), counted as oscillators created. A double chime once clipped the
//      lead-in, so a second sound per outcome is a failure.
//   2. SPEECH: the lead-in and the word each play to their END. A fake speechSynthesis
//      with Chrome's semantics (cancel() while something is speaking or queued fires an
//      'interrupted'/'canceled' error on it) records every utterance; any interruption
//      in the natural flow is a failure. (Real audio cannot be heard headless; this
//      catches the cause, a cancel landing on live speech.)
//   3. NETWORK: every request, across the home, difficulty, settings, a 30-word round and
//      the results screen, goes to the site's own origin. Nothing is sent anywhere else.
//      Multiplayer is NOT clicked: it would sign a guest in on the live Supabase project.
//   4. no page errors or console errors.
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:4173/spellingbee/] node design/harness/check-real-app.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:4173/spellingbee/";
const ORIGIN = new URL(APP).origin;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
const p = await ctx.newPage();

const requests = [];
const errors = [];
p.on("request", (r) => requests.push(r.url()));
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

// CONTROL=cancel breaks the thing on purpose (a cancel() landing 200ms into the first lead-in) to
// prove this check can fail. Never set in normal runs.
await p.addInitScript((control) => { window.__control = control; }, process.env.CONTROL ?? "");
await p.addInitScript(() => {
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  window.__speech = [];   // { text, t, end, endedBy }
  window.__osc = [];      // { t }
  // --- fake speechSynthesis, Chrome semantics ---
  const queue = [];
  let current = null;
  const finish = (rec, by, u) => {
    rec.end = now(); rec.endedBy = by;
    if (by === "end") u.onend?.({});
    else u.onerror?.({ error: by });
    current = null;
    next();
  };
  const next = () => {
    if (current || !queue.length) return;
    const u = queue.shift();
    const rec = u.__rec;
    current = { u, rec, timer: setTimeout(() => finish(rec, "end", u), 350 + u.text.length * 28) };
    u.onstart?.({});
  };
  const fake = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [],
    speak(u) {
      u.__rec = { text: u.text, t: now() };
      window.__speech.push(u.__rec);
      queue.push(u);
      if (window.__control === "cancel" && window.__speech.length === 1) setTimeout(() => fake.cancel(), 200);
      fake.pending = queue.length > 0; next(); fake.speaking = !!current;
    },
    cancel() {
      if (current) { clearTimeout(current.timer); finish(current.rec, "interrupted", current.u); }
      for (const u of queue.splice(0)) { u.__rec.end = now(); u.__rec.endedBy = "canceled"; u.onerror?.({ error: "canceled" }); }
      fake.speaking = false; fake.pending = false;
    },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: new Proxy(fake, { get: (t, k) => (k === "speaking" ? !!current : k === "pending" ? queue.length > 0 : t[k]) }), configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  // --- count oscillators ---
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    createOscillator() { window.__osc.push({ t: now() }); return super.createOscillator(); }
  };
});

let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${what}`); };
const oscCount = () => p.evaluate(() => window.__osc.length);
const speech = () => p.evaluate(() => window.__speech);

console.log("\n## home, difficulty, settings");
await p.goto(APP, { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Singleplayer" }).click();
await p.waitForSelector(".tier-bar");
await p.click(".settings-toggle");
await p.waitForSelector("dialog[open]");
await p.keyboard.press("Escape");
await p.waitForSelector("dialog[open]", { state: "detached" });
check(true, "home, difficulty and the Settings dialog opened and closed");

// WORDS_PER_GAME in useGameEngine.ts
const WORDS = 30;
console.log(`\n## a full ${WORDS}-word game`);
await p.click('.tier-bar[data-tier="novice"]');
const outcomes = [];
for (let i = 0; i < WORDS; i++) {
  await p.waitForSelector(".answer-field:not([readonly])");
  // the lead-in then the word are spoken; wait until the WORD (the last utterance) has finished
  await p.waitForFunction(() => { const s = window.__speech; return s.length >= 2 && s[s.length - 1].endedBy === "end"; }, null, { timeout: 15000 });
  const spoken = await speech();
  const word = spoken[spoken.length - 1].text;
  const wrong = i === 0;
  const before = await oscCount();
  await p.fill(".answer-field", wrong ? "zzzzqq" : word);
  await p.keyboard.press("Enter");
  await p.waitForSelector(wrong ? ".feedback.incorrect" : ".feedback.correct", { timeout: 4000 });
  await p.waitForTimeout(900); // let every sound finish being scheduled; nothing else may start
  const made = (await oscCount()) - before;
  outcomes.push({ i, wrong, made });
  if (i < WORDS - 1) await p.waitForFunction((n) => window.__speech.length > n, spoken.length, { timeout: 8000 });
}
await p.waitForSelector(".results-screen", { timeout: 8000 });
console.log(`  oscillators per word (submit tick + outcome): ${outcomes.map((o) => o.made).join(" ")}`);
const miss = outcomes.filter((o) => o.wrong);
const hits = outcomes.filter((o) => !o.wrong);
check(miss.every((o) => o.made === 1 + 3), "a miss sounds ONCE: the submit tick (1) + one bell (3 partials) = 4 oscillators");
check(hits.every((o) => o.made === 1 + 2), "a correct answer sounds ONCE: the submit tick (1) + one chime (2 notes) = 3 oscillators");

const spoken = await speech();
const interrupted = spoken.filter((s) => s.endedBy === "interrupted" || s.endedBy === "canceled");
console.log(`  utterances: ${spoken.length}, ended normally: ${spoken.filter((s) => s.endedBy === "end").length}, interrupted/canceled: ${interrupted.length}`);
check(interrupted.length === 0, "no utterance was interrupted or cancelled in the natural flow (the lead-in plays in full)");
const leadIns = spoken.filter((s) => / /.test(s.text));
check(leadIns.length === WORDS && leadIns.every((s) => s.endedBy === "end"), `all ${WORDS} lead-ins ran to their end before the word (${leadIns.length} found)`);
check(spoken.length === WORDS * 2, `each word was announced exactly once: ${WORDS} lead-ins + ${WORDS} words = ${WORDS * 2} utterances`);

console.log("\n## results screen");
check(await p.locator(".results-screen").count() === 1, "the results screen appeared after the last word");

console.log("\n## network: every request, whole session");
const kinds = {};
const foreign = [];
for (const u of requests) {
  if (u.startsWith("data:") || u.startsWith("blob:")) { kinds["data/blob"] = (kinds["data/blob"] ?? 0) + 1; continue; }
  const url = new URL(u);
  if (url.origin !== ORIGIN) { foreign.push(u); continue; }
  const ext = url.pathname.split(".").pop();
  kinds[ext] = (kinds[ext] ?? 0) + 1;
}
console.log(`  ${requests.length} requests: ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")}`);
check(foreign.length === 0, `every request went to ${ORIGIN} (foreign: ${foreign.length ? foreign.join(", ") : "none"})`);
check(errors.length === 0, `no page or console errors${errors.length ? ": " + errors.join(" | ") : ""}`);

await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails === 0 ? 0 : 1);
