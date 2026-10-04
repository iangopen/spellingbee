// Every screen the app has, rendered with mocked state in the harness, requests only the
// site's own files: no font service, no analytics, no image host, nothing else. (The real
// multiplayer screens talk to Supabase and Cloudflare Turnstile by design; they are not
// opened here, because that would sign a guest in on the live project. check-real-app.mjs
// covers a full singleplayer game in the production build.)
//   PW_MODULE=<playwright/index.mjs> [APP_URL=http://localhost:5199] node design/harness/check-network-screens.mjs
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const APP = process.env.APP_URL ?? "http://localhost:5199";
const SCREENS = ["home", "difficulty", "sp-round", "sp-correct", "sp-incorrect", "sp-results", "settings", "lobby", "waiting-room",
  "race-round", "race-locked", "race-roundend", "race-results", "race-tie", "elim-watch", "elim-myturn", "elim-knockout", "elim-results"];
const b = await chromium.launch();
let foreign = 0, total = 0;
for (const theme of ["dark", "light"]) for (const screen of SCREENS) {
  const p = await (await b.newContext()).newPage();
  const bad = [];
  p.on("request", (r) => { const u = r.url(); total++; if (!u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== APP) bad.push(u); });
  await p.goto(`${APP}/?screen=${screen}&theme=${theme}`, { waitUntil: "networkidle" });
  if (screen === "settings") await p.click(".settings-toggle");
  await p.waitForTimeout(300);
  if (bad.length) { foreign += bad.length; console.log(`FAIL ${theme} ${screen}: ${bad.join(", ")}`); }
  await p.close();
}
await b.close();
console.log(`${foreign === 0 ? "PASS" : "FAIL"} ${SCREENS.length * 2} screen loads, ${total} requests, ${foreign} to anywhere but ${APP}`);
process.exit(foreign ? 1 : 0);
