// Waits until the Settings dialog has finished loading the voice list. Browsers with voices
// (Chrome on Windows) settle at once. A browser that exposes none (headless Chromium on Linux,
// in CI) shows "Loading voices…" until loadVoices() gives up after 3 s, then a two-line note,
// which pushes every control below it down. A check that measures pixels must not straddle
// that change: the reduced-motion check saw it as motion, and the contrast check sampled
// focus rings 20px from where they were. This waits for the settled page; it hides nothing.
export async function settleSettings(page) {
  await page.waitForFunction(() => { const d = document.querySelector("dialog[open]"); return !!d && !/Loading voices/.test(d.textContent); }, null, { timeout: 10000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
