// Bee art: the mascot, the eight contestant avatars and the rosette, as SVG strings
// drawn from theme tokens only (--bee-*, --mark*, --panel-solid), so both palettes
// work and no colour is hardcoded here. The same drawing feeds the favicon, the app
// icons and the share card (design/harness/build-brand-assets.mjs substitutes the
// token colours); rerun that script after changing anything here.
//
// This is the approved prototype's drawing at the homemade "light" strength
// (design/prototypes/homemade/art.js, ?h=light), restored on 2026-10-06: every round
// part (wings, body, head, eyes, the rosette's petals and ring) is a hand-drawn blob,
// points jittered around the ellipse and joined with smooth cubic curves, so the
// line wobbles like a pen. Stage 6 had replaced it with smooth hand-placed curves,
// which lost the wobble the light strength was picked for.
//
// The jitter is a fixed pseudo-random sequence SEEDED PER AVATAR KEY and the result
// is memoized, so a given avatar is identical on every screen and every render by
// construction (ui.test.tsx pins the output). Nothing here animates and nothing is
// interactive; the components that use it mark it aria-hidden.
//
// The avatar KEYS are the existing eight (the room_players.avatar CHECK); only the
// art is new. lib/avatars.ts stays the one list of keys.
//
// Strings contain the placeholder CLIP_ID where a <clipPath> id goes; the component
// swaps in a useId()-based value so two copies on one page never share an id.

import type { AvatarKey } from "./avatars";

export const CLIP_ID = "__CLIP_ID__";

// How far each point wanders, in viewBox units: the prototype's "light" value ("more"
// is 1.5). The one strength number that is not a CSS token (see index.css).
export const ART_WOBBLE = 0.8;
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
const f1 = (n: number) => n.toFixed(1);

function blobPath(cx: number, cy: number, rx: number, ry: number): string {
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

function shape(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  { fill = "none", stroke = "var(--bee-line)", sw = 2.4, tf = "" } = {},
): string {
  const t = tf ? ` transform="${tf}"` : "";
  return `<path d="${blobPath(cx, cy, rx, ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw + 0.3}" stroke-linejoin="round"${t}/>`;
}

// The bee: round body, two cocoa bands, big friendly eyes, two wings. `acc` adds
// the per-avatar accessory; `slim` is the wasp's build; `body` fills the body and
// head (the maker's colours). Its default is the mascot's own token, so every
// drawing made without it is byte for byte what it was before the maker.
function beeInner({ acc = "", slim = false, eyes = 1, sd = 11, body = "var(--bee-body)" } = {}): string {
  seed = sd;
  const bodyRx = slim ? 13 : 17, bodyRy = slim ? 19 : 17;
  const bcy = slim ? 64 : 62;
  const wingRx = slim ? 15 : 14, wingRy = slim ? 8 : 10, wingCy = slim ? 40 : 38;
  const wingTilt = slim ? 38 : 28;
  return `
      ${shape(33, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(-${wingTilt} 33 38)` })}
      ${shape(67, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(${wingTilt} 67 38)` })}
      <g stroke="var(--bee-line)" stroke-width="2.4" stroke-linecap="round" fill="none">
        ${slim
          ? `<path d="M44 26 38 13M56 26 62 13"/>`
          : `<path d="M44 27c-2-8-7-12-11-11M56 27c2-8 7-12 11-11"/><circle cx="32.5" cy="16" r="2.4" fill="var(--bee-line)"/><circle cx="67.5" cy="16" r="2.4" fill="var(--bee-line)"/>`}
      </g>
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

const ACC: Partial<Record<AvatarKey, string>> = {
  queen: `<path d="M40 22 42 13l5 5 3-7 3 7 5-5 2 9z" fill="var(--mark)" stroke="var(--bee-line)" stroke-width="2" stroke-linejoin="round"/>`,
  hive: `<g stroke="var(--bee-line)" stroke-width="2" fill="var(--panel-solid)"><path d="M70 92c0-14 4-22 10-22s10 8 10 22z"/><path d="M71 84h18M73 77h14" fill="none"/></g>`,
  honey: `<path d="M24 66s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12z" fill="var(--mark)" stroke="var(--bee-line)" stroke-width="2"/>`,
  blossom: `<g stroke="var(--bee-line)" stroke-width="1.6" fill="var(--bee-eye)">${[0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${68 + 5 * Math.cos((a * Math.PI) / 180)}" cy="${12 + 5 * Math.sin((a * Math.PI) / 180)}" r="3.4"/>`)
    .join("")}<circle cx="68" cy="12" r="2.6" fill="var(--mark)"/></g>`,
  clover: `<g stroke="var(--bee-line)" stroke-width="1.6" fill="var(--bee-leaf)"><circle cx="30" cy="9" r="4"/><circle cx="25" cy="15" r="4"/><circle cx="35" cy="15" r="4"/></g>`,
};

const hash = (k: string) => [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);

function beeBody(key: AvatarKey): string {
  const sd = hash(key);
  if (key === "wasp") return beeInner({ slim: true, sd });
  if (key === "drone") return beeInner({ eyes: 1.45, sd });
  return beeInner({ acc: ACC[key] ?? "", sd });
}

const wrap = (inner: string, viewBox = "12 4 76 90") =>
  `<svg viewBox="${viewBox}" width="100%" height="100%" aria-hidden="true" focusable="false">${inner}</svg>`;

const cache = new Map<string, string>();
const memo = (k: string, build: () => string) => {
  let v = cache.get(k);
  if (!v) cache.set(k, (v = build()));
  return v;
};

/** One contestant avatar (or the mascot, for "bee"). Deterministic per key. */
export function avatarSvg(key: AvatarKey): string {
  return memo(`avatar:${key}`, () => wrap(beeBody(key)));
}

// ---- the avatar maker (2026-10-15): 8 colours x 14 cosmetics -------------------
//
// The approved prototype's drawing (design/prototypes/avatar-maker/bee-art.js on
// branch design/avatar-maker), moved here unchanged. Every maker bee is the mascot
// (seeded like it, hash("bee")) in one of 8 body colours, wearing one of 14
// cosmetics; each cosmetic has its own fixed seed, so it wobbles identically on
// every colour and screen. Colour 0 + cosmetic 0 is mascotSvg() byte for byte.
// The indices are lib/avatarParts.ts's (APPEND-ONLY lists); ui.test.tsx fails if
// the lengths here differ from it, and pins a digest of all 112 drawings.

/** Body fill per colour index. 0 is the mascot's own token; 1-7 are --av-1 ... --av-7 (index.css). */
export const AVATAR_COLOR_FILLS = [
  "var(--bee-body)",
  "var(--av-1)",
  "var(--av-2)",
  "var(--av-3)",
  "var(--av-4)",
  "var(--av-5)",
  "var(--av-6)",
  "var(--av-7)",
] as const;

const L = `stroke="var(--bee-line)" stroke-linejoin="round" stroke-linecap="round"`;
const withSeed = (sd: number, build: () => string) => () => {
  seed = sd;
  return build();
};
const crown = () => ACC.queen!; // the legacy "queen" crown, byte for byte
const flower = () => ACC.blossom!; // the legacy "blossom", byte for byte
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

/** One drawing per cosmetic index, in AVATAR_COSMETICS order (0 = none). */
export const COSMETIC_DRAWINGS: readonly (() => string)[] = [
  () => "",
  crown,
  partyHat,
  flower,
  sunglasses,
  headphones,
  bowTie,
  honeyPot,
  gradCap,
  pencil,
  readingGlasses,
  quill,
  book,
  letterBlock,
];

const inRange = (n: number, count: number) => (Number.isInteger(n) && n >= 0 && n < count ? n : 0);

/** One maker avatar. Deterministic and memoized per pair; out-of-range reads as 0. */
export function partsSvg(color: number, cosmetic: number): string {
  const c = inRange(color, AVATAR_COLOR_FILLS.length);
  const k = inRange(cosmetic, COSMETIC_DRAWINGS.length);
  return memo(`parts:${c}:${k}`, () => {
    // The cosmetic is drawn first, on its own seed; beeInner then reseeds for the bee.
    const acc = COSMETIC_DRAWINGS[k]();
    return wrap(beeInner({ acc, sd: hash("bee"), body: AVATAR_COLOR_FILLS[c] }));
  });
}

/** The mascot is the plain bee avatar, drawn larger by CSS. */
export const mascotSvg = (): string => avatarSvg("bee");

/** The rosette: a petal ring, two ribbon tails and the bee at the centre. */
export function rosetteSvg(): string {
  return memo("rosette", () => {
    seed = 5;
    const petals = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return `<path d="${blobPath(+(50 + Math.cos(a) * 30).toFixed(2), +(44 + Math.sin(a) * 30).toFixed(2), 9.5, 9.5)}"/>`;
    }).join("");
    const ring = `<path d="${blobPath(50, 44, 27, 27)}" fill="var(--panel-solid)" stroke="var(--mark-ring)" stroke-width="3"/>`;
    const centre = `<svg x="24" y="18" width="52" height="52" viewBox="0 0 100 100">${beeInner()}</svg>`;
    return wrap(
      `<path d="M36 62 26 96l12-7 8 10 6-35z" fill="var(--mark-2)"/>
      <path d="M64 62l10 34-12-7-8 10-6-35z" fill="var(--mark-2)" opacity=".78"/>
      <g fill="var(--mark)">${petals}</g>${ring}${centre}`,
      "0 0 100 100",
    );
  });
}
