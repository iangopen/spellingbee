-- 0016_score_integrity.sql
-- Scores are server-only, and nobody joins a game in progress (hardening #1).
--
-- THE HOLE
-- ---------------------------------------------------------------------------
-- 0002 granted `insert on room_players` at TABLE level. RLS pinned player_id to
-- auth.uid() but said nothing about the other columns, so a guest could join a
-- room with any score, streak, lives or turn_order they liked. The live probe
-- showed it: an insert carrying `score: 9999` passed RLS and was stopped only by
-- the deliberately fake room id (23503). Two things made that matter in race
-- mode specifically:
--   * start_game_tx (0006, re-created in 0015) never reset scores, so a forged
--     lobby score carried straight into the game;
--   * room_accepts_new_players (0012) refused mid-game joins only for
--     ELIMINATION rooms, so a race could be joined mid-game with a forged score.
-- Elimination was already safe on the first point (start_elimination_game_tx
-- zeroes score/streak/lives), which is why the fix mirrors it.
--
-- BACKWARD COMPATIBLE with the deployed client: src/lib/rooms.ts inserts exactly
-- {room_id, player_id, display_name, avatar} on both create and join, and already
-- refuses to join a room whose status isn't 'lobby' before inserting.

-- ---------------------------------------------------------------------------
-- 1. Column-level INSERT grant.
--
-- A column grant is the same mechanism 0002 already uses for UPDATE: naming any
-- other column in the INSERT fails the privilege check with 42501 before RLS,
-- triggers or constraints run. Everything else takes its column default.
-- The table-level grant must be revoked first — column grants add to it, they
-- don't narrow it.
-- ---------------------------------------------------------------------------
revoke insert on public.room_players from anon, authenticated;
grant insert (room_id, player_id, display_name, avatar) on public.room_players to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Backstop trigger: a CLIENT row always starts at the defaults.
--
-- Redundant with the grant today, on purpose. The grant is one line that a
-- future migration could widen without noticing what it protects; this makes
-- that mistake fail loudly instead of silently re-opening #1. It checks the
-- invoking role, so the engine (service_role / the migration owner) is exempt —
-- not that any engine path inserts into room_players today.
-- ---------------------------------------------------------------------------
create or replace function public.room_players_client_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.score <> 0
          or new.streak <> 0
          or new.turn_order is not null
          or new.is_eliminated) then
    raise exception 'room_players: game columns are server-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.room_players_client_defaults() is
  'Trigger: rejects a client-inserted room_players row whose score/streak/turn_order/is_eliminated is not the default. Backstop for the column grant in 0016.';

revoke all on function public.room_players_client_defaults() from public, anon, authenticated;

drop trigger if exists room_players_client_defaults on public.room_players;
create trigger room_players_client_defaults
  before insert on public.room_players
  for each row execute function public.room_players_client_defaults();

-- ---------------------------------------------------------------------------
-- 3. Nobody joins a game in progress, in either mode.
--
-- Same signature, so the 0012 restrictive policy that calls this and its grants
-- (authenticated + service_role, revoked from public/anon) carry over untouched.
-- Before: false only for an elimination room past the lobby. After: false for
-- any room past the lobby. A nonexistent room still returns true, so a bad
-- room id keeps failing on the foreign key (23503) exactly as before rather than
-- as an RLS violation.
--
-- No legitimate flow needs a mid-game insert: a reconnecting player's row
-- survives (0005 permits self-delete only in 'lobby'), and the client already
-- refuses to join a started room.
-- ---------------------------------------------------------------------------
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
      and r.status <> 'lobby'
  );
$$;

comment on function public.room_accepts_new_players(uuid) is
  'False for any room that has left the lobby (both modes, since 0016). SECURITY DEFINER because a joiner is not yet a member and so cannot see the rooms row under its own RLS.';

-- ---------------------------------------------------------------------------
-- 4. start_game_tx resets every player's score and streak.
--
-- 0015's body verbatim; the only edit is the reset UPDATE, placed where
-- start_elimination_game_tx resets the same two columns. With the grant above a
-- client can no longer write them at all, so this covers rows that existed
-- before this migration and keeps "the race starts at zero" true by
-- construction rather than by the grant alone.
-- Signature unchanged, so the service_role-only grants survive; restated below.
-- ---------------------------------------------------------------------------
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

  -- Hardening #1: every race starts at zero, whatever the rows held before.
  update public.room_players
     set score = 0, streak = 0
   where room_id = p_room_id;

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

revoke all on function public.start_game_tx(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_game_tx(uuid, uuid) to service_role;
