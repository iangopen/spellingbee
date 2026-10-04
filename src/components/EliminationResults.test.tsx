// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MultiplayerExtras } from "../hooks/useMultiplayerGame";
import { EliminationResults } from "./EliminationResults";

afterEach(cleanup);

const p = (player_id: string, display_name: string, score: number, is_eliminated: boolean) =>
  ({ room_id: "r", player_id, display_name, score, streak: 0, connected_at: "t", lives: is_eliminated ? 0 : 1, is_eliminated, turn_order: 1, avatar: "bee" }) as const;

const extras = (over: Partial<MultiplayerExtras>): MultiplayerExtras =>
  ({ players: [], currentUserId: "me", winnerId: null, winnerName: null, eliminationOrder: [], ...over }) as unknown as MultiplayerExtras;

describe("EliminationResults", () => {
  const players = [p("me", "Maya", 300, true), p("p2", "Tomasz", 90, false), p("p3", "Adaeze", 150, true), p("p4", "Rafael", 400, true)];

  it("places by survival, not score: winner, then last knocked out first", () => {
    // Rafael has the highest score but went out first; Tomasz survived.
    render(<EliminationResults extras={extras({ players, winnerId: "p2", eliminationOrder: ["p4", "p3", "me"] })} onLeave={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Tomasz");
    expect([...document.querySelectorAll(".standing-name")].map((n) => n.textContent?.replace("you", ""))).toEqual(["Tomasz", "Maya", "Adaeze", "Rafael"]);
    expect(screen.getByText(/do not decide the order/)).toBeTruthy();
  });

  it("tells the winner they won", () => {
    render(<EliminationResults extras={extras({ players: [p("me", "Maya", 10, false), p("p2", "Bo", 5, true)], winnerId: "me", eliminationOrder: ["p2"] })} onLeave={() => {}} />);
    expect(screen.getByText("You win")).toBeTruthy();
  });

  it("a null winner is an honest draw, never 'undefined wins'", () => {
    render(<EliminationResults extras={extras({ players: [p("me", "Maya", 10, false)], winnerId: null })} onLeave={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("No winner");
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("has one button, which leaves", () => {
    render(<EliminationResults extras={extras({ players, winnerId: "p2", eliminationOrder: ["p4", "p3", "me"] })} onLeave={() => {}} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Back to lobby"]);
  });
});
