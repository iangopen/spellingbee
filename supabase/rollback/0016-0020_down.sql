-- 0016-0020_down.sql — reverse the hardening migrations 0016–0020.
--
-- NOT A MIGRATION. It lives outside supabase/migrations/ on purpose, so
-- `supabase db push` never runs it. Run it by hand (SQL editor) only if
-- 0016–0020 have to come out. test:db applies 0016–0020, then this file, and
-- asserts the catalog matches a database that only ever ran 0001–0015:
-- functions (source, ACL, SECURITY DEFINER, config, comment), table and column
-- ACLs, constraints, triggers, policies, indexes, columns, schemas and cron jobs.
--
-- Undone in reverse order: 0020, 0019, 0018, 0017, 0016. One transaction, so it
-- either fully applies or not at all.
--
-- WHAT IT CANNOT UNDO (data, not schema):
--   * rows the 0019 purge jobs already deleted (finished games' guesses, rooms
--     past retention, anonymous users) are gone;
--   * display names 0018 trimmed to 24 characters stay trimmed.
--
-- THE CLIENT: the hardened client works against the rolled-back database. It
-- sends the same columns the grants below allow, and the error codes it words
-- (room_full, display_name_not_allowed, ...) simply stop occurring. Rolling back
-- re-opens every finding 0016–0020 closed (self-set scores, unbounded names,
-- no limits or retention, default grants).
--
-- If `supabase db push` recorded 0016–0020, the last block removes them from
-- the migration history so a later push re-applies them.

begin;

-- ===========================================================================
-- 0020 grant cleanup -> restore the grants 0006/0010/0012 left behind
-- ===========================================================================
-- Supabase's default privileges had granted ALL on round_attempts to both roles.
grant all on public.round_attempts to anon, authenticated;

-- PUBLIC's implicit EXECUTE, and the explicit anon grant from Supabase's default
-- privileges, on the constant getters that existed before 0016.
grant execute on function public.round_seconds(text)                        to public, anon;
grant execute on function public.rounds_per_game()                          to public, anon;
grant execute on function public.late_grace_ms()                            to public, anon;
grant execute on function public.feedback_ms()                              to public, anon;
grant execute on function public.avatar_keys()                              to public, anon;
grant execute on function public.decay_params()                             to public, anon;
grant execute on function public.decayed_round_seconds(text, int, int, int) to public, anon;
-- (player_cap / abuse_limits are 0019's and are dropped below.)

-- ===========================================================================
-- 0019 abuse limits and retention
-- ===========================================================================
do $unsched$
declare
  j text;
begin
  foreach j in array array[
    'purge-finished-round-attempts',
    'purge-stale-rooms',
    'purge-anonymous-users',
    'purge-cron-history'
  ] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end
$unsched$;

drop trigger if exists rooms_enforce_host_limits      on public.rooms;
drop trigger if exists room_players_enforce_limits    on public.room_players;
drop trigger if exists room_players_drop_empty_lobby  on public.room_players;

drop function if exists public.rooms_enforce_host_limits();
drop function if exists public.room_players_enforce_limits();
drop function if exists public.room_players_drop_empty_lobby();
drop function if exists public.purge_finished_round_attempts();
drop function if exists public.purge_stale_rooms();
drop function if exists public.purge_anonymous_users();
drop function if exists public.purge_cron_history();
drop function if exists public.lock_for(text, uuid);
drop function if exists public.abuse_limits();
drop function if exists public.player_cap();

drop index if exists public.rooms_host_id_idx;
drop table if exists private.room_creations;

-- ===========================================================================
-- 0018 display names
-- ===========================================================================
drop trigger if exists room_players_check_display_name on public.room_players;
drop function if exists public.room_players_check_display_name();
alter table public.room_players drop constraint if exists room_players_display_name_valid;

-- Everything left in `private` is 0018's (the name filter and its table).
drop schema if exists private cascade;

-- ===========================================================================
-- 0017 room insert columns -> back to 0002's table-level INSERT
-- ===========================================================================
alter table public.rooms drop constraint if exists rooms_code_charset;
-- Column privileges are separate ACL entries; a table-level grant doesn't
-- clear them, so they are revoked explicitly.
revoke insert (id, code, tier, host_id, mode, lives_setting) on public.rooms from authenticated;
grant insert on public.rooms to authenticated;

-- ===========================================================================
-- 0016 score integrity
-- ===========================================================================
drop trigger if exists room_players_client_defaults on public.room_players;
drop function if exists public.room_players_client_defaults();

revoke insert (room_id, player_id, display_name, avatar) on public.room_players from authenticated;
grant insert on public.room_players to authenticated;

-- room_accepts_new_players and its comment, verbatim from 0012.
create or replace function public.room_accepts_new_players(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and r.mode = 'elimination'
      and r.status <> 'lobby'
  );
$$;

comment on function public.room_accepts_new_players(uuid) is
  'False only for an elimination room that has left the lobby. SECURITY DEFINER because a joiner is not yet a member and so cannot see the rooms row under its own RLS.';

-- start_game_tx, verbatim from 0015 (no score reset). Same signature, so its
-- service_role-only grants are untouched by create or replace.
create or replace function public.start_game_tx(p_room_id uuid, p_caller uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    public.rooms%rowtype;
  v_players int;
  v_word_id text;
  v_word    text;
  v_now     timestamptz;
begin
  -- FOR UPDATE serialises concurrent start attempts on the same room: the second
  -- caller waits here, then sees status <> 'lobby' and is rejected.
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'room_not_found');
  end if;

  -- Session 19: this engine owns race rooms only. Mirrors the check
  -- start_elimination_game_tx makes in the opposite direction.
  if v_room.mode <> 'race' then
    return jsonb_build_object('ok', false, 'error', 'wrong_mode',
                              'mode', v_room.mode);
  end if;

  -- Host check against the room row, NOT against anything the caller asserted.
  if v_room.host_id <> p_caller then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;

  if v_room.status <> 'lobby' then
    return jsonb_build_object('ok', false, 'error', 'already_started',
                              'status', v_room.status);
  end if;

  select count(*) into v_players from public.room_players where room_id = p_room_id;
  if v_players < 2 then
    return jsonb_build_object('ok', false, 'error', 'not_enough_players',
                              'players', v_players);
  end if;

  v_word_id := public.pick_unused_word(p_room_id, v_room.tier);
  if v_word_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_words_for_tier');
  end if;
  select word into v_word from public.words where id = v_word_id;

  v_now := now();

  -- The round_results row and the room bump land in ONE transaction, so round 1
  -- becomes readable to clients at exactly the moment the room says it started.
  insert into public.round_results (room_id, round_num, word_id)
  values (p_room_id, 1, v_word_id);

  update public.rooms
     set status = 'active', current_round = 1, round_started_at = v_now
   where id = p_room_id;

  return jsonb_build_object(
    'ok', true,
    'round_num', 1,
    'word', v_word,
    'round_started_at', v_now,
    'round_seconds', public.round_seconds(v_room.tier),
    'tier', v_room.tier
  );
end;
$$;

-- ===========================================================================
-- Migration history (only where the Supabase CLI keeps it)
-- ===========================================================================
do $hist$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations
     where version in ('0016', '0017', '0018', '0019', '0020');
  end if;
end
$hist$;

commit;
