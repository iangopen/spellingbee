// Keyboard-only pass over the elimination screens, using the harness's mocked state
// (no server, no second player). Drives ONLY the keyboard and records what each press
// lands on, so a regression in order, focus loss or a trap shows up as text.
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:5199] node design/harness/keyboard-elimination.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:5199";
const b = await chromium.launch();
let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${what}`); };

const where = (p) => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "<body>";
  const name = a.getAttribute("aria-label") || a.getAttribute("placeholder") || a.textContent?.trim().slice(0, 28) || a.className;
  return `${a.tagName.toLowerCase()}${a.className ? "." + String(a.className).split(" ")[0] : ""} "${name}"`;
});
async function tabs(p, n) {
  const seen = [];
  for (let i = 0; i < n; i++) { await p.keyboard.press("Tab"); seen.push(await where(p)); }
  return seen;
}
const open = async (screen, w = 900) => {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
  await p.goto(`${APP}/?screen=${screen}&theme=dark`, { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  return p;
};

console.log("\n## my turn (elim-myturn)");
{
  const p = await open("elim-myturn");
  const first = await where(p);
  console.log(`  on load, focus is: ${first}`);
  check(/answer-field/.test(first), "the answer field has focus on load (it is my turn)");
  await p.keyboard.type("rhythm");
  check((await p.inputValue(".answer-field")) === "rhythm", "typing reaches the field");
  const order = await tabs(p, 4);
  console.log(`  Tab x4 from the field: ${order.join("  ->  ")}`);
  check(await p.evaluate(() => document.querySelectorAll(".player-tokens a, .player-tokens button, .player-tokens [tabindex], .player-tokens input").length === 0), "the table's tokens contain nothing focusable");
  // Leave: two-step confirm by keyboard only
  await p.focus(".back-link");
  await p.keyboard.press("Enter");
  const afterLeave = await where(p);
  console.log(`  Enter on "Leave" -> focus is: ${afterLeave}`);
  check(await p.locator(".exit-confirm").count() === 1, "Enter on Leave opens the in-panel confirm");
  check(afterLeave !== "<body>", "focus is not lost to <body> when the confirm replaces the Leave link");
  check(/Keep playing/.test(afterLeave), "focus lands on 'Keep playing' (the safe choice) when the confirm opens");
  const conf = await tabs(p, 3);
  console.log(`  Tab x3 inside the confirm: ${conf.join("  ->  ")}`);
  await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab");
  await p.keyboard.press("Shift+Tab");
  await p.locator(".exit-confirm .btn", { hasText: "Keep playing" }).focus();
  await p.keyboard.press("Enter");
  check(await p.locator(".exit-confirm").count() === 0, "Enter on Keep playing closes the confirm");
  const back = await where(p);
  console.log(`  after Keep playing, focus is: ${back}`);
  check(/back-link/.test(back), "focus returns to the Leave link when the confirm closes");
}

console.log("\n## another player's turn (elim-watch)");
{
  const p = await open("elim-watch");
  check(await p.locator(".answer-field").count() === 0 && await p.locator("form").count() === 0, "no input and no form exist for a watcher");
  const order = await tabs(p, 4);
  console.log(`  Tab x4 from the top: ${order.join("  ->  ")}`);
  check(!order.slice(0, 3).some((x) => /answer-field/.test(x)), "no Tab stop lands on an answer field");
  check(await p.evaluate(() => !!document.querySelector('.waiting-turn[role="status"]')), "the waiting line is a status region");
}

console.log("\n## just eliminated (elim-knockout)");
{
  const p = await open("elim-knockout");
  check(await p.locator('.knockout[role="alert"]').count() === 1, "the knockout is announced (role=alert)");
  const order = await tabs(p, 3);
  console.log(`  Tab x3: ${order.join("  ->  ")}`);
  check(!order.some((x) => /answer-field/.test(x)), "no answer field while eliminated");
  await p.waitForTimeout(4800);
  check(await p.locator(".knockout").count() === 0, "the overlay clears itself after ~4s and the spectator view is back");
  check(await p.locator(".spectating").count() === 1, "the spectator line replaces it");
}

console.log("\n## final results (elim-results)");
{
  const p = await open("elim-results");
  const order = await tabs(p, 3);
  console.log(`  Tab x3: ${order.join("  ->  ")}`);
  check(order.some((x) => /Back to lobby/.test(x)), "'Back to lobby' is reachable by Tab");
  check(await p.evaluate(() => document.querySelectorAll(".standings a, .standings button, .standings [tabindex]").length === 0), "the standings list has nothing focusable");
  await p.locator(".btn-primary").focus();
  check(/Back to lobby/.test(await where(p)), "the primary button takes focus");
}

await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails === 0 ? 0 : 1);
