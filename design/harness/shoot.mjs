// Capture harness screens (or prototype files) at desktop and phone width.
//
//   node shoot.mjs harness <outDir> [screen,screen...]   -> http://127.0.0.1:5199
//   node shoot.mjs files <outDir> <file.html> [...]       -> file:// prototypes
//
// Needs Playwright importable (installed outside the repo on purpose, so
// package.json is unchanged): set PW_MODULE to its path.
import { mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);

const WIDTHS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const THEMES = ["dark", "light"];
const ALL = [
  "home", "difficulty", "sp-round", "sp-correct", "sp-incorrect", "sp-results", "settings",
  "lobby", "waiting-room", "race-round", "race-locked", "race-roundend", "race-results",
  "elim-watch", "elim-myturn", "elim-results",
];

const [mode, outDir, ...rest] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const offHost = [];
const errors = [];

async function capture(url, name, theme, w, prep) {
  const ctx = await browser.newContext({
    viewport: WIDTHS[w],
    deviceScaleFactor: w === "phone" ? 2 : 1,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  page.on("request", (r) => {
    const h = new URL(r.url()).hostname;
    if (h && !["localhost", "127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"].includes(h)) offHost.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (prep) await prep(page);
  await page.waitForTimeout(700);
  const file = resolve(outDir, `${name}--${w}--${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

let n = 0;
if (mode === "harness") {
  const screens = rest.length ? rest[0].split(",") : ALL;
  for (const s of screens)
    for (const w of Object.keys(WIDTHS))
      for (const t of THEMES) {
        const prep = s === "settings" ? (p) => p.click(".settings-toggle") : null;
        await capture(`http://127.0.0.1:5199/?screen=${s}&theme=${t}`, s, t, w, prep);
        n++;
      }
} else {
  for (const f of rest)
    for (const w of Object.keys(WIDTHS))
      for (const t of THEMES) {
        const name = `${basename(dirname(resolve(f)))}__${basename(f, ".html")}`;
        await capture(pathToFileURL(resolve(f)).href, name, t, w, null);
        n++;
      }
}
await browser.close();
console.log(`captured ${n} screenshots -> ${outDir}`);
console.log(`off-host requests: ${offHost.length}${offHost.length ? "\n  " + [...new Set(offHost)].join("\n  ") : ""}`);
console.log(`page errors: ${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`);
