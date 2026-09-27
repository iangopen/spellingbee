import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

// Ensures the visitor has a LIVE anonymous session, signing in at most once per
// call. Concurrent callers (React StrictMode's double-invoke, two components
// mounting together) share one in-flight attempt instead of creating two users.
//
// "Live" matters since migration 0019: anonymous users with no game data are
// purged after 30 days, but supabase-js still has their session in
// localStorage. Its access token is a validly signed JWT for a user that no
// longer exists, so every write would fail on a foreign key and the lobby would
// be stuck. So a stored session is checked against the Auth server once, and a
// session the server says is dead is dropped and replaced with a new guest —
// silently, and exactly once: a failed replacement is reported, never retried
// in a loop.
let inFlight: Promise<void> | null = null;

/**
 * @param getCaptchaToken Supplies a Turnstile token for a NEW sign-in. Called
 *   only when one is actually needed, so a returning visitor with a live
 *   session never sees a challenge. Omitted when CAPTCHA isn't configured.
 */
export function ensureAnonymousSession(getCaptchaToken?: () => Promise<string>): Promise<void> {
  inFlight ??= establish(getCaptchaToken).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function establish(getCaptchaToken?: () => Promise<string>): Promise<void> {
  const auth = getSupabase().auth;

  // A refresh that fails for a deleted user already clears the stored session
  // here, so this path also covers a token that expired while the user was gone.
  const { data } = await auth.getSession();
  if (data.session) {
    const { error } = await auth.getUser();
    if (!error) return;
    // Offline, a 5xx or a timeout says nothing about the session — keep it and
    // let the next real request report the problem. Only an answer from the
    // Auth server that this user/session doesn't exist replaces it.
    if (!isDeadSession(error)) return;
    await auth.signOut({ scope: "local" });
  }

  const captchaToken = getCaptchaToken ? await getCaptchaToken() : undefined;
  const { error } = await auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined
  );
  if (error) throw error;
}

/** True only for Auth-server answers meaning "this session can never work again". */
export function isDeadSession(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthApiError(error)) return false;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    ["user_not_found", "session_not_found", "bad_jwt", "refresh_token_not_found"].includes(
      error.code ?? ""
    )
  );
}
