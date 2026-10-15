// 0021 avatar parts: room_players.avatar_color (0-7) and avatar_cosmetic (0-13), the
// sync trigger with the legacy `avatar` key, the two-column grant widening, and the
// backstop now covering every game column on INSERT and UPDATE.
//
// Writes are made in the shapes PostgREST uses, so "rejected" means rejected for a
// client calling the API directly:
//   POST  insert into room_players (cols) select cols from json_populate_recordset(null::room_players, $1)
//   PATCH update room_players set (cols) = (select cols from json_populate_record(null::room_players, $1)) where ...
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, migrationSql } from "./harness.mjs";
import { AVATAR_KEYS } from "../../src/lib/avatars.ts";
import { AVATAR_COLORS, AVATAR_COSMETICS, keyFromParts, partsFromKey } from "../../src/lib/avatarParts.ts";

const TOP_COLOR = AVATAR_COLORS.length - 1; // 7
const TOP_COSMETIC = AVATAR_COSMETICS.length - 1; // 13

const GAME_COLUMNS = ["score", "streak", "lives", "turn_order", "is_eliminated", "connected_at"];

/** POST /room_players with a JSON body, as the signed-in `uid`. */
function post(h, uid, body) {
  const cols = Object.keys(body).join(", ");
  return h.as(
    uid,
    `insert into room_players (${cols}) select ${cols} from json_populate_recordset(null::room_players, $1::json)`,
    [JSON.stringify([body])]
  );
}

/** PATCH /room_players?room_id=eq.&player_id=eq. with a JSON body, as `uid`. */
function patch(h, uid, roomId, playerId, body) {
  const cols = Object.keys(body);
  const list = cols.length === 1 ? cols[0] : `(${cols.join(", ")})`;
  const sel = cols.length === 1 ? `(select ${cols[0]} from json_populate_record(null::room_players, $1::json))` : `(select ${cols.join(", ")} from json_populate_record(null::room_players, $1::json))`;
  return h.as(
    uid,
    `update room_players set ${list} = ${sel} where room_id = $2 and player_id = $3 returning player_id`,
    [JSON.stringify(body), roomId, playerId]
  );
}

const row = (h, roomId, playerId) =>
  h.sql("select to_jsonb(rp) as r from room_players rp where room_id = $1 and player_id = $2", [roomId, playerId]).then((r) => r[0]?.r);
// The room's game state outside room_players: changing your bee is never a game event.
const roomState = async (h, roomId) => ({
  room: (await h.sql("select to_jsonb(r) as r from rooms r where id = $1", [roomId]))[0].r,
  rounds: (await h.sql("select to_jsonb(rr) as r from round_results rr where room_id = $1 order by round_num", [roomId])).map((x) => x.r),
});
const without = (r, ...keys) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)));

describe("0021 avatar parts", () => {
  let h;
  beforeAll(async () => (h = await freshDb()));
  afterAll(() => h.close());

  // ------------------------------------------------------------------ schema
  it("adds two smallint NOT NULL DEFAULT 0 columns whose CHECK ranges match src/lib/avatarParts.ts", async () => {
    const cols = await h.sql(`
      select a.attname, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as def
        from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = 'public.room_players'::regclass and a.attname in ('avatar_color', 'avatar_cosmetic') order by 1`);
    expect(cols).toEqual([
      { attname: "avatar_color", type: "smallint", attnotnull: true, def: "0" },
      { attname: "avatar_cosmetic", type: "smallint", attnotnull: true, def: "0" },
    ]);
    const checks = await h.sql(`select conname, pg_get_constraintdef(oid) as def from pg_constraint
                                 where conrelid = 'public.room_players'::regclass and conname like 'room_players_avatar_%_range' order by 1`);
    const bound = (name) => Number(checks.find((c) => c.conname === name).def.match(/<= (\d+)/)[1]);
    expect(checks.every((c) => />= 0/.test(c.def))).toBe(true);
    expect(bound("room_players_avatar_color_range")).toBe(AVATAR_COLORS.length - 1);
    expect(bound("room_players_avatar_cosmetic_range")).toBe(AVATAR_COSMETICS.length - 1);
  });

  // ------------------------------------------------------------------ bad values
  const BAD = [
    ["-1", -1, "23514"],
    ["one past the end", "END", "23514"],
    ["32767 (smallint max)", 32767, "23514"],
    ["null", null, "23502"],
    ["2.5", 2.5, "22P02"],
    ['"blue"', "blue", "22P02"],
    ['"3" as a string of digits is NOT bad', "3", null],
  ];
  // "one past the end" is the list length, so a range that disagrees with avatarParts.ts in
  // either direction fails here or in the boundary test below.
  const resolve = (col, v) => (v === "END" ? (col === "avatar_color" ? AVATAR_COLORS : AVATAR_COSMETICS).length : v);

  for (const col of ["avatar_color", "avatar_cosmetic"]) {
    it.each(BAD)(`insert: ${col} = %s is rejected (%#)`, async (_label, raw, code) => {
      const host = await h.user();
      const { id } = await h.room(host);
      const u = await h.user();
      const r = await post(h, u, { room_id: id, player_id: u, display_name: "x", avatar: "bee", [col]: resolve(col, raw) });
      if (code === null) {
        expect(r.error).toBeUndefined();
        return;
      }
      expect(r.error?.code).toBe(code);
      expect((await h.sql("select count(*)::int as n from room_players where player_id = $1", [u]))[0].n).toBe(0);
    });

    it.each(BAD)(`update: ${col} = %s is rejected and the row is unchanged (%#)`, async (_label, raw, code) => {
      const host = await h.user();
      const { id } = await h.room(host);
      const before = await row(h, id, host);
      const r = await patch(h, host, id, host, { [col]: resolve(col, raw) });
      if (code === null) {
        expect(r.error).toBeUndefined();
        return;
      }
      expect(r.error?.code).toBe(code);
      expect(await row(h, id, host)).toEqual(before);
    });
  }

  it(`the top of each range is accepted (colour ${TOP_COLOR}, cosmetic ${TOP_COSMETIC}), so the ranges are not narrower than the lists`, async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    expect((await post(h, u, { room_id: id, player_id: u, display_name: "x", avatar_color: TOP_COLOR, avatar_cosmetic: TOP_COSMETIC })).error).toBeUndefined();
    expect(await row(h, id, u)).toMatchObject({ avatar_color: TOP_COLOR, avatar_cosmetic: TOP_COSMETIC });
  });

  // ------------------------------------------------------------------ grants
  it("the client may write exactly the intended columns: insert + update gain only the two avatar columns", async () => {
    const cols = await h.sql(`select attname from pg_attribute where attrelid = 'public.room_players'::regclass and attnum > 0 and not attisdropped order by attnum`);
    const can = async (priv) =>
      (await Promise.all(cols.map(async ({ attname }) => ((await h.sql(`select has_column_privilege('authenticated', 'public.room_players', $1, $2) as ok`, [attname, priv]))[0].ok ? attname : null)))).filter(Boolean).sort();
    expect(await can("INSERT")).toEqual(["avatar", "avatar_color", "avatar_cosmetic", "display_name", "player_id", "room_id"]);
    expect(await can("UPDATE")).toEqual(["avatar", "avatar_color", "avatar_cosmetic", "display_name"]);
    for (const priv of ["INSERT", "UPDATE", "SELECT"]) {
      const anon = await h.sql(`select bool_or(has_column_privilege('anon', 'public.room_players', attname, $1)) as any from pg_attribute where attrelid = 'public.room_players'::regclass and attnum > 0 and not attisdropped`, [priv]);
      expect(anon[0].any, `anon ${priv}`).toBe(false);
    }
  });

  it.each(GAME_COLUMNS)("an insert naming %s (alongside the new columns) fails with 42501", async (col) => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    const val = { score: 50, streak: 3, lives: 9, turn_order: 0, is_eliminated: true, connected_at: "2000-01-01T00:00:00Z" }[col];
    const r = await post(h, u, { room_id: id, player_id: u, display_name: "x", avatar_color: 3, avatar_cosmetic: 2, [col]: val });
    expect(r.error?.code).toBe("42501");
  });

  it.each(GAME_COLUMNS)("an update setting %s together with the bee fails with 42501 and changes nothing", async (col) => {
    const host = await h.user();
    const { id } = await h.room(host);
    const before = await row(h, id, host);
    const val = { score: 50, streak: 3, lives: 9, turn_order: 0, is_eliminated: true, connected_at: "2000-01-01T00:00:00Z" }[col];
    const r = await patch(h, host, id, host, { avatar_color: 4, avatar_cosmetic: 1, [col]: val });
    expect(r.error?.code).toBe("42501");
    expect(await row(h, id, host)).toEqual(before);
  });

  it.each(GAME_COLUMNS)(
    "the backstop alone (grants deliberately widened in this test) still refuses a client %s on insert and on update",
    async (col) => {
      const g = await freshDb();
      try {
        await g.sql("grant insert, update on public.room_players to authenticated");
        const host = await g.user();
        const { id } = await g.room(host);
        const val = { score: 50, streak: 3, lives: 9, turn_order: 0, is_eliminated: true, connected_at: "2000-01-01T00:00:00Z" }[col];
        const u = await g.user();
        const ins = await post(g, u, { room_id: id, player_id: u, display_name: "x", avatar_color: 2, [col]: val });
        expect(ins.error?.code, "insert").toBe("42501");
        expect(ins.error?.message).toMatch(/game columns are server-only/);
        const before = await row(g, id, host);
        const upd = await patch(g, host, id, host, { avatar_cosmetic: 4, [col]: val });
        expect(upd.error?.code, "update").toBe("42501");
        expect(upd.error?.message).toMatch(/game columns are server-only/);
        expect(await row(g, id, host)).toEqual(before);
        // and the identity columns can't be moved by an update either
        const other = await g.user();
        const moved = await patch(g, host, id, host, { player_id: other });
        expect(moved.error?.code).toBe("42501");
      } finally {
        await g.close();
      }
    }
  );

  // ------------------------------------------------------------------ nothing else moves
  async function raceMidGame() {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host, { mode: "race" });
    await h.join(guest, id, "Guest", "wasp");
    await h.rpc("start_game_tx", { p_room_id: id, p_caller: host });
    const [{ word }] = await h.sql("select w.word from round_results rr join words w on w.id = rr.word_id where rr.room_id = $1", [id]);
    await h.rpc("submit_answer_tx", { p_room_id: id, p_round_num: 1, p_player: host, p_guess: word });
    return { id, host, guest };
  }
  async function eliminationMidGame() {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host, { mode: "elimination" });
    await h.join(guest, id, "Guest", "clover");
    expect((await h.rpc("start_elimination_game_tx", { p_room_id: id, p_caller: host })).ok).toBe(true);
    const [{ holder }] = await h.sql("select current_turn_player_id as holder from rooms where id = $1", [id]);
    await h.rpc("submit_turn_answer_tx", { p_room_id: id, p_round_num: 1, p_player: holder, p_guess: "zzzz-wrong" });
    return { id, host, guest };
  }
  async function lobby(mode) {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host, { mode });
    await h.join(guest, id, "Guest", "hive");
    return { id, host, guest };
  }

  const SETUPS = [
    ["race lobby", () => lobby("race")],
    ["elimination lobby", () => lobby("elimination")],
    ["race mid-game", raceMidGame],
    ["elimination mid-game", eliminationMidGame],
  ];

  it.each(SETUPS)("%s: changing the bee leaves every other column of the row, and the room's rooms/round_results, identical", async (_name, setup) => {
    const { id, host, guest } = await setup();
    const roomBefore = await roomState(h, id);
    for (const who of [host, guest]) {
      const before = await row(h, id, who);
      // the new client: numbers only
      expect((await patch(h, who, id, who, { avatar_color: 5, avatar_cosmetic: 12 })).error).toBeUndefined();
      const mid = await row(h, id, who);
      expect(without(mid, "avatar", "avatar_color", "avatar_cosmetic")).toEqual(without(before, "avatar", "avatar_color", "avatar_cosmetic"));
      expect(mid).toMatchObject({ avatar_color: 5, avatar_cosmetic: 12, avatar: keyFromParts(5, 12) });
      // the old client: the key only
      expect((await patch(h, who, id, who, { avatar: "drone" })).error).toBeUndefined();
      const after = await row(h, id, who);
      expect(without(after, "avatar", "avatar_color", "avatar_cosmetic")).toEqual(without(before, "avatar", "avatar_color", "avatar_cosmetic"));
      expect(after).toMatchObject({ avatar: "drone", ...{ avatar_color: 4, avatar_cosmetic: 5 } });
    }
    // rooms and round_results for this room are untouched too (spec §6.5)
    expect(await roomState(h, id)).toEqual(roomBefore);
    // the game state is really mid-game where it should be (so "identical" means something)
    const state = await h.sql("select status from rooms where id = $1", [id]);
    expect(state[0].status).toBe(_name.includes("mid-game") ? "active" : "lobby");
  });

  it("the mid-game rows really carry game state that a change of bee leaves alone", async () => {
    const race = await raceMidGame();
    expect((await row(h, race.id, race.host)).score).toBeGreaterThan(0);
    const elim = await eliminationMidGame();
    const rows = await h.sql("select lives, turn_order from room_players where room_id = $1", [elim.id]);
    expect(rows.some((r) => r.lives < 3)).toBe(true);
    expect(rows.every((r) => r.turn_order !== null)).toBe(true);
  });

  it("another player's row can't be touched: update matches nothing, insert as them is refused", async () => {
    const { id, host, guest } = await lobby("race");
    const before = await row(h, id, guest);
    const r = await patch(h, host, id, guest, { avatar_color: 1, avatar_cosmetic: 1 });
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([]); // RLS hides the row from the UPDATE
    expect(await row(h, id, guest)).toEqual(before);
    const r2 = await patch(h, host, id, guest, { avatar: "queen" });
    expect(r2.rows).toEqual([]);
    expect(await row(h, id, guest)).toEqual(before);
    const stranger = await h.user();
    const ins = await post(h, host, { room_id: id, player_id: stranger, display_name: "x", avatar_color: 2 });
    expect(ins.error?.code).toBe("42501"); // the join-as-self policy
  });

  // ------------------------------------------------------------------ old client, end to end
  it("the deployed client's path works unchanged: create, join and update with the key only, read with PLAYER_COLUMNS", async () => {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host); // rooms.ts:119-121 shape (key defaults to bee)
    expect((await post(h, guest, { room_id: id, player_id: guest, display_name: "Guest", avatar: "drone" })).error).toBeUndefined(); // :178-180
    expect(await row(h, id, guest)).toMatchObject({ avatar: "drone", avatar_color: 4, avatar_cosmetic: 5 });
    expect((await patch(h, guest, id, guest, { avatar: "clover" })).error).toBeUndefined(); // :225-230
    expect(await row(h, id, guest)).toMatchObject({ avatar: "clover", avatar_color: 6, avatar_cosmetic: 3 });
    const read = await h.as(
      guest,
      "select room_id,player_id,display_name,score,streak,connected_at,lives,is_eliminated,turn_order,avatar from room_players where room_id = $1 order by display_name",
      [id]
    );
    expect(read.error).toBeUndefined();
    expect(read.rows.map((r) => r.avatar)).toEqual(["clover", "bee"]);
    // an off-list key is still refused by the 0012 CHECK, as before
    expect((await patch(h, guest, id, guest, { avatar: "unicorn" })).error?.code).toBe("23514");
    // a new client changes the bee: the old client reads the nearest old key
    expect((await patch(h, guest, id, guest, { avatar_color: 2, avatar_cosmetic: 4 })).error).toBeUndefined();
    const again = await h.as(host, "select avatar from room_players where player_id = $1", [guest]);
    expect(again.rows[0].avatar).toBe("blossom");
  });

  // ------------------------------------------------------------------ the mapping
  it.each(AVATAR_KEYS)("old key %s: written by the old client, it gets the spec's numbers and keeps its key", async (key) => {
    const host = await h.user();
    const { id } = await h.room(host);
    const u = await h.user();
    expect((await post(h, u, { room_id: id, player_id: u, display_name: "x", avatar: key })).error).toBeUndefined();
    const p = partsFromKey(key);
    expect(await row(h, id, u)).toMatchObject({ avatar: key, avatar_color: p.color, avatar_cosmetic: p.cosmetic });
    // and the numbers written back by a new client return the same key (the round trip)
    await patch(h, u, id, u, { avatar_color: 0, avatar_cosmetic: 0 });
    expect((await patch(h, u, id, u, { avatar_color: p.color, avatar_cosmetic: p.cosmetic })).error).toBeUndefined();
    expect(await row(h, id, u)).toMatchObject({ avatar: key, avatar_color: p.color, avatar_cosmetic: p.cosmetic });
  });

  it("all 112 pairs written by a new client get the same key as src/lib/avatarParts.ts says, on insert and on update", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    const mismatches = [];
    for (let c = 0; c < AVATAR_COLORS.length; c++) {
      for (let k = 0; k < AVATAR_COSMETICS.length; k++) {
        const u = await h.user();
        if ((await post(h, u, { room_id: id, player_id: u, display_name: "x", avatar_color: c, avatar_cosmetic: k })).error) {
          // the 8-player cap: start a fresh room
          throw new Error("unexpected insert error");
        }
        const r = await row(h, id, u);
        if (r.avatar !== keyFromParts(c, k) || r.avatar_color !== c || r.avatar_cosmetic !== k) mismatches.push(["insert", c, k, r.avatar]);
        await h.sql("delete from room_players where player_id = $1", [u]);
        const upd = await patch(h, host, id, host, { avatar_color: c, avatar_cosmetic: k });
        expect(upd.error).toBeUndefined();
        const hr = await row(h, id, host);
        if (hr.avatar !== keyFromParts(c, k)) mismatches.push(["update", c, k, hr.avatar]);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("when a client changes the key AND the numbers at once, the numbers win", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    await patch(h, host, id, host, { avatar: "queen", avatar_color: 4, avatar_cosmetic: 5 });
    expect(await row(h, id, host)).toMatchObject({ avatar: "drone", avatar_color: 4, avatar_cosmetic: 5 });
  });

  // ------------------------------------------------------------------ the trigger itself
  it("the sync trigger is security invoker with an empty search_path, runs no statement, and is not client-executable", async () => {
    const [f] = await h.sql(`select prosecdef, proconfig::text as cfg, prosrc,
                                    has_function_privilege('authenticated', oid, 'execute') as auth,
                                    has_function_privilege('anon', oid, 'execute') as anon
                               from pg_proc where oid = 'public.room_players_avatar_sync()'::regprocedure`);
    expect(f.prosecdef).toBe(false);
    expect(f.cfg).toBe('{"search_path=\\"\\""}');
    expect(f.auth).toBe(false);
    expect(f.anon).toBe(false);
    // the body only assigns NEW fields: no DML, no dynamic SQL, no PERFORM
    const code = f.prosrc.replace(/'[^']*'/g, "''"); // string literals ('INSERT' is tg_op's value) aren't statements
    expect(code).not.toMatch(/\b(insert|update|delete|execute|perform|copy)\b/i);
    const assigned = [...f.prosrc.matchAll(/new\.(\w+)\s*:=/gi)].map((m) => m[1]);
    expect([...new Set(assigned)].sort()).toEqual(["avatar", "avatar_color", "avatar_cosmetic"]);
  });

  it("the sync trigger never loops: one change fires each row trigger once, at depth 1", async () => {
    const g = await freshDb();
    try {
      await g.db.exec(`create table public.trigger_log (depth int, op text);
                   create function public.log_depth() returns trigger language plpgsql as $$
                   begin insert into public.trigger_log values (pg_trigger_depth(), tg_op); return null; end $$;
                   create trigger zz_log after update on public.room_players for each row execute function public.log_depth();
                   grant insert on public.trigger_log to authenticated;`);
      const host = await g.user();
      const { id } = await g.room(host);
      for (const body of [{ avatar_color: 3 }, { avatar: "queen" }, { avatar_color: 6, avatar_cosmetic: 3 }, { avatar: "queen", avatar_cosmetic: 9 }]) {
        await g.sql("delete from public.trigger_log");
        expect((await patch(g, host, id, host, body)).error).toBeUndefined();
        expect(await g.sql("select depth, op from public.trigger_log")).toEqual([{ depth: 1, op: "UPDATE" }]);
      }
    } finally {
      await g.close();
    }
  });

  it("engine writes still pass the widened backstop (scores, lives, turn order change server-side)", async () => {
    const race = await raceMidGame();
    expect((await row(h, race.id, race.host)).score).toBeGreaterThan(0);
    const elim = await eliminationMidGame();
    expect((await h.sql("select count(*)::int as n from room_players where room_id = $1 and lives = 2", [elim.id]))[0].n).toBe(1);
  });
});

describe("0021 backfill of rows that existed before it", () => {
  it("every old key gets the spec's numbers and keeps its key", async () => {
    const h = await freshDb({ upTo: "0020" });
    try {
      const rooms = [];
      for (const [i, key] of AVATAR_KEYS.entries()) {
        if (i % 4 === 0) {
          const host = await h.user();
          rooms.push((await h.room(host)).id);
          await h.sql("update room_players set avatar = $1 where player_id = $2", [key, host]);
          continue;
        }
        const u = await h.user();
        expect((await h.join(u, rooms.at(-1), `P${i}`, key)).error).toBeUndefined();
      }
      const keysBefore = await h.sql("select player_id, avatar from room_players order by player_id");
      await h.db.exec(migrationSql("0021_avatar_parts.sql"));
      const after = await h.sql("select player_id, avatar, avatar_color, avatar_cosmetic from room_players order by player_id");
      expect(after.map((r) => r.avatar)).toEqual(keysBefore.map((r) => r.avatar));
      expect(new Set(after.map((r) => r.avatar))).toEqual(new Set(AVATAR_KEYS));
      for (const r of after) {
        const p = partsFromKey(r.avatar);
        expect([r.avatar, r.avatar_color, r.avatar_cosmetic]).toEqual([r.avatar, p.color, p.cosmetic]);
      }
    } finally {
      await h.close();
    }
  });
});
