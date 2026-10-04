// CSS custom properties that are defined but never read: dead tokens.
//   node design/harness/unused-tokens.mjs [--fail]
// A property is USED if `var(--name` appears in any stylesheet or source file, or it is
// set from script (style={{ "--name": ... }} / setProperty). Properties that exist only
// to be set per element and read by a descendant rule are found by the same test.
// Exit 1 with --fail if any are dead.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve("src");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(SRC).filter((f) => /\.(css|ts|tsx)$/.test(f));
const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");

const defined = new Set([...css.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
const used = new Set([...text.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]));
const dead = [...defined].filter((n) => !used.has(n)).sort();
for (const n of dead) console.log("DEAD", n);
console.log(`\n${dead.length} dead custom propert${dead.length === 1 ? "y" : "ies"} of ${defined.size} defined`);
if (process.argv.includes("--fail") && dead.length) process.exit(1);
