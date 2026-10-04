// Bee art: the mascot, the eight contestant avatars and the rosette, as static SVG
// drawn in the light "homemade" style: a wobbly ink outline, soft honey fills, a
// cocoa-banded body, two big friendly eyes. Original work, drawn for this project.
//
// Everything here is FIXED path data. There is no runtime jitter any more (the
// stage 3 version generated its wobble from a seeded random sequence); each curve
// below was placed by hand so the line can be read, adjusted and redrawn, and a
// given avatar is identical on every screen and every render by construction.
// The same shapes feed the favicon, the app icons and the share card
// (design/harness/build-brand-assets.mjs substitutes the token colours).
//
// Colours are theme tokens only (--bee-*, --mark*, --panel-solid), so both palettes
// work and no colour is hardcoded here. Nothing animates and nothing is
// interactive; the components that use it mark it aria-hidden.
//
// The avatar KEYS are the eight the room_players.avatar CHECK allows; only the art
// changes. lib/avatars.ts stays the one list of keys.
//
// Strings contain the placeholder CLIP_ID where a <clipPath> id goes; the component
// swaps in a useId()-based value so two copies on one page never share an id.

import type { AvatarKey } from "./avatars";

export const CLIP_ID = "__CLIP_ID__";

// The outline every shape shares: ink colour, a slightly heavy round-joined stroke.
const INK = 'stroke="var(--bee-line)" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round"';

// --- the parts, in drawing order -----------------------------------------------

const WING_L = `<path d="M40.2 40.6C28.4 37.4 19.6 29 22.2 22.2C24.9 15.7 37.2 17.6 44.2 27.6C46.8 31.4 45 39.4 40.2 40.6Z" fill="var(--bee-wing)" ${INK}/>`;
const WING_R = `<path d="M59.8 40.6C71.6 37.4 80.4 29 77.8 22.2C75.1 15.7 62.8 17.6 55.8 27.6C53.2 31.4 55 39.4 59.8 40.6Z" fill="var(--bee-wing)" ${INK}/>`;

const ANTENNAE = `<g fill="none" ${INK}><path d="M45 25.4C43.2 18.2 38.8 14.2 33.8 15.6"/><path d="M55 25.4C56.8 18.2 61.2 14.2 66.2 15.6"/></g>
      <circle cx="33.4" cy="15.7" r="2.5" fill="var(--bee-line)"/><circle cx="66.6" cy="15.7" r="2.5" fill="var(--bee-line)"/>`;
const ANTENNAE_WASP = `<g fill="none" ${INK}><path d="M45 25.6L39.4 13.6"/><path d="M55 25.6L60.6 13.6"/></g>`;

const BODY_PATH = "M33.4 60.8C33 51.6 40.6 45.2 50.2 45C59.8 44.8 67.2 51.8 66.8 61.4C66.4 71.2 59.4 79.2 49.9 79.1C40.4 79 33.8 70.4 33.4 60.8Z";
const STRIPES = `<path d="M30 56.6C40 58.4 60 55.8 70 57.8L70 63.8C60 62.4 40 64.8 30 63Z"/><path d="M30 68.4C40 70.2 60 67.6 70 69.6L70 75.6C60 74.2 40 76.6 30 74.8Z"/>`;
const STINGER = `<path d="M47.4 78.4L50.1 86L52.8 78.2Z" fill="var(--bee-line)" stroke="var(--bee-line)" stroke-width="1.4" stroke-linejoin="round"/>`;

const HEAD = `<path d="M36.2 35.4C36.4 27.6 42.6 21.8 50.3 22C58 22.2 64 28.4 63.9 36.2C63.8 43.8 57.8 50.2 50 50C42.2 49.8 36 43.2 36.2 35.4Z" fill="var(--bee-body)" ${INK}/>`;

const EYE_L = "M40.4 35.2C40.3 32.8 42 31.4 44.1 31.4C46.2 31.4 47.8 33 47.7 35.2C47.6 37.3 46 38.8 44 38.7C42 38.7 40.5 37.3 40.4 35.2Z";
const EYE_R = "M52.4 35.2C52.3 32.8 54 31.4 56.1 31.4C58.2 31.4 59.8 33 59.7 35.2C59.6 37.3 58 38.8 56 38.7C54 38.7 52.5 37.3 52.4 35.2Z";
const eyes = (scale: number) =>
  `<g transform="translate(50 35.2) scale(${scale}) translate(-50 -35.2)">
        <path d="${EYE_L}" fill="var(--bee-eye)" stroke="var(--bee-line)" stroke-width="${(1.7 / scale).toFixed(2)}" stroke-linejoin="round"/>
        <path d="${EYE_R}" fill="var(--bee-eye)" stroke="var(--bee-line)" stroke-width="${(1.7 / scale).toFixed(2)}" stroke-linejoin="round"/>
        <circle cx="44.7" cy="35.9" r="1.9" fill="var(--bee-line)"/><circle cx="56.7" cy="35.9" r="1.9" fill="var(--bee-line)"/>
      </g>`;
const SMILE = `<path d="M45.4 42.6C47.4 45 52.6 45.1 54.6 42.5" fill="none" stroke="var(--bee-line)" stroke-width="2" stroke-linecap="round"/>`;
const CHEEKS = `<ellipse cx="40.4" cy="41.2" rx="2.3" ry="2" fill="var(--bee-cheek)" opacity=".7"/><ellipse cx="59.6" cy="41.2" rx="2.3" ry="2" fill="var(--bee-cheek)" opacity=".7"/>`;

// The body group: outline + banding clipped to the outline. `wasp` is the same
// drawing slimmed and stretched, so the build reads as a different insect without a
// second set of curves to keep in step.
function bodyGroup(wasp: boolean): string {
  const tf = wasp ? ' transform="translate(50 64) scale(0.78 1.1) translate(-50 -62)"' : "";
  return `<g${tf}>
        <path d="${BODY_PATH}" fill="var(--bee-body)" ${INK}/>
        <clipPath id="${CLIP_ID}"><path d="${BODY_PATH}"/></clipPath>
        <g clip-path="url(#${CLIP_ID})" fill="var(--bee-stripe)">${STRIPES}</g>
      </g>`;
}

function bee(opts: { wasp?: boolean; eyeScale?: number; accessory?: string } = {}): string {
  const wasp = Boolean(opts.wasp);
  return `
      ${WING_L}${WING_R}
      ${wasp ? ANTENNAE_WASP : ANTENNAE}
      ${bodyGroup(wasp)}
      ${STINGER}
      ${HEAD}
      ${eyes(opts.eyeScale ?? 1)}
      ${SMILE}
      ${wasp ? "" : CHEEKS}
      ${opts.accessory ?? ""}`;
}

// One accessory per avatar, drawn to sit in the empty corners of the 100-wide frame.
const ACCESSORY: Partial<Record<AvatarKey, string>> = {
  queen: `<path d="M39.6 23.4L41.6 12.6L47.2 18.2L50.2 10.8L53.2 18.2L58.8 12.6L60.6 23.6Z" fill="var(--mark)" ${INK} stroke-width="2.2"/>`,
  hive: `<g fill="var(--bee-eye)" ${INK} stroke-width="2.1"><path d="M69.6 92.4C69.4 78.6 73.6 70.2 79.8 70.4C86.2 70.6 90.4 79 90.2 92.2Z"/><path d="M71 84.2C76 85.4 84 85 89 83.8M72.6 77.2C77 78.2 83 77.8 87.4 76.8" fill="none"/></g>`,
  honey: `<path d="M24 65.4C24 65.4 16.8 73.8 17.2 78.4C17.6 82.6 20.8 85.2 24.2 85.2C27.8 85.2 30.8 82.2 30.8 78C30.8 73.8 24 65.4 24 65.4Z" fill="var(--mark)" ${INK} stroke-width="2.2"/>`,
  blossom: `<g stroke="var(--bee-line)" stroke-width="1.7" stroke-linejoin="round" fill="var(--bee-eye)">${[0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${(68 + 5.2 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(12 + 5.2 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="3.5"/>`)
    .join("")}<circle cx="68" cy="12" r="2.7" fill="var(--mark)"/></g>`,
  clover: `<g stroke="var(--bee-line)" stroke-width="1.7" stroke-linejoin="round" fill="var(--bee-leaf)"><circle cx="30.4" cy="9.2" r="4.1"/><circle cx="25.2" cy="15.2" r="4.1"/><circle cx="35.6" cy="15.2" r="4.1"/></g>`,
};

function beeFor(key: AvatarKey): string {
  if (key === "wasp") return bee({ wasp: true });
  if (key === "drone") return bee({ eyeScale: 1.42 });
  return bee({ accessory: ACCESSORY[key] });
}

const wrap = (inner: string, viewBox = "12 4 76 90") =>
  `<svg viewBox="${viewBox}" width="100%" height="100%" aria-hidden="true" focusable="false">${inner}</svg>`;

const cache = new Map<string, string>();
const memo = (k: string, build: () => string) => {
  let v = cache.get(k);
  if (!v) cache.set(k, (v = build()));
  return v;
};

/** One contestant avatar (or the mascot, for "bee"). */
export function avatarSvg(key: AvatarKey): string {
  return memo(`avatar:${key}`, () => wrap(beeFor(key)));
}

/** The mascot is the plain bee avatar, drawn larger by CSS. */
export const mascotSvg = (): string => avatarSvg("bee");

// The rosette's scalloped ring: fourteen lobes, each a touch different, drawn once.
const ROSETTE_SCALLOP =
  "M81.9 44.0C91.1 47.6 88.2 58.4 78.3 57.7C84.5 64.4 77.8 73.2 69.9 68.6C72.8 78.0 62.2 82.8 56.7 74.7C55.2 84.9 44.5 84.9 43.0 74.7C37.7 82.5 27.8 77.6 30.6 68.6C21.9 73.7 14.5 65.0 21.4 57.7C12.4 58.4 10.2 47.3 18.6 44.0C9.6 40.5 11.8 29.6 21.5 30.3C14.6 22.9 21.9 14.3 30.7 19.4C27.9 10.5 37.5 5.6 42.7 13.3C44.2 3.5 55.7 3.5 57.2 13.3C62.5 5.4 72.2 10.3 69.4 19.4C78.2 14.2 85.4 22.9 78.5 30.3C87.7 29.6 90.5 40.7 81.9 44.0Z";
const ROSETTE_RING = "M23.4 44.3C23.2 31.2 34 21.2 50.2 21.4C65.8 21.6 76.8 31.8 76.6 44.5C76.4 57.6 65.6 67.2 49.8 66.9C34.2 66.7 23.6 57.2 23.4 44.3Z";

/** The rosette: a scalloped honey ring, two ribbon tails and the bee at the centre. */
export function rosetteSvg(): string {
  return memo("rosette", () =>
    wrap(
      `<path d="M36 62.4L25.6 96.6L38.2 89.2L46.4 99L52.4 63.6Z" fill="var(--mark-2)" ${INK} stroke-width="2.2"/>
      <path d="M64 62.4L74.4 96.6L61.8 89.2L53.6 99L47.6 63.6Z" fill="var(--mark-2)" opacity=".85" ${INK} stroke-width="2.2"/>
      <path d="${ROSETTE_SCALLOP}" fill="var(--mark)" ${INK}/>
      <path d="${ROSETTE_RING}" fill="var(--panel-solid)" stroke="var(--mark-ring)" stroke-width="3.2" stroke-linejoin="round"/>
      <g transform="translate(24.2 17.2) scale(0.684) translate(-12 -4)">${bee()}</g>`,
      "0 0 100 100",
    ),
  );
}
