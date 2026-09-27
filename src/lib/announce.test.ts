import { describe, expect, it } from "vitest";
import { roundAnnouncement } from "./announce";

describe("roundAnnouncement", () => {
  it("announces a correct answer with the score", () => {
    expect(roundAnnouncement("correct", "rhythm", 42)).toBe("Correct. Score 42.");
  });

  it("announces an incorrect answer with the word and the score", () => {
    expect(roundAnnouncement("incorrect", "rhythm", 30)).toBe("Incorrect: rhythm. Score 30.");
  });

  it("is empty while a word is live, so the next outcome is a fresh announcement", () => {
    expect(roundAnnouncement("playing", "rhythm", 30)).toBe("");
    expect(roundAnnouncement("idle", undefined, 0)).toBe("");
    expect(roundAnnouncement("finished", "rhythm", 30)).toBe("");
  });

  it("never reveals the word while other racers are still typing it", () => {
    for (const status of ["playing", "correct", "incorrect"] as const) {
      const text = roundAnnouncement(status, "rhythm", 30, true);
      expect(text).not.toContain("rhythm");
      expect(text).toMatch(/locked in/);
    }
  });
});
