// Chooses the 7 bee colours that join Honey (index 0, the mascot's --bee-body in each theme).
// Constraints, in both themes:
//   - 3:1 against --panel-solid (dark), so the body itself draws the silhouette on dark tokens,
//     where the dark outline almost vanishes;
//   - 3:1 against --bee-line (the outline and stripes), the spec's rule, so the bands and the
//     edge read on the body;
//   - relative luminance at most 0.72, so the white eyes and wings still read on the head/body.
// One colour per hue family (OKLCH hue ranges below, a neutral last), so every bee has a plain
// colour name a player can say; pure distance alone picked two near-identical greys.
// Objective: the largest possible smallest CIEDE2000 distance between any two of the 8 colours
// (both honeys included) under normal vision AND simulated protanopia, deuteranopia and
// tritanopia. Exhaustive over a hue/lightness/chroma grid with a greedy start and swap passes.
//   node design/prototypes/avatar-maker/pick-colors.mjs
import { hex2rgb, rgb2hex, contrast, lum, minDe, unlin } from "./colorlab.mjs";

const HONEY = { dark: "#f0b24c", light: "#eaa640" };
const PANEL_SOLID = { dark: "#211c15", light: "#fffcf5" };
const BEE_LINE = { dark: "#1a1410", light: "#2c2419" };

// OKLCH -> sRGB (null if out of gamut)
function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lr = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (lr.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
  return hex2rgb(rgb2hex(lr.map((v) => unlin(Math.min(1, Math.max(0, v))))));
}
const ok = (rgb) =>
  lum(rgb) <= 0.72 &&
  ["dark", "light"].every((t) => contrast(rgb, hex2rgb(BEE_LINE[t])) >= 3) &&
  contrast(rgb, hex2rgb(PANEL_SOLID.dark)) >= 3;

const FAMILIES = [
  ["Coral", [15, 45]], ["Leaf", [125, 155]], ["Teal", [175, 205]], ["Sky", [225, 255]],
  ["Violet", [285, 315]], ["Pink", [335, 365]], ["Cloud", null],
];
const pools = FAMILIES.map(([, hr]) => {
  const out = [];
  for (let L = 0.6; L <= 0.92; L += 0.02) for (let C = hr ? 0.06 : 0; C <= (hr ? 0.2 : 0.02); C += 0.01) for (let h = hr ? hr[0] : 0; h <= (hr ? hr[1] : 350); h += 5) {
    const rgb = oklch(L, C, h % 360);
    if (rgb && ok(rgb)) out.push(rgb);
  }
  return out;
});
const pool = pools.flat();
const fixed = [hex2rgb(HONEY.dark), hex2rgb(HONEY.light)];
const score = (set) => { let m = Infinity; const all = [...fixed, ...set]; for (let i = 0; i < all.length; i++) for (let j = Math.max(i + 1, 2); j < all.length; j++) m = Math.min(m, minDe(all[i], all[j])); return m; };

let set = pools.map((p) => p[Math.floor(p.length / 2)]);
for (let pass = 0, improved = true; improved && pass < 30; pass++) {
  improved = false;
  for (let i = 0; i < set.length; i++) for (const c of pools[i]) {
    const trial = set.slice(); trial[i] = c;
    if (score(trial) > score(set) + 1e-9) { set = trial; improved = true; }
  }
}
console.log("pool", pool.length, "min dE2000 across normal+protan+deutan+tritan:", score(set).toFixed(2));
for (const [i, c] of set.entries()) console.log(FAMILIES[i][0].padEnd(7), rgb2hex(c), "L", lum(c).toFixed(3), "vs dark panel", contrast(c, hex2rgb(PANEL_SOLID.dark)).toFixed(2));
