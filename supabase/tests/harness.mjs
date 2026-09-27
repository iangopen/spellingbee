// harness.mjs — run the REAL migrations in supabase/migrations against an
// in-process Postgres (PGlite, Postgres compiled to WASM) and act as the same
// roles Supabase clients act as.
//
// Why this exists: there is no Docker on the dev machine, so `supabase start`
// isn't available, and every earlier verify script in supabase/scripts/ runs
// against the LIVE project. This lets the security properties of a migration be
// checked before it ever reaches production.
//
// What is stubbed (and therefore NOT proven here — see CLAUDE.md "Security"):
//   * auth.users / auth.uid()          — a minimal table + a function reading the
//                                        same request.jwt.claim.sub GUC PostgREST sets
//   * anon / authenticated / service_role — plain roles; service_role BYPASSRLS
//   * Supabase's default privileges    — reproduced (tables/functions/sequences in
//                                        public granted to all three roles), because
//                                        several findings are ABOUT those defaults
//   * pg_cron                          — a stub cron schema; `create extension pg_cron`
//                                        is stripped from 0009. Jobs never run on a
//                                        schedule here; tests call the job functions.
//   * supabase_realtime publication    — created empty so 0004/0007 apply
//   * single connection                — no concurrency; locks are not exercised
//
// PGlite is Postgres 18.x; production is 17.6. Nothing used here differs between them.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase preinstalls pgcrypto into its own schema, so 0001's
-- "create extension if not exists pgcrypto" is a no-op there. Mirror that, or
-- every pgcrypto function lands in public and pollutes the grant sweeps.
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase's default privileges for objects the migration owner creates in public.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id           uuid primary key,
  is_anonymous boolean not null default true,
  created_at   timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema cron;
create table cron.job (
  jobid    bigserial primary key,
  jobname  text unique,
  schedule text not null,
  command  text not null
);
create table cron.job_run_details (
  runid     bigserial primary key,
  jobid     bigint,
  status    text,
  start_time timestamptz,
  end_time  timestamptz
);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint
language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(p_name text) returns boolean language sql as $$
  with d as (delete from cron.job where jobname = p_name returning 1) select exists (select 1 from d)
$$;

create publication supabase_realtime;
`;

export function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
}

/**
 * A fresh database with every migration up to and including `upTo` (a filename
 * prefix like "0015"), or all of them.
 */
export async function freshDb({ upTo } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(BOOTSTRAP);
  for (const f of migrationFiles()) {
    if (upTo && f.slice(0, 4) > upTo) break;
    let sql = readFileSync(join(migrationsDir, f), "utf8");
    // pg_cron isn't available in WASM; the stub schema above stands in for it.
    sql = sql.replace(/create extension if not exists pg_cron;/gi, "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`migration ${f} failed: ${e.message}`);
    }
  }
  return new Harness(db);
}

export class Harness {
  constructor(db) {
    this.db = db;
  }

  /** Run as the migration owner (postgres). */
  async sql(query, params = []) {
    return (await this.db.query(query, params)).rows;
  }

  /**
   * Run as a client role. `uid` null means the no-session `anon` role; a uid
   * means a signed-in (possibly anonymous) user, which Supabase maps to
   * `authenticated`. Resolves to { rows } or { error: { code, message } } — it
   * never throws on a database error, so tests can assert on codes.
   */
  async as(uid, query, params = []) {
    const role = uid === "service_role" ? "service_role" : uid ? "authenticated" : "anon";
    await this.db.exec(
      `select set_config('request.jwt.claim.sub', '${uid && uid !== "service_role" ? uid : ""}', false)`
    );
    await this.db.exec(`set role ${role}`);
    try {
      const r = await this.db.query(query, params);
      return { rows: r.rows };
    } catch (e) {
      return { error: { code: e.code, message: e.message } };
    } finally {
      await this.db.exec("reset role");
      await this.db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  }

  /** Create an auth user (as the owner); returns its id. */
  async user({ anonymous = true, createdAt = null } = {}) {
    const [{ id }] = await this.sql(
      `insert into auth.users (id, is_anonymous, created_at)
       values (gen_random_uuid(), $1, coalesce($2::timestamptz, now())) returning id`,
      [anonymous, createdAt]
    );
    return id;
  }

  /** Create a lobby room hosted by `host` through the CLIENT path, host joined. */
  async room(host, { tier = "medium", mode = "race", name = "Host", code = null } = {}) {
    const id = (await this.sql("select gen_random_uuid() as id"))[0].id;
    const c = code ?? randomCode();
    const ins = await this.as(
      host,
      "insert into public.rooms (id, code, tier, host_id, mode, lives_setting) values ($1,$2,$3,$4,$5,3)",
      [id, c, tier, host, mode]
    );
    if (ins.error) return { error: ins.error };
    const join = await this.join(host, id, name);
    if (join.error) return { error: join.error };
    return { id, code: c };
  }

  join(uid, roomId, name = "Player", avatar = "bee") {
    return this.as(
      uid,
      "insert into public.room_players (room_id, player_id, display_name, avatar) values ($1,$2,$3,$4)",
      [roomId, uid, name, avatar]
    );
  }

  /** Call an edge-function-only SQL function the way the edge function does. */
  async rpc(fn, args) {
    const keys = Object.keys(args);
    const r = await this.as(
      "service_role",
      `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`,
      keys.map((k) => args[k])
    );
    if (r.error) throw new Error(`${fn}: ${r.error.code} ${r.error.message}`);
    return r.rows[0].r;
  }

  close() {
    return this.db.close();
  }
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
