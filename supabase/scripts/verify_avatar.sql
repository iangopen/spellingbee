-- verify_avatar.sql — check migration 0021 (avatar colour and cosmetic) on the LIVE
-- project from the Supabase SQL editor, without signing anyone up (CAPTCHA stays on)
-- and without keeping anything.
--
-- HOW IT WORKS
--   * It is ONE statement (a DO block), so it is one transaction. It creates two
--     throwaway guests and a lobby inside that transaction, acts as each guest with
--     a transaction-local role (SET LOCAL ROLE authenticated) and transaction-local
--     JWT claims (set_config(..., true)), runs every check, and then RAISES its
--     report as an error. The error rolls the whole transaction back: the guests,
--     the room, every write. Nothing survives, so nothing needs cleaning up.
--   * So the expected output is an ERROR whose message is the report:
--       AVATAR VERIFY: 34 PASS, 0 FAIL (everything rolled back; ...)
--     "0 FAIL" is a pass. Any FAIL line names the check and what it saw.
--   * The live-data check at the top is read-only: every existing row's key must
--     match its numbers (the sync trigger's invariant).
--   * No explicit BEGIN/ROLLBACK on purpose: an error after an explicit BEGIN can
--     leave the editor's pooled connection in an aborted transaction. A single
--     statement that errors is rolled back and closed by Postgres itself.
--
-- Run: paste the whole file into the SQL editor (as the default postgres role) and
-- press Run. Tested in PGlite by supabase/tests/verify_avatar_script.test.mjs.
do $verify$
declare
  v_host   uuid := gen_random_uuid();
  v_guest  uuid := gen_random_uuid();
  v_other  uuid := gen_random_uuid();
  v_room   uuid := gen_random_uuid();
  v_code   text := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 12));
  v_report text[] := '{}';
  v_pass   int := 0;
  v_fail   int := 0;
  v_state  text;
  v_before jsonb;
  v_after  jsonb;
  v_n      int;
  v_m      int;
  v_txt    text;
  t        record;
begin
  -- every check lands here; the table goes with the transaction
  create temp table if not exists _av_checks (n serial, name text, ok boolean, detail text) on commit drop;

  -- ================================================================ 1. schema (read-only)
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'room_players'
     and column_name in ('avatar_color', 'avatar_cosmetic')
     and data_type = 'smallint' and is_nullable = 'NO' and column_default = '0';
  insert into _av_checks (name, ok, detail) values ('columns avatar_color, avatar_cosmetic: smallint not null default 0', v_n = 2, v_n || ' of 2');

  select string_agg(pg_get_constraintdef(oid), ' | ' order by conname) into v_txt
    from pg_constraint where conrelid = 'public.room_players'::regclass and conname in ('room_players_avatar_color_range', 'room_players_avatar_cosmetic_range');
  insert into _av_checks (name, ok, detail) values ('range CHECKs 0-7 and 0-13',
    v_txt = 'CHECK (((avatar_color >= 0) AND (avatar_color <= 7))) | CHECK (((avatar_cosmetic >= 0) AND (avatar_cosmetic <= 13)))', v_txt);

  select count(*) into v_n from pg_trigger
   where tgrelid = 'public.room_players'::regclass and tgname in ('room_players_avatar_sync', 'room_players_client_defaults') and tgenabled = 'O';
  insert into _av_checks (name, ok, detail) values ('sync trigger and backstop trigger present and enabled', v_n = 2, v_n || ' of 2');

  select format('secdef=%s config=%s', prosecdef, proconfig) into v_txt from pg_proc where oid = 'public.room_players_avatar_sync()'::regprocedure;
  insert into _av_checks (name, ok, detail) values ('sync trigger: security invoker, empty search_path', v_txt = 'secdef=f config={"search_path=\"\""}', v_txt);

  select string_agg(attname, ',' order by attname) into v_txt from pg_attribute
   where attrelid = 'public.room_players'::regclass and attnum > 0 and not attisdropped
     and has_column_privilege('authenticated', 'public.room_players', attname, 'INSERT');
  insert into _av_checks (name, ok, detail) values ('client INSERT columns are exactly the 4 old + 2 new', v_txt = 'avatar,avatar_color,avatar_cosmetic,display_name,player_id,room_id', v_txt);
  select string_agg(attname, ',' order by attname) into v_txt from pg_attribute
   where attrelid = 'public.room_players'::regclass and attnum > 0 and not attisdropped
     and has_column_privilege('authenticated', 'public.room_players', attname, 'UPDATE');
  insert into _av_checks (name, ok, detail) values ('client UPDATE columns are exactly the 2 old + 2 new', v_txt = 'avatar,avatar_color,avatar_cosmetic,display_name', v_txt);

  -- every existing row: the key is what the numbers say (the trigger's reverse mapping)
  select count(*), count(*) filter (where avatar <> case
           when avatar_cosmetic in (1, 8) then 'queen' when avatar_cosmetic = 5 then 'drone'
           when avatar_cosmetic = 7 then case when avatar_color = 7 then 'hive' else 'honey' end
           when avatar_cosmetic = 3 then case when avatar_color = 6 then 'clover' else 'blossom' end
           when avatar_color = 7 then 'wasp' when avatar_color = 2 then 'blossom' when avatar_color = 6 then 'clover'
           else 'bee' end)
    into v_n, v_m from public.room_players;
  insert into _av_checks (name, ok, detail) values ('live rows: every key matches its numbers', v_m = 0, format('%s rows, %s mismatched', v_n, v_m));

  -- ================================================================ 2. throwaway guests (rolled back)
  begin
    insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
    values (v_host, 'authenticated', 'authenticated', true, now(), now()),
           (v_guest, 'authenticated', 'authenticated', true, now(), now()),
           (v_other, 'authenticated', 'authenticated', true, now(), now());
  exception when others then
    raise exception 'AVATAR VERIFY: could not create throwaway guests (%: %). Nothing was changed.', sqlstate, sqlerrm;
  end;

  -- The client steps below each: set the claims (transaction-local), switch to the
  -- authenticated role (SET LOCAL), run ONE statement in a subtransaction, switch
  -- back. A failing statement's subtransaction is rolled back, role included.
  for t in
    select * from (values
      -- step, actor, sql, expected sqlstate ('ok' = must succeed)
      (1,  v_host,  format('insert into public.rooms (id, code, tier, host_id, mode, lives_setting) values (%L, %L, ''easy'', %L, ''race'', 3)', v_room, v_code, v_host), 'ok'),
      (2,  v_host,  format('insert into public.room_players (room_id, player_id, display_name, avatar) select room_id, player_id, display_name, avatar from json_populate_recordset(null::public.room_players, %L::json)',
                           json_build_array(json_build_object('room_id', v_room, 'player_id', v_host, 'display_name', 'Verify host', 'avatar', 'drone'))), 'ok'),
      (3,  v_guest, format('insert into public.room_players (room_id, player_id, display_name, avatar_color, avatar_cosmetic) select room_id, player_id, display_name, avatar_color, avatar_cosmetic from json_populate_recordset(null::public.room_players, %L::json)',
                           json_build_array(json_build_object('room_id', v_room, 'player_id', v_guest, 'display_name', 'Verify guest', 'avatar_color', 2, 'avatar_cosmetic', 4))), 'ok')
    ) s(step, actor, sql, expect)
  loop
    perform set_config('request.jwt.claim.sub', t.actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', t.actor, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    begin
      execute 'set local role authenticated';
      execute t.sql;
      execute 'reset role';
      v_state := 'ok';
    exception when others then
      v_state := sqlstate || ' ' || sqlerrm;
    end;
    insert into _av_checks (name, ok, detail) values (
      case t.step when 1 then 'a guest creates a lobby (client path)'
                  when 2 then 'old client: join with the key only (drone)'
                  else 'new client: join with numbers only (2, 4)' end,
      v_state = 'ok', v_state);
  end loop;

  select avatar_color || ',' || avatar_cosmetic || ',' || avatar into v_txt from public.room_players where player_id = v_host;
  insert into _av_checks (name, ok, detail) values ('old key drone got colour 4, cosmetic 5', v_txt = '4,5,drone', v_txt);
  select avatar_color || ',' || avatar_cosmetic || ',' || avatar into v_txt from public.room_players where player_id = v_guest;
  insert into _av_checks (name, ok, detail) values ('numbers 2,4 got the key blossom', v_txt = '2,4,blossom', v_txt);

  -- ================================================================ 3. what must be refused
  for t in
    select * from (values
      ('insert colour -1', v_other, 'avatar_color', '-1', 'insert', '23514'),
      ('insert colour 8', v_other, 'avatar_color', '8', 'insert', '23514'),
      ('insert cosmetic 14', v_other, 'avatar_cosmetic', '14', 'insert', '23514'),
      ('insert colour 32767', v_other, 'avatar_color', '32767', 'insert', '23514'),
      ('insert colour null', v_other, 'avatar_color', 'null', 'insert', '23502'),
      ('insert cosmetic 2.5', v_other, 'avatar_cosmetic', '2.5', 'insert', '22P02'),
      ('insert colour "blue"', v_other, 'avatar_color', '"blue"', 'insert', '22P02'),
      ('insert with score', v_other, 'score', '50', 'insert', '42501'),
      ('insert with lives', v_other, 'lives', '9', 'insert', '42501'),
      ('insert with turn_order', v_other, 'turn_order', '0', 'insert', '42501'),
      ('update colour -1', v_host, 'avatar_color', '-1', 'update', '23514'),
      ('update cosmetic 14', v_host, 'avatar_cosmetic', '14', 'update', '23514'),
      ('update colour 32767', v_host, 'avatar_color', '32767', 'update', '23514'),
      ('update colour null', v_host, 'avatar_color', 'null', 'update', '23502'),
      ('update cosmetic 2.5', v_host, 'avatar_cosmetic', '2.5', 'update', '22P02'),
      ('update colour "blue"', v_host, 'avatar_color', '"blue"', 'update', '22P02'),
      ('update score', v_host, 'score', '50', 'update', '42501'),
      ('update streak', v_host, 'streak', '3', 'update', '42501'),
      ('update is_eliminated', v_host, 'is_eliminated', 'true', 'update', '42501')
    ) s(name, actor, col, val, op, expect)
  loop
    select to_jsonb(rp) into v_before from public.room_players rp where player_id = v_host;
    perform set_config('request.jwt.claim.sub', t.actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', t.actor, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    begin
      execute 'set local role authenticated';
      if t.op = 'insert' then
        execute format('insert into public.room_players (room_id, player_id, display_name, %1$I) select room_id, player_id, display_name, %1$I from json_populate_recordset(null::public.room_players, %2$L::json)',
                       t.col, format('[{"room_id":"%s","player_id":"%s","display_name":"Verify other","%s":%s}]', v_room, v_other, t.col, t.val));
      else
        execute format('update public.room_players set %1$I = (select %1$I from json_populate_record(null::public.room_players, %2$L::json)) where player_id = %3$L',
                       t.col, format('{"%s":%s}', t.col, t.val), v_host);
      end if;
      execute 'reset role';
      v_state := 'ok';
    exception when others then
      v_state := sqlstate;
    end;
    select to_jsonb(rp) into v_after from public.room_players rp where player_id = v_host;
    select count(*) into v_n from public.room_players where player_id = v_other;
    insert into _av_checks (name, ok, detail) values ('refused: ' || t.name,
      v_state = t.expect and v_after = v_before and v_n = 0,
      format('got %s (want %s); host row %s; stray rows %s', v_state, t.expect, case when v_after = v_before then 'unchanged' else 'CHANGED' end, v_n));
  end loop;

  -- ================================================================ 4. what must work, and touch nothing else
  for t in
    select * from (values
      ('host changes the bee (numbers): nothing else on the row moves', v_host, v_host, 'update public.room_players set (avatar_color, avatar_cosmetic) = (5, 12) where player_id = %L', '5,12,bee'),
      ('host changes the bee (key, old client): numbers follow', v_host, v_host, 'update public.room_players set avatar = ''clover'' where player_id = %L', '6,3,clover'),
      ('host tries to change the GUEST''s bee: nothing happens', v_host, v_guest, 'update public.room_players set (avatar_color, avatar_cosmetic) = (1, 1) where player_id = %L', '2,4,blossom')
    ) s(name, actor, target, sql, want)
  loop
    select to_jsonb(rp) - 'avatar' - 'avatar_color' - 'avatar_cosmetic' into v_before from public.room_players rp where player_id = t.target;
    perform set_config('request.jwt.claim.sub', t.actor::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', t.actor, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    begin
      execute 'set local role authenticated';
      execute format(t.sql, t.target);
      execute 'reset role';
      v_state := 'ok';
    exception when others then
      v_state := sqlstate || ' ' || sqlerrm;
    end;
    select to_jsonb(rp) - 'avatar' - 'avatar_color' - 'avatar_cosmetic', avatar_color || ',' || avatar_cosmetic || ',' || avatar
      into v_after, v_txt from public.room_players rp where player_id = t.target;
    insert into _av_checks (name, ok, detail) values (t.name, v_state = 'ok' and v_after = v_before and v_txt = t.want,
      format('%s; bee now %s (want %s); other columns %s', v_state, v_txt, t.want, case when v_after = v_before then 'identical' else 'CHANGED' end));
  end loop;

  -- ================================================================ report, and roll everything back
  for t in select * from _av_checks order by n loop
    if t.ok then v_pass := v_pass + 1; else v_fail := v_fail + 1; end if;
    v_report := v_report || format('%s %s%s', case when t.ok then 'PASS' else 'FAIL' end, t.name, case when t.ok then '' else ' -- ' || coalesce(t.detail, '') end);
  end loop;
  raise exception using
    errcode = 'P0001',
    message = format(E'AVATAR VERIFY: %s PASS, %s FAIL (everything rolled back; this error is the expected ending)\n%s',
                     v_pass, v_fail, array_to_string(v_report, E'\n'));
end
$verify$;
