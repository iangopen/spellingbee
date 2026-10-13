// Runs ONLY the tier-bar focus check (tier-focus.mjs), against any copy of the
// prototype folder, without touching screens/ or checks.txt.
//   PW_MODULE=<playwright/index.mjs> [HM_DIR=<folder>] [HM_STRENGTHS=light] node design/harness/check-tier-focus.mjs
// Exits 1 if any configuration fails, so a broken focus rim cannot pass quietly.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { measureTierFocus } from "./tier-focus.mjs";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve(process.env.HM_DIR ?? "design/prototypes/homemade");
const STRENGTHS = (process.env.HM_STRENGTHS ?? "off,light,more").split(",");
const THEMES = ["dark", "light"];
const W = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const view = (page, w) => (page === "difficulty" ? (w === "phone" ? { width: 390, height: 1000 } : { width: 1280, height: 960 }) : W[w]);
const url = (page, q) => `${pathToFileURL(resolve(DIR, `${page}.html`)).href}?${new URLSearchParams(q)}`;

const browser = await chromium.launch();
const cmp = await (await browser.newContext()).newPage();
const { focusN, focusFails, focusMin } = await measureTierFocus({ browser, cmp, url, view, W, STRENGTHS, THEMES, log: console.log });
await browser.close();
console.log(`\n${focusFails === 0 ? "PASS" : "FAIL"} ${focusFails} of ${focusN} configurations failing (lowest ${focusMin.toFixed(2)}:1) in ${DIR}`);
process.exit(focusFails === 0 ? 0 : 1);
