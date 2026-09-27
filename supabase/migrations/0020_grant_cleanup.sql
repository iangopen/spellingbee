-- 0020_grant_cleanup.sql
-- Make the grants say what the comments always claimed (hardening #15, #16).
--
-- #15 round_attempts. 0006's comment says "NO grants", but 0006 never revoked
-- the privileges Supabase hands every new table in public by default. RLS (no
-- policies) still hid every row, so anon's SELECT returned 200 with zero rows
-- rather than 42501. Nothing was exposed, but the table's protection rested on
-- one layer instead of the two 0002 set out to have. No client reads it — every
-- write comes from the service_role SQL functions, which bypass both layers.
revoke all on public.round_attempts from anon, authenticated;

-- #16 constant getters. Postgres grants EXECUTE on every new function to PUBLIC,
-- and Supabase's default privileges grant it to anon as well; 0006/0010/0012 only
-- ever ADDED grants for these, so a caller with no session at all could run them.
-- They are read-only constants and not SECURITY DEFINER, so this is consistency,
-- not a leak. `authenticated` keeps its explicit grants: useMultiplayerGame calls
-- round_seconds / rounds_per_game / feedback_ms / late_grace_ms after the
-- anonymous sign-in, and singleplayer never calls Supabase at all.
-- player_cap() and abuse_limits() are 0019's, which inherited the same defaults.
revoke execute on function public.round_seconds(text)                         from public, anon;
revoke execute on function public.rounds_per_game()                           from public, anon;
revoke execute on function public.late_grace_ms()                             from public, anon;
revoke execute on function public.feedback_ms()                               from public, anon;
revoke execute on function public.avatar_keys()                               from public, anon;
revoke execute on function public.decay_params()                              from public, anon;
revoke execute on function public.decayed_round_seconds(text, int, int, int)  from public, anon;
revoke execute on function public.player_cap()                                from public, anon;
revoke execute on function public.abuse_limits()                              from public, anon;

grant execute on function public.player_cap()   to authenticated, service_role;
grant execute on function public.abuse_limits() to authenticated, service_role;
