import { getAutoSubmit } from "./storage";

/**
 * A touch-first device: the primary pointer is coarse AND cannot hover. A media
 * query, never the user agent. A laptop with a touchscreen still has a fine
 * pointer that hovers, so it stays a desktop here.
 */
export const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(TOUCH_QUERY).matches;
}

/**
 * Whether singleplayer submits a correct word the moment it is typed. Touch
 * devices only; on by default there, and the Settings switch can turn it off.
 * Read on every keystroke, so a change in Settings applies to the next letter.
 */
export function isAutoSubmitOn(): boolean {
  return isTouchDevice() && (getAutoSubmit() ?? true);
}
