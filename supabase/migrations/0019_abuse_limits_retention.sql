-- 0019_abuse_limits_retention.sql
-- Bounded writes and bounded retention (hardening #5, data minimization §C11).
--
-- Anonymous sign-in means "authenticated" is anyone, and until now each guest
-- could create unlimited rooms and memberships, and nothing was ever deleted:
-- not rooms, not every typed guess in round_attempts, not anonymous users.
--
-- WRITE LIMITS (enforced here, in triggers — client checks are only UX):
--   * at most 3 OPEN rooms per host (active, or a lobby that still has members)
--   * at most 20 rooms CREATED per host per rolling hour
--   * at most player_cap() = 8 players per room (was client best-effort only)
--   * a lobby whose last member leaves is deleted on the spot
--
-- RETENTION (pg_cron):
--   * every 10 min  delete round_attempts of finished games — every typed guess.
--                   Nothing reads them after the game: winners and response
--                   times already live on round_results, and no client can read
--                   round_attempts at all.
--   * every 10 min  delete rooms older than 30 days, lobbies older than 24 h, and
--                   member-less lobbies older than 10 min. Children cascade.
--   * daily         delete anonymous auth users older than 30 days that no longer
--                   appear in ANY game row (see purge_anonymous_users for the FK
--                   reasoning), and room-creation log rows older than a day
--   * daily         delete cron.job_run_details older than 7 days (the two
--                   5-second sweepers write ~34k rows a day there)
--
-- BACKWARD COMPATIBLE with the deployed client: normal play never approaches the
-- limits. A client that does hit one gets the raw error code as its message
-- (e.g. "too_many_open_rooms"); the new client words it.
--
-- LOCKING. Every membership-changing path for a room takes the same transaction
-- advisory lock, keyed on the room id, before it counts anything:
--   * a join (room_players BEFORE INSERT) — for the player cap
--   * a leave (room_players AFTER DELETE) — for the empty-lobby cleanup
-- so a join racing the last leave serialises: either the join lands first and the
-- leaver's recount sees it (room kept), or the leave lands first, deletes the
-- room, and the join then fails cleanly on the foreign key. Without the lock the
-- cleanup's cascade could silently delete a join that committed in between.
-- Room creation takes the same kind of lock keyed on the HOST id for the two
-- per-host caps. One helper builds both keys so they can never collide.

-- ===========================================================================
-- Limits, in one place (same discipline as decay_params()).
-- ===========================================================================

-- Mirrors PLAYER_CAP in src/lib/rooms.ts. test:db reads that file and fails if
-- the two disagree; the database is the authority.
create or replace function public.player_cap()
returns int
language sql
immutable
as $$ select 8; $$;

create or replace function public.abuse_limits()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'max_open_rooms_per_host',     3,
    'max_rooms_per_host_per_hour', 20,
    'room_retention_days',         30,
    'stale_lobby_hours',           24,
    'empty_lobby_minutes',         10,
    'anon_user_retention_days',    30,
    'cron_history_days',           7
  );
$$;

comment on function public.player_cap() is
  'Max players per room. Enforced by room_players_enforce_limits(); mirrored by PLAYER_CAP in src/lib/rooms.ts (asserted by test:db).';
comment on function public.abuse_limits() is
  'Every write limit and retention period from 0019, in one place.';

-- ===========================================================================
-- The one advisory-lock helper. `kind` namespaces the key so a room id and a
-- host id can never map to the same lock.
-- ===========================================================================
create or replace function public.lock_for(p_kind text, p_id uuid)
returns void
language sql
volatile
as $$
  select pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_id::text, 0));
$$;

revoke all on function public.lock_for(text, uuid) from public, anon, authenticated;

-- ===========================================================================
-- Per-host room limits.
--
-- The hourly cap counts a separate creation LOG, not public.rooms: with the
-- empty-lobby cleanup below, create-then-leave deletes the room row, so a count
-- over rooms would forget it and the cap would be bypassable by leaving.
-- ===========================================================================
create table if not exists private.room_creations (
  host_id    uuid        not null,
  created_at timestamptz not null default now()
);
create index if not exists room_creations_host_time_idx
  on private.room_creations (host_id, created_at);
revoke all on private.room_creations from public, anon, authenticated;

create index if not exists rooms_host_id_idx on public.rooms (host_id);

create or replace function public.rooms_enforce_host_limits()
returns trigger
language plpgsql
security definer          -- must count the host's rooms, including ones RLS hides
set search_path = public
as $$
declare
  v_lim    jsonb := public.abuse_limits();
  v_recent int;
  v_open   int;
begin
  -- The engine and the migration owner are trusted; the limits are for clients.
  -- NOT current_user: inside a SECURITY DEFINER function that is the owner. The
  -- `role` setting still holds what PostgREST SET ROLE'd the request to.
  if coalesce(current_setting('role', true), 'none') not in ('anon', 'authenticated') then
    return new;
  end if;

  perform public.lock_for('host', new.host_id);

  select count(*) into v_recent
    from private.room_creations
   where host_id = new.host_id
     and created_at > now() - interval '1 hour';
  if v_recent >= (v_lim->>'max_rooms_per_host_per_hour')::int then
    raise exception 'room_create_rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_open
    from public.rooms r
   where r.host_id = new.host_id
     and (r.status = 'active'
          or (r.status = 'lobby'
              and exists (select 1 from public.room_players p where p.room_id = r.id)));
  if v_open >= (v_lim->>'max_open_rooms_per_host')::int then
    raise exception 'too_many_open_rooms' using errcode = 'P0001';
  end if;

  insert into private.room_creations (host_id) values (new.host_id);
  return new;
end;
$$;

revoke all on function public.rooms_enforce_host_limits() from public, anon, authenticated;

drop trigger if exists rooms_enforce_host_limits on public.rooms;
create trigger rooms_enforce_host_limits
  before insert on public.rooms
  for each row execute function public.rooms_enforce_host_limits();

-- ===========================================================================
-- Player cap, race-free. Replaces the client's join-then-count-then-back-out.
-- ===========================================================================
create or replace function public.room_players_enforce_limits()
returns trigger
language plpgsql
security definer          -- a joiner is not a member yet, so RLS hides the roster
set search_path = public
as $$
begin
  perform public.lock_for('room', new.room_id);

  if (select count(*) from public.room_players where room_id = new.room_id)
     >= public.player_cap() then
    raise exception 'room_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.room_players_enforce_limits() from public, anon, authenticated;

drop trigger if exists room_players_enforce_limits on public.room_players;
create trigger room_players_enforce_limits
  before insert on public.room_players
  for each row execute function public.room_players_enforce_limits();

-- ===========================================================================
-- Empty-lobby cleanup. Before this, every abandoned lobby lived forever, and a
-- host could only leave one by deleting their membership — the room stayed.
-- Only lobbies: active/finished rooms keep their rows (0005 forbids leaving
-- them anyway), and a finished game's scoreboard must not vanish.
-- A room deleted by cascade fires this for each child row; by then the parent
-- row is already gone, so the DELETE below matches nothing.
-- ===========================================================================
create or replace function public.room_players_drop_empty_lobby()
returns trigger
language plpgsql
security definer          -- clients have no DELETE on rooms
set search_path = public
as $$
begin
  perform public.lock_for('room', old.room_id);

  delete from public.rooms r
   where r.id = old.room_id
     and r.status = 'lobby'
     and not exists (select 1 from public.room_players p where p.room_id = r.id);
  return null;
end;
$$;

revoke all on function public.room_players_drop_empty_lobby() from public, anon, authenticated;

drop trigger if exists room_players_drop_empty_lobby on public.room_players;
create trigger room_players_drop_empty_lobby
  after delete on public.room_players
  for each row execute function public.room_players_drop_empty_lobby();

-- ===========================================================================
-- Retention jobs. Each is plain DML with no game rules, callable standalone for
-- testing, and not client-callable (same boundary as the 0009/0014 sweepers).
-- ===========================================================================

-- Every typed guess, once its game is over.
create or replace function public.purge_finished_round_attempts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  delete from public.round_attempts ra
   using public.rooms r
   where r.id = ra.room_id
     and r.status = 'finished';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Old rooms of any status, stale lobbies, and member-less lobbies (e.g. a room
-- whose creator's join then failed). room_players, round_results and
-- round_attempts all reference rooms ON DELETE CASCADE (0001/0006), so nothing
-- is orphaned.
create or replace function public.purge_stale_rooms()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim jsonb := public.abuse_limits();
  v_n   int;
begin
  delete from public.rooms r
   where r.created_at < now() - make_interval(days => (v_lim->>'room_retention_days')::int)
      or (r.status = 'lobby'
          and r.created_at < now() - make_interval(hours => (v_lim->>'stale_lobby_hours')::int))
      or (r.status = 'lobby'
          and r.created_at < now() - make_interval(mins => (v_lim->>'empty_lobby_minutes')::int)
          and not exists (select 1 from public.room_players p where p.room_id = r.id));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Anonymous users with no remaining game data.
--
-- FK REASONING. auth.users is referenced by:
--   rooms.host_id, room_players.player_id, round_attempts.player_id  ON DELETE CASCADE
--   rooms.winner_id, rooms.current_turn_player_id,
--   round_results.winner_id, round_results.turn_player_id            NO ACTION
-- Deleting a user still named in a NO ACTION column would fail the whole batch;
-- deleting a HOST would cascade through rooms.host_id into other players' game
-- history. So a user is only eligible once they appear in none of the seven.
-- In practice that is "30 days since their last game", because purge_stale_rooms
-- removes rooms after 30 days, which clears every reference.
-- A returning visitor whose user was purged is signed in again as a new guest by
-- the client (src/lib/auth.ts), so this never strands anyone.
create or replace function public.purge_anonymous_users()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim jsonb := public.abuse_limits();
  v_n   int;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - make_interval(days => (v_lim->>'anon_user_retention_days')::int)
     and not exists (select 1 from public.rooms r
                      where r.host_id = u.id or r.winner_id = u.id or r.current_turn_player_id = u.id)
     and not exists (select 1 from public.room_players p where p.player_id = u.id)
     and not exists (select 1 from public.round_results rr
                      where rr.winner_id = u.id or rr.turn_player_id = u.id)
     and not exists (select 1 from public.round_attempts ra where ra.player_id = u.id);
  get diagnostics v_n = row_count;

  delete from private.room_creations where created_at < now() - interval '1 day';
  return v_n;
end;
$$;

create or replace function public.purge_cron_history()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  delete from cron.job_run_details
   where end_time < now() - make_interval(days => (public.abuse_limits()->>'cron_history_days')::int);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.purge_finished_round_attempts() from public, anon, authenticated;
revoke all on function public.purge_stale_rooms()             from public, anon, authenticated;
revoke all on function public.purge_anonymous_users()         from public, anon, authenticated;
revoke all on function public.purge_cron_history()            from public, anon, authenticated;

-- ===========================================================================
-- Schedules. Idempotent in 0009's shape: unschedule first, so re-running the
-- migration re-points each job instead of failing on a duplicate name.
-- ===========================================================================
do $sched$
declare
  j record;
begin
  for j in
    select * from (values
      ('purge-finished-round-attempts', '*/10 * * * *', 'select public.purge_finished_round_attempts();'),
      ('purge-stale-rooms',             '*/10 * * * *', 'select public.purge_stale_rooms();'),
      ('purge-anonymous-users',         '17 3 * * *',   'select public.purge_anonymous_users();'),
      ('purge-cron-history',            '37 3 * * *',   'select public.purge_cron_history();')
    ) as t(name, schedule, command)
  loop
    if exists (select 1 from cron.job where jobname = j.name) then
      perform cron.unschedule(j.name);
    end if;
    perform cron.schedule(j.name, j.schedule, j.command);
  end loop;
end
$sched$;
