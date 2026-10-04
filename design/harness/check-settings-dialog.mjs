// The Settings dialog behaviour in real Chrome (design/harness): focus moves in,
// Tab cannot leave, Escape closes, focus returns to the launcher, the page behind
// is inert. Presentation changes must never regress these (hardening #18).
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:5199] node design/harness/check-settings-dialog.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:5199";
const b = await chromium.launch();
let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${what}`); };
for (const theme of ["dark", "light"]) {
  const p = await (await b.newContext({ viewport: { width: 900, height: 800 } })).newPage();
  await p.goto(`${APP}/?screen=home&theme=${theme}`, { waitUntil: "networkidle" });
  await p.click(".settings-toggle");
  await p.waitForSelector("dialog[open]");
  const inDialog = () => p.evaluate(() => !!document.activeElement?.closest("dialog"));
  // A native modal lets Tab pass through the browser UI (activeElement is <body> for a
  // moment) and wrap; what must never happen is landing on the page behind it.
  const behind = () => p.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !a.closest("dialog"); });
  check(await inDialog(), `${theme}: focus moves into the dialog on open`);
  let stayed = true;
  for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); if (await behind()) stayed = false; }
  for (let i = 0; i < 6; i++) { await p.keyboard.press("Shift+Tab"); if (await behind()) stayed = false; }
  check(stayed, `${theme}: 46 Tab / Shift+Tab presses never land on the page behind it`);
  check(await p.evaluate(() => getComputedStyle(document.querySelector(".settings-drawer")).backgroundColor.startsWith("rgba(") === false), `${theme}: the drawer is opaque (no honeycomb through the form)`);
  await p.keyboard.press("Escape");
  // A dialog that ignores Escape must FAIL the check, not crash it.
  const closed = await p.waitForSelector("dialog[open]", { state: "detached", timeout: 3000 }).then(() => true, () => false);
  check(closed, `${theme}: Escape closes the dialog`);
  check(await p.evaluate(() => document.activeElement?.classList.contains("settings-toggle")), `${theme}: Escape closes and focus returns to the Settings button`);
}
await b.close();
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails === 0 ? 0 : 1);
