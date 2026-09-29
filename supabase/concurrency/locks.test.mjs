// Real-concurrency tests for the 0019 advisory locks.
//
// supabase/tests/ runs the migrations under PGlite, which is ONE connection, so
// it can assert that the lock calls exist but never that they serialise two
// transactions that actually overlap. This file closes that gap: it starts a
// real Postgres 17 (embedded-postgres), applies the same migrations with the
// same bootstrap as the PGlite harness, and races separate connections.
//
// Every race has a NEGATIVE CONTROL: the same race with public.lock_for()
// replaced by a no-op must break the invariant. That proves each test can see
// the race it claims to guard, rather than passing because the timing never
// overlapped.
//
// Run (after `npm ci` at the repo root, which provides the PGlite harness deps):
//   npm --prefix supabase/concurrency ci
//   npm --prefix supabase/concurrency test

import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { BOOTSTRAP, migrationFiles, migrationSql, randomCode } from "../tests/harness.mjs";

const PORT = 55000 + Math.floor(Math.random() * 5000);
const PASSWORD = "local-test-only";
const dataDir = mkdtempSync(join(tmpdir(), "spellingbee-locks-"));
const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: PASSWORD,
  port: PORT,
  persistent: false,
  // Supabase is UTF8; the Windows default is not, and 0018's name filter needs normalize().
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-c", "max_connections=100"],
  onLog: () => {},
});

const NO_OP_LOCK = `
create or replace function public.lock_for(p_kind text, p_id uuid)
returns void language sql volatile as $$ select $$`;

let dbSeq = 0;
const open = [];

async function connect(database) {
  const c = new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: PASSWORD, database });
  // A connection the server drops at shutdown emits 'error'; unhandled, that
  // crashes the run after every test has already passed.
  c.on("error", () => {});
  await c.connect();
  open.push(c);
  return c;
}

/** A fresh database cloned from the migrated template; optionally with the locks disabled. */
async function freshDb({ withoutLocks = false } = {}) {
  const name = `t${++dbSeq}`;
  const admin = await connect("postgres");
  await admin.query(`create database ${name} template spellingbee_tmpl`);
  const owner = await connect(name);
  if (withoutLocks) await owner.query(NO_OP_LOCK);
  return { name, owner };
}

/** A connection acting as a signed-in guest, exactly as PostgREST would. */
async function asUser(db, uid) {
  const c = await connect(db.name);
  await c.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await c.query("set role authenticated");
  const [{ pid }] = (await c.query("select pg_backend_pid() as pid")).rows;
  c.pid = pid;
  return c;
}

async function newUser(db) {
  return (await db.owner.query("insert into auth.users (id) values (gen_random_uuid()) returning id")).rows[0].id;
}

/** A lobby hosted by `host`, host already seated (set up as the owner). */
async function lobby(db, host) {
  const { rows } = await db.owner.query(
    `insert into public.rooms (id, code, tier, host_id, mode, lives_setting)
     values (gen_random_uuid(), $1, 'medium', $2, 'race', 3) returning id`,
    [randomCode(), host]
  );
  await db.owner.query(
    "insert into public.room_players (room_id, player_id, display_name) values ($1, $2, 'Host')",
    [rows[0].id, host]
  );
  return rows[0].id;
}

/** Resolve once backend `pid` is waiting on a lock (advisory or row). */
async function blockedOnLock(db, pid) {
  for (let i = 0; i < 200; i++) {
    const { rows } = await db.owner.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [pid]
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`backend ${pid} never blocked on a lock`);
}

/** Run `sql` in its own transaction, holding it open for `holdMs` before COMMIT. */
async function txn(c, sql, params, holdMs) {
  await c.query("begin");
  try {
    await c.query(sql, params);
    await c.query(`select pg_sleep(${holdMs / 1000})`);
    await c.query("commit");
    return { ok: true };
  } catch (e) {
    await c.query("rollback");
    return { ok: false, code: e.code, message: e.message };
  }
}

const JOIN = "insert into public.room_players (room_id, player_id, display_name) values ($1, $2, 'Racer')";
const LEAVE = "delete from public.room_players where room_id = $1 and player_id = $2";

before(async () => {
  await server.initialise();
  await server.start();
  const admin = await connect("postgres");
  await admin.query("create database spellingbee_tmpl");
  const tmpl = await connect("spellingbee_tmpl");
  // Roles are cluster-wide, so they are created once here along with the rest of the bootstrap.
  await tmpl.query(BOOTSTRAP);
  for (const f of migrationFiles()) {
    try {
      await tmpl.query(migrationSql(f));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${e.message}`);
    }
  }
  await tmpl.end();
  open.splice(open.indexOf(tmpl), 1);
});

// Each case opens up to 31 connections; close them so the next case starts clean.
afterEach(async () => {
  await Promise.allSettled(open.splice(0).map((c) => c.end()));
});

after(async () => {
  await server.stop();
  // Windows can hold a just-stopped server's files for a moment; retry instead
  // of failing a run whose tests all passed.
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("0019 locks under real concurrency (Postgres 17, separate connections)", () => {
  it("runs a real server, not PGlite", async () => {
    const db = await freshDb();
    const { rows } = await db.owner.query("select current_setting('server_version_num')::int as v");
    assert.ok(rows[0].v >= 170000 && rows[0].v < 180000, `server_version_num ${rows[0].v}`);
  });

  for (const withoutLocks of [false, true]) {
    const title = (guarded, control) => (withoutLocks ? `CONTROL, lock_for() stubbed out: ${control}` : guarded);

    it(title("20 simultaneous joins into a 1-player room seat exactly player_cap()", "the same joins overrun the cap"), async (t) => {
      const db = await freshDb({ withoutLocks });
      const [{ cap }] = (await db.owner.query("select public.player_cap() as cap")).rows;
      const room = await lobby(db, await newUser(db));
      const joiners = [];
      for (let i = 0; i < 20; i++) {
        const uid = await newUser(db);
        joiners.push({ uid, c: await asUser(db, uid) });
      }
      const results = await Promise.all(joiners.map(({ uid, c }) => txn(c, JOIN, [room, uid], 100)));
      const { rows } = await db.owner.query(
        "select count(*)::int as n from public.room_players where room_id = $1",
        [room]
      );
      t.diagnostic(`seated ${rows[0].n} (cap ${cap})`);
      if (withoutLocks) {
        assert.ok(rows[0].n > cap, `control expected the cap to be overrun, got ${rows[0].n}`);
      } else {
        assert.equal(rows[0].n, cap);
        assert.equal(results.filter((r) => r.ok).length, cap - 1);
        const refused = results.filter((r) => !r.ok);
        assert.ok(refused.every((r) => r.message === "room_full"), JSON.stringify(refused[0]));
      }
    });

    it(title("a join that commits while the last player is leaving is never silently deleted", "the empty-lobby cleanup deletes a committed join"), async (t) => {
      const db = await freshDb({ withoutLocks });
      const host = await newUser(db);
      const room = await lobby(db, host);
      const joinerId = await newUser(db);
      const joiner = await asUser(db, joinerId);
      const leaver = await asUser(db, host);

      // The join is in flight (inserted, not committed) when the last member leaves.
      await joiner.query("begin");
      await joiner.query(JOIN, [room, joinerId]);
      await leaver.query("begin");
      const leaving = leaver.query(LEAVE, [room, host]);
      await blockedOnLock(db, leaver.pid);
      await joiner.query("commit"); // the joiner is told it succeeded
      await leaving;
      await leaver.query("commit");

      const { rows } = await db.owner.query(
        `select (select count(*)::int from public.rooms where id = $1) as rooms,
                (select count(*)::int from public.room_players where room_id = $1 and player_id = $2) as joined`,
        [room, joinerId]
      );
      t.diagnostic(`room rows ${rows[0].rooms}, joiner rows ${rows[0].joined}`);
      if (withoutLocks) {
        assert.deepEqual(rows[0], { rooms: 0, joined: 0 }, "control expected the cleanup to eat the committed join");
      } else {
        assert.deepEqual(rows[0], { rooms: 1, joined: 1 });
      }
    });

    it(title("30 simultaneous room creations by one host stop at the hourly cap", "the same creations overrun the hourly cap"), async (t) => {
      const db = await freshDb({ withoutLocks });
      const [{ lim }] = (
        await db.owner.query("select (public.abuse_limits()->>'max_rooms_per_host_per_hour')::int as lim")
      ).rows;
      const host = await newUser(db);
      const conns = [];
      for (let i = 0; i < 30; i++) conns.push(await asUser(db, host));
      const results = await Promise.all(
        conns.map((c) =>
          txn(
            c,
            `insert into public.rooms (id, code, tier, host_id, mode, lives_setting)
             values (gen_random_uuid(), $1, 'medium', $2, 'race', 3)`,
            [randomCode(), host],
            50
          )
        )
      );
      const created = results.filter((r) => r.ok).length;
      t.diagnostic(`created ${created} (cap ${lim})`);
      if (withoutLocks) {
        assert.ok(created > lim, `control expected the cap to be overrun, got ${created}`);
      } else {
        assert.equal(created, lim);
        const refused = results.filter((r) => !r.ok);
        assert.ok(refused.every((r) => r.message === "room_create_rate_limited"), JSON.stringify(refused[0]));
      }
    });
  }

  it("a join that arrives after the last leave has committed fails cleanly on the foreign key", async () => {
    const db = await freshDb();
    const host = await newUser(db);
    const room = await lobby(db, host);
    const joinerId = await newUser(db);
    const joiner = await asUser(db, joinerId);
    const leaver = await asUser(db, host);

    await leaver.query("begin");
    await leaver.query(LEAVE, [room, host]); // holds the room lock, room already deleted in this txn
    const joining = joiner.query(JOIN, [room, joinerId]).then(
      () => ({ ok: true }),
      (e) => ({ ok: false, code: e.code })
    );
    await blockedOnLock(db, joiner.pid);
    await leaver.query("commit");

    assert.deepEqual(await joining, { ok: false, code: "23503" });
    const { rows } = await db.owner.query(
      "select count(*)::int as n from public.room_players where room_id = $1",
      [room]
    );
    assert.equal(rows[0].n, 0);
  });
});
