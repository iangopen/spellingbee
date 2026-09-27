-- 0017_room_insert_columns.sql
-- A client creating a room may set only what a host actually chooses (§A1).
--
-- 0002 granted `insert on rooms` at TABLE level, and 0012 documented that this
-- makes every column client-settable. The RLS policy pins host_id to auth.uid()
-- and nothing else, so a crafted insert could set:
--
--   created_at             forward-dated past any retention purge (0019 ages
--                          rooms by this column), or back-dated to dodge the
--                          per-host hourly room cap
--   status                 'active'/'finished' at birth: skips the lobby, the
--                          open-room cap and the empty-lobby cleanup
--   round_started_at       with status='active', drops the room into the 0009
--                          race sweeper, which then fails on it every 5 seconds
--   current_round          any value, ahead of the engine that owns it
--   winner_id, current_turn_player_id
--                          any auth user id ("X won" in a pre-finished room)
--   starting_players, table_streak
--                          overwritten at start, but junk until then
--
-- tier / mode / lives_setting are genuine host choices and already have CHECKs.
-- id stays client-settable because the client must know the id of a row it
-- cannot yet SELECT (see createRoom in src/lib/rooms.ts).
--
-- BACKWARD COMPATIBLE: createRoom inserts exactly
-- {id, code, tier, host_id, mode, lives_setting}.
revoke insert on public.rooms from anon, authenticated;
grant insert (id, code, tier, host_id, mode, lives_setting) on public.rooms to authenticated;

-- Invite codes use the client's unambiguous alphabet (no 0/O/1/I/L), so a host
-- can't pick a vanity or offensive code outside it. NOT VALID: enforced for
-- every new row, while rows created before this migration aren't re-checked
-- (they all came from the same generator, but a failed validation would abort
-- the whole migration for no benefit).
alter table public.rooms drop constraint if exists rooms_code_charset;
alter table public.rooms
  add constraint rooms_code_charset
  check (code ~ '^[A-HJKMNP-Z2-9]{4,12}$') not valid;
