// Turn a database or API error from a lobby action into a sentence a player
// can act on. The codes come from the server (migrations 0016+); the server
// decides, this only words it. Anything unrecognised falls through to the raw
// message rather than being hidden behind a generic "something went wrong".

import { displayNameProblemText } from "./displayName";

interface ErrorLike {
  code?: string;
  message?: string;
}

export function friendlyRoomError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as ErrorLike;
  const message = e.message ?? (typeof err === "string" ? err : String(err));

  if (message.includes("display_name_not_allowed")) {
    return "That name isn't allowed. Try another.";
  }
  if (message.includes("room_players_display_name_valid")) {
    return displayNameProblemText("too_long");
  }
  return message;
}
