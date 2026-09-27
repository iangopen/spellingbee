// Hardening #15 / #16 — grants match the comments (0020), and a sweep of the
// whole public schema proves no role can do more than intended.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./harness.mjs";

describe("0020 grant cleanup", () => {
  let h;
  beforeAll(async () => (h = await freshDb()));
  afterAll(() => h.close());

  it("anon and a signed-in guest can't read round_attempts (42501, not 200/0 rows)", async () => {
    const u = await h.user();
    for (const who of [null, u]) {
      expect((await h.as(who, "select * from round_attempts")).error?.code).toBe("42501");
    }
  });

  it("anon can execute NO function in public", async () => {
    const rows = await h.sql(
      `select p.oid::regprocedure::text as fn
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and has_function_privilege('anon', p.oid, 'execute')`
    );
    expect(rows.map((r) => r.fn)).toEqual([]);
  });

  it("anon has no privilege on any table in public", async () => {
    const rows = await h.sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
            or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))`
    );
    expect(rows).toEqual([]);
  });

  it("a signed-in client can execute exactly the intended functions", async () => {
    const rows = await h.sql(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
        order by 1`
    );
    expect(rows.map((r) => r.proname)).toEqual([
      "abuse_limits",
      "avatar_keys",
      "decay_params",
      "decayed_round_seconds",
      "feedback_ms",
      "get_room_by_code",
      "is_room_member",
      "late_grace_ms",
      "player_cap",
      "room_accepts_new_players",
      "round_seconds",
      "rounds_per_game",
      "server_now",
    ]);
  });

  it("the multiplayer client's RPCs still work for a signed-in guest", async () => {
    const u = await h.user();
    const r = await h.as(
      u,
      "select round_seconds('easy') as a, rounds_per_game() as b, feedback_ms() as c, late_grace_ms() as d, server_now() is not null as e, avatar_keys() as f"
    );
    expect(r.error).toBeUndefined();
    expect(r.rows[0]).toMatchObject({ a: 20, b: 10, c: 1100, d: 750, e: true });
  });

  it("anon calling a constant now gets 42501 (P-anon-15…20)", async () => {
    for (const fn of ["round_seconds('easy')", "rounds_per_game()", "late_grace_ms()", "feedback_ms()", "avatar_keys()", "decay_params()"]) {
      expect((await h.as(null, `select ${fn}`)).error?.code, fn).toBe("42501");
    }
  });

  it("the engine still writes round_attempts through service_role", async () => {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host);
    await h.join(guest, id);
    await h.rpc("start_game_tx", { p_room_id: id, p_caller: host });
    const res = await h.rpc("submit_answer_tx", { p_room_id: id, p_round_num: 1, p_player: guest, p_guess: "zzz" });
    expect(res).toMatchObject({ ok: true, correct: false });
  });
});
