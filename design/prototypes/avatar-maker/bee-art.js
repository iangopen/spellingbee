// Avatar maker art (prototype, 2026-10-13). A classic script so the page opens from disk:
// it defines window.BeeMaker (and module.exports under node, for the checks).
//
// The drawing is src/lib/beeArt.ts's, copied VERBATIM (blobPath, shape, beeInner, the seeded
// generator, ART_WOBBLE 0.8, the 12 4 76 90 viewBox), with exactly two additions so it can
// drop into the app:
//   1. beeInner takes `body`, the fill of the body and head. It defaults to
//      "var(--bee-body)", so colour 0 is the mascot's own token and
//      makerSvg(0, 0) === avatarSvg("bee") byte for byte (check-mascot.mjs proves it
//      against the real beeArt.ts). Colours 1-7 are new tokens --av-1 ... --av-7.
//   2. `antennae: false`, used ONLY by the contrast measurement to measure the antenna
//      lines separately from the filled silhouette. No avatar is ever drawn without them.
// Every maker bee is seeded like the mascot (hash("bee")), so all 64 share its wobbly outline:
// they are the mascot in different colours, wearing things. Each cosmetic has its own fixed
// seed, so its wobble is the same on every colour and every screen.
(function (root) {
  "use strict";

  const CLIP_ID = "__CLIP_ID__";
  const ART_WOBBLE = 0.8;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const f1 = (n) => n.toFixed(1);

  function blobPath(cx, cy, rx, ry) {
    const n = Math.max(8, Math.min(14, Math.round(Math.max(rx, ry) * 0.9)));
    const a = ART_WOBBLE * Math.min(1, Math.max(rx, ry) / 12);
    const p = Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return [cx + rx * Math.cos(t) + rnd() * a * 2, cy + ry * Math.sin(t) + rnd() * a * 2];
    });
    let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + "Z";
  }

  function shape(cx, cy, rx, ry, { fill = "none", stroke = "var(--bee-line)", sw = 2.4, tf = "" } = {}) {
    const t = tf ? ` transform="${tf}"` : "";
    return `<path d="${blobPath(cx, cy, rx, ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw + 0.3}" stroke-linejoin="round"${t}/>`;
  }

  // beeArt.ts's beeInner, plus `body` and `antennae` (see the header).
  function beeInner({ acc = "", slim = false, eyes = 1, sd = 11, body = "var(--bee-body)", antennae = true } = {}) {
    seed = sd;
    const bodyRx = slim ? 13 : 17, bodyRy = slim ? 19 : 17;
    const bcy = slim ? 64 : 62;
    const wingRx = slim ? 15 : 14, wingRy = slim ? 8 : 10, wingCy = slim ? 40 : 38;
    const wingTilt = slim ? 38 : 28;
    const ant = antennae
      ? `<g stroke="var(--bee-line)" stroke-width="2.4" stroke-linecap="round" fill="none">
        ${slim
          ? `<path d="M44 26 38 13M56 26 62 13"/>`
          : `<path d="M44 27c-2-8-7-12-11-11M56 27c2-8 7-12 11-11"/><circle cx="32.5" cy="16" r="2.4" fill="var(--bee-line)"/><circle cx="67.5" cy="16" r="2.4" fill="var(--bee-line)"/>`}
      </g>`
      : `<g></g>`;
    return `
      ${shape(33, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(-${wingTilt} 33 38)` })}
      ${shape(67, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(${wingTilt} 67 38)` })}
      ${ant}
      ${shape(50, bcy, bodyRx, bodyRy, { fill: body, sw: 2.6 })}
      <clipPath id="${CLIP_ID}"><path d="${blobPath(50, bcy, bodyRx, bodyRy)}"/></clipPath>
      <g clip-path="url(#${CLIP_ID})" fill="var(--bee-stripe)">
        <rect x="20" y="${slim ? 60 : 58}" width="60" height="${slim ? 6 : 7}"/><rect x="20" y="${slim ? 71 : 70}" width="60" height="${slim ? 6 : 7}"/>
      </g>
      ${shape(50, 36, slim ? 12 : 14, slim ? 12 : 14, { fill: body, sw: 2.6 })}
      ${shape(45 - eyes, 35, 3.6 * eyes, 3.6 * eyes, { fill: "var(--bee-eye)", sw: 1.6 })}${shape(55 + eyes, 35, 3.6 * eyes, 3.6 * eyes, { fill: "var(--bee-eye)", sw: 1.6 })}
      <g fill="var(--bee-line)"><circle cx="${45.6 - eyes}" cy="35.6" r="${1.8 * eyes}"/><circle cx="${55.6 + eyes}" cy="35.6" r="${1.8 * eyes}"/></g>
      <path d="M45.5 42.5q4.5 3.6 9 0" fill="none" stroke="var(--bee-line)" stroke-width="2" stroke-linecap="round"/>
      ${slim ? "" : `<circle cx="40.5" cy="41" r="2.2" fill="var(--bee-cheek)" opacity=".7"/><circle cx="59.5" cy="41" r="2.2" fill="var(--bee-cheek)" opacity=".7"/>`}
      ${acc}`;
  }

  const hash = (k) => [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const wrap = (inner, viewBox = "12 4 76 90") =>
    `<svg viewBox="${viewBox}" width="100%" height="100%" aria-hidden="true" focusable="false">${inner}</svg>`;

  // ---------------------------------------------------------------- colours
  // Index 0 is the mascot's honey (its own token, different per theme). 1-7 were chosen by
  // pick-colors.mjs: one per hue family, each >= 3:1 against the dark panel and against
  // --bee-line in both themes, and at least 11.7 CIEDE2000 apart from every other colour
  // under normal vision and simulated protanopia, deuteranopia and tritanopia.
  const COLORS = [
    { name: "Honey", token: "var(--bee-body)" },
    { name: "Red", token: "var(--av-1)", hex: "#c85b32" },
    { name: "Rose", token: "var(--av-2)", hex: "#a8669a" },
    { name: "Purple", token: "var(--av-3)", hex: "#796ce0" },
    { name: "Blue", token: "var(--av-4)", hex: "#5aa0d0" },
    { name: "Aqua", token: "var(--av-5)", hex: "#64d1d7" },
    { name: "Green", token: "var(--av-6)", hex: "#83aa84" },
    { name: "Grey", token: "var(--av-7)", hex: "#867e7f" },
  ];

  // ---------------------------------------------------------------- cosmetics
  // Round parts are blobs (the same pen wobble as the bee); straight parts are fixed paths.
  // Tokens only, all existing art tokens: --mark (honey gold), --bee-eye (cream), --bee-cheek
  // (pink), --bee-leaf (green), --bee-stripe / --bee-line (cocoa), --panel-solid.
  const L = `stroke="var(--bee-line)" stroke-linejoin="round" stroke-linecap="round"`;
  const withSeed = (sd, build) => () => { seed = sd; return build(); };

  const crown = () =>
    // The legacy "queen" crown, byte for byte, so queen rows keep their art.
    `<path d="M40 22 42 13l5 5 3-7 3 7 5-5 2 9z" fill="var(--mark)" stroke="var(--bee-line)" stroke-width="2" stroke-linejoin="round"/>`;
  const flower = () =>
    // The legacy "blossom", byte for byte.
    `<g stroke="var(--bee-line)" stroke-width="1.6" fill="var(--bee-eye)">${[0, 72, 144, 216, 288]
      .map((a) => `<circle cx="${68 + 5 * Math.cos((a * Math.PI) / 180)}" cy="${12 + 5 * Math.sin((a * Math.PI) / 180)}" r="3.4"/>`)
      .join("")}<circle cx="68" cy="12" r="2.6" fill="var(--mark)"/></g>`;
  const partyHat = withSeed(301, () =>
    `<path d="M41.5 24.5 50.5 7.5 59 24q-8.5 3.4-17.5.5z" fill="var(--bee-cheek)" ${L} stroke-width="2"/>` +
    `<g fill="var(--bee-eye)" stroke="var(--bee-line)" stroke-width="1"><circle cx="48.5" cy="19.5" r="1.7"/><circle cx="53.5" cy="14.5" r="1.5"/><circle cx="54" cy="21.5" r="1.4"/></g>` +
    shape(50.5, 7.5, 3, 3, { fill: "var(--mark)", sw: 1.5 }));
  const sunglasses = withSeed(302, () =>
    shape(44, 35, 5.4, 4.6, { fill: "var(--bee-stripe)", sw: 1.7 }) + shape(56, 35, 5.4, 4.6, { fill: "var(--bee-stripe)", sw: 1.7 }) +
    `<path d="M49.2 34.6q.8-1.2 1.6 0M38.8 34.2l-3-1.4M61.2 34.2l3-1.4" fill="none" ${L} stroke-width="1.8"/>` +
    `<path d="M41.4 33.4l2.2-1.8M53.4 33.4l2.2-1.8" fill="none" stroke="var(--bee-eye)" stroke-width="1.3" stroke-linecap="round"/>`);
  const headphones = withSeed(303, () =>
    `<path d="M36.5 37C35 19 65 19 63.5 37" fill="none" stroke="var(--bee-line)" stroke-width="5.4" stroke-linecap="round"/>` +
    `<path d="M36.5 37C35 19 65 19 63.5 37" fill="none" stroke="var(--bee-cheek)" stroke-width="2.4" stroke-linecap="round"/>` +
    shape(36, 39, 4.2, 6, { fill: "var(--bee-cheek)", sw: 1.9 }) + shape(64, 39, 4.2, 6, { fill: "var(--bee-cheek)", sw: 1.9 }));
  const bowTie = withSeed(304, () =>
    `<path d="M50 50.5 41.5 46q-2 4.5 0 9zM50 50.5 58.5 46q2 4.5 0 9z" fill="var(--bee-cheek)" ${L} stroke-width="1.8"/>` +
    shape(50, 50.5, 2.4, 2.4, { fill: "var(--bee-cheek)", sw: 1.5 }));
  const honeyPot = withSeed(305, () =>
    `<path d="M80 74 86 63.5" fill="none" ${L} stroke-width="2.2"/>` + shape(86.2, 62.5, 2, 2.8, { fill: "var(--mark)", sw: 1.4, tf: "rotate(30 86.2 62.5)" }) +
    shape(77, 82, 8.5, 8, { fill: "var(--mark)", sw: 2 }) +
    shape(77, 74.5, 7.2, 2.4, { fill: "var(--bee-eye)", sw: 1.6 }) +
    `<path d="M71.5 79q1 3.5-.4 6" fill="none" stroke="var(--bee-eye)" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`);
  const gradCap = withSeed(306, () =>
    `<path d="M41 21.5v5.6q9 3.8 18 0v-5.6" fill="var(--bee-stripe)" ${L} stroke-width="2"/>` +
    `<path d="M33 18.5 50 11.5 67 18.5 50 25.5z" fill="var(--bee-stripe)" ${L} stroke-width="2"/>` +
    `<path d="M50 18.5 63 21v7.5" fill="none" stroke="var(--mark)" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="50" cy="18.5" r="1.6" fill="var(--mark)"/>` + shape(63, 30.2, 1.9, 2.6, { fill: "var(--mark)", sw: 1.2 }));
  const pencil = withSeed(307, () =>
    `<g transform="rotate(25 74 72)" ${L} stroke-width="1.8">` +
    `<path d="M70 58h8v22h-8z" fill="var(--mark)"/><path d="M70 80h8v3.5h-8z" fill="var(--bee-eye)"/>` +
    `<path d="M70 83.5h8v2.5q-4 3-8 0z" fill="var(--bee-cheek)"/>` +
    `<path d="M70 58l4-10 4 10z" fill="var(--bee-eye)"/><path d="M72.6 51.5 74 48l1.4 3.5z" fill="var(--bee-line)"/>` +
    `<path d="M74 60v19" fill="none" stroke-width="1" opacity=".5"/></g>`);
  const readingGlasses = withSeed(308, () =>
    shape(44, 35, 5.8, 5.6, { fill: "none", sw: 2.1 }) + shape(56, 35, 5.8, 5.6, { fill: "none", sw: 2.1 }) +
    `<path d="M49.2 34.4q.8-1.4 1.6 0M38.2 34l-2.8-1.2M61.8 34l2.8-1.2" fill="none" ${L} stroke-width="2.2"/>`);
  const quill = withSeed(309, () =>
    shape(64.5, 14.5, 3.8, 10.5, { fill: "var(--bee-eye)", sw: 1.6, tf: "rotate(35 64.5 14.5)" }) +
    `<path d="M57.8 24.2Q63 16 70.5 6" fill="none" ${L} stroke-width="1.4"/>`);
  const book = withSeed(310, () =>
    `<path d="M15 72.5l11-3.5 11 3.5v13l-11-3.5-11 3.5z" fill="var(--bee-leaf)" ${L} stroke-width="2"/>` +
    `<path d="M17.2 73.6l8.8-2.7v10.6l-8.8 2.7zM34.8 73.6 26 70.9v10.6l8.8 2.7z" fill="var(--bee-eye)" ${L} stroke-width="1.2"/>`);
  const letterBlock = withSeed(311, () =>
    `<path d="M68.5 74.5l3.5-4h15l-3.5 4zM84 74.5l3.5-4v15L84 89.5z" fill="var(--mark)" ${L} stroke-width="1.8"/>` +
    `<path d="M68.5 74.5H84v15H68.5z" fill="var(--bee-eye)" ${L} stroke-width="1.8"/>` +
    `<path d="M72.2 86.5 76.2 77l4 9.5M73.7 83h5" fill="none" ${L} stroke-width="1.8"/>`);

  // Two candidate sets (Ian picks one). Index 0 is "none" in both, so 7 things to wear plus
  // the plain bee, the same convention as the draft's "No hat" (spec §2.2). `phrase` makes the
  // spoken description: "Blue bee wearing a crown".
  const SETS = {
    playful: {
      label: "Playful",
      items: [
        { name: "None", phrase: "", draw: () => "" },
        { name: "Crown", phrase: "wearing a crown", draw: crown },
        { name: "Party hat", phrase: "wearing a party hat", draw: partyHat },
        { name: "Flower", phrase: "wearing a flower", draw: flower },
        { name: "Sunglasses", phrase: "wearing sunglasses", draw: sunglasses },
        { name: "Headphones", phrase: "wearing headphones", draw: headphones },
        { name: "Bow tie", phrase: "wearing a bow tie", draw: bowTie },
        { name: "Honey pot", phrase: "holding a honey pot", draw: honeyPot },
      ],
    },
    spelling: {
      label: "Spelling-themed",
      items: [
        { name: "None", phrase: "", draw: () => "" },
        { name: "Graduation cap", phrase: "wearing a graduation cap", draw: gradCap },
        { name: "Pencil", phrase: "holding a pencil", draw: pencil },
        { name: "Reading glasses", phrase: "wearing reading glasses", draw: readingGlasses },
        { name: "Quill", phrase: "wearing a quill", draw: quill },
        { name: "Book", phrase: "holding a book", draw: book },
        { name: "Letter block", phrase: "holding a letter block", draw: letterBlock },
        { name: "Headphones", phrase: "wearing headphones", draw: headphones },
      ],
    },
  };

  const cache = new Map();
  /** One maker avatar. Deterministic per (set, colour, cosmetic); colour 0 + none is the mascot. */
  function makerSvg(color, cosmetic, set = "playful", { antennae = true } = {}) {
    const k = `${set}:${color}:${cosmetic}:${antennae}`;
    let v = cache.get(k);
    if (!v) {
      const acc = SETS[set].items[cosmetic].draw();
      v = wrap(beeInner({ acc, sd: hash("bee"), body: COLORS[color].token, antennae }));
      cache.set(k, v);
    }
    return v;
  }

  function describe(color, cosmetic, set = "playful") {
    const c = COLORS[color].name, p = SETS[set].items[cosmetic].phrase;
    return `${c} bee${p ? " " + p : ""}`;
  }

  const api = { CLIP_ID, COLORS, SETS, makerSvg, describe, hash };
  root.BeeMaker = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
