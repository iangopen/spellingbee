// Hardening #5 / §C11 — write limits and retention (0019).
//
// NOT covered here (PGlite is one connection): two transactions actually racing
// on the advisory locks. The lock calls are asserted to be present; that they
// serialise real concurrent requests is a live-only check.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, repoRoot } from "./harness.mjs";

const count = async (h, sql, params = []) => (await h.sql(`select count(*)::int as n from ${sql}`, params))[0].n;
const leave = (h, uid, roomId) =>
  h.as(uid, "delete from room_players where room_id = $1 and player_id = $2", [roomId, uid]);

describe("0019 write limits", () => {
  let h;
  beforeAll(async () => (h = await freshDb()));
  afterAll(() => h.close());

  it("player_cap() equals PLAYER_CAP in src/lib/rooms.ts", async () => {
    const src = readFileSync(join(repoRoot, "src", "lib", "rooms.ts"), "utf8");
    const client = Number(src.match(/export const PLAYER_CAP = (\d+);/)?.[1]);
    const [{ cap }] = await h.sql("select public.player_cap() as cap");
    expect(client).toBe(cap);
    expect(cap).toBe(8);
  });

  it("a room takes player_cap() players and refuses the next", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    for (let i = 1; i < 8; i++) expect((await h.join(await h.user(), id)).error).toBeUndefined();
    const r = await h.join(await h.user(), id);
    expect(r.error?.message).toBe("room_full");
    expect(await count(h, "room_players where room_id = $1", [id])).toBe(8);
  });

  it("a host may hold 3 open rooms; the 4th is refused until one closes", async () => {
    const host = await h.user();
    const rooms = [];
    for (let i = 0; i < 3; i++) {
      const r = await h.room(host);
      expect(r.error).toBeUndefined();
      rooms.push(r.id);
    }
    const fourth = await h.room(host);
    expect(fourth.error?.message).toBe("too_many_open_rooms");
    await leave(h, host, rooms[0]);
    expect((await h.room(host)).error).toBeUndefined();
  });

  it("an active room counts as open; a finished one doesn't", async () => {
    const host = await h.user();
    const a = await h.room(host);
    await h.join(await h.user(), a.id);
    expect((await h.rpc("start_game_tx", { p_room_id: a.id, p_caller: host })).ok).toBe(true);
    await h.room(host);
    await h.room(host);
    expect((await h.room(host)).error?.message).toBe("too_many_open_rooms");
    await h.sql("update rooms set status = 'finished' where id = $1", [a.id]);
    expect((await h.room(host)).error).toBeUndefined();
  });

  it("the hourly cap can't be dodged by create-then-leave", async () => {
    const host = await h.user();
    for (let i = 0; i < 20; i++) {
      const r = await h.room(host);
      expect(r.error, `room ${i + 1}`).toBeUndefined();
      await leave(h, host, r.id); // the empty lobby is deleted...
    }
    expect(await count(h, "rooms where host_id = $1", [host])).toBe(0);
    // ...but the creation log still remembers all 20.
    expect((await h.room(host)).error?.message).toBe("room_create_rate_limited");
    // An hour later the window has passed.
    await h.sql("update private.room_creations set created_at = now() - interval '61 minutes' where host_id = $1", [host]);
    expect((await h.room(host)).error).toBeUndefined();
  });

  it("the limits don't apply to the engine / owner", async () => {
    const host = await h.user();
    for (let i = 0; i < 4; i++) {
      await h.sql(
        "insert into rooms (id, code, tier, host_id) values (gen_random_uuid(), $1, 'easy', $2)",
        [`SRV${String.fromCharCode(65 + i)}22`, host]
      );
    }
    expect(await count(h, "rooms where host_id = $1", [host])).toBe(4);
  });

  it("the last member leaving a lobby deletes it; a non-last leave doesn't", async () => {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host);
    await h.join(guest, id);
    await leave(h, host, id);
    expect(await count(h, "rooms where id = $1", [id])).toBe(1);
    await leave(h, guest, id);
    expect(await count(h, "rooms where id = $1", [id])).toBe(0);
  });

  it("joining a lobby that was just emptied fails on the FK, with no orphan row", async () => {
    const host = await h.user();
    const { id } = await h.room(host);
    await leave(h, host, id);
    const r = await h.join(await h.user(), id);
    expect(r.error?.code).toBe("23503");
    expect(await count(h, "room_players where room_id = $1", [id])).toBe(0);
  });

  it("every membership path takes the per-room lock, and room creation the per-host lock", async () => {
    const src = (fn) =>
      h.sql("select prosrc from pg_proc where proname = $1", [fn]).then((r) => r[0].prosrc);
    expect(await src("room_players_enforce_limits")).toMatch(/lock_for\('room', new\.room_id\)/);
    expect(await src("room_players_drop_empty_lobby")).toMatch(/lock_for\('room', old\.room_id\)/);
    expect(await src("rooms_enforce_host_limits")).toMatch(/lock_for\('host', new\.host_id\)/);
    const defs = await h.sql(
      `select proname, prosecdef, proconfig::text as cfg from pg_proc
        where proname in ('room_players_enforce_limits','room_players_drop_empty_lobby','rooms_enforce_host_limits')`
    );
    for (const d of defs) {
      expect(d.prosecdef, d.proname).toBe(true);
      expect(d.cfg, d.proname).toMatch(/search_path=public/);
    }
  });
});

describe("0019 retention", () => {
  let h;
  beforeAll(async () => (h = await freshDb()));
  afterAll(() => h.close());

  async function playedRaceRoom() {
    const host = await h.user();
    const guest = await h.user();
    const { id } = await h.room(host);
    await h.join(guest, id);
    await h.rpc("start_game_tx", { p_room_id: id, p_caller: host });
    const [{ word }] = await h.sql(
      "select w.word from round_results rr join words w on w.id = rr.word_id where rr.room_id = $1",
      [id]
    );
    await h.rpc("submit_answer_tx", { p_room_id: id, p_round_num: 1, p_player: guest, p_guess: "nope" });
    await h.rpc("submit_answer_tx", { p_room_id: id, p_round_num: 1, p_player: host, p_guess: word });
    return { id, host, guest };
  }

  it("guesses are deleted once a game finishes, and only then", async () => {
    const live = await playedRaceRoom();
    const done = await playedRaceRoom();
    await h.sql("update rooms set status = 'finished' where id = $1", [done.id]);
    expect(await count(h, "round_attempts where room_id = $1", [done.id])).toBe(2);
    await h.sql("select public.purge_finished_round_attempts()");
    expect(await count(h, "round_attempts where room_id = $1", [done.id])).toBe(0);
    expect(await count(h, "round_attempts where room_id = $1", [live.id])).toBe(2);
    // The scoreboard survives.
    expect(await count(h, "round_results where room_id = $1 and winner_id is not null", [done.id])).toBe(1);
  });

  it("rooms past retention are deleted with every child row; recent ones stay", async () => {
    const old = await playedRaceRoom();
    const recent = await playedRaceRoom();
    await h.sql("update rooms set created_at = now() - interval '31 days' where id = $1", [old.id]);
    await h.sql("select public.purge_stale_rooms()");
    for (const t of ["rooms where id", "room_players where room_id", "round_results where room_id", "round_attempts where room_id"]) {
      expect(await count(h, `${t} = $1`, [old.id]), t).toBe(0);
    }
    expect(await count(h, "rooms where id = $1", [recent.id])).toBe(1);
    // No child row anywhere points at a missing room.
    for (const t of ["room_players", "round_results", "round_attempts"]) {
      expect(await count(h, `${t} c where not exists (select 1 from rooms r where r.id = c.room_id)`), t).toBe(0);
    }
  });

  it("stale and member-less lobbies are cleared, a fresh lobby is kept", async () => {
    const a = await h.user();
    const stale = await h.room(a);
    await h.sql("update rooms set created_at = now() - interval '25 hours' where id = $1", [stale.id]);
    // Member-less: the room insert succeeded but the creator's join didn't.
    const b = await h.user();
    const orphanId = (await h.sql("select gen_random_uuid() as id"))[0].id;
    await h.as(b, "insert into rooms (id, code, tier, host_id, mode, lives_setting) values ($1,'ORPHN2','easy',$2,'race',3)", [orphanId, b]);
    await h.sql("update rooms set created_at = now() - interval '11 minutes' where id = $1", [orphanId]);
    const fresh = await h.room(await h.user());
    await h.sql("select public.purge_stale_rooms()");
    expect(await count(h, "rooms where id = $1", [stale.id])).toBe(0);
    expect(await count(h, "rooms where id = $1", [orphanId])).toBe(0);
    expect(await count(h, "rooms where id = $1", [fresh.id])).toBe(1);
  });

  it("purges only old anonymous users with no game data left", async () => {
    const OLD = "now() - interval '31 days'";
    const idle = await h.user({ createdAt: (await h.sql(`select ${OLD} as t`))[0].t });
    const young = await h.user();
    const permanent = await h.user({ anonymous: false, createdAt: (await h.sql(`select ${OLD} as t`))[0].t });
    const game = await playedRaceRoom(); // host won round 1 → referenced by round_results.winner_id (NO ACTION)
    await h.sql(`update auth.users set created_at = ${OLD} where id = any($1)`, [[game.host, game.guest]]);

    expect((await h.sql("select public.purge_anonymous_users() as n"))[0].n).toBe(1);
    const alive = async (id) => (await count(h, "auth.users where id = $1", [id])) === 1;
    expect(await alive(idle)).toBe(false);
    expect(await alive(young)).toBe(true);
    expect(await alive(permanent)).toBe(true);
    expect(await alive(game.host)).toBe(true);
    expect(await alive(game.guest)).toBe(true);

    // Once their room ages out, both become eligible and go cleanly.
    await h.sql("update rooms set created_at = now() - interval '31 days' where id = $1", [game.id]);
    await h.sql("select public.purge_stale_rooms()");
    await h.sql("select public.purge_anonymous_users()");
    expect(await alive(game.host)).toBe(false);
    expect(await alive(game.guest)).toBe(false);
  });

  it("cron history older than 7 days is purged", async () => {
    await h.sql(
      "insert into cron.job_run_details (jobid, status, end_time) values (1,'succeeded', now() - interval '8 days'), (1,'succeeded', now())"
    );
    await h.sql("select public.purge_cron_history()");
    expect(await count(h, "cron.job_run_details")).toBe(1);
  });

  it("all four jobs are scheduled", async () => {
    const jobs = (await h.sql("select jobname from cron.job order by jobname")).map((r) => r.jobname);
    expect(jobs).toEqual(
      expect.arrayContaining([
        "purge-anonymous-users",
        "purge-cron-history",
        "purge-finished-round-attempts",
        "purge-stale-rooms",
        "sweep-expired-rounds",
        "sweep-expired-turns",
      ])
    );
  });

  it("no client role can call the purge or limit functions, or see the creation log", async () => {
    const u = await h.user();
    for (const who of [null, u]) {
      for (const fn of [
        "purge_finished_round_attempts()",
        "purge_stale_rooms()",
        "purge_anonymous_users()",
        "purge_cron_history()",
        "lock_for('room', gen_random_uuid())",
      ]) {
        expect((await h.as(who, `select public.${fn}`)).error?.code, fn).toBe("42501");
      }
      expect((await h.as(who, "select * from private.room_creations")).error?.code).toBe("42501");
    }
  });
});
