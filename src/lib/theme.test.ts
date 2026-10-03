import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, resolveTheme, setStoredTheme } from "./theme";

// vitest runs in node here, so give theme.ts the two browser globals it touches.
function stubBrowser(osPrefersLight: boolean, stored?: string) {
  const store = new Map<string, string>();
  if (stored !== undefined) store.set("spellingbee:theme", stored);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  // If theme.ts ever asks the OS again, this is the answer it would get.
  vi.stubGlobal("window", { matchMedia: () => ({ matches: osPrefersLight }) });
  return store;
}

describe("resolveTheme", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("is dark when nothing is stored", () => {
    stubBrowser(false);
    expect(resolveTheme()).toBe("dark");
  });

  it("ignores an OS that prefers light", () => {
    stubBrowser(true);
    expect(resolveTheme()).toBe("dark");
  });

  it("keeps an explicit light choice, whatever the OS says", () => {
    stubBrowser(false, "light");
    expect(resolveTheme()).toBe("light");
    stubBrowser(true, "light");
    expect(resolveTheme()).toBe("light");
  });

  it("keeps an explicit dark choice", () => {
    stubBrowser(true, "dark");
    expect(resolveTheme()).toBe("dark");
  });

  it("treats an unrecognised stored value as no choice", () => {
    stubBrowser(true, "sepia");
    expect(resolveTheme()).toBe("dark");
  });

  it("writes only on an explicit pick, and null clears it", () => {
    const store = stubBrowser(true);
    expect(store.size).toBe(0);
    setStoredTheme("light");
    expect(store.get("spellingbee:theme")).toBe("light");
    setStoredTheme(null);
    expect(store.has("spellingbee:theme")).toBe(false);
  });
});

describe("applyTheme", () => {
  it("sets data-theme on <html>", () => {
    const attrs: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } });
    applyTheme("light");
    expect(attrs["data-theme"]).toBe("light");
    vi.unstubAllGlobals();
  });
});
