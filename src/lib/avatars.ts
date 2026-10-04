// The avatar preset set — the ONE place the client writes this list down.
//
// It mirrors `public.avatar_keys()` from migration 0012, which the
// `room_players.avatar` CHECK constraint validates against. The database is the
// authority: an off-list key is refused at INSERT and UPDATE time regardless of
// what this file says. This exists so the client can render a picker and so it
// never *attempts* a key the constraint would reject.
//
// The two lists are therefore coupled and must be changed together. That
// coupling is asserted, not just asserted-in-a-comment:
// supabase/scripts/verify_elimination_client.mjs reads avatar_keys() off the
// live database and fails if it disagrees with AVATAR_KEYS below. Same
// discipline as Session 15's tier de-duplication — one list, and a check that
// nothing has drifted from it.
//
// The art for each key is drawn in lib/beeArt.ts (bee contestants, redesign
// stage 3): no emoji, no photos, no uploads. This file stays the one list of KEYS
// and labels, so the coupling to the database CHECK has a single home.

export type AvatarKey =
  | "bee"
  | "queen"
  | "drone"
  | "hive"
  | "honey"
  | "blossom"
  | "clover"
  | "wasp";

/** Must equal public.avatar_keys(), in the same order. */
export const AVATAR_KEYS: readonly AvatarKey[] = [
  "bee",
  "queen",
  "drone",
  "hive",
  "honey",
  "blossom",
  "clover",
  "wasp",
] as const;

/** Matches the column default in 0012, so an un-picked avatar agrees with the DB. */
export const DEFAULT_AVATAR: AvatarKey = "bee";

export const AVATAR_META: Record<AvatarKey, { label: string }> = {
  bee: { label: "Bee" },
  queen: { label: "Queen" },
  drone: { label: "Drone" },
  hive: { label: "Hive" },
  honey: { label: "Honey" },
  blossom: { label: "Blossom" },
  clover: { label: "Clover" },
  wasp: { label: "Wasp" },
};

export const AVATARS = AVATAR_KEYS.map((id) => ({ id, ...AVATAR_META[id] }));

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === "string" && (AVATAR_KEYS as readonly string[]).includes(value);
}

/**
 * Narrow an unknown value (a database row, a localStorage string) to a usable
 * key. Falls back to the default rather than throwing: a row written by a
 * future version of the app with a key this build doesn't know about should
 * render as a bee, not crash the scoreboard.
 */
export function coerceAvatar(value: unknown): AvatarKey {
  return isAvatarKey(value) ? value : DEFAULT_AVATAR;
}
