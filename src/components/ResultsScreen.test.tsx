// @vitest-environment jsdom
//
// Singleplayer results. (A finished race has its own screen: RaceResults.)
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsScreen } from "./ResultsScreen";

afterEach(cleanup);

describe("ResultsScreen actions", () => {
  it("singleplayer: 'Play again' replays and 'Change difficulty' goes to the menu", () => {
    const onReplay = vi.fn();
    const onMenu = vi.fn();
    render(<ResultsScreen score={132} bestStreak={6} best={118} onReplay={onReplay} onMenu={onMenu} />);
    expect(screen.queryByText("Back to lobby")).toBeNull();
    fireEvent.click(screen.getByText("Play again"));
    fireEvent.click(screen.getByText("Change difficulty"));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("claims a new best, and shows the rosette, only when the caller says the previous best was beaten", () => {
    const { container, rerender } = render(<ResultsScreen score={132} bestStreak={6} best={132} isNewBest onReplay={() => {}} onMenu={() => {}} />);
    expect(screen.getByText(/new best/)).toBeTruthy();
    expect(container.querySelector(".results-rosette")).not.toBeNull();
    // a tie with the stored best is NOT a new best (it used to read score >= best)
    rerender(<ResultsScreen score={132} bestStreak={6} best={132} onReplay={() => {}} onMenu={() => {}} />);
    expect(screen.queryByText(/new best/i)).toBeNull();
    expect(container.querySelector(".results-rosette")).toBeNull();
  });

  it("practice: says best scores are not set, and never claims a new best", () => {
    render(<ResultsScreen score={60} bestStreak={6} best={0} practice onReplay={() => {}} onMenu={() => {}} />);
    expect(screen.getByText(/Practice runs don't set best scores/)).toBeTruthy();
    expect(screen.queryByText(/new best/i)).toBeNull();
  });
});
