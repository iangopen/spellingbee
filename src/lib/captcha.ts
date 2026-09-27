// Cloudflare Turnstile for anonymous sign-in (hardening #5).
//
// Anonymous sign-in is the front door to every write in this app, so a CAPTCHA
// there is the one bot check that covers everything behind it. The ENFORCEMENT
// is Supabase Auth's (Dashboard → Authentication → Bot and Abuse Protection):
// with CAPTCHA on, /auth/v1/signup rejects a request without a valid token no
// matter what this file does. This file only obtains the token.
//
// Off unless VITE_TURNSTILE_SITE_KEY is set at build time, so a build without
// it behaves exactly as before — which is what lets the client ship BEFORE
// CAPTCHA is switched on in the dashboard (the other order locks out every new
// visitor on the old client).
//
// The script is third-party code, loaded lazily and only on the multiplayer
// path when a sign-in is actually needed; singleplayer never loads it, and a
// returning visitor with a stored session never sees a challenge.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 120_000;

export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined;
export const isCaptchaEnabled = Boolean(TURNSTILE_SITE_KEY);

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      theme: "auto";
      appearance: "interaction-only";
    }
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to initialise."));
    s.onerror = () => {
      scriptPromise = null; // allow a retry on the next sign-in attempt
      reject(new Error("Couldn't load the bot check. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Render a Turnstile widget into `container` and resolve with its token. With
 * `appearance: "interaction-only"` most visitors see nothing at all; the widget
 * only becomes visible if Cloudflare wants an interaction.
 */
export async function getTurnstileToken(container: HTMLElement): Promise<string> {
  if (!TURNSTILE_SITE_KEY) throw new Error("Turnstile is not configured for this build.");
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null;
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      if (widgetId) turnstile.remove(widgetId);
      fn();
    };
    const timer = window.setTimeout(
      () => done(() => reject(new Error("The bot check timed out. Reload to try again."))),
      TOKEN_TIMEOUT_MS
    );
    widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => done(() => resolve(token)),
      "error-callback": () => done(() => reject(new Error("The bot check failed. Reload to try again."))),
      "expired-callback": () => done(() => reject(new Error("The bot check expired. Reload to try again."))),
      theme: "auto",
      appearance: "interaction-only",
    });
  });
}
