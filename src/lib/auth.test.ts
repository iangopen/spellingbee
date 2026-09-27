import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for supabase-js's auth client. Each test scripts what the Auth
// server says; the assertions are about what ensureAnonymousSession does next.
const auth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInAnonymously: vi.fn(),
};
vi.mock("./supabaseClient", () => ({ getSupabase: () => ({ auth }) }));

const { ensureAnonymousSession } = await import("./auth");

const session = { access_token: "t", user: { id: "old-user" } };
const purged = new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found");

beforeEach(() => {
  vi.clearAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInAnonymously.mockResolvedValue({ data: { session: { user: { id: "new-user" } } }, error: null });
});

describe("ensureAnonymousSession", () => {
  it("signs in a first-time visitor", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await ensureAnonymousSession();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("keeps a live stored session without signing in again", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: session.user }, error: null });
    await ensureAnonymousSession();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("replaces a session whose anonymous user was purged, silently and once", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: purged });
    await expect(ensureAnonymousSession()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    // signOut happens before the new sign-in, so the dead session can't be reused.
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signInAnonymously.mock.invocationCallOrder[0]
    );
  });

  it("treats a missing session and a failed refresh (session already cleared) the same way", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await ensureAnonymousSession();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    auth.signInAnonymously.mockResolvedValue({ data: {}, error: null });
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    });
    await ensureAnonymousSession();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("does NOT throw away a session because the network is down", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) });
    await ensureAnonymousSession();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("reports a failed replacement once, without looping, and allows a later retry", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: purged });
    const rateLimited = new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit");
    auth.signInAnonymously.mockResolvedValueOnce({ data: {}, error: rateLimited });
    await expect(ensureAnonymousSession()).rejects.toBe(rateLimited);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);

    // The next mount tries again from scratch (and here succeeds).
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await ensureAnonymousSession();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one sign-in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await Promise.all([ensureAnonymousSession(), ensureAnonymousSession(), ensureAnonymousSession()]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
