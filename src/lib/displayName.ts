// Display-name rules, client side. UX ONLY: the authority is the database —
// the room_players_display_name_valid CHECK and the blocklist trigger in
// migration 0018. This mirrors the CHECK so the lobby can explain a problem
// before a round trip; it cannot see the blocklist and must never try to.

/** Must equal the upper bound in 0018's CHECK. */
export const DISPLAY_NAME_MAX = 24;

export type DisplayNameProblem = "empty" | "too_long" | "invalid_chars";

export type DisplayNameCheck =
  | { ok: true; name: string }
  | { ok: false; problem: DisplayNameProblem };

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Trim and check a name the way the server will. Length is counted in code
 * points, like Postgres' char_length, not UTF-16 units like String.length.
 */
export function validateDisplayName(raw: string): DisplayNameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, problem: "empty" };
  if (CONTROL_CHARS.test(name)) return { ok: false, problem: "invalid_chars" };
  if ([...name].length > DISPLAY_NAME_MAX) return { ok: false, problem: "too_long" };
  return { ok: true, name };
}

export function displayNameProblemText(problem: DisplayNameProblem): string {
  switch (problem) {
    case "empty":
      return "Enter a name to create or join a room.";
    case "too_long":
      return `Names can be at most ${DISPLAY_NAME_MAX} characters.`;
    case "invalid_chars":
      return "That name contains characters that can't be used.";
  }
}
