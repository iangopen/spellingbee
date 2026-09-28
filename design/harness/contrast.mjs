// WCAG 2.x contrast ratios for palette pairs.
//   node contrast.mjs <palette.json>
// palette.json: { "name": { "pairs": [["label", "#fg", "#bg", "text"|"large"|"ui"], ...] } }
// Thresholds: text 4.5, large text 3, ui (non-text: borders, icons, focus rings) 3.
import { readFileSync } from "node:fs";

function lum(hex) {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const NEED = { text: 4.5, large: 3, ui: 3 };

if (process.argv[2]) {
  const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
  let fails = 0;
  for (const [name, { pairs }] of Object.entries(data)) {
    console.log(`\n## ${name}`);
    for (const [label, fg, bg, kind] of pairs) {
      const r = ratio(fg, bg);
      const ok = r >= NEED[kind];
      if (!ok) fails++;
      console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (need ${NEED[kind]})  ${label}  ${fg} on ${bg}`);
    }
  }
  console.log(`\n${fails} failing pair(s)`);
  process.exitCode = fails ? 1 : 0;
}
