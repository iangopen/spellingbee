-- 0021_avatar_parts.sql
-- The avatar maker's data (spec §2 on plan/multiplayer-modes; D17, Ian 2026-10-13/14):
-- a bee COLOUR (0-7) and a COSMETIC (0-13) per player, alongside the legacy
-- `avatar` key, which the deployed client keeps writing until the new one ships.
--
-- The lists are fixed and APPEND-ONLY: a stored number must always mean the same
-- bee. Client copy: src/lib/avatarParts.ts (avatar_parts.test.mjs fails if its
-- lengths or its mapping disagree with this file).
--   colour    0 Honey 1 Red 2 Rose 3 Purple 4 Blue 5 Aqua 6 Green 7 Grey
--   cosmetic  0 None 1 Crown 2 Party hat 3 Flower 4 Sunglasses 5 Headphones
--             6 Bow tie 7 Honey pot 8 Graduation cap 9 Pencil 10 Reading glasses
--             11 Quill 12 Book 13 Letter block
--   (Ian picked BOTH prototype sets: the playful set keeps its prototype indices
--   0-7, the spelling-themed set follows; its Headphones is the same item, 5.)
--
-- COMPATIBLE WITH THE DEPLOYED CLIENT. It inserts exactly {room_id, player_id,
-- display_name, avatar} (src/lib/rooms.ts:119-121 create, :178-180 join),
-- updates only {avatar} (:225-230), and reads an explicit column list
-- (PLAYER_COLUMNS, :52-53), so two new defaulted columns are invisible to it and
-- the sync trigger below fills them in from the key it sends.
--
-- What this changes, in order:
--   1. room_players.avatar_color / avatar_cosmetic: smallint, NOT NULL DEFAULT 0,
--      CHECK 0-7 / 0-13. The server rejects anything else: anyone can call the
--      API directly, so the client's copy of the range is a convenience only.
--   2. room_players_avatar_sync: a BEFORE trigger keeping the key and the numbers
--      consistent in both directions.
--   3. Attach it, and backfill both numbers from each existing key.
--   4. Column grants: INSERT and UPDATE gain exactly these two columns.
--   5. The 0016 backstop now covers EVERY game column on INSERT and on UPDATE.

-- ---------------------------------------------------------------------------
-- 1. The columns. Plain range CHECKs (no lookup function: nothing to grant or
--    revoke, and the client-callable function list stays at 13).
-- ---------------------------------------------------------------------------
alter table public.room_players
  add column avatar_color smallint not null default 0
    constraint room_players_avatar_color_range check (avatar_color between 0 and 7),
  add column avatar_cosmetic smallint not null default 0
    constraint room_players_avatar_cosmetic_range check (avatar_cosmetic between 0 and 13);

comment on column public.room_players.avatar_color is
  'Bee colour index 0-7 (append-only list, src/lib/avatarParts.ts). Client-settable; kept in step with avatar by room_players_avatar_sync.';
comment on column public.room_players.avatar_cosmetic is
  'Cosmetic index 0-13, 0 = none (append-only list, src/lib/avatarParts.ts). Client-settable; kept in step with avatar by room_players_avatar_sync.';

-- ---------------------------------------------------------------------------
-- 2. The sync trigger function.
--
-- The mapping (the backfill in section 2 repeats the forward half once). Forward (old key -> colour, cosmetic):
--   bee (0,0)  queen (0,1)  drone (4,5)  hive (7,7)  honey (0,7)
--   blossom (2,3)  clover (6,3)  wasp (7,0)
-- Reverse (colour, cosmetic -> nearest old key; first rule that matches):
--   cosmetic Crown or Graduation cap -> queen; Headphones -> drone;
--   Honey pot -> hive if Grey, else honey; Flower -> clover if Green, else blossom;
--   otherwise colour Grey -> wasp, Rose -> blossom, Green -> clover, else bee.
-- All 8 old keys round-trip (forward then reverse returns the same key).
--
-- Which side wins:
--   INSERT  a non-default pair (anything but 0,0) wins and sets the key (the new
--           client sends numbers only); a default pair is filled from the key
--           (the old client sends the key only; (0,0) and 'bee' agree anyway).
--   UPDATE  numbers changed -> the key follows them (the numbers win, even if
--           the key changed too); only the key changed -> the numbers follow it.
--           Fires only when one of the three columns is in the SET list.
--
-- SECURITY INVOKER (the default; it needs no privilege of its own), search_path
-- empty, and it ONLY ever assigns new.avatar, new.avatar_color and
-- new.avatar_cosmetic. It runs no statement, so it cannot touch another column,
-- another row or itself: a BEFORE trigger that only edits NEW can't recurse.
-- ---------------------------------------------------------------------------
create or replace function public.room_players_avatar_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from_key boolean;
begin
  if tg_op = 'INSERT' then
    v_from_key := new.avatar_color = 0 and new.avatar_cosmetic = 0;
  elsif (new.avatar_color, new.avatar_cosmetic) is distinct from (old.avatar_color, old.avatar_cosmetic) then
    v_from_key := false;
  elsif new.avatar is distinct from old.avatar then
    v_from_key := true;
  else
    return new;
  end if;

  if v_from_key then
    new.avatar_color := case new.avatar
      when 'drone' then 4 when 'hive' then 7 when 'blossom' then 2
      when 'clover' then 6 when 'wasp' then 7 else 0 end;
    new.avatar_cosmetic := case new.avatar
      when 'queen' then 1 when 'drone' then 5 when 'hive' then 7 when 'honey' then 7
      when 'blossom' then 3 when 'clover' then 3 else 0 end;
  else
    new.avatar := case
      when new.avatar_cosmetic in (1, 8) then 'queen'
      when new.avatar_cosmetic = 5 then 'drone'
      when new.avatar_cosmetic = 7 then case when new.avatar_color = 7 then 'hive' else 'honey' end
      when new.avatar_cosmetic = 3 then case when new.avatar_color = 6 then 'clover' else 'blossom' end
      when new.avatar_color = 7 then 'wasp'
      when new.avatar_color = 2 then 'blossom'
      when new.avatar_color = 6 then 'clover'
      else 'bee' end;
  end if;
  return new;
end;
$$;

comment on function public.room_players_avatar_sync() is
  'Trigger: keeps room_players.avatar (legacy key) and avatar_color/avatar_cosmetic consistent both ways (0021). Assigns only those three fields of NEW; runs no statements.';

revoke all on function public.room_players_avatar_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Attach the trigger, then backfill existing rows from their key.
--
-- The backfill writes the forward table a second time (the trigger can't be
-- asked to re-read an unchanged key). It runs once, here; avatar_parts.test.mjs
-- builds rows with every old key at 0020, applies this file and checks each
-- against the trigger's own mapping. Writing the numbers fires the trigger,
-- which re-derives each key from them; the mapping round-trips, so every key
-- comes back unchanged (also tested).
-- ---------------------------------------------------------------------------
drop trigger if exists room_players_avatar_sync on public.room_players;
create trigger room_players_avatar_sync
  before insert or update of avatar, avatar_color, avatar_cosmetic on public.room_players
  for each row execute function public.room_players_avatar_sync();

update public.room_players
   set avatar_color = case avatar
         when 'drone' then 4 when 'hive' then 7 when 'blossom' then 2
         when 'clover' then 6 when 'wasp' then 7 else 0 end,
       avatar_cosmetic = case avatar
         when 'queen' then 1 when 'drone' then 5 when 'hive' then 7 when 'honey' then 7
         when 'blossom' then 3 when 'clover' then 3 else 0 end
 where avatar <> 'bee';

-- ---------------------------------------------------------------------------
-- 4. Column grants.
--
-- THIS WIDENS THE room_players COLUMN GRANTS THAT 0016 SAID NEVER TO WIDEN,
-- deliberately and by exactly two columns, both cosmetic like `avatar`, both
-- range-CHECKed. Nothing else is added: insert stays (room_id, player_id,
-- display_name, avatar) + the two; update stays (display_name, avatar) + the two.
-- What keeps it safe, each pinned by supabase/tests/avatar_parts.test.mjs:
--   * the CHECKs reject every value outside the lists;
--   * the sync trigger writes only the three avatar fields;
--   * the backstop (section 5) rejects any client row whose game columns are not
--     the defaults on INSERT, or that CHANGES a game column on UPDATE;
--   * RLS still pins insert and update to the caller's own row (0002).
-- ---------------------------------------------------------------------------
grant insert (avatar_color, avatar_cosmetic) on public.room_players to authenticated;
grant update (avatar_color, avatar_cosmetic) on public.room_players to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The backstop, widened to EVERY game column and to UPDATE.
--
-- 0016's version checked score, streak, turn_order and is_eliminated on INSERT.
-- Now that the client can write more columns, it covers every column that isn't
-- the player's own choice (display_name, avatar, avatar_color, avatar_cosmetic)
-- or the row's identity:
--   INSERT  score 0, streak 0, lives 3, is_eliminated false, turn_order null,
--           connected_at = now() (the default; now() is fixed per transaction)
--   UPDATE  none of those may change, and neither may room_id or player_id
-- Still keyed on the invoking role, so the engine (SECURITY DEFINER functions
-- run as their owner, edge functions as service_role) is exempt.
-- Fires after room_players_avatar_sync (BEFORE triggers run in name order), so
-- it checks the row as the sync trigger left it.
-- ---------------------------------------------------------------------------
create or replace function public.room_players_client_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.score <> 0
       or new.streak <> 0
       or new.lives <> 3
       or new.turn_order is not null
       or new.is_eliminated
       or new.connected_at <> now() then
      raise exception 'room_players: game columns are server-only'
        using errcode = '42501';
    end if;
  elsif (new.room_id, new.player_id, new.score, new.streak, new.lives,
         new.turn_order, new.is_eliminated, new.connected_at)
        is distinct from
        (old.room_id, old.player_id, old.score, old.streak, old.lives,
         old.turn_order, old.is_eliminated, old.connected_at) then
    raise exception 'room_players: game columns are server-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.room_players_client_defaults() is
  'Trigger: rejects a client room_players INSERT whose game columns are not the defaults, and a client UPDATE that changes any game or identity column. Backstop for the column grants (0016, widened to every game column and to UPDATE in 0021).';

revoke all on function public.room_players_client_defaults() from public, anon, authenticated;

drop trigger if exists room_players_client_defaults on public.room_players;
create trigger room_players_client_defaults
  before insert or update on public.room_players
  for each row execute function public.room_players_client_defaults();
