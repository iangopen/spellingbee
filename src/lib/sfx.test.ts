// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSfxForOutcome } from "../hooks/useSfxForOutcome";
import { BELL_FUNDAMENTAL, BELL_PARTIALS, playCorrect, playIncorrect } from "./sfx";

// A fake AudioContext that records every oscillator: when it starts, its pitch and
// how long it runs. Real sound is checked in a browser (see docs/history.md); this
// pins the SHAPE of the sounds and how often they fire.
interface Osc { start: number; stop: number; freq: number; type: string }
let oscillators: Osc[] = [];

beforeEach(() => {
  oscillators = [];
  class FakeAudioContext {
    state = "running";
    currentTime = 10;
    destination = {};
    resume() { return Promise.resolve(); }
    createGain() {
      const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
      return { gain: param, connect() {} };
    }
    createOscillator() {
      const o: Osc = { start: 0, stop: 0, freq: 0, type: "" };
      oscillators.push(o);
      return {
        set type(t: string) { o.type = t; },
        frequency: { setValueAtTime: (f: number) => { o.freq = f; }, exponentialRampToValueAtTime() {} },
        connect() {},
        start: (t: number) => { o.start = t; },
        stop: (t: number) => { o.stop = t; },
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("the miss bell", () => {
  it("is one event: three sine partials starting together", () => {
    playIncorrect();
    expect(oscillators).toHaveLength(3);
    expect(new Set(oscillators.map((o) => o.start)).size).toBe(1);
    expect(oscillators.every((o) => o.type === "sine")).toBe(true);
  });

  it("uses inharmonic partials (1 : 2.76 : 5.4), never whole-number multiples", () => {
    playIncorrect();
    const ratios = oscillators.map((o) => o.freq / BELL_FUNDAMENTAL);
    expect(ratios[0]).toBeCloseTo(1, 5);
    expect(ratios[1]).toBeCloseTo(2.76, 5);
    expect(ratios[2]).toBeCloseTo(5.4, 5);
    expect(BELL_PARTIALS.slice(1).every((p) => !Number.isInteger(p.ratio))).toBe(true);
  });

  it("rings out in under a second, the high partials dying first", () => {
    playIncorrect();
    const lengths = oscillators.map((o) => o.stop - o.start);
    expect(Math.max(...lengths)).toBeLessThan(0.8);
    expect(lengths[0]).toBeGreaterThan(lengths[1]);
    expect(lengths[1]).toBeGreaterThan(lengths[2]);
  });

  it("is quieter than a buzzer would be: the top partial is a fraction of the fundamental", () => {
    expect(BELL_PARTIALS[2].peak).toBeLessThan(BELL_PARTIALS[0].peak / 4);
  });

  it("does nothing when sound is off", async () => {
    const { setEnabled } = await import("./sfx");
    setEnabled(false);
    playIncorrect();
    playCorrect();
    expect(oscillators).toHaveLength(0);
    setEnabled(true);
  });
});

describe("useSfxForOutcome: each outcome sounds exactly once", () => {
  it("a miss plays one bell, and a re-render does not replay it", () => {
    const { rerender } = renderHook(({ id, status }) => useSfxForOutcome(id, status), { initialProps: { id: "w1", status: "playing" as const } as { id: string; status: "playing" | "correct" | "incorrect" } });
    expect(oscillators).toHaveLength(0);
    rerender({ id: "w1", status: "incorrect" });
    expect(oscillators).toHaveLength(3);
    rerender({ id: "w1", status: "incorrect" });
    rerender({ id: "w1", status: "incorrect" });
    expect(oscillators).toHaveLength(3);
  });

  it("a correct answer plays the two-note chime once", () => {
    const { rerender } = renderHook(({ id, status }) => useSfxForOutcome(id, status), { initialProps: { id: "w1", status: "playing" as const } as { id: string; status: "playing" | "correct" | "incorrect" } });
    rerender({ id: "w1", status: "correct" });
    rerender({ id: "w1", status: "correct" });
    expect(oscillators).toHaveLength(2);
  });

  it("two misses in a row on different words each get one bell", () => {
    const { rerender } = renderHook(({ id, status }) => useSfxForOutcome(id, status), { initialProps: { id: "w1", status: "incorrect" as const } as { id: string; status: "playing" | "correct" | "incorrect" } });
    rerender({ id: "w2", status: "playing" });
    rerender({ id: "w2", status: "incorrect" });
    expect(oscillators).toHaveLength(6);
  });
});
