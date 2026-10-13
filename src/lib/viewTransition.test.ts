// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, withViewTransition } from "./viewTransition";

const setReduced = (osReduce: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: osReduce && q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  document.documentElement.removeAttribute("data-reduce-motion");
  setReduced(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe("withViewTransition", () => {
  it("runs the update straight away when the browser has no View Transition API", () => {
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("wraps the update in a transition when the API exists and motion is allowed", () => {
    const start = vi.fn((cb: () => void) => cb());
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("under the OS reduced-motion setting, starts NO transition and runs the update at once", () => {
    setReduced(true);
    const start = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("the in-app reduce-motion switch does the same", () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    const start = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
