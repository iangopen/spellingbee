// Hardening #17 — edge functions log internal errors and return only a code.
//
// Runs the real _shared/mod.ts under Node with a stub `Deno` global and a
// stubbed fetch (for the Auth lookup). No Deno runtime is needed.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let handler;
const SECRET_DETAIL = 'rpc submit_answer_tx failed: HTTP 500 {"code":"23502","message":"null value in column \\"response_time_ms\\" of relation \\"round_attempts\\""}';

beforeAll(async () => {
  globalThis.Deno = { env: { get: () => "stub" } };
  ({ handler } = await import("../functions/_shared/mod.ts"));
});
afterAll(() => {
  delete globalThis.Deno;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: "user-1" }), { status: 200 }))
  );
});

const post = (body = {}) =>
  new Request("https://x.supabase.co/functions/v1/submit-answer", {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("edge function error shaping", () => {
  it("a thrown error becomes a bare internal_error, with the detail only in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handler(async () => {
      throw new Error(SECRET_DETAIL);
    })(post());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "internal_error" });
    expect(JSON.stringify(body)).not.toMatch(/round_attempts|23502|rpc/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("round_attempts");
    log.mockRestore();
  });

  it("an unreachable Auth server is also a bare 500, not an unhandled exception", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("connection refused to 10.0.0.5"); }));
    const res = await handler(async () => new Response("unreachable"))(post());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal_error" });
    log.mockRestore();
  });

  it("named game errors still reach the client unchanged", async () => {
    const { respond } = await import("../functions/_shared/mod.ts");
    const res = await handler(async () => respond({ ok: false, error: "not_host" }))(post());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "not_host" });
  });

  it("an invalid token is still a 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const res = await handler(async () => new Response("never"))(post());
    expect(res.status).toBe(401);
  });
});

describe("CORS preflight", () => {
  const options = () =>
    new Request("https://x.supabase.co/functions/v1/submit-answer", {
      method: "OPTIONS",
      headers: { Origin: "https://iangopen.github.io", "Access-Control-Request-Method": "POST" },
    });

  it("answers OPTIONS without auth, carrying a 2 h Access-Control-Max-Age", async () => {
    const fn = vi.fn(async () => new Response("never"));
    const res = await handler(fn)(options());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Max-Age")).toBe("7200");
    expect(fn).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leaves the allowed origin, headers and methods exactly as they were", async () => {
    const res = await handler(async () => new Response("never"))(options());
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type"
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("the shared header set is exactly these four, so no function gains or loses one", async () => {
    const { corsHeaders } = await import("../functions/_shared/mod.ts");
    expect(Object.keys(corsHeaders).sort()).toEqual([
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Origin",
      "Access-Control-Max-Age",
    ]);
  });
});
