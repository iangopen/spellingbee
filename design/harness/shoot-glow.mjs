// Screenshots for the Blue Ribbon glow prototypes (design/prototypes/blue-ribbon-glow).
//   PW_MODULE=<playwright/index.mjs> node design/harness/shoot-glow.mjs
// Writes design/prototypes/blue-ribbon-glow/screens/*.jpg and checks that every
// reduced-motion capture is pixel-identical to the static-background capture.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/blue-ribbon-glow");
const OUT = resolve(DIR, "screens");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const W = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const url = (page, q) => `${pathToFileURL(resolve(DIR, `${page}.html`)).href}?${new URLSearchParams(q)}`;
const browser = await chromium.launch();
const errors = [];
const bufs = new Map();

async function shot(name, page, q, { w, theme, motion = "no-preference", prep } = {}) {
  const ctx = await browser.newContext({ viewport: W[w], deviceScaleFactor: 1, colorScheme: theme, reducedMotion: motion });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(url(page, { ...q, theme }), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(motion === "reduce" ? 200 : 1400); // let entry animations finish
  if (prep) await prep(p);
  // Saved as JPEG to keep the repo light; kept in memory as lossless PNG for
  // the pixel-exact reduced-motion comparisons.
  await p.screenshot({ path: resolve(OUT, `${name}.jpg`), type: "jpeg", quality: 88 });
  bufs.set(name, await p.screenshot({ type: "png" }));
  await ctx.close();
}

// Freeze the shimmer with its band in the middle of the screen.
const midSweep = (p) =>
  p.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (/sweep-/.test(a.animationName)) { a.pause(); a.currentTime = 4500; }
    }
  });
const pointerAt = (fx, fy) => async (p) => {
  const vp = p.viewportSize();
  await p.mouse.move(vp.width * fx, vp.height * fy, { steps: 8 });
  await p.waitForTimeout(1200);
};

let n = 0;
// F. FINAL: the picked direction (slow shimmer caught mid-sweep, bee, old cell size)
for (const page of ["home", "round", "race-results"])
  for (const w of ["desktop", "phone"])
    for (const theme of ["dark", "light"]) {
      await shot(`final--${page}--${w}--${theme}`, page, { bg: "shimmer", bee: "1" }, { w, theme, prep: midSweep }); n++;
    }
// A. main set: static background, bee off/on, both widths, both themes
for (const page of ["home", "round", "race-results"])
  for (const bee of ["0", "1"])
    for (const w of ["desktop", "phone"])
      for (const theme of ["dark", "light"]) {
        await shot(`${page}--static--bee${bee}--${w}--${theme}`, page, { bg: "static", bee }, { w, theme }); n++;
      }
// B. background variants on the home screen
for (const w of ["desktop", "phone"])
  for (const theme of ["dark", "light"]) {
    await shot(`bg-shimmer--home--${w}--${theme}`, "home", { bg: "shimmer", bee: "0" }, { w, theme, prep: midSweep }); n++;
    await shot(`bg-reactive--home--${w}--${theme}`, "home", { bg: "reactive", bee: "0" }, { w, theme, prep: pointerAt(0.36, 0.84) }); n++;
  }
// C. reduced motion: the moving variants must render exactly the static still
const stills = [];
for (const page of ["home", "round"])
  for (const bg of ["shimmer", "reactive"])
    for (const w of ["desktop", "phone"]) {
      const name = `still-${bg}--${page}--${w}--dark`;
      // Same pointer move for both captures, so hover styles can't differ;
      // only the background can.
      const prep = bg === "reactive" ? pointerAt(0.72, 0.28) : null;
      await shot(name, page, { bg, bee: "0" }, { w, theme: "dark", motion: "reduce", prep }); n++;
      await shot(`${name}--ref`, page, { bg: "static", bee: "0" }, { w, theme: "dark", motion: "reduce", prep });
      stills.push(name);
    }
// E. keyboard focus over the glow (Tab twice: Settings, then Play solo)
for (const w of ["desktop", "phone"])
  for (const theme of ["dark", "light"]) {
    await shot(`focus--home--${w}--${theme}`, "home", { bg: "shimmer", bee: "1" }, { w, theme, prep: async (p) => { await midSweep(p); await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.waitForTimeout(300); } }); n++;
  }
// D. answer moments
for (const state of ["correct", "incorrect"])
  for (const w of ["desktop", "phone"])
    for (const theme of ["dark", "light"]) {
      await shot(`state-${state}--round--${w}--${theme}`, "round", { bg: "static", bee: "0", state }, { w, theme }); n++;
    }

// Compare each still with its static reference, pixel by pixel. A channel
// difference of 8/255 or less is anti-aliasing noise, not a visible layer.
const cmp = await (await browser.newContext()).newPage();
let same = 0;
for (const s of stills) {
  const r = await cmp.evaluate(async ([a, b]) => {
    const load = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + d; });
    const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const [da, db] = (await Promise.all([load(a), load(b)])).map(px);
    let over = 0, max = 0;
    for (let k = 0; k < da.length; k += 4) {
      const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
      max = Math.max(max, d);
      if (d > 8) over++;
    }
    return { over, max };
  }, [bufs.get(s).toString("base64"), bufs.get(`${s}--ref`).toString("base64")]);
  if (r.over === 0) same++;
  console.log(`${r.over === 0 ? "STILL OK" : "DIFFERS "}  ${s}: max channel diff ${r.max}/255, pixels over tolerance ${r.over}`);
  if (r.over && process.env.STILL_DEBUG) {
    writeFileSync(resolve(process.env.STILL_DEBUG, `${s}.png`), bufs.get(s));
    writeFileSync(resolve(process.env.STILL_DEBUG, `${s}--ref.png`), bufs.get(`${s}--ref`));
  }
  rmSync(resolve(OUT, `${s}--ref.jpg`));
}
await browser.close();
// File list for compare.html's gallery (a file:// page can't list a folder).
const names = readdirSync(OUT).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).sort();
writeFileSync(resolve(OUT, "index.js"), `// Written by design/harness/shoot-glow.mjs\nwindow.SCREENS = ${JSON.stringify(names, null, 1)};\n`);
console.log(`captured ${n} screenshots -> ${OUT}`);
console.log(`reduced-motion stills identical to the static background: ${same}/${stills.length}`);
console.log(`page errors: ${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`);
