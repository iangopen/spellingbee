// Contrast of every visible text element (and control edge / focus ring)
// against the WORST pixel actually behind it, with the honeycomb at its peak
// brightness everywhere (?peak=1). "Worst" = the pixel giving the lowest ratio,
// which for light text is the brightest glow and for dark text the darkest line.
//   PW_MODULE=<playwright/index.mjs> node design/harness/measure.mjs
// Writes design/prototypes/blue-ribbon-glow/contrast.md (+ contrast.json).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PW_MODULE).href);
const DIR = resolve("design/prototypes/blue-ribbon-glow");
const VIEWS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const RUNS = [];
for (const page of ["home", "round", "race-results"])
  for (const theme of ["dark", "light"])
    for (const w of Object.keys(VIEWS))
      for (const bee of ["0", "1"])
        for (const state of page === "round" ? ["", "correct", "incorrect"] : [""])
          RUNS.push({ page, theme, w, bee, state });

// Worst-pixel sampler, run inside the page (Playwright serialises it).
const SAMPLE = async ({ png, targets }) => {
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + png; });
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return targets.map((t) => {
    const f = parse(t.color);
    let worst = Infinity, wp = null;
    const test = (px, py) => {
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
      const k = (py * img.width + px) * 4;
      const br = d[k], bg = d[k + 1], bb = d[k + 2];
      const fr = f.r * f.a + br * (1 - f.a), fg = f.g * f.a + bg * (1 - f.a), fb = f.b * f.a + bb * (1 - f.a);
      const a = L(fr, fg, fb), b = L(br, bg, bb);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < worst) { worst = ratio; wp = hex(br, bg, bb); }
    };
    if (t.rects) for (const [l, tp, rr, bt] of t.rects)
      for (let py = Math.floor(tp); py < Math.ceil(bt); py++) for (let px = Math.floor(l); px < Math.ceil(rr); px++) test(px, py);
    if (t.band) {
      // Pixels whose distance OUTSIDE the element's rounded outline is between
      // -inner and +outer (the band the edge or ring actually touches).
      const [l, tp, rr, bt, inner, outer, rad0] = t.band;
      const cx = (l + rr) / 2, cy = (tp + bt) / 2, hw = (rr - l) / 2, hh = (bt - tp) / 2;
      const rad = Math.min(rad0, hw, hh);
      const sdf = (px, py) => {
        const qx = Math.abs(px + 0.5 - cx) - (hw - rad), qy = Math.abs(py + 0.5 - cy) - (hh - rad);
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      };
      for (let py = Math.floor(tp - outer - 1); py < Math.ceil(bt + outer + 1); py++)
        for (let px = Math.floor(l - outer - 1); px < Math.ceil(rr + outer + 1); px++) {
          const dist = sdf(px, py);
          if (dist >= inner && dist <= outer) test(px, py); // inner < 0 = reaches inside the edge
        }
    }
    return { ...t, fg: hex(f.r, f.g, f.b), worst: +worst.toFixed(2), wp };
  });
};

const browser = await chromium.launch();
const rows = [];

for (const r of RUNS) {
  const ctx = await browser.newContext({ viewport: VIEWS[r.w], deviceScaleFactor: 1, colorScheme: r.theme, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  const q = new URLSearchParams({ bg: "shimmer", peak: "1", bee: r.bee, theme: r.theme, ...(r.state ? { state: r.state } : {}) });
  await p.goto(`${pathToFileURL(resolve(DIR, r.page + ".html")).href}?${q}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);

  // 1. Collect targets while everything is visible.
  const targets = await p.evaluate(() => {
    const out = [];
    const visible = (el) => {
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
        if (e.classList.contains("sr-only")) return false;
      }
      return true;
    };
    const large = (cs) => { const s = parseFloat(cs.fontSize), wgt = Number(cs.fontWeight); return s >= 24 || (s >= 18.66 && wgt >= 700); };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (!t || !n.parentElement || n.parentElement.closest("svg, script, style")) continue;
      if (!visible(n.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((b) => b.width > 1 && b.height > 1).map((b) => [b.left, b.top, b.right, b.bottom]);
      if (!rects.length) continue;
      const cs = getComputedStyle(n.parentElement);
      out.push({ kind: "text", label: t.slice(0, 48), color: cs.color, need: large(cs) ? 3 : 4.5, rects });
    }
    for (const inp of document.querySelectorAll("input")) {
      if (!inp.value || !visible(inp)) continue;
      const b = inp.getBoundingClientRect(), cs = getComputedStyle(inp);
      out.push({ kind: "text", label: `typed answer "${inp.value}"`, color: cs.color, need: large(cs) ? 3 : 4.5, rects: [[b.left + 16, b.top + 10, b.right - 60, b.bottom - 10]] });
    }
    for (const el of document.querySelectorAll("[data-ui]")) {
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      out.push({ kind: "edge", label: el.dataset.ui, color: cs.borderTopColor, need: 3, band: [b.left, b.top, b.right, b.bottom, -3, 2, parseFloat(cs.borderTopLeftRadius) || 0] });
    }
    for (const el of document.querySelectorAll("a[href], button, input")) {
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      const probe = document.createElement("i"); probe.style.color = "var(--ring)"; document.body.append(probe);
      const ring = getComputedStyle(probe).color; probe.remove(); // resolved to rgb(), not a hex string
      const name = (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).replace(/\s+/g, " ").trim().slice(0, 30);
      const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      el.dataset.ringIdx = String(out.length);
      out.push({ kind: "ring", idx: out.length, label: `focus ring: ${name}`, color: ring, need: 3, band: [b.left, b.top, b.right, b.bottom, 3, 6, rad + 3] });
    }
    return out;
  });

  // 2. Hide all text, icons, edges and rings; keep panels, scrims and the peak background.
  await p.addStyleTag({ content: `*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;outline-color:transparent!important}
    [data-ui]{border-color:transparent!important} *:focus{outline:none!important}` });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.waitForTimeout(100);
  const png = (await p.screenshot()).toString("base64");

  // 3. Worst pixel per target.
  let results = await p.evaluate(SAMPLE, { png, targets });

  // 4. Focus rings are measured in the REAL focused state: focus each control
  // (keyboard-style), hide only the ring itself, and sample the pixels it sits on.
  for (let i = 0; i < results.length; i++) {
    if (results[i].kind !== "ring") continue;
    const ok = await p.evaluate((idx) => {
      const el = document.querySelector(`[data-ring-idx="${idx}"]`);
      if (!el) return false;
      el.focus({ focusVisible: true, preventScroll: true });
      return document.activeElement === el;
    }, results[i].idx);
    if (!ok) continue;
    await p.waitForTimeout(60);
    const shot = (await p.screenshot()).toString("base64");
    const [res] = await p.evaluate(SAMPLE, { png: shot, targets: [targets[i]] });
    results[i] = { ...res, focused: true };
  }

  for (const res of results) rows.push({ ...r, ...res });
  await ctx.close();
}
await browser.close();

// Collapse to one row per (theme, screen, kind, label, need): the minimum over
// widths, bee variants and states.
const key = (x) => [x.theme, x.page, x.kind, x.label, x.need].join("|");
const agg = new Map();
for (const x of rows) {
  const k = key(x), cur = agg.get(k);
  if (!cur || x.worst < cur.worst) agg.set(k, { ...x, where: `${x.w}${x.bee === "1" ? ", bee" : ""}${x.state ? `, ${x.state}` : ""}` });
}
const list = [...agg.values()].sort((a, b) => a.theme.localeCompare(b.theme) || a.page.localeCompare(b.page) || a.kind.localeCompare(b.kind) || a.worst - b.worst);
const fails = list.filter((x) => x.worst < x.need);
let md = `# Contrast over the glowing honeycomb\n\nGenerated by \`design/harness/measure.mjs\`. Every visible text element, control edge and focus ring, measured against the **worst pixel behind it** with the honeycomb lit to its peak everywhere (\`?peak=1\`, the shimmer and reactive light's full brightness). Each row is the minimum over desktop and phone, bee and no bee, and, on the round screen, the playing, correct and missed states. Required: text 4.5:1, large text 3:1, edges and focus rings 3:1.\n\n**${list.length} pairs, ${fails.length} failing.** (${rows.length} raw measurements across ${RUNS.length} renders.)\n`;
for (const theme of ["dark", "light"]) for (const page of ["home", "round", "race-results"]) {
  md += `\n## ${theme}, ${page}\n\n| | Element | Text / edge colour | Worst pixel behind | Ratio | Needs | Worst case at |\n|---|---|---|---|---|---|---|\n`;
  for (const x of list.filter((y) => y.theme === theme && y.page === page))
    md += `| ${x.worst >= x.need ? "PASS" : "**FAIL**"} | ${x.kind === "text" ? "" : `*${x.kind}:* `}${x.label.replace(/\|/g, "/")} | \`${x.fg}\` | \`${x.wp}\` | ${x.worst.toFixed(2)}:1 | ${x.need}:1 | ${x.where} |\n`;
}
writeFileSync(resolve(DIR, "contrast.md"), md);
writeFileSync(resolve(DIR, "contrast.json"), JSON.stringify(list, null, 1));
console.log(`${list.length} pairs, ${fails.length} failing`);
for (const f of fails) console.log(`FAIL ${f.theme} ${f.page} ${f.kind} "${f.label}" ${f.fg} on ${f.wp} = ${f.worst} (need ${f.need}) @ ${f.where}`);
