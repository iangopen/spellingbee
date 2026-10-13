// The tier bars' focus indicator check, shared by shoot-homemade.mjs and
// check-tier-focus.mjs. Rim vs the pixels immediately inside and outside it,
// measured with the honeycomb at its peak. A failing bar must make this FAIL:
// check-tier-focus.mjs proves that on a copy with the rim removed.
export async function measureTierFocus({ browser, cmp, url, view, W, STRENGTHS, THEMES, log }) {
  log("\n## Tier bar focus indicator (a thickened rim in the focus colour; an outline would be clipped by the hexagon)");
  let focusMin = Infinity, focusFails = 0, focusN = 0;
  for (const h of STRENGTHS) for (const theme of THEMES) for (const w of Object.keys(W)) {
    const ctx = await browser.newContext({ viewport: view("difficulty", w), colorScheme: theme, reducedMotion: "reduce" });
    const pg = await ctx.newPage();
    await pg.goto(url("difficulty", { h, bg: "shimmer", peak: "1", bee: "1", theme }), { waitUntil: "networkidle" });
    await pg.evaluate(() => document.fonts.ready);
    const n = await pg.locator(".tier-bar").count();
    let worstRimFill = Infinity, worstRimOut = Infinity;
    for (let i = 0; i < n; i++) {
      await pg.evaluate((k) => document.querySelectorAll(".tier-bar")[k].focus({ focusVisible: true }), i);
      await pg.waitForTimeout(80);
      // Wrapper glow is part of the real focused look, so it stays in the capture.
      const rect = await pg.evaluate((k) => { const e = document.querySelectorAll(".tier-bar")[k], b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rim: getComputedStyle(e).backgroundColor }; }, i);
      const png = (await pg.screenshot()).toString("base64");
      const res = await cmp.evaluate(async ({ png, rect }) => {
        const img = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = "data:image/png;base64," + png; });
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
        const at = (px, py) => [...x.getImageData(Math.round(px), Math.round(py), 1, 1).data].slice(0, 3);
        let rimFill = Infinity, rimOut = Infinity;
        // The bands have fixed geometry (outer moat 3px, rim 5px, inner moat 3px, measured
        // from the bar's top and bottom edge), so each is sampled at its CENTRE row, which
        // tolerates the 1px the irregular "more" hexagon points can drift. The sample is
        // asserted to BE the focus colour; finding the rim by colour alone matched the
        // neighbouring Expert/Master bars (whose rims are near the focus colour) and
        // reported 1.00:1 for a ring that was fine.
        const want = rect.rim.match(/[\d.]+/g).slice(0, 3).map(Number);
        const isRim = (c) => Math.max(...c.map((v, n) => Math.abs(v - want[n]))) <= 12;
        for (let k = 0; k < 24; k++) {
          const px = rect.l + 40 + (k / 23) * (rect.r - rect.l - 80);
          for (const [edge, dir] of [[rect.t, 1], [rect.b - 1, -1]]) {
            const rim = at(px, edge + dir * 2), out = at(px, edge - dir * 2), inn = at(px, edge + dir * 6);
            if (!isRim(rim)) { rimFill = 1; rimOut = 1; continue; }
            rimFill = Math.min(rimFill, ratio(rim, inn)); rimOut = Math.min(rimOut, ratio(rim, out));
          }
        }
        return { rimFill, rimOut };
      }, { png, rect });
      worstRimFill = Math.min(worstRimFill, res.rimFill); worstRimOut = Math.min(worstRimOut, res.rimOut);
    }
    focusN++; focusMin = Math.min(focusMin, worstRimFill, worstRimOut);
    const ok = worstRimFill >= 3 && worstRimOut >= 3;
    if (!ok) focusFails++;
    log(`${ok ? "PASS" : "FAIL"} ${h}, ${theme}, ${w}: focused rim vs the moat band just inside it ${worstRimFill.toFixed(2)}:1, vs the moat just outside it ${worstRimOut.toFixed(2)}:1 (need 3:1), worst of all ${n} bars`);
    await ctx.close();
  }
  log(`Tier bar focus: ${focusN - focusFails}/${focusN} configurations pass; lowest ratio ${focusMin.toFixed(2)}:1`);
  return { focusN, focusFails, focusMin };
}
