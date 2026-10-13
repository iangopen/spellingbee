// Bytes a phone downloads for a first visit, from two built dist folders (default: this
// branch against a build of main). Raw and gzip, by kind. Fonts are woff2 (already
// compressed). "First load" = index.html + the JS + the CSS + the fonts the first screen
// requests (counted here as every font file: the worst case, a player with a long name).
//   node design/harness/bundle-size.mjs <branch-dist> <main-dist>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
function sizes(dist) {
  const out = {};
  for (const f of walk(resolve(dist))) {
    const ext = f.split(".").pop();
    const kind = { js: "js", css: "css", woff2: "fonts", html: "html" }[ext] ?? (/\.(png|svg|webmanifest|ico)$/.test(f) ? "icons/art" : "other");
    const buf = readFileSync(f);
    const o = (out[kind] ??= { files: 0, raw: 0, gz: 0 });
    o.files++; o.raw += buf.length; o.gz += ext === "woff2" || ext === "png" ? buf.length : gzipSync(buf).length;
  }
  return out;
}
const [a, b] = [sizes(process.argv[2]), sizes(process.argv[3])];
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + " kB";
const kinds = ["js", "css", "fonts", "html", "icons/art", "other"];
console.log("kind          branch(gz)    main(gz)    change      | branch(raw)   main(raw)");
let ta = 0, tb = 0;
for (const k of kinds) {
  const x = a[k] ?? { gz: 0, raw: 0, files: 0 }, y = b[k] ?? { gz: 0, raw: 0, files: 0 };
  if (!x.files && !y.files) continue;
  const d = x.gz - y.gz;
  console.log(`${k.padEnd(12)} ${kb(x.gz)}  ${kb(y.gz)}  ${(d >= 0 ? "+" : "") + (d / 1024).toFixed(1).padStart(6)} kB | ${kb(x.raw)} ${kb(y.raw)}   (${x.files} vs ${y.files} files)`);
  if (k !== "icons/art" && k !== "other") { ta += x.gz; tb += y.gz; }
}
console.log(`${"first-load".padEnd(12)} ${kb(ta)}  ${kb(tb)}  ${((ta - tb) >= 0 ? "+" : "") + ((ta - tb) / 1024).toFixed(1).padStart(6)} kB   (html + js + css + every font; icons and the share card are fetched only by browsers/crawlers that ask)`);
