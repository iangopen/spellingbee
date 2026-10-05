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

## 2026-10-04: echo protection and the decisions list (plan/multiplayer-modes)

Docs only. No code, migrations or edge functions were changed.

**Supabase docs read today:**
- Edge Function invocations are billed "regardless of the response status
  code";
- on Free, the quota is 500,000 invocations, and API requests are unlimited;
- going over a quota brings a notification, a grace period, then possible 402
  responses, read-only mode or pausing until the next billing cycle;
- the Realtime per-second cap disconnects connections.

**The spec's echo moved from an edge function to a database RPC.** A rate
limit inside a function can't stop rejected calls being billed, so the old
design let one script use up the monthly quota in about 7 hours. The RPC
spends no invocations.

**Protection** (§4.5.1):
- user token, room membership, the pre-start window;
- limits of 8 per round, 120 a minute and 6,000 a day per player, and 64 per
  round and 900 a minute per room, all under an advisory lock;
- worst case per month: one guest, 180,000 served calls and 72 MB of egress
  (1.4%); one hostile room, 1,440,000 calls and 576 MB (11.5%); Edge
  invocations 0 in both cases.

**New limit:** a host may start at most 60 games a day, so one room playing
nonstop can't use up the invocation quota (41 days instead of 5).

**Failure behaviour** (§4.5.2): a failed, throttled or disabled echo zeroes
the credit, and answers never wait on it.

**Runtime switches:** `private.runtime_flags` holds `echo_enabled`,
`live_feed`, `feed_budget_msgs_per_s` and `multiplayer_open`. Each is flipped
with one SQL statement, without a deploy.

**402 handling:** players are told multiplayer is resting until next month;
singleplayer is unaffected.

**Live feed** (§5.3.1): admitted against a 40 msg/s budget at game start,
before the cap that disconnects every connection, plus a manual off switch.
New engines must not rewrite unchanged rows, because today's streak reset
sends about 88 Realtime messages per 8-player round.

**Runbook** (§6.6): a weekly usage check, an estimate query from game rows,
and a response ladder.

**Tests added:**
- non-members and outside-window calls rejected with no rows written;
- every limit throttles;
- the kill switch works;
- a zero credit still scores, including when the sample read fails;
- feed admission;
- the 60-games cap;
- the client never awaits the echo;
- the concurrency limit has a negative control.

**PRIVACY.md wording** for the echo timings is in §5.6.

**§9:**
- new items C10 and D26 to D31;
- C1 and D19 reclassified as engineering;
- 22 items remain Default.

They are listed in plain language in `docs/multiplayer-decisions-for-ian.md`.

## 2026-10-04: answer stamp, cold starts and the echo's flood exposure (plan/multiplayer-modes)

Docs only. No code, migrations or edge functions were changed.

**The earlier lag figures, confirmed:** commit `1b7d1a4` (2026-09-27) measured
the race's `submit-answer` at 309-667 ms warm and about 1.3 s cold. They were
in that commit message only, not in this file or CLAUDE.md, so they are
recorded here. They are client round trips (Enter → reply), not stamp errors.

**Where answers are stamped** (spec §4.5.3):
- today's race: `now()` inside `submit_answer_tx` (`0015:197-198`), after the
  edge function's Auth check (`_shared/mod.ts:45-56,131`) and its PostgREST
  call. Upload, a cold boot, the Auth round trip and the DB hop all count;
- Dash and Hourglass (spec): `Date.now()` at handler entry, which is still
  **after the worker boots**. No in-request time is available before that.
- The echo (database RPC) and the answer (pinned edge function) share the
  player → Supabase leg and one HTTP/2 connection; they differ only inside the
  region. Planning error 10 ms (path) + 10 ms (edge vs DB clock), both already
  in the budget. The credit is valid only with region pinning and with no
  preflight, cold boot or token refresh in front of the answer.

**Found while reading:** most race answers today pay a CORS preflight round
trip. `callEdge` sends non-simple headers (`rooms.ts:300-307`), the functions
set no `Access-Control-Max-Age` (`_shared/mod.ts:20-24`), the browser default
cache is 5 s, and race rounds are 13 s or more apart.

**Supabase docs read today:** a Free worker lives at most 150 s (400 s paid);
published boot times are 42 ms average, 86 ms P95, 460 ms P99 (blog,
2025-07-18); preflights aren't billed; worker reuse across requests isn't
clearly documented. MDN: `Access-Control-Max-Age` caps at 2 h in Chromium 76+
and 24 h in Firefox.

**Fixes specified** (§4.5.4):
- `Access-Control-Max-Age: 7200` on every function, moved into stage 1;
- one warm-up per player per Dash/Hourglass round to the exact answer URL,
  never retried or awaited, switchable by `warmup_enabled`;
- server-side cold detection (`edge_cold`, `edge_boot_ms`) and a boot credit
  capped at 500 ms, switched on (`boot_credit`) only if stage 6 matches it to
  the dashboard's `booted` events within 20 ms;
- the session token refreshed in the pre-start window, not on Enter.

**Budget re-picked:** adding upload jitter (30 ms) left no margin at a 100 ms
cap, so under D7b the cap is now **70 ms** (warm total 170, margin 30; cold
with boot credit 190; cold without it 212 / 256 / 630 at avg / P95 / P99).
The dead band stays at 200 ms. The Dash settle window goes from 150 to
**250 ms**, because the old one left out the edge-to-DB lag spread.

**Invocations with warm-ups:** an 8-player Dash game is 145 (was 81, ~3,450 a
month on Free), Hourglass 361 (was 201, ~1,385). The host daily game cap goes
from 60 to **30**, because 60 × 361 would spend the quota in 23 days; 30 gives
46.

**Flood exposure** (§4.5.5): rejected echo calls cost a transaction, a pool
connection and ~200 B each, and spend no invocations; a sustained flood can
slow every API request and spend egress (~25M calls for 5 GB). Found:
`lock_for` waits (`0019:79-85`), so one guest's parallel calls could pin the
PostgREST pool. The echo now uses a non-waiting `try_lock_for`. Detection and
the defences, with what each does and doesn't protect, are in §4.5.5 and the
runbook.

**Stage 7** gains an answer-time error measurement, cold vs warm, as an A/B on
`warmup_enabled`, with targets: warm spread ≤ 130 ms, cold landings ≤ 2%,
commit-lag spread ≤ 170 ms, no `settled_late` in warm rounds.

**§9:** D32 (cap 70, engineering), D33 (settle 250), D34 (warm-up), D35 (boot
credit), D36 (plumbing, engineering); D30 changed to 30. 25 items are now
Default, all listed in `docs/multiplayer-decisions-for-ian.md`.
