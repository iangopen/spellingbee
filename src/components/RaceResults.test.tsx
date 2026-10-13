// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RaceResults } from "./RaceResults";

afterEach(cleanup);

const row = (player_id: string, display_name: string, score: number) => ({ player_id, display_name, score, avatar: "bee" });

describe("RaceResults", () => {
  it("names a clear winner, tells the runner-up how far behind, and lists everyone best first", () => {
    render(<RaceResults players={[row("me", "Maya", 205), row("p2", "Tomasz", 211), row("p3", "Adaeze", 141)]} currentUserId="me" tier="medium" onLeave={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Tomasz");
    expect(screen.getByText("Race winner, Medium words")).toBeTruthy();
    expect(screen.getByText("You came 2nd with 205 points, 6 behind.")).toBeTruthy();
    const names = [...document.querySelectorAll(".lane .name b")].map((n) => n.textContent);
    expect(names).toEqual(["Tomasz", "Maya", "Adaeze"]);
    expect(document.querySelector(".lane.you .name")?.textContent).toContain("you");
  });

  it("a two-way tie is a tie: both names, shared first place, nobody picked by row order", () => {
    render(<RaceResults players={[row("me", "Maya", 205), row("p2", "Tomasz", 205), row("p3", "Adaeze", 141)]} currentUserId="me" tier="medium" onLeave={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Maya and Tomasz");
    expect(screen.getByText(/A tie for first/)).toBeTruthy();
    expect(screen.getByText("You tied for 1st with 205 points.")).toBeTruthy();
    expect([...document.querySelectorAll(".lane .pos")].map((n) => n.textContent)).toEqual(["1", "1", "3"]);
  });

  it("never claims a new best", () => {
    render(<RaceResults players={[row("me", "Maya", 205)]} currentUserId="me" tier="easy" onLeave={() => {}} />);
    expect(screen.queryByText(/new best/i)).toBeNull();
  });

  it("has exactly one button, which leaves the room", () => {
    const onLeave = vi.fn();
    render(<RaceResults players={[row("me", "Maya", 5)]} currentUserId="me" tier={null} onLeave={onLeave} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("Back to lobby");
    fireEvent.click(buttons[0]);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("the standings are a labelled list and the lane tokens are decoration", () => {
    render(<RaceResults players={[row("me", "Maya", 5), row("p2", "Bo", 3)]} currentUserId="me" tier="easy" onLeave={() => {}} />);
    expect(screen.getByRole("list", { name: "Final standings" })).toBeTruthy();
    for (const t of document.querySelectorAll(".track")) expect(t.getAttribute("aria-hidden")).toBe("true");
  });

  it("when nobody scored there is no winner and no rosette", () => {
    const { container } = render(<RaceResults players={[row("me", "Maya", 0), row("p2", "Bo", 0)]} currentUserId="me" tier="easy" onLeave={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("No points this time");
    expect(container.querySelector(".winner-rosette")).toBeNull();
  });
});
