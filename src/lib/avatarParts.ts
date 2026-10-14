// The avatar maker's data: bee colours, cosmetics, the spoken description, and the
// mapping to and from the legacy avatar keys. DATA ONLY: no art, no screen uses it
// yet (the picker is the next session's work). lib/avatars.ts stays the list of
// legacy keys the deployed client writes.
//
// The database is the authority. Migration 0021 adds room_players.avatar_color
// (CHECK 0-7) and avatar_cosmetic (CHECK 0-13), and its sync trigger holds the
// SQL copy of the mapping below. supabase/tests/avatar_parts.test.mjs imports this
// file and fails if the list lengths differ from the CHECK ranges or if
// partsFromKey / keyFromParts disagree with the trigger for any key or any of the
// 112 pairs.
//
// Both lists are APPEND-ONLY: a stored index must always mean the same thing.
// Never reorder, never reuse; a retired item stays in the list.

import { DEFAULT_AVATAR, isAvatarKey, type AvatarKey } from "./avatars";

/** Bee colours, by index. Index 0 is the mascot's own honey. */
export const AVATAR_COLORS = ["Honey", "Red", "Rose", "Purple", "Blue", "Aqua", "Green", "Grey"] as const;

/**
 * Cosmetics, by index. Index 0 is none. Ian picked both prototype sets
 * (2026-10-14): the playful set keeps its prototype indices 0-7, the
 * spelling-themed set follows from 8 (its Headphones is the same item as 5).
 * `phrase` completes the spoken description: "Blue bee wearing a crown".
 */
export const AVATAR_COSMETICS = [
  { name: "None", phrase: "" },
  { name: "Crown", phrase: "wearing a crown" },
  { name: "Party hat", phrase: "wearing a party hat" },
  { name: "Flower", phrase: "wearing a flower" },
  { name: "Sunglasses", phrase: "wearing sunglasses" },
  { name: "Headphones", phrase: "wearing headphones" },
  { name: "Bow tie", phrase: "wearing a bow tie" },
  { name: "Honey pot", phrase: "holding a honey pot" },
  { name: "Graduation cap", phrase: "wearing a graduation cap" },
  { name: "Pencil", phrase: "holding a pencil" },
  { name: "Reading glasses", phrase: "wearing reading glasses" },
  { name: "Quill", phrase: "wearing a quill" },
  { name: "Book", phrase: "holding a book" },
  { name: "Letter block", phrase: "holding a letter block" },
] as const;

export type AvatarColor = number; // 0 .. AVATAR_COLORS.length - 1
export type AvatarCosmetic = number; // 0 .. AVATAR_COSMETICS.length - 1
export interface AvatarParts {
  color: AvatarColor;
  cosmetic: AvatarCosmetic;
}

/** Matches the column defaults in 0021: the plain honey bee, i.e. the mascot. */
export const DEFAULT_AVATAR_PARTS: AvatarParts = { color: 0, cosmetic: 0 };

/**
 * Narrow an unknown value (a database row, a localStorage string) to a valid
 * index, falling back to 0 like coerceAvatar does: a row written by a future
 * version with an index this build doesn't know should render, not crash.
 */
export function coerceAvatarPart(value: unknown, count: number): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < count ? n : 0;
}

export function coerceAvatarParts(color: unknown, cosmetic: unknown): AvatarParts {
  return {
    color: coerceAvatarPart(color, AVATAR_COLORS.length),
    cosmetic: coerceAvatarPart(cosmetic, AVATAR_COSMETICS.length),
  };
}

/** "Blue bee wearing a crown"; "Honey bee" with no cosmetic. Out-of-range input reads as 0. */
export function describeAvatar(color: number, cosmetic: number): string {
  const p = coerceAvatarParts(color, cosmetic);
  const phrase = AVATAR_COSMETICS[p.cosmetic].phrase;
  return `${AVATAR_COLORS[p.color]} bee${phrase ? ` ${phrase}` : ""}`;
}

// ---- the legacy mapping (the SQL copy is room_players_avatar_sync in 0021) ----

const FROM_KEY: Record<AvatarKey, AvatarParts> = {
  bee: { color: 0, cosmetic: 0 },
  queen: { color: 0, cosmetic: 1 },
  drone: { color: 4, cosmetic: 5 },
  hive: { color: 7, cosmetic: 7 },
  honey: { color: 0, cosmetic: 7 },
  blossom: { color: 2, cosmetic: 3 },
  clover: { color: 6, cosmetic: 3 },
  wasp: { color: 7, cosmetic: 0 },
};

/** The parts an old avatar key becomes (the backfill, and an old client's write). Unknown keys read as bee. */
export function partsFromKey(key: unknown): AvatarParts {
  return { ...FROM_KEY[isAvatarKey(key) ? key : DEFAULT_AVATAR] };
}

/** The nearest old key for a pair, so a client still on the old list draws something sensible. */
export function keyFromParts(color: number, cosmetic: number): AvatarKey {
  const p = coerceAvatarParts(color, cosmetic);
  if (p.cosmetic === 1 || p.cosmetic === 8) return "queen";
  if (p.cosmetic === 5) return "drone";
  if (p.cosmetic === 7) return p.color === 7 ? "hive" : "honey";
  if (p.cosmetic === 3) return p.color === 6 ? "clover" : "blossom";
  if (p.color === 7) return "wasp";
  if (p.color === 2) return "blossom";
  if (p.color === 6) return "clover";
  return "bee";
}
