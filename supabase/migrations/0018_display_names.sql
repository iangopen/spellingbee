-- 0018_display_names.sql
-- Display names are bounded and filtered by the server (hardening #6).
--
-- Other players see a display_name exactly as typed, and until now the only
-- limit was the client's maxLength={24}: anyone calling the API directly could
-- insert (or later UPDATE, since 0012 grants update on display_name) a name of
-- any length, any content, with control characters. Two layers, both server-side:
--
--   1. A CHECK: 1-24 characters, not blank, no control characters. Structural,
--      so it also holds for the engine and for any future write path.
--   2. A trigger against a blocklist the client cannot read.
--
-- BACKWARD COMPATIBLE: the deployed client trims the name and caps it at 24
-- UTF-16 units, which is never more than 24 code points (what char_length
-- counts). A blocked name reaches the old client as the raw error text
-- "display_name_not_allowed"; the new client turns it into a sentence.

-- ---------------------------------------------------------------------------
-- 1. Length / charset CHECK.
--
-- Existing rows are repaired first so the constraint can be VALIDATED (not
-- NOT VALID): an unvalidated CHECK is still evaluated on every UPDATE, so one
-- legacy 30-character name would make that player's avatar change fail with an
-- error about a column they didn't touch.
-- ---------------------------------------------------------------------------
update public.room_players
   set display_name = coalesce(
         nullif(left(btrim(regexp_replace(display_name, '[[:cntrl:]]', '', 'g')), 24), ''),
         'Player')
 where char_length(display_name) > 24
    or btrim(display_name) = ''
    or display_name ~ '[[:cntrl:]]';

alter table public.room_players drop constraint if exists room_players_display_name_valid;
alter table public.room_players
  add constraint room_players_display_name_valid
  check (
    char_length(display_name) between 1 and 24
    and btrim(display_name) <> ''
    and display_name !~ '[[:cntrl:]]'
  );

-- ---------------------------------------------------------------------------
-- 2. The blocklist lives in a schema PostgREST does not expose, with no grants
--    to any client role. It holds SHA-256 digests, never the terms: the point
--    is that the list is not greppable plain text in a public repository. The
--    hashes are not a secret (short words can be brute-forced) — the access
--    control is. New terms: supabase/scripts/hash_name_terms.mjs, then a NEW
--    migration inserting its output.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.blocked_name_terms (
  digest bytea primary key,           -- sha256 of the normalized term
  len    int  not null check (len >= 3),
  kind   text not null check (kind in ('substring', 'token'))
);

comment on table private.blocked_name_terms is
  'Display-name blocklist as sha256 digests of normalized terms. substring = matched anywhere in the flattened name; token = matched against whole words and against the whole flattened name. Not readable by any client role.';

revoke all on private.blocked_name_terms from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Normalization. Must agree with normalizeTerm() in hash_name_terms.mjs for
-- ASCII input (test:db asserts it).
--   NFKD + lower  full-width and styled letters fold to plain ones, and accents
--                 split off so the strip below keeps the base letter
--   translate     common digit/symbol stand-ins for letters
-- `flat` drops everything but a-z ("F.u-c k" -> one run); the word split keeps
-- boundaries so a short term only matches a whole word.
-- sha256() is core Postgres (11+), so this doesn't depend on which schema
-- pgcrypto was installed into.
-- ---------------------------------------------------------------------------
create or replace function private.name_filter_fold(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(normalize(p, NFKD)), '013457@$!|8', 'oieastasiib')
$$;

create or replace function private.name_filter_flat(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(private.name_filter_fold(p), '[^a-z]', '', 'g')
$$;

create or replace function private.name_is_blocked(p text)
returns boolean
language sql
stable
set search_path = ''
as $$
  with f as (
    select private.name_filter_flat(p) as flat,
           private.name_filter_fold(p) as fold
  ),
  candidates as (
    -- every substring of the flattened name at each length the list uses
    select 'substring'::text as kind, substr(f.flat, i, l.len) as piece
      from f,
           (select distinct len from private.blocked_name_terms where kind = 'substring') l,
           generate_series(1, char_length(f.flat) - l.len + 1) i
    union all
    -- each whole word ...
    select 'token', w
      from f, regexp_split_to_table(regexp_replace(f.fold, '[^a-z]+', ' ', 'g'), ' ') w
     where w <> ''
    union all
    -- ... and the whole name with separators removed ("f.o.o" spelled out)
    select 'token', f.flat from f
  )
  select exists (
    select 1
      from candidates c
      join private.blocked_name_terms t
        on t.kind = c.kind
       and t.digest = sha256(convert_to(c.piece, 'UTF8'))
  )
$$;

revoke all on function private.name_filter_fold(text) from public, anon, authenticated;
revoke all on function private.name_filter_flat(text) from public, anon, authenticated;
revoke all on function private.name_is_blocked(text)  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The trigger. SECURITY DEFINER so it can read the private schema on behalf of
-- a client that cannot; search_path pinned so a caller's objects can't shadow
-- anything it calls. Fires on INSERT and on an UPDATE that touches the name, so
-- an avatar change on a legacy row is never blocked by the name filter.
-- ---------------------------------------------------------------------------
create or replace function public.room_players_check_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.name_is_blocked(new.display_name) then
    raise exception 'display_name_not_allowed'
      using errcode = 'P0001',
            hint = 'Choose a different display name.';
  end if;
  return new;
end;
$$;

revoke all on function public.room_players_check_display_name() from public, anon, authenticated;

drop trigger if exists room_players_check_display_name on public.room_players;
create trigger room_players_check_display_name
  before insert or update of display_name on public.room_players
  for each row execute function public.room_players_check_display_name();

-- ---------------------------------------------------------------------------
-- Seed. Generated by supabase/scripts/hash_name_terms.mjs from a term file that
-- is deliberately not committed.
-- ---------------------------------------------------------------------------
insert into private.blocked_name_terms (digest, len, kind) values
  ('\x120f6e5b4ea32f65bda68452fcfaaef06b0136e1d0e4a6f60bc3771fa0936dd6'::bytea, 6, 'substring'),
  ('\x08a841e996781e9e77d30a4e4420a8f501a280b00624e6d1224bf54aaff73eba'::bytea, 5, 'substring'),
  ('\x8f5083e3e5c7dc8932f2bf58212f963f3a44752618c96297f82623f736c52738'::bytea, 6, 'substring'),
  ('\x6ac3c336e4094835293a3fed8a4b5fedde1b5e2626d9838fed50693bba00af0e'::bytea, 4, 'substring'),
  ('\x396ccc4a28fe20ec37cab2e08ffd5413ba523c10c00da1106197ecc81efb8bfc'::bytea, 7, 'substring'),
  ('\xeef3bd091670c3447022d619c06ad15de96da72b5a66f28bb8b75d1b1c12a05f'::bytea, 7, 'substring'),
  ('\x22fc75e65a0e9d34324092a7c6a8dba961853294abca4e5914e60c550f48e0c2'::bytea, 7, 'substring'),
  ('\x333f7618092958c75b8c5af6f1ec77b42803922a0fc6ff1570a8af3a3aab3b4a'::bytea, 9, 'substring'),
  ('\x6d1833779e389477ac6757e19c371df8e141bd67bc83e4b596dfc8a1947db29d'::bytea, 7, 'substring'),
  ('\x70e4043b678ff365b6377e3ceeb5067bc27bbcd03707e17a36b62bf0201340bc'::bytea, 11, 'substring'),
  ('\xfd70ad909b94deb27b460692084d9f2b1dbc9df3c6bcfd3caee571e707031e3f'::bytea, 6, 'substring'),
  ('\xf50c51ed2315dcf3fa88181cf033f8029cac64f7dea4048327ca032ec102ea74'::bytea, 7, 'substring'),
  ('\xd75a838dc758ba17f28bd8dbac605cb70c35465263d5733164521de2f7ef7926'::bytea, 5, 'substring'),
  ('\xbdb1cc258d6976aafd3a0c3399dfff42a486e63a6948d8bc2e10e7c36fab7611'::bytea, 6, 'substring'),
  ('\x83621b34ec5955e56c07c5b2ed2c87ed8050c3884cd89a1527d06579711e8906'::bytea, 4, 'substring'),
  ('\x9ae315a94e428a7ee3b5e48adae6541965d93b86acf10ffa1c45b93b6fe577b4'::bytea, 5, 'substring'),
  ('\x158869a97379229b7681efae9d7f9c9214134e836d649ba53477c0c111414d59'::bytea, 6, 'substring'),
  ('\x16ea09fc78ca83ca502cbcf2377acdf280bf18f61e259153f0868405eedab5ef'::bytea, 6, 'substring'),
  ('\x12e6274e4309293e2d480272b49a6c7c73a6a6b22678ba226b533c67006c17d1'::bytea, 6, 'substring'),
  ('\xc3de533e9b7fe63b79f648687a30d2861edd92fe7c3cd1f2c485e0a605367624'::bytea, 4, 'token'),
  ('\xa76d588d0047e3b043406060ba6170e2313f46f15a084d680464f881f1efeeb9'::bytea, 6, 'token'),
  ('\xab26f6966ee37fdf3b66775bf6d4f5541ae62ba85301ca534723a68cc7bfeba6'::bytea, 9, 'substring'),
  ('\x3ef0b158edbfe22d12f0b0a9c59e00f7ee84a3f0730ba94c659502f9bb145056'::bytea, 10, 'substring'),
  ('\x7c4a5c242b72a23d999bb2801c6544a368f49a3ab869ef578e171079b44a9ad8'::bytea, 10, 'substring'),
  ('\x06a1d8bf7fc210de23d9540ab35744ae9db310afa0afbabe9529333e175a850f'::bytea, 8, 'substring'),
  ('\x566f532d486c947709d3d0e6b7575af8380248db66dada211d58eb00ad585297'::bytea, 4, 'token'),
  ('\x98b52c4b6b7d1f48e7477a5ccc10955dd195d0ac5a38c8281bfeb08762634909'::bytea, 4, 'token'),
  ('\xf9d0d9b18ae9033a5ea36df19bf279b059e887a9ae785db81117bceaecc95933'::bytea, 5, 'token'),
  ('\xcc02032349c833ac5e97bac094560ed40e09acf34cb1978ab7a9840b9bf15b4d'::bytea, 4, 'token'),
  ('\xe7b98c6aa5b944e0b315d350d423f895ac9e44fb84f1534b18c2572370a67b9e'::bytea, 4, 'token'),
  ('\x3b1e0d7c5dd45583867e897943e37a940a7e7321022317dd3deea01963ee365e'::bytea, 4, 'token'),
  ('\x886d51e97ad7931d0d2af8439ca6d9e4887e3c2b469ed247cbd68ceb3649ccde'::bytea, 4, 'token'),
  ('\x9915ba2d822280f22c283df4e76584a40e0119fc58f73c5f84d4fdb04d04fa6f'::bytea, 3, 'token'),
  ('\x17bde8b4064612e266eaa1b5b1dfa054d1e6dd263f66b392159006d2c9a8ae8a'::bytea, 4, 'token'),
  ('\x85fc17f7069acd39a5c636cd0a6530651096128da447959f5e250824857dc559'::bytea, 4, 'token'),
  ('\xe388b89852d4dbb0ef877a856824ac0f76627ace8f5f171a9178ec3d7eb7eee3'::bytea, 5, 'token'),
  ('\xc2c3b68b48832afd9a4dbdd474c1b6c81c8baecdb71446f9947dac72dd0fe93d'::bytea, 4, 'token'),
  ('\x796e43a5a8cdb73b92b5f59eb50610cea3efa8ce229cd7f0557983091b2b4552'::bytea, 4, 'token'),
  ('\xad505b0be8a49b89273e307106fa42133cbd804456724c5e7635bd953215d92a'::bytea, 4, 'token'),
  ('\xf6952d6eef555ddd87aca66e56b91530222d6e318414816f3ba7cf5bf694bf0f'::bytea, 5, 'token'),
  ('\x0508a634445d401652d06013cdcc95183ab78c58e406cfec6dc58a395958ef2b'::bytea, 6, 'token'),
  ('\x59cc3cb8a42973019cddacdee59e0aa7746ba6c203af78cefb453cb3a1b6610d'::bytea, 4, 'token'),
  ('\x2a6937d721b14cdd7331c1ad1caf6a3cfa37a266650807101d44cdcd0acb132f'::bytea, 4, 'token'),
  ('\x8a2496b950a93110c9af3bee5ee9e600a578574b09d0ceb7104745db0c22e0dd'::bytea, 4, 'token'),
  ('\x96efbc43a462ab9d9c6a8173e5b322e17f218b56eb3a05a4bbc53221adebc7b3'::bytea, 3, 'token'),
  ('\x0f28c4960d96647e77e7ab6d13b85bd16c7ca56f45df802cdc763a5e5c0c7863'::bytea, 5, 'token'),
  ('\xdd92623b0a4b255f87cc4aaee7990ee182d91db49189df6229ce65b5e9d960da'::bytea, 4, 'token'),
  ('\x594810adcbee20bd1d6f8e4cee51efdf1a235691e9d08fe96ce944d7fde34fd6'::bytea, 3, 'token'),
  ('\x8c5c04391361cbf4afd74c5ed8101ea4af881c4ee3b3df1d5b3716a19b1a834d'::bytea, 4, 'token'),
  ('\x7d2969e37aa4ff6030ee5b5b9e60f8689a5bab0a4a24b432d7ee4be157e5f6bd'::bytea, 3, 'token'),
  ('\x429fecdc0e189e9694833581223e1ea9c9e9df38434014057c3a1fade7563475'::bytea, 4, 'token'),
  ('\x6556c1a58444e10f074e59b510fc392d61dd39d04227671272a61617dcecc094'::bytea, 5, 'token'),
  ('\x7902e27065cfa96f685ba02d8168505328e5046a6d39390fb24c0e5d780efa56'::bytea, 4, 'token'),
  ('\x737dd1bca21d67a7c158ed425276b04581e3c2b1f209e25a7cff37d8cb333f0f'::bytea, 4, 'token'),
  ('\x13a465fc6616da8d2afacaf00a8276aa841662820f9337de127f815ee71cc55d'::bytea, 4, 'token'),
  ('\x7e85c676fd97d370e2309003a5681bc4388306979b7db04c37c6fb0672891b6a'::bytea, 5, 'token'),
  ('\xeb9b035455b44ae0c47b89aa899e181f65b6957b95fbe6d724e646e289b8de25'::bytea, 7, 'token'),
  ('\x268651b3ece980102f18871fde07189372961e056f858ca147a28d004f876b03'::bytea, 5, 'token')
on conflict (digest) do nothing;
