// Turn a database or API error from a lobby action into a sentence a player
// can act on. The codes come from the server (migrations 0016+); the server
// decides, this only words it. Anything unrecognised falls through to the raw
// message rather than being hidden behind a generic "something went wrong".

import { displayNameProblemText } from "./displayName";
import { PLAYER_CAP } from "./rooms";

// Codes raised by the 0019 limit triggers. The open-room and hourly numbers are
// deliberately not repeated here: they live in public.abuse_limits() only.
const LIMIT_MESSAGES: Record<string, string> = {
  room_full: `That room is full (max ${PLAYER_CAP} players).`,
  too_many_open_rooms:
    "You already have the maximum number of open rooms. Finish or leave one before creating another.",
  room_create_rate_limited: "You've created a lot of rooms recently. Try again in a little while.",
};

interface ErrorLike {
  code?: string;
  message?: string;
}

export function friendlyRoomError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as ErrorLike;
  const message = e.message ?? (typeof err === "string" ? err : String(err));

  for (const [code, text] of Object.entries(LIMIT_MESSAGES)) {
    if (message === code) return text;
  }
  if (message.includes("display_name_not_allowed")) {
    return "That name isn't allowed. Try another.";
  }
  if (message.includes("room_players_display_name_valid")) {
    return displayNameProblemText("too_long");
  }
  return message;
}
