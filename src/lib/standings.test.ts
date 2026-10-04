import { describe, expect, it } from "vitest";
import { ordinal, rankPlayers, summarizeRace } from "./standings";

const p = (id: string, name: string, score: number) => ({ player_id: id, display_name: name, score });

describe("rankPlayers", () => {
  it("orders by score, highest first, with places and gaps", () => {
    const r = rankPlayers([p("a", "Ada", 141), p("b", "Bo", 205), p("c", "Cy", 67)]);
    expect(r.map((x) => [x.player.display_name, x.rank, x.behind])).toEqual([["Bo", 1, 0], ["Ada", 2, 64], ["Cy", 3, 138]]);
  });

  it("gives equal scores the same place and skips the next (1, 1, 3)", () => {
    const r = rankPlayers([p("a", "Ada", 100), p("b", "Bo", 100), p("c", "Cy", 40)]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
  });

  it("scales lane progress to the leader; zero points sits at the start", () => {
    const r = rankPlayers([p("a", "Ada", 200), p("b", "Bo", 100), p("c", "Cy", 0)]);
    expect(r.map((x) => x.progress)).toEqual([1, 0.5, 0]);
    expect(rankPlayers([p("a", "Ada", 0)])[0].progress).toBe(0);
  });

  it("keeps arrival order among equals and does not mutate the input", () => {
    const input = [p("a", "Ada", 5), p("b", "Bo", 5)];
    expect(rankPlayers(input).map((x) => x.player.player_id)).toEqual(["a", "b"]);
    expect(input.map((x) => x.player_id)).toEqual(["a", "b"]);
  });

  it("handles an empty room", () => {
    expect(rankPlayers([])).toEqual([]);
  });
});

describe("summarizeRace", () => {
  it("a clear winner, told to a runner-up", () => {
    const s = summarizeRace(rankPlayers([p("a", "Tomasz", 208), p("b", "Maya", 205), p("c", "Adaeze", 141)]), "b");
    expect(s).toEqual({ kicker: "Race winner", headline: "Tomasz", youLine: "You came 2nd with 205 points, 3 behind." });
  });

  it("tells the winner they won", () => {
    expect(summarizeRace(rankPlayers([p("a", "Ada", 9), p("b", "Bo", 4)]), "a").youLine).toBe("You won with 9 points.");
  });

  it("a tie for first names everyone and does not pick one", () => {
    const s = summarizeRace(rankPlayers([p("a", "Maya", 205), p("b", "Tomasz", 205), p("c", "Adaeze", 90)]), "a");
    expect(s.kicker).toBe("A tie for first");
    expect(s.headline).toBe("Maya and Tomasz");
    expect(s.youLine).toBe("You tied for 1st with 205 points.");
  });

  it("a three-way tie lists all three", () => {
    expect(summarizeRace(rankPlayers([p("a", "A", 5), p("b", "B", 5), p("c", "C", 5)]), null).headline).toBe("A, B and C");
  });

  it("nobody scoring is not a win", () => {
    const s = summarizeRace(rankPlayers([p("a", "Ada", 0), p("b", "Bo", 0)]), "a");
    expect(s.headline).toBe("No points this time");
    expect(s.kicker).toBe("Race over");
  });

  it("says nothing personal to someone not in the list, and handles one point", () => {
    expect(summarizeRace(rankPlayers([p("a", "Ada", 1)]), "zz").youLine).toBeNull();
    expect(summarizeRace(rankPlayers([p("a", "Ada", 1)]), "a").youLine).toBe("You won with 1 point.");
  });
});

describe("ordinal", () => {
  it("words places", () => expect([1, 2, 3, 4, 8].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "8th"]));
});
