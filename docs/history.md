# Session history

## 2026-09-30: rename to Spelling Bee on main

Renamed every user-facing "Spelling Race" to "Spelling Bee", ahead of the
redesign: `index.html` title and meta description, the `<h1>` on ModeSelect and
DifficultySelect, `README.md` and `PRIVACY.md`. The GitHub About description was
updated with `gh repo edit`; homepage and topics were kept.

Kept on purpose: the "Race" mode label, the repo slug, the `/spellingbee/` base,
all `spellingbee:*` localStorage keys, and the `package.json` name.

The meta description said "A word-spelling race game"; "race" is now dropped
there because it described the product, not the mode.

Not done: README screenshots (retaken after the redesign merges).

## 2026-10-04: multiplayer modes and avatar maker spec (plan/multiplayer-modes)

A spec-only session on a new branch off `main`. No code, migrations or edge
functions were changed, and the redesign branch was read with `git show` only.

Read:
- migrations 0001-0020;
- the five edge functions and `_shared/mod.ts`;
- `useMultiplayerGame`, `rooms.ts`, `avatars.ts`, `serverClock.ts`, `tts.ts`
  and `useAnnouncedWord`;
- the redesign's `AvatarPicker`, `Art`, `beeArt.ts`, `standings.ts`, the lobby
  and waiting room, and `RaceResults`;
- HARDENING.md.

The Supabase Realtime limits, the message counting rules and the
authorization caching behaviour were fetched from the Supabase docs on the
same day.

Wrote `docs/multiplayer-modes-spec.md`:
- what exists today, with file citations;
- the avatar data model and its migration while the old client runs;
- Dash, Hourglass and Spotlight, each with an edge-case table;
- timing fairness;
- the live typing feed, with the quota arithmetic;
- migrations 0021-0027 and their tests;
- UI, 13 build stages, and a decisions list.

Choices made without asking (all listed in the spec's §9):
- a Hourglass miss is capped at 4 s rather than costing the full round;
- Spotlight keeps lives;
- a void Dash round uses up one of the five;
- only the tied leaders play sudden death;
- the player's speech rate is kept;
- client-reported timing is rejected in favour of an edge-entry receipt stamp
  measured from a scheduled reveal.

Found in today's code:
- random lead-ins are rolled per client;
- the clock sync takes one sample;
- Elimination still has no timeout fast path.

## 2026-10-04: spec review pass (plan/multiplayer-modes)

Docs only. No code, migrations or edge functions were changed, and the
redesign branch wasn't touched.

**Ten random citations checked.** `Get-Random -SetSeed 20261004` picked ten of
the 42 cited lines in §1, and each was opened at the cited lines on `main`.
- 8 match.
- 2 mismatched, both corrected:
  - the speech-rate citation pointed only at the bounds; it now also cites
    `tts.ts:188-201`, where the saved rate is read;
  - the retention row said guesses go "10 min after" a game. The job runs
    every 10 min, so the true figure is *within* 10 min. The row also missed
    the member-less-lobby rule.

  The table is in the spec, §1.7.

**Ian's decisions recorded,** and every §9 item marked resolved.

**New latency credit** (§4.5):
- the server times echo round trips itself (6 chained calls, 5 samples,
  median);
- it subtracts `min(median/2, 100 ms)`;
- a hostile client can only inflate its own echoes, gaining at most 100 ms;
- the worst-case budget is 100 + 30 + 20 + 10 = 160 ms, under the 200 ms dead
  band;
- Dash now picks the lowest adjusted time, after a 150 ms settle window.
- The cost in Edge invocations is tabulated.

**Region pinning checked** against Supabase's regional-invocation and limits
pages:
- it is available (`forceFunctionRegion`, `x-region`, supabase-js `region`);
- no plan restriction is documented;
- pinned calls aren't re-routed during an outage.

The spec now requires pinning and uses the query parameter. Supabase's Realtime
limits were re-checked: going past the per-second cap disconnects connections,
which is now noted against the feed.

**Avatar tests added:**
- out-of-range colours and hats, nulls, and type errors are rejected;
- the avatar columns can't set score or any game state (a row snapshot; an
  active game in each mode; another player's row; SECURITY INVOKER asserted).

**Build plan reordered:**
- fixes that stand alone first; clock sync was moved before the word start
  because the word start depends on it;
- then avatars, Dash (stopping point A, 12 sessions) and Spotlight (stopping
  point B, 16.5);
- then Hourglass (optional), then the old-mode cleanup;
- about 18 sessions without Hourglass, 22 with it.

The Spotlight screen-reader check is now Ian's own NVDA pass, with setup steps
and a checklist (§8.1).
