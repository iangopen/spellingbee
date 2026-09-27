// §A1 — a client creating a room may set only the host's genuine choices (0017).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, randomCode } from "./harness.mjs";

describe("0017 rooms insert columns", () => {
  let h;
  beforeAll(async () => (h = await freshDb()));
  afterAll(() => h.close());

  const insertRoom = (uid, extraCol, extraVal) =>
    h.as(
      uid,
      `insert into rooms (id, code, tier, host_id, mode, lives_setting${extraCol ? `, ${extraCol}` : ""})
       values (gen_random_uuid(), $1, 'medium', $2, 'race', 3${extraCol ? ", $3" : ""})`,
      extraCol ? [randomCode(), uid, extraVal] : [randomCode(), uid]
    );

  it("the deployed client's insert still works and gets server defaults", async () => {
    const u = await h.user();
    expect((await insertRoom(u)).error).toBeUndefined();
    const [r] = await h.sql(
      "select status, current_round, round_started_at, winner_id, created_at > now() - interval '1 minute' as fresh from rooms where host_id=$1",
      [u]
    );
    expect(r).toEqual({ status: "lobby", current_round: 0, round_started_at: null, winner_id: null, fresh: true });
  });

  it.each([
    ["status", "active"],
    ["created_at", "9999-01-01"],
    ["round_started_at", "2020-01-01"],
    ["current_round", 5],
    ["current_turn_player_id", "00000000-0000-0000-0000-000000000001"],
    ["winner_id", "00000000-0000-0000-0000-000000000001"],
    ["starting_players", 8],
    ["table_streak", 9],
  ])("a client cannot set %s", async (col, val) => {
    const u = await h.user();
    expect((await insertRoom(u, col, val)).error?.code).toBe("42501");
  });

  it("host_id is still pinned to the caller", async () => {
    const u = await h.user();
    const other = await h.user();
    const r = await h.as(
      u,
      "insert into rooms (id, code, tier, host_id, mode, lives_setting) values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)",
      [randomCode(), other]
    );
    expect(r.error?.code).toBe("42501");
  });

  it.each(["FUCKOFF1", "ABCDE0", "ILLO23", "abc234", "AB"])("code %s outside the alphabet is rejected", async (code) => {
    const u = await h.user();
    const r = await h.as(
      u,
      "insert into rooms (id, code, tier, host_id, mode, lives_setting) values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)",
      [code, u]
    );
    // FUCKOFF1 is 8 chars but contains O and 1; every case must hit the charset CHECK.
    expect(r.error?.code).toBe("23514");
  });

  it("every code the client generator can produce is accepted", async () => {
    const u = await h.user();
    const r = await h.as(
      u,
      "insert into rooms (id, code, tier, host_id, mode, lives_setting) values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)",
      ["ABCDEFGHJKMN", u]
    );
    expect(r.error).toBeUndefined();
    const r2 = await h.as(
      u,
      "insert into rooms (id, code, tier, host_id, mode, lives_setting) values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)",
      ["PQRSTUVWXYZ2", u]
    );
    expect(r2.error).toBeUndefined();
    const r3 = await h.as(
      u,
      "insert into rooms (id, code, tier, host_id, mode, lives_setting) values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)",
      ["3456789A", u]
    );
    expect(r3.error).toBeUndefined();
  });
});
