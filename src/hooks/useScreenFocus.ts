import { useEffect, useRef, type RefObject } from "react";

// Screen changes replace the control that had focus, and focus then falls to
// <body>: the next Tab starts again at the top of the page and a screen reader
// hears nothing about the new screen (hardening #19). Each screen calls this
// with its heading or primary control, and focus moves there once, when that
// element first appears — which may be a render or two after mount (the lobby
// shows "Connecting…" before its heading exists), hence no dependency list and
// a per-element "done" marker instead of a mount-only effect.
//
// The very first screen of a page load is left alone — nothing had focus yet,
// and grabbing it on arrival would scroll and announce before the visitor has
// done anything. React StrictMode remounts in development, so "first" is keyed
// on the ELEMENT (StrictMode reuses it), not on a mount count.
let firstScreen: Element | undefined;

export function useScreenFocus(ref: RefObject<HTMLElement | null>): void {
  const done = useRef<Element | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current === el) return;
    done.current = el;
    firstScreen ??= el;
    if (firstScreen === el) return;
    el.focus();
  });
}
