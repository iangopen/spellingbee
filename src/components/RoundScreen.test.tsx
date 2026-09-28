// @vitest-environment jsdom
//
// Enter must register in the same tick it is pressed, whatever the engine's
// latency. In a race the verdict is a network round trip away (0.3-1.3s,
// measured on the live project), and before this the screen showed nothing
// until it came back, so Enter felt dead.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../types";
import { RoundScreen } from "./RoundScreen";

const base: GameState = {
  tier: "easy",
  status: "playing",
  currentWord: { id: "e1", word: "rhythm", tier: "easy", definition: "A strong regular pattern" },
  score: 0,
  streak: 0,
  bestStreak: 0,
  timeLeft: 20,
  wordsRemaining: 9,
  untimed: false,
  hideDefinition: false,
  lastResponseMs: null,
};

afterEach(cleanup);

// jsdom implements no layout, so no scrollIntoView (RoundScreen calls it on focus).
Element.prototype.scrollIntoView = () => {};

function setup(state: GameState = base) {
  const onSubmit = vi.fn();
  const utils = render(<RoundScreen state={state} onSubmit={onSubmit} onSkip={() => {}} canSkip={false} />);
  const input = screen.getByPlaceholderText("Type the word you hear") as HTMLInputElement;
  const enter = (text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.submit(input.form!);
  };
  return { ...utils, onSubmit, input, enter };
}

describe("RoundScreen — Enter latency", () => {
  it("acknowledges Enter synchronously, before any verdict exists", () => {
    const { enter, input, onSubmit } = setup();
    enter("rhythm");
    // Same tick: no timers advanced, no promise awaited, status still "playing".
    expect(onSubmit).toHaveBeenCalledWith("rhythm");
    expect(screen.getByText("Checking…")).toBeTruthy();
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps focus on the input while checking", () => {
    const { enter, input } = setup();
    input.focus();
    enter("rhythm");
    expect(document.activeElement).toBe(input);
  });

  it("a second Enter while the first is in flight sends nothing", () => {
    const { enter, onSubmit } = setup();
    enter("rhythm");
    enter("rhythm");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("never states a verdict while checking, and the live region stays silent", () => {
    const { enter, container } = setup();
    enter("rhythm");
    expect(screen.queryByText(/Correct|The word was/)).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  });

  it("the verdict replaces 'Checking…' when the engine reports it", () => {
    const { enter, rerender } = setup();
    enter("rhythm");
    rerender(<RoundScreen state={{ ...base, status: "correct", score: 30 }} onSubmit={() => {}} onSkip={() => {}} canSkip={false} />);
    expect(screen.queryByText("Checking…")).toBeNull();
    expect(screen.getByText(/Correct!/)).toBeTruthy();
  });

  it("race: 'Answer locked in' replaces 'Checking…' without revealing the word", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<RoundScreen state={base} onSubmit={onSubmit} onSkip={() => {}} canSkip={false} />);
    const input = screen.getByPlaceholderText("Type the word you hear") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "rythm" } });
    fireEvent.submit(input.form!);
    rerender(<RoundScreen state={{ ...base, status: "incorrect" }} onSubmit={onSubmit} onSkip={() => {}} canSkip={false} awaitingOthers />);
    expect(screen.queryByText("Checking…")).toBeNull();
    // Both the visible line and the (hidden) live region say so; neither names the word.
    expect(document.querySelector(".feedback.waiting")?.textContent).toMatch(/Answer locked in/);
    expect(document.querySelector('[role="status"]')?.textContent).toMatch(/Answer locked in/);
    expect(screen.queryByText(/rhythm/)).toBeNull();
  });

  it("a request that never gets a verdict unlocks the input again", () => {
    vi.useFakeTimers();
    try {
      const { enter, input } = setup();
      enter("rhythm");
      expect(input.readOnly).toBe(true);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(input.readOnly).toBe(false);
      expect(screen.queryByText("Checking…")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the next word starts unlocked", () => {
    const { enter, input, rerender } = setup();
    enter("rhythm");
    rerender(
      <RoundScreen
        state={{ ...base, currentWord: { id: "e2", word: "garden", tier: "easy", definition: "Where plants grow" } }}
        onSubmit={() => {}}
        onSkip={() => {}}
        canSkip={false}
      />
    );
    expect(input.readOnly).toBe(false);
    expect(screen.queryByText("Checking…")).toBeNull();
  });
});
