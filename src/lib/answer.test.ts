// guessMatches must decide exactly what checkAnswer decided before the comparison moved
// out of useGameEngine (2026-10-13), for every word in the bank and every kind of guess,
// because the engine's verdict now goes through it.
import { describe, expect, it } from "vitest";
import { WORD_BANK } from "../data/words";
import { guessMatches } from "./answer";

// The expression checkAnswer held until 2026-10-13, verbatim.
const oldCheck = (word: string, guess: string) => guess.trim().toLowerCase() === word.toLowerCase();

function guessesFor(word: string): string[] {
  const swapped = word.length > 1 ? word[1] + word[0] + word.slice(2) : word;
  return [
    word,
    word.toUpperCase(),
    word[0].toUpperCase() + word.slice(1),
    `${word} `,
    ` ${word}`,
    `\t${word}\n`,
    `${word}  `,
    word.slice(0, -1), // partial
    `${word}s`, // one letter too many
    swapped, // transposed
    word.replace(/[aeiou]/, "e"),
    `${word} ${word}`,
    "",
    " ",
  ];
}

describe("guessMatches agrees with the old checkAnswer expression", () => {
  it(`on every word in the bank (${WORD_BANK.length} words) and 14 kinds of guess each`, () => {
    let compared = 0;
    let matches = 0;
    for (const { word } of WORD_BANK) {
      for (const guess of guessesFor(word)) {
        expect(guessMatches(word, guess), JSON.stringify({ word, guess })).toBe(oldCheck(word, guess));
        compared++;
        if (oldCheck(word, guess)) matches++;
      }
    }
    // Both outcomes were exercised, not just one.
    expect(matches).toBeGreaterThan(WORD_BANK.length * 6);
    expect(compared - matches).toBeGreaterThan(WORD_BANK.length * 4);
  });
});
