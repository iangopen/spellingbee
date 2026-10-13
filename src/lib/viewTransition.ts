// A same-document View Transition around a screen change the player asked for
// (a tap on Play, Back, Change difficulty ...). The browser snapshots the old
// screen, React swaps in the new one, and the two cross-fade (see the
// ::view-transition rules in App.css).
//
// It is decoration on a change that has already happened: the update runs either
// way, and the screen is correct whether or not the animation does. So:
//   - no API (older Safari/Firefox): the update just runs;
//   - reduced motion (the OS setting, or the in-app override): the update just runs,
//     INSTANTLY, and no transition is started at all, so there is nothing to
//     collapse and nothing to wait for;
//   - the update is never deferred past the transition callback, so a double tap
//     cannot leave a screen change queued behind an animation.
//
// Screen changes the GAME causes (a round ending, the server moving a room on) are
// not wrapped: they should not wait for or be dressed in an animation.

import { flushSync } from "react-dom";

type StartViewTransition = (update: () => void) => unknown;

export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  if (document.documentElement.getAttribute("data-reduce-motion") === "true") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function withViewTransition(update: () => void): void {
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition;
  if (typeof start !== "function" || prefersReducedMotion()) {
    update();
    return;
  }
  // flushSync so React has committed the new screen by the time the browser takes
  // the "after" snapshot.
  start.call(document, () => flushSync(update));
}
