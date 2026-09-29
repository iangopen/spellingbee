// @vitest-environment jsdom
//
// A finished race used to show "Play again" and "Change difficulty", and both
// silently left the room. The race now gets one button that says what it does;
// singleplayer keeps its two real choices.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsScreen } from "./ResultsScreen";

afterEach(cleanup);

describe("ResultsScreen actions", () => {
  it("race: exactly one button, 'Back to lobby', which leaves the room", () => {
    const onLeaveRoom = vi.fn();
    render(<ResultsScreen score={205} bestStreak={5} best={205} onLeaveRoom={onLeaveRoom} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("Back to lobby");
    expect(screen.queryByText("Play again")).toBeNull();
    expect(screen.queryByText("Change difficulty")).toBeNull();
    fireEvent.click(buttons[0]);
    expect(onLeaveRoom).toHaveBeenCalledTimes(1);
  });

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
});
