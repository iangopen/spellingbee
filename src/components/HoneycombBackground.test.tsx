// @vitest-environment jsdom
//
// The honeycomb is decoration only: hidden from assistive tech, no text, and
// nothing a keyboard could land on. It also freezes while the tab is hidden.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HoneycombBackground } from "./HoneycombBackground";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-paused");
});

describe("HoneycombBackground", () => {
  it("is aria-hidden, holds no text and nothing focusable", () => {
    const { container } = render(<HoneycombBackground />);
    const bg = container.querySelector(".bg") as HTMLElement;
    expect(bg.getAttribute("aria-hidden")).toBe("true");
    expect(bg.textContent).toBe("");
    expect(bg.querySelectorAll("a, button, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("pauses while the tab is hidden and resumes when it is visible", () => {
    let state: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    render(<HoneycombBackground />);
    const root = document.documentElement;
    expect(root.hasAttribute("data-paused")).toBe(false);
    state = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(root.hasAttribute("data-paused")).toBe(true);
    state = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(root.hasAttribute("data-paused")).toBe(false);
  });

  it("clears the pause flag when it unmounts", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const { unmount } = render(<HoneycombBackground />);
    expect(document.documentElement.hasAttribute("data-paused")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-paused")).toBe(false);
  });
});
