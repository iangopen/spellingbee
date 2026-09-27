import { useEffect, useState, type RefObject } from "react";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { ensureAnonymousSession } from "../lib/auth";
import { getTurnstileToken, isCaptchaEnabled } from "../lib/captcha";

export interface SupabaseUserState {
  userId: string | null;
  ready: boolean;
  error: string | null;
}

// Signs the visitor in anonymously (once) and tracks their auth user id.
// Keeps the singleplayer path completely independent — nothing here runs unless
// this hook is mounted, which only happens on the multiplayer path.
//
// `captchaSlot` is where a Turnstile widget may render if this build has a site
// key and a NEW sign-in is needed; it must stay mounted until `ready`.
export function useSupabaseUser(captchaSlot?: RefObject<HTMLElement | null>): SupabaseUserState {
  const [state, setState] = useState<SupabaseUserState>({
    userId: null,
    ready: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    // No Supabase config in this build: report it as a normal auth error so the
    // lobby renders a message with a way back, instead of throwing.
    if (!isSupabaseConfigured) {
      setState({
        userId: null,
        ready: true,
        error:
          "Multiplayer isn't configured for this build (missing Supabase env vars). " +
          "Singleplayer still works.",
      });
      return;
    }

    const getCaptchaToken = isCaptchaEnabled
      ? () => {
          const el = captchaSlot?.current;
          if (!el) return Promise.reject(new Error("The bot check couldn't be shown. Reload to try again."));
          return getTurnstileToken(el);
        }
      : undefined;

    ensureAnonymousSession(getCaptchaToken)
      .then(async () => {
        const { data } = await getSupabase().auth.getUser();
        if (active) setState({ userId: data.user?.id ?? null, ready: true, error: null });
      })
      .catch((e: unknown) => {
        if (active) {
          setState({
            userId: null,
            ready: true,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

    // Keep the id fresh across token refreshes / future account upgrades.
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (active) setState((s) => ({ ...s, userId: session?.user?.id ?? s.userId }));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // captchaSlot is a ref: stable identity, read lazily at sign-in time.
  }, [captchaSlot]);

  return state;
}
