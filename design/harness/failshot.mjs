// Failure screenshots for the browser checks. run-checks.mjs sets FAIL_SHOTS=<dir> when it is
// given SB_OUT_DIR (in CI); without it both functions do nothing, so a local run is unchanged.
// A screenshot that cannot be taken is reported and never turns a check's result around.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.FAIL_SHOTS;
const file = (name) => { mkdirSync(DIR, { recursive: true }); return join(DIR, name.replace(/[^\w.-]+/g, "_").slice(0, 150) + ".png"); };

// The page as it is now (viewport only, never fullPage).
export async function failShot(page, name) {
  if (!DIR || !page) return;
  try { await page.screenshot({ path: file(name) }); } catch (e) { console.log(`  (failure screenshot "${name}" not saved: ${e.message.split("\n")[0]})`); }
}

// A PNG the check already captured (a Buffer, or base64 text).
export function failPng(png, name) {
  if (!DIR || !png) return;
  try { writeFileSync(file(name), typeof png === "string" ? Buffer.from(png, "base64") : png); } catch (e) { console.log(`  (failure screenshot "${name}" not saved: ${e.message})`); }
}
