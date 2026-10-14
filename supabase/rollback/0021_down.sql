-- 0021_down.sql — undo supabase/migrations/0021_avatar_parts.sql.
--
-- NOT a migration: it lives outside supabase/migrations, so `supabase db push`
-- can never run it. Run it by hand (SQL editor, or psql) only to roll 0021 back.
-- supabase/tests/avatar_parts_rollback.test.mjs applies 0001-0021, runs this,
-- and checks the catalog (tables, columns and their grants, constraints,
-- triggers, functions and their ACLs, policies) is identical to a fresh 0001-0020.
--
-- Data: the two avatar columns are dropped. The legacy `avatar` key on every row
-- is kept (the sync trigger kept it current), so players keep a sensible bee and
-- the deployed client is unaffected.
--
-- After running it, delete the 0021 row from supabase_migrations.schema_migrations
-- (the production steps in CLAUDE.md say how) so a later push re-applies 0021.

begin;

drop trigger if exists room_players_avatar_sync on public.room_players;
drop function if exists public.room_players_avatar_sync();

-- Dropping the columns drops their CHECKs and their column grants with them.
alter table public.room_players
  drop column if exists avatar_color,
  drop column if exists avatar_cosmetic;

-- The backstop exactly as 0016 created it (INSERT only, four game columns).
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

commit;
