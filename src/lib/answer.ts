/**
 * Whether a typed guess spells the word. The one comparison in the app.
 *
 * The engine's checkAnswer (useGameEngine) calls this for the verdict. The only
 * other caller is singleplayer's touch auto-submit (RoundScreen), which uses it
 * to decide WHEN to submit, never what the verdict is: the guess still goes
 * through the engine exactly like an Enter. Multiplayer verdicts come from the
 * server and never use this.
 *
 * Surrounding whitespace is ignored, so a trailing space from predictive text
 * still matches.
 */
export function guessMatches(word: string, guess: string): boolean {
  return guess.trim().toLowerCase() === word.toLowerCase();
}
