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
// the per-avatar accessory; `slim` is the wasp's build.
function beeInner({ acc = "", slim = false, eyes = 1, sd = 11 } = {}): string {
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
      ${shape(50, bcy, bodyRx, bodyRy, { fill: "var(--bee-body)", sw: 2.6 })}
      <clipPath id="${CLIP_ID}"><path d="${blobPath(50, bcy, bodyRx, bodyRy)}"/></clipPath>
      <g clip-path="url(#${CLIP_ID})" fill="var(--bee-stripe)">
        <rect x="20" y="${slim ? 60 : 58}" width="60" height="${slim ? 6 : 7}"/><rect x="20" y="${slim ? 71 : 70}" width="60" height="${slim ? 6 : 7}"/>
      </g>
      ${shape(50, 36, slim ? 12 : 14, slim ? 12 : 14, { fill: "var(--bee-body)", sw: 2.6 })}
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
