// Retakes docs/screenshots/*.png (the README images) from a LOCAL build, with no live users:
//   - singleplayer screens (home, difficulty, a round, results) come from the production build
//     served by `vite preview`, played for real; the browser speaks to nothing but localhost
//     (a fake speechSynthesis reads the word so the script can type it);
//   - multiplayer screens (lobby, race results, elimination) come from the harness, which renders
//     the real components with MOCKED state: opening the real multiplayer screens would sign a
//     guest in on the live Supabase project, which this must never do.
//
//   npm run build && npx vite preview --port 4173            (terminal 1)
//   npx vite --config design/harness/vite.config.ts          (terminal 2)
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-readme.mjs
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://127.0.0.1:4173/spellingbee/";
const HARNESS = process.env.HARNESS_URL ?? "http://127.0.0.1:5199";
const OUT = resolve("docs/screenshots");
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const foreign = [];

// ---- the real build ----
{
  const ctx = await b.newContext({ viewport: { width: 1100, height: 780 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("request", (r) => { const u = r.url(); if (!u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== new URL(APP).origin) foreign.push(u); });
  await p.addInitScript(() => {
    window.__spoken = [];
    const fake = { speaking: false, pending: false, getVoices: () => [], cancel() {}, addEventListener() {}, removeEventListener() {},
      speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend?.({}), 200); } };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    // a believable set of best scores, in the browser's own storage (this page only)
    const best = { novice: 214, easy: 187, building: 152, medium: 118, advanced: 64 };
    for (const [k, v] of Object.entries(best)) localStorage.setItem(`spellingbee:best:${k}`, String(v));
  });
  await p.goto(APP, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.screenshot({ path: resolve(OUT, "home.jpg"), type: "jpeg", quality: 86 });
  await p.getByRole("button", { name: "Singleplayer" }).click();
  await p.waitForSelector(".tier-bar");
  await p.waitForTimeout(700);
  await p.screenshot({ path: resolve(OUT, "tiers.jpg"), type: "jpeg", quality: 86, fullPage: true });
  await p.click('.tier-bar[data-tier="medium"]');
  await p.waitForSelector(".answer-field:not([readonly])");
  await p.waitForFunction(() => window.__spoken.length >= 2);
  const word = await p.evaluate(() => window.__spoken.at(-1));
  await p.waitForTimeout(500);
  await p.keyboard.type(word.slice(0, Math.max(2, Math.ceil(word.length / 2))));
  await p.waitForTimeout(500);
  await p.screenshot({ path: resolve(OUT, "round.jpg"), type: "jpeg", quality: 86 });
  // play it out so the results screen is a real one
  // Two utterances per word (lead-in, then the word): wait for the NEXT word to be announced
  // before answering, so the answer is for the word on screen.
  for (let i = 0; i < 30; i++) {
    await p.waitForFunction((n) => window.__spoken.length >= n, 2 * (i + 1), { timeout: 8000 });
    await p.waitForSelector(".answer-field:not([readonly])");
    const w = await p.evaluate(() => window.__spoken.at(-1));
    await p.locator(".answer-field").fill(w);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(1250);
  }
  await p.waitForSelector(".results-screen", { timeout: 20000 });
  await p.waitForTimeout(1300); // let the rosette finish pinning
  await p.screenshot({ path: resolve(OUT, "results.jpg"), type: "jpeg", quality: 86 });
  await ctx.close();
}

// ---- the harness (mocked state) ----
for (const [name, screen, vp] of [
  ["lobby", "lobby", { width: 1100, height: 780 }],
  ["race-results", "race-results", { width: 1100, height: 780 }],
  ["elimination", "elim-myturn", { width: 1100, height: 900 }],
]) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.goto(`${HARNESS}/?screen=${screen}&theme=dark`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1400);
  await p.screenshot({ path: resolve(OUT, `${name}.jpg`), type: "jpeg", quality: 86, fullPage: screen === "lobby" });
  await ctx.close();
}
await b.close();
console.log("wrote home, tiers, round, results, lobby, race-results, elimination");
console.log(foreign.length ? `FOREIGN REQUESTS: ${foreign.join(", ")}` : "every request from the real build went to localhost");
process.exit(foreign.length ? 1 : 0);
