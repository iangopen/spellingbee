// The maker's colour 0 with no cosmetic must BE the mascot: byte-identical to the app's
// avatarSvg("bee") (= mascotSvg()) from src/lib/beeArt.ts, imported directly (Node 22.6+
// strips the TypeScript types). Also checks that every one of the 2 x 64 avatars is
// deterministic, that all 64 per set are distinct strings, and that the legacy crown and
// flower are the app's queen and blossom accessories unchanged.
//   node --experimental-strip-types design/prototypes/avatar-maker/check-mascot.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
// bee-art.js is a classic browser script (the repo is "type": "module", so require() would
// treat it as ESM): run it in its own context, which also gives a truly fresh instance below.
const load = () => { const ctx = {}; vm.runInNewContext(readFileSync(path.join(here, "bee-art.js"), "utf8"), ctx); return ctx.BeeMaker; };
const maker = load();
const app = await import(pathToFileURL(path.join(here, "../../../src/lib/beeArt.ts")).href);

let fails = 0;
const check = (ok, what) => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${what}`); };

const mascot = app.mascotSvg();
for (const set of ["playful", "spelling"]) {
  check(maker.makerSvg(0, 0, set) === mascot, `${set}: colour 0 + none === app mascotSvg() (${mascot.length} chars)`);
  const all = [];
  for (let c = 0; c < 8; c++) for (let k = 0; k < 8; k++) all.push(maker.makerSvg(c, k, set));
  check(new Set(all).size === 64, `${set}: 64 distinct avatars`);
}
// Deterministic regardless of drawing order: rebuild in reverse in a fresh module instance.
const fresh = load();
let same = true;
for (const set of ["spelling", "playful"]) for (let c = 7; c >= 0; c--) for (let k = 7; k >= 0; k--) same &&= fresh.makerSvg(c, k, set) === maker.makerSvg(c, k, set);
check(same, "all 128 avatars identical when drawn in reverse order (seeded, order-independent)");
// The legacy accessories: queen's crown and blossom's flower are the app's, unchanged.
const appQueen = app.avatarSvg("queen"), appBlossom = app.avatarSvg("blossom");
const crown = maker.SETS.playful.items[1].draw(), flower = maker.SETS.playful.items[3].draw();
check(appQueen.includes(crown), "playful Crown is the app's queen crown, byte for byte");
check(appBlossom.includes(flower), "playful Flower is the app's blossom, byte for byte");
console.log(`\n${fails === 0 ? "PASS" : "FAIL"} ${fails} failures`);
process.exit(fails ? 1 : 0);
