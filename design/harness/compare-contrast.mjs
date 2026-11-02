// Compares two app-wide contrast tables written by measure.mjs (TARGET=app), pair by pair.
// It reports; it never passes or fails anything (exit 0 unless a file is missing). Used in CI
// to set the Linux run beside the committed Windows run:
//   node design/harness/compare-contrast.mjs <new contrast-app.json> design/stage-results/final-contrast-app.json [out.md]
// A pair is (theme, screen, kind, label, need), the same key run-checks.mjs uses; its value is
// the worst ratio over widths. Differences come from font rasterisation and metrics (Linux
// FreeType vs Windows DirectWrite): text moves by a pixel, so the worst pixel behind it can too.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const [a, b, outFile] = process.argv.slice(2);
for (const f of [a, b]) if (!f || !existsSync(f)) { console.error(`usage: compare-contrast.mjs <new.json> <reference.json> [out.md] (missing: ${f})`); process.exit(2); }
const load = (f) => {
  const m = new Map();
  for (const x of JSON.parse(readFileSync(f, "utf8"))) {
    if (x.worst === null) continue;
    const k = [x.theme, x.page, x.kind, x.label, x.need].join("|");
    m.set(k, Math.min(m.get(k) ?? 99, x.worst));
  }
  return m;
};
const A = load(a), B = load(b);
const both = [...A.keys()].filter((k) => B.has(k));
const onlyA = [...A.keys()].filter((k) => !B.has(k));
const onlyB = [...B.keys()].filter((k) => !A.has(k));
const need = (k) => Number(k.split("|").at(-1));
const diffs = both.map((k) => ({ k, a: A.get(k), b: B.get(k), d: +(A.get(k) - B.get(k)).toFixed(2) }));
const changed = diffs.filter((x) => x.d !== 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
const crossed = diffs.filter((x) => (x.a >= need(x.k)) !== (x.b >= need(x.k)));
const failA = [...A.keys()].filter((k) => A.get(k) < need(k));
const bucket = (lo, hi) => changed.filter((x) => Math.abs(x.d) > lo && Math.abs(x.d) <= hi).length;
const lowest = (m) => [...m].sort((x, y) => x[1] / need(x[0]) - y[1] / need(y[0]))[0];
const fmt = (k) => k.split("|").slice(0, 4).join(", ").replace(/\|/g, "/");
const [la, lb] = [lowest(A), lowest(B)];

let md = `## Contrast: this run vs the reference\n\nThis run: \`${a}\`  \nReference: \`${b}\`\n\n`;
md += `| | This run | Reference |\n|---|---|---|\n| measured pairs | ${A.size} | ${B.size} |\n| failing pairs | ${failA.length} | ${[...B.keys()].filter((k) => B.get(k) < need(k)).length} |\n| closest to its threshold | ${la ? `${fmt(la[0])}: ${la[1]}:1 (needs ${need(la[0])})` : "-"} | ${lb ? `${fmt(lb[0])}: ${lb[1]}:1 (needs ${need(lb[0])})` : "-"} |\n\n`;
md += `Pairs in both: ${both.length}. Identical: ${both.length - changed.length}. Different: ${changed.length} (by up to 0.05: ${bucket(0, 0.05)}; 0.05-0.25: ${bucket(0.05, 0.25)}; 0.25-1: ${bucket(0.25, 1)}; over 1: ${bucket(1, Infinity)}). `;
md += `Crossing a threshold between the two: **${crossed.length}**. Only in this run: ${onlyA.length}. Only in the reference: ${onlyB.length}.\n\n`;
if (crossed.length) md += `### Crossing a threshold\n\n| Pair | This run | Reference | Needs |\n|---|---|---|---|\n${crossed.map((x) => `| ${fmt(x.k)} | ${x.a} | ${x.b} | ${need(x.k)} |`).join("\n")}\n\n`;
if (changed.length) md += `### Largest differences (up to 40)\n\n| Pair | This run | Reference | Difference |\n|---|---|---|---|\n${changed.slice(0, 40).map((x) => `| ${fmt(x.k)} | ${x.a} | ${x.b} | ${x.d > 0 ? "+" : ""}${x.d} |`).join("\n")}\n\n`;
const list = (title, ks) => (ks.length ? `### ${title} (${ks.length}, up to 40)\n\n${ks.slice(0, 40).map((k) => `- ${fmt(k)}`).join("\n")}\n\n` : "");
md += list("Only in this run", onlyA) + list("Only in the reference", onlyB);

console.log(md);
if (outFile) writeFileSync(outFile, md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
