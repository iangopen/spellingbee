// Screenshots for compare.html: the maker, the tokens, all 8 colours and all 8 cosmetics per
// set, in dark and light, at desktop (1280 x 900) and phone (390 x 844, 2x) width. Element
// captures of a fixed viewport, never fullPage. Opens index.html straight from disk.
//   PW_MODULE=<playwright/index.mjs> node design/prototypes/avatar-maker/shoot.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";
const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "screenshots");
mkdirSync(out, { recursive: true });

const WIDTHS = { desktop: { viewport: { width: 1280, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } };
const PARTS = { maker: "#maker-panel", tokens: "#tokens", colors: "#colors", "cosmetics-playful": "#cosmetics-playful", "cosmetics-spelling": "#cosmetics-spelling" };
const b = await chromium.launch();
let n = 0;
try {
  for (const theme of ["dark", "light"]) for (const [w, opts] of Object.entries(WIDTHS)) {
    const ctx = await b.newContext({ ...opts, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    // Blue bee wearing a crown in the maker and the tokens; the grids use honey / no cosmetic.
    await p.goto(pathToFileURL(path.join(here, "index.html")).href + `?theme=${theme}&color=4&cosmetic=1`);
    await p.evaluate(() => document.fonts.ready);
    for (const [name, sel] of Object.entries(PARTS)) {
      if (name === "colors") await p.goto(pathToFileURL(path.join(here, "index.html")).href + `?theme=${theme}`), await p.evaluate(() => document.fonts.ready);
      await p.locator(sel).scrollIntoViewIfNeeded();
      await p.locator(sel).screenshot({ path: path.join(out, `${theme}-${w}-${name}.png`), animations: "disabled" });
      n++;
    }
    await ctx.close();
  }
} finally {
  await b.close();
}
console.log(`${n} screenshots in ${out}`);
