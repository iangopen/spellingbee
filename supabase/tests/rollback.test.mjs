// supabase/rollback/0016-0020_down.sql restores a database that ran 0016–0020 to
// exactly what 0001–0015 produce: compared catalog-wide against a fresh 0015.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, repoRoot } from "./harness.mjs";

const ROLLBACK = readFileSync(join(repoRoot, "supabase", "rollback", "0016-0020_down.sql"), "utf8");

// ACL arrays are order-dependent in storage but not in meaning; an empty ACL
// and no ACL both mean "defaults". Normalize both before comparing.
const acl = (a) => {
  if (a === null || a === undefined) return null;
  const items = String(a).replace(/^\{|\}$/g, "").split(",").filter(Boolean).map((s) => s.replace(/^"|"$/g, ""));
  return items.length ? items.sort() : null;
};

async function snapshot(h) {
  const q = (sql) => h.sql(sql);
  const fns = (
    await q(`
      select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
             p.prosrc, p.prosecdef, p.proconfig::text as cfg, p.proacl::text as acl,
             obj_description(p.oid, 'pg_proc') as comment
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private', 'auth', 'cron')
       order by 1`)
  ).map((r) => ({ ...r, acl: acl(r.acl) }));

  const tables = (
    await q(`
      select n.nspname || '.' || c.relname as rel, c.relkind, c.relacl::text as acl, c.relrowsecurity as rls,
             obj_description(c.oid, 'pg_class') as comment
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'private') and c.relkind in ('r', 'i', 'S', 'v')
       order by 1`)
  ).map((r) => ({ ...r, acl: acl(r.acl) }));

  const columns = (
    await q(`
      select c.relname || '.' || a.attname as col, format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as def, a.attacl::text as acl
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
       order by 1`)
  ).map((r) => ({ ...r, acl: acl(r.acl) }));

  const constraints = await q(`
    select conrelid::regclass::text as rel, conname, pg_get_constraintdef(oid) as def, convalidated
      from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`);
  const triggers = await q(`
    select tgrelid::regclass::text as rel, tgname, pg_get_triggerdef(oid) as def
      from pg_trigger where not tgisinternal order by 1, 2`);
  const policies = await q(`
    select tablename, policyname, permissive, roles::text, cmd, qual, with_check
      from pg_policies where schemaname = 'public' order by 1, 2`);
  const indexes = await q(`select indexname, indexdef from pg_indexes where schemaname = 'public' order by 1`);
  const schemas = await q(`
    select nspname, nspacl::text as acl from pg_namespace
     where nspname not like 'pg\\_%' and nspname <> 'information_schema' order by 1`);
  const cron = await q(`select jobname, schedule, command from cron.job order by 1`);
  const publication = await q(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`);

  return { fns, tables, columns, constraints, triggers, policies, indexes, schemas: schemas.map((s) => ({ ...s, acl: acl(s.acl) })), cron, publication };
}

describe("rollback 0016-0020_down.sql", () => {
  let at15, rolled, full;
  beforeAll(async () => {
    at15 = await freshDb({ upTo: "0015" });
    full = await freshDb();
    rolled = await freshDb();
    await rolled.db.exec(ROLLBACK);
  });
  afterAll(async () => {
    await at15.close();
    await rolled.close();
    await full.close();
  });

  it("is not in supabase/migrations, so db push can never run it", () => {
    expect(ROLLBACK).toMatch(/^-- 0016-0020_down\.sql/);
  });

  it("the full chain really differs from 0015 (so the comparison below means something)", async () => {
    expect(await snapshot(full)).not.toEqual(await snapshot(at15));
  });

  it("restores the catalog to exactly what 0001–0015 produce", async () => {
    const [a, b] = [await snapshot(at15), await snapshot(rolled)];
    // Section by section, so a failure names what differs.
    for (const k of Object.keys(a)) expect(b[k], k).toEqual(a[k]);
  });

  it("brings back the original behaviour, including finding #1 (proving it really rolled back)", async () => {
    const u = await rolled.user();
    const r = await rolled.as(
      u,
      "insert into room_players (room_id, player_id, display_name, score) values ('00000000-0000-0000-0000-00000000dead', $1, 'x', 9999)",
      [u]
    );
    expect(r.error?.code).toBe("23503"); // P-auth-8's pre-hardening result
    expect((await rolled.as(null, "select * from round_attempts")).error).toBeUndefined(); // P-anon-5: 200, 0 rows
  });

  it("the whole chain can be re-applied after a rollback", async () => {
    const h = await freshDb();
    await h.db.exec(ROLLBACK);
    for (const f of ["0016_score_integrity", "0017_room_insert_columns", "0018_display_names", "0019_abuse_limits_retention", "0020_grant_cleanup"]) {
      await h.db.exec(readFileSync(join(repoRoot, "supabase", "migrations", `${f}.sql`), "utf8"));
    }
    expect(await snapshot(h)).toEqual(await snapshot(full));
    await h.close();
  });
});
