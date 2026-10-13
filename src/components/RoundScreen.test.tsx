// @vitest-environment jsdom
//
// Enter must register in the same tick it is pressed, whatever the engine's
// latency. In a race the verdict is a network round trip away (0.3-1.3s,
// measured on the live project), and before this the screen showed nothing
// until it came back, so Enter felt dead.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Touch auto-submit (2026-10-12). Singleplayer passes `autoSubmit`; on a device
// matching "(pointer: coarse) and (hover: none)" a COMPLETE correct word is sent
// with no Enter. Everything else must still need Enter.
describe("RoundScreen — touch auto-submit", () => {
  let touch = true;
  beforeEach(() => {
    touch = true;
    localStorage.clear();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: touch && q === "(pointer: coarse) and (hover: none)", addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  function setupAuto({ autoSubmit = true } = {}) {
    const onSubmit = vi.fn();
    render(<RoundScreen state={base} onSubmit={onSubmit} onSkip={() => {}} canSkip={false} autoSubmit={autoSubmit} />);
    const input = screen.getByPlaceholderText("Type the word you hear") as HTMLInputElement;
    // One change event per keystroke, the way a phone keyboard types.
    const typeKeys = (text: string) => {
      for (let i = 1; i <= text.length; i++) fireEvent.change(input, { target: { value: text.slice(0, i) } });
    };
    return { onSubmit, input, typeKeys };
  }

  it("submits the moment the last letter makes the word correct, once, without Enter", () => {
    const { onSubmit, input, typeKeys } = setupAuto();
    typeKeys("rhythm");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("rhythm");
    // Same acknowledgement as an Enter: locked, aria-disabled, "Checking…".
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Checking…")).toBeTruthy();
  });

  it("never submits a partial word", () => {
    const { onSubmit, typeKeys } = setupAuto();
    typeKeys("rhyth");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("never submits a wrong word, and Enter still sends it", () => {
    const { onSubmit, input, typeKeys } = setupAuto();
    typeKeys("rythm");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.submit(input.form!);
    expect(onSubmit).toHaveBeenCalledWith("rythm");
  });

  it("a trailing space from predictive text still submits (whole word inserted at once)", () => {
    const { onSubmit, input } = setupAuto();
    fireEvent.change(input, { target: { value: "rhythm " } });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("rhythm ");
  });

  it("matches case-insensitively, like the engine's verdict", () => {
    const { onSubmit, input } = setupAuto();
    fireEvent.change(input, { target: { value: "Rhythm" } });
    expect(onSubmit).toHaveBeenCalledWith("Rhythm");
  });

  it("waits while a composition is in progress, then submits when it ends", () => {
    const { onSubmit, input } = setupAuto();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "rhythm" } });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("rhythm");
  });

  it("is off on a desktop (fine pointer that hovers)", () => {
    touch = false;
    const { onSubmit, typeKeys } = setupAuto();
    typeKeys("rhythm");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is off when Settings switched it off", () => {
    localStorage.setItem("spellingbee:autoSubmit", "false");
    const { onSubmit, typeKeys } = setupAuto();
    typeKeys("rhythm");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is off without the prop (multiplayer's race screen), even on touch", () => {
    const { onSubmit, typeKeys } = setupAuto({ autoSubmit: false });
    typeKeys("rhythm");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
