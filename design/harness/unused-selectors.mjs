// Class selectors in src/**/*.css that no source file can produce.
//   node design/harness/unused-selectors.mjs [--fail]
// A class counts as USED if its name appears as a word anywhere in src/**/*.ts(x)
// (string literals, template pieces, tests), or in DYNAMIC below. This errs toward
// "used": it can miss a dead class that happens to share a word with live code, but
// it will not call a live class dead, and it never reads CSS-only state classes
// (those are in STATE). Exit 1 with --fail if anything is unused.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve("src");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(SRC);
const css = files.filter((f) => f.endsWith(".css"));
const code = files.filter((f) => /\.(ts|tsx)$/.test(f));

// Class names built at run time, so no literal exists to find. Each entry names the
// code that builds it.
const DYNAMIC = new Set([
  "btn-primary", "btn-secondary", "btn-text", "btn-danger", "btn-sm", // Button.tsx: `btn-${variant}`
  "is-correct", "is-incorrect",                                         // AnswerField.tsx: `is-${state}`
  "p1", "p2", "p3",                                                     // RaceResults.tsx: `p${rank}`
  "correct", "incorrect",                                               // AnswerField state class, TurnScreen feedback
  "low", "critical",                                                    // TimerBar.tsx: urgency suffix
  "elimination", "race",                                                // LobbyScreen: `room-preview ${preview.mode}`
]);

const words = new Set();
// Comments are stripped first: a class named only in a comment is not used.
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
for (const f of code) for (const m of stripComments(readFileSync(f, "utf8")).matchAll(/[A-Za-z][\w-]*/g)) words.add(m[0]);

const unused = new Map();
let total = 0;
for (const f of css) {
  const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\((["'])[\s\S]*?\1\)/g, "url()");
  for (const m of text.matchAll(/\.([A-Za-z][\w-]*)/g)) {
    const name = m[1];
    if (/^\d/.test(name)) continue;
    total++;
    if (words.has(name) || DYNAMIC.has(name)) continue;
    const k = `${f.slice(SRC.length + 1)}  .${name}`;
    unused.set(k, (unused.get(k) ?? 0) + 1);
  }
}
const list = [...unused.keys()].sort();
for (const k of list) console.log("UNUSED", k);
console.log(`\n${list.length} unused class selector${list.length === 1 ? "" : "s"} (of ${new Set([...css].flatMap(() => [])).size || "all"} scanned occurrences: ${total})`);
if (process.argv.includes("--fail") && list.length) process.exit(1);
