// Hardening #1 — scores are server-only; nobody joins a started game (0016).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./harness.mjs";

const FAKE_ROOM = "00000000-0000-0000-0000-00000000dead";

const fnAcl = (h, sig) =>
  h.sql(`select proacl::text as acl from pg_proc where oid = $1::regprocedure`, [sig]).then((r) => r[0].acl);

describe("baseline at 0015 (proves the harness can see the hole)", () => {
  let h;
  beforeAll(async () => (h = await freshDb({ upTo: "0015" })));
  afterAll(() => h.close());

  it("P-auth-8 shape: a self-insert carrying score 9999 passes RLS and dies only on the fake FK", async () => {
    const u = await h.user();
    const r = await h.as(
      u,
      "insert into room_players (room_id, player_id, display_name, score) values ($1,$2,'x',9999)",
      [FAKE_ROOM, u]
    );
    expect(r.error?.code).toBe("23503");
  });
});

describe("0016 score integrity", () => {
  let h, h15;
  beforeAll(async () => {
    h = await freshDb();
    h15 = await freshDb({ upTo: "0015" });
  });
  afterAll(async () => {
    await h.close();
    await h15.close();
  });

  it("P-auth-8 shape is now refused by privilege (42501), before RLS or the FK", async () => {
    const u = await h.user();
    const r = await h.as(
      u,
      "insert into room_players (room_id, player_id, display_name, score) values ($1,$2,'x',9999)",
      [FAKE_ROOM, u]
    );
    expect(r.error?.code).toBe("42501");
  });

  it("a client-set score on join to a REAL lobby is rejected", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    const r = await h.as(
      u,
      "insert into room_players (room_id, player_id, display_name, score) values ($1,$2,'x',50)",
      [id, u]
    );
    expect(r.error?.code).toBe("42501");
    const rows = await h.sql("select count(*)::int as n from room_players where player_id = $1", [u]);
    expect(rows[0].n).toBe(0);
  });

  it.each(["streak", "lives", "turn_order", "is_eliminated", "connected_at"])(
    "a client cannot set %s on join",
    async (col) => {
      const host = await h.user();
      const { id } = await h.room(host);
      const u = await h.user();
      const val = { streak: 3, lives: 9, turn_order: 0, is_eliminated: true, connected_at: "2000-01-01" }[col];
      const r = await h.as(
        u,
        `insert into room_players (room_id, player_id, display_name, ${col}) values ($1,$2,'x',$3)`,
        [id, u, val]
      );
      expect(r.error?.code).toBe("42501");
    }
  );

  it("the deployed client's join (room_id, player_id, display_name, avatar) still works", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    const r = await h.join(u, id, "Alex", "queen");
    expect(r.error).toBeUndefined();
    const [row] = await h.sql("select score, streak, lives, turn_order from room_players where player_id=$1", [u]);
    expect(row).toEqual({ score: 0, streak: 0, lives: 3, turn_order: null });
  });

  it("score cannot be changed by a client UPDATE; display_name and avatar still can", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    expect((await h.as(host, "update room_players set score = 999 where room_id=$1", [id])).error?.code).toBe("42501");
    expect((await h.as(host, "update room_players set streak = 9 where room_id=$1", [id])).error?.code).toBe("42501");
    expect((await h.as(host, "update room_players set display_name='Renamed', avatar='wasp' where room_id=$1", [id])).error).toBeUndefined();
  });

  it("the backstop trigger rejects a nonzero client score even if the grant were widened", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    await h.sql("grant insert (score) on room_players to authenticated");
    try {
      const r = await h.as(
        u,
        "insert into room_players (room_id, player_id, display_name, avatar, score) values ($1,$2,'x','bee',7)",
        [id, u]
      );
      expect(r.error?.code).toBe("42501");
      expect(r.error?.message).toMatch(/server-only/);
    } finally {
      await h.sql("revoke insert (score) on room_players from authenticated");
    }
  });

  it("race start_game_tx resets every player's score and streak", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    await h.join(u, id);
    // Legacy rows forged before 0016 — only the owner can write these now.
    await h.sql("update room_players set score = 9999, streak = 7 where room_id = $1", [id]);
    const res = await h.rpc("start_game_tx", { p_room_id: id, p_caller: host });
    expect(res.ok).toBe(true);
    const rows = await h.sql("select score, streak from room_players where room_id=$1", [id]);
    expect(rows).toEqual([{ score: 0, streak: 0 }, { score: 0, streak: 0 }]);
  });

  it.each(["race", "elimination"])("joining a started %s room is refused", async (mode) => {
    const host = await h.user();
    const { id } = await h.room(host, { mode });
    await h.join(await h.user(), id);
    const fn = mode === "race" ? "start_game_tx" : "start_elimination_game_tx";
    expect((await h.rpc(fn, { p_room_id: id, p_caller: host })).ok).toBe(true);
    const late = await h.user();
    const r = await h.join(late, id);
    expect(r.error?.code).toBe("42501");
    expect(r.error?.message).toMatch(/row-level security/);
  });

  it("a nonexistent room still fails on the foreign key, not on RLS", async () => {
    const u = await h.user();
    expect((await h.join(u, FAKE_ROOM)).error?.code).toBe("23503");
  });

  it("grants on the replaced functions are exactly what 0015 left", async () => {
    for (const sig of ["public.start_game_tx(uuid,uuid)", "public.room_accepts_new_players(uuid)"]) {
      expect(await fnAcl(h, sig)).toBe(await fnAcl(h15, sig));
    }
    const priv = (role, sig) =>
      h.sql("select has_function_privilege($1, $2, 'execute') as ok", [role, sig]).then((r) => r[0].ok);
    expect(await priv("service_role", "public.start_game_tx(uuid,uuid)")).toBe(true);
    expect(await priv("authenticated", "public.start_game_tx(uuid,uuid)")).toBe(false);
    expect(await priv("anon", "public.start_game_tx(uuid,uuid)")).toBe(false);
    expect(await priv("authenticated", "public.room_accepts_new_players(uuid)")).toBe(true);
    expect(await priv("anon", "public.room_accepts_new_players(uuid)")).toBe(false);
    expect(await priv("authenticated", "public.room_players_client_defaults()")).toBe(false);
  });
});
