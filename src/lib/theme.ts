// Theme resolution and persistence. Purely presentational — no game state.
//
// The stored preference is "light" | "dark" | null. Since the redesign (stage 1,
// Ian 2026-09-28) null means DARK, not "follow the OS": dark is the identity of
// the new look and the operating system's setting is no longer consulted. Only
// an explicit pick by the player is written, so the key and its two values are
// unchanged and someone who chose light before the redesign keeps light.

export type Theme = "light" | "dark";

// Same "spellingbee:" convention as the best scores and voice prefs.
const THEME_KEY = "spellingbee:theme";

export const DEFAULT_THEME: Theme = "dark";

export function getStoredTheme(): Theme | null {
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

export function setStoredTheme(theme: Theme | null): void {
  if (theme) localStorage.setItem(THEME_KEY, theme);
  else localStorage.removeItem(THEME_KEY);
}

/** What the app should actually render: an explicit pick wins, else dark. */
export function resolveTheme(): Theme {
  return getStoredTheme() ?? DEFAULT_THEME;
}

// The stylesheet keys off data-theme on <html>. index.css puts the dark palette
// on :root itself, so the first paint is already dark in the instant before this
// runs; only a stored "light" needs the attribute.
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}
