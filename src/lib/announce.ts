import type { RoundStatus } from "../types";

/**
 * The text RoundScreen's role="status" region carries, so a screen-reader user
 * hears the outcome of each word and the running score (hardening #13). Sighted
 * players get the same facts from the coloured input and the feedback line.
 *
 * Empty while a word is live: clearing between words is also what makes the
 * next outcome a CHANGE a screen reader will announce.
 *
 * `awaitingOthers` (race mode: answered, round still open) must never reveal
 * the word, exactly like the visible feedback it mirrors — other players are
 * still typing it.
 */
export function roundAnnouncement(
  status: RoundStatus,
  word: string | undefined,
  score: number,
  awaitingOthers = false
): string {
  if (awaitingOthers) return "Answer locked in. Waiting for the other players.";
  if (status === "correct") return `Correct. Score ${score}.`;
  if (status === "incorrect") return `Incorrect: ${word ?? "unknown"}. Score ${score}.`;
  return "";
}
