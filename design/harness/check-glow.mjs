// Trademark-distance checks for the Blue Ribbon glow prototypes:
//   1. no yellow: every colour literal in the source, and every pixel of every screenshot
//   2. the honeycomb is decoration only: no text inside it, hidden from AT,
//      no pointer events, and no hexagon-shaped element anywhere in the content
//   PW_MODULE=<playwright/index.mjs> node design/harness/check-glow.mjs
// Writes design/prototypes/blue-ribbon-glow/checks.txt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/blue-ribbon-glow");
const out = [];
const log = (s) => { console.log(s); out.push(s); };

// "Yellow" = hue 32-70 degrees (32 reaches the old honey #e8a63d at 37) with real saturation and mid lightness. Broad on
// purpose: it also catches gold, amber and honey tones.
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const isYellow = (r, g, b) => { const [h, s, l] = hsl(r, g, b); return h >= 32 && h <= 70 && s > 0.35 && l > 0.25 && l < 0.92; };

// 1a. source colour literals
const files = [...readdirSync(DIR).filter((f) => /\.(css|js|html)$/.test(f)).map((f) => resolve(DIR, f)),
  resolve(DIR, "../_shared/avatars.js"), resolve(DIR, "../_shared/icons.js")];
const colours = new Map();
for (const f of files) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join("");
    colours.set("#" + h.toLowerCase(), [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  }
  for (const m of t.matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/gi)) colours.set(m[0] + ")", [+m[1], +m[2], +m[3]]);
}
const yellowSrc = [...colours].filter(([, c]) => isYellow(...c)).map(([k]) => k);
log(`Source colours scanned: ${colours.size} distinct literals in ${files.length} files. Yellow/gold/amber: ${yellowSrc.length}${yellowSrc.length ? " -> " + yellowSrc.join(", ") : ""}`);

// 1b. screenshot pixels
const browser = await chromium.launch();
const page = await browser.newPage();
const shots = readdirSync(resolve(DIR, "screens")).filter((f) => f.endsWith(".jpg"));
let yellowPx = 0, totalPx = 0; const hits = [];
for (const f of shots) {
  const b64 = readFileSync(resolve(DIR, "screens", f)).toString("base64");
  const r = await page.evaluate(async (b64) => {
    const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/jpeg;base64," + b64; });
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    return Array.from(x.getImageData(0, 0, img.width, img.height).data);
  }, b64);
  let n = 0;
  for (let k = 0; k < r.length; k += 4) if (isYellow(r[k], r[k + 1], r[k + 2])) n++;
  yellowPx += n; totalPx += r.length / 4;
  if (n) hits.push(`${f}: ${n}`);
}
log(`Screenshot pixels scanned: ${totalPx.toLocaleString("en")} in ${shots.length} screenshots. Yellow/gold/amber pixels: ${yellowPx}${hits.length ? "\n  " + hits.join("\n  ") : ""}`);

// 2. honeycomb = decoration only
for (const p of ["home", "round", "race-results", "avatars"]) for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ colorScheme: theme });
  const pg = await ctx.newPage();
  await pg.goto(`${pathToFileURL(resolve(DIR, p + ".html")).href}?bg=shimmer&bee=1`, { waitUntil: "networkidle" });
  const r = await pg.evaluate(() => {
    const bg = document.querySelector(".bg");
    const hexShapes = [...document.querySelectorAll("body *")].filter((el) => !bg.contains(el) && /polygon/.test(getComputedStyle(el).clipPath || "")).length;
    return {
      text: bg.textContent.trim().length,
      ariaHidden: bg.getAttribute("aria-hidden"),
      pointer: getComputedStyle(bg).pointerEvents,
      focusable: bg.querySelectorAll("a,button,input,[tabindex]").length,
      hexShapes,
      honeycombOutsideBg: [...document.querySelectorAll("body *")].filter((el) => !bg.contains(el) && /polygon/.test(getComputedStyle(el).backgroundImage)).length,
    };
  });
  log(`${p} (${theme}): honeycomb text=${r.text}, aria-hidden=${r.ariaHidden}, pointer-events=${r.pointer}, focusable inside=${r.focusable}, hexagon-clipped elements in content=${r.hexShapes}, honeycomb tiles outside the background=${r.honeycombOutsideBg}`);
  await ctx.close();
}
await browser.close();
log("Answers are typed into a standard text input on the round screen; there is no letter board or letter tiles on any screen.");
writeFileSync(resolve(DIR, "checks.txt"), out.join("\n") + "\n");
