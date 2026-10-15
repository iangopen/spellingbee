// The catalog snapshot the rollback tests compare: functions (body, security,
// config, ACL, comment), tables and their ACLs, columns with types, defaults and
// column ACLs, constraints, triggers, policies, indexes, schemas, cron jobs and
// the realtime publication. Shared by rollback.test.mjs and
// avatar_parts_rollback.test.mjs.

// ACL arrays are order-dependent in storage but not in meaning; an empty ACL
// and no ACL both mean "defaults". Normalize both before comparing.
const acl = (a) => {
  if (a === null || a === undefined) return null;
  const items = String(a).replace(/^\{|\}$/g, "").split(",").filter(Boolean).map((s) => s.replace(/^"|"$/g, ""));
  return items.length ? items.sort() : null;
};

export async function snapshot(h) {
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

