// Phone-sized performance and behaviour checks for the glowing honeycomb.
//   PW_MODULE=<playwright/index.mjs> node design/harness/perf-glow.mjs
// For each background variant, at 390x844 with the CPU throttled 4x (a
// mid-range phone): frame intervals over 4s while the page is live (the
// shimmer is mid-sweep, the reactive light is chasing a moving pointer),
// which CSS properties animate, and whether everything pauses when the tab
// is hidden.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/blue-ribbon-glow");
const browser = await chromium.launch();

for (const bg of ["static", "shimmer", "reactive"]) for (const page of ["home", "round"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "dark", hasTouch: false });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(`${pathToFileURL(resolve(DIR, page + ".html")).href}?bg=${bg}&bee=1`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (bg === "shimmer") await p.evaluate(() => { for (const a of document.getAnimations()) if (/sweep-/.test(a.animationName)) a.currentTime = 1500; });

  const move = bg === "reactive" ? (async () => { for (let i = 0; i < 40; i++) await p.mouse.move(40 + (i * 8) % 320, 120 + (i * 13) % 600); })() : null;
  const frames = await p.evaluate(() => new Promise((done) => {
    const t = []; let last = performance.now(); const end = last + 4000;
    const tick = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else done(t); };
    requestAnimationFrame(tick);
  }));
  await move;
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  frames.shift();
  const sorted = [...frames].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)], p95 = sorted[Math.floor(sorted.length * 0.95)];
  const slow = frames.filter((f) => f > 25).length;

  const props = await p.evaluate(() => {
    const set = new Set();
    for (const a of document.getAnimations()) {
      if (!a.effect || !a.effect.getKeyframes) continue;
      for (const k of a.effect.getKeyframes()) for (const key of Object.keys(k))
        if (!["offset", "easing", "composite", "computedOffset"].includes(key)) set.add(key);
    }
    return [...set];
  });

  // Tab hidden -> everything paused?
  const paused = await p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    const bgAnims = document.getAnimations().filter((a) => a.effect?.target?.closest?.(".bg"));
    return { attr: document.documentElement.hasAttribute("data-paused"), running: bgAnims.filter((a) => a.playState === "running").length, total: bgAnims.length };
  });
  await p.waitForTimeout(100);
  const pausedNow = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.(".bg") && a.playState === "running").length);

  console.log(`${bg.padEnd(8)} ${page.padEnd(6)} frames=${frames.length} median=${med.toFixed(1)}ms p95=${p95.toFixed(1)}ms >25ms=${slow} | animated props: ${props.join(",") || "none"} | hidden tab: data-paused=${paused.attr}, bg animations still running=${pausedNow}/${paused.total}`);
  await ctx.close();
}
await browser.close();
