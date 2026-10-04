# Multiplayer modes and avatar maker: spec

Status: **spec only** (2026-10-04, branch `plan/multiplayer-modes`, cut from `main` at `8b979dc`).
Reviewed by Ian on 2026-10-04: every decision in §9 is resolved, timing gained a server-measured latency
credit (§4.5), region pinning was checked against Supabase's docs (§4.4.1), and the build plan was
reordered with two stopping points (§8).
No code and no migrations were written. Every statement about current behaviour cites the file it
comes from. Paths without a branch are on `main`; paths marked *(redesign)* are on
`redesign/spelling-bee` and were read with `git show`, not checked out.

The three new modes get original names:

| # | Ian's idea | Name | One line |
|---|---|---|---|
| 1 | Fastest correct typist wins the round; first to 3, up to 5 rounds | **Dash** | Everyone gets the same word; first correct answer takes the round. |
| 2 | A stock of seconds; lose the gap to the fastest correct player | **Hourglass** | Everyone answers every word; the slower you are, the more sand you lose. |
| 3 | One player at a time, watched live; clock shrinks, resets on a miss | **Spotlight** | One speller on stage, everyone watching them type. |

"Race" and "Elimination" are the two existing modes. Dash replaces Race in the lobby and Spotlight
replaces Elimination (see Decisions D1).

Contents

1. What exists today
2. Avatar maker
3. Mode rules and edge cases (Dash, Hourglass, Spotlight)
4. Fairness and cheating in the timed modes
5. Spotlight's live typing feed
6. Data and security changes
7. UI
8. Build stages
9. Decisions and conflicts

---

## 1. What exists today

### 1.1 Shared machinery

| Fact | Where |
|---|---|
| Game logic lives in plpgsql functions granted to `service_role` only. Edge functions only authenticate the caller (`getCallerId`) and forward to `rpc()`. | `supabase/migrations/0006_round_engine.sql:4-21,486-492`, `supabase/functions/_shared/mod.ts:45,65` |
| The client sends only `{room_id, round_num, guess}`. No correctness flag and no timing. | `supabase/functions/submit-answer/index.ts:1-35`, `src/lib/rooms.ts:352-370` |
| Correctness check: `lower(btrim(guess)) = lower(word)`, server-side. | `0006_round_engine.sql:285`, `0012_elimination_engine.sql:1005` |
| One attempt per player per round, enforced by the `round_attempts` primary key. The table is server-only. | `0006_round_engine.sql:57-75,287-296`, `0020_grant_cleanup.sql:10` |
| Words are secret until their round starts: the `round_results` row is inserted in the same transaction as the round bump. | `0006_round_engine.sql:23-29,194-201` |
| **Once a round starts, any member can read the word text.** The client fetches `words` by `word_id`, and `words` is readable by every signed-in user. A scripted client knows the answer at t=0. | `src/hooks/useMultiplayerGame.ts:267-270`, `0002_rls.sql:85-92` |
| Tunable constants: `late_grace_ms()` = 750, `feedback_ms()` = 1100. | `0006_round_engine.sql:110-124` |
| Round length per tier: novice 22, easy 20, building 18, medium 16, advanced 14, hard/expert/master 13 s. | `0010_eight_tiers.sql:53-66` |
| Server clock: `server_now()` RPC. The client measures its offset once per session from one sample (RTT/2) and ticks against `serverNow()`. | `0008_server_now.sql:16-26`, `src/lib/serverClock.ts:32-59` |
| Realtime: one `postgres_changes` channel per room (`mp:<roomId>`) on `rooms`, `round_results`, `room_players`. RLS scopes rows to members. Every change triggers a full `refresh()`. No broadcast or presence is used anywhere. | `useMultiplayerGame.ts:436-458`, `0004_realtime.sql:21`, `0007_realtime_rounds.sql:33,40` |
| Speech: each client picks its own **random** lead-in ("Try spelling this:" … "Next word:"), speaks it, then the word. The rate is the player's own setting (0.5 to 1.4), and the lead-in is spoken 0.1 faster. The announcement starts 200 ms after the word renders. | `src/lib/tts.ts:16-32,188-201,304-355`, `src/hooks/useAnnouncedWord.ts:37-42` |
| Joining: nobody joins a room past the lobby, in any mode. | `0016_score_integrity.sql:86-98`, `0012_elimination_engine.sql:417-423` |
| Leaving: self-delete only in `lobby`. A mid-game leaver's row stays, and their rounds or turns time out. | `0005_self_leave.sql`, CLAUDE.md "Leaving mid-game" |
| Limits: 8 players per room, 3 open rooms per host, 20 rooms created per host per hour. Empty lobbies are deleted. | `0019_abuse_limits_retention.sql:48-213` |
| Retention (`pg_cron` jobs on `abuse_limits()` values): guesses of finished games are deleted by a job every 10 min, so **within** 10 min of the end. Every 10 min, rooms over 30 days old, lobbies over 24 h and member-less lobbies over 10 min are deleted. Anonymous users over 30 days old that no game row references are deleted daily. | `0019_abuse_limits_retention.sql:54-68,221-262,277-301,327-345` |
| Client `INSERT` on `room_players` is limited to `(room_id, player_id, display_name, avatar)`. `UPDATE` is limited to `(display_name, avatar)`. A trigger rejects non-default game columns. | `0016_score_integrity.sql:32-70`, `0012_elimination_engine.sql:359` |
| Room creation is limited to `(id, code, tier, host_id, mode, lives_setting)`. | `0017_room_insert_columns.sql:27-28` |
| `test:db` pins the exact list of 13 functions a guest may execute. | `supabase/tests/grants.test.mjs:38-59` |

### 1.2 Race (mode `race`)

| Aspect | Behaviour | Where |
|---|---|---|
| Start | Host only, 2+ players, scores and streaks zeroed, round 1 word picked, `rooms.round_started_at = now()` | `0016_score_integrity.sql:113-187` |
| Timing | `elapsed = now() at the SQL call − rooms.round_started_at`. Rejected if over `round_seconds(tier)` plus 750 ms grace. | `0015_race_mode_guards.sql:136-262` (body of `0006:220-337` plus the mode guard) |
| Round winner | The first correct submission claims the round with `UPDATE … WHERE winner_id IS NULL`. Because every player shares one start time, this is **arrival order at the database**. | `0006_round_engine.sql:304-320` |
| Scoring | Winner only: `10 + whole seconds left`. Streak = consecutive rounds won. Everyone else's streak is reset on advance. | `0006_round_engine.sql:322-330,437-442` |
| Wrong answer | Uses up your one attempt. The round continues for everyone else. | `0006_round_engine.sql:298-302` |
| Advance | Single path, `advance_round_tx`. A won round is held 1100 ms for feedback; an unwon one ends at limit plus grace. The host's client asks at +150 ms and the others at +1600 ms. The `pg_cron` sweeper runs every 5 s. | `0015_race_mode_guards.sql:264+`, `useMultiplayerGame.ts:586-663`, `0009_round_sweeper.sql:58-150` |
| End | 10 rounds (`rounds_per_game()`) or the tier's unused words run out. The winner is shown by score on the client; no server winner field. | `0006_round_engine.sql:100-104,446-452`, *(redesign)* `src/lib/standings.ts` |
| Skip | None (`skipWord` is a no-op, button hidden) | CLAUDE.md "Rules this hook must keep" |

### 1.3 Elimination (mode `elimination`)

| Aspect | Behaviour | Where |
|---|---|---|
| Start | Host only, 2+ players. A random fixed rotation (`turn_order`), lives from `lives_setting` (1 to 9, default 3), counters reset. | `0012_elimination_engine.sql:296-297,505-622` |
| Clock | Lives on `round_results.turn_started_at` plus this row's frozen `round_seconds`. `rooms.round_started_at` stays NULL so the race sweeper never sees the room. | `0012_elimination_engine.sql:32-48,594-608` |
| Turn | Only the holder may answer (`not_your_turn`, `eliminated`, `stale_round`, `turn_not_started` and `turn_expired` are all rejected). | `0012_elimination_engine.sql:898-1032` |
| Outcome | One function, `apply_turn_outcome`. Correct: `10 + whole seconds left` of this turn, plus streak. Wrong or timeout: −1 life, and table streak to 0. 0 lives: eliminated. | `0012_elimination_engine.sql:646-886` |
| Decay | `decayed_round_seconds(tier, N, remaining, table_streak)`. A player-count cut (from ceil(N/2) survivors, 10% then +5% each, max 30%, none at N=2) times a streak cut (−10% at a streak of 5, −25% at 9). Clamped once to [6 s, base]. | `0012_elimination_engine.sql:106-275` |
| Feedback | Folded into the next turn's clock: it starts `feedback_ms` in the future. | `0012_elimination_engine.sql:856-867` |
| End | One survivor left; or words run out (most lives, then most score; a tie is a NULL draw). | `0012_elimination_engine.sql:741-810` |
| Timeouts | `timeout_turn_tx` plus the 5 s sweeper. **No client fast path:** there is no `timeout-turn` edge function, so an abandoned turn waits up to about 5 s past its deadline. | `0012_elimination_engine.sql:1052+`, `0014_elimination_sweeper.sql:74-158`, `useMultiplayerGame.ts:604-625` |

### 1.4 Avatars today

| Fact | Where |
|---|---|
| There are 8 fixed keys: `bee, queen, drone, hive, honey, blossom, clover, wasp`. One SQL definition, `avatar_keys()`. | `0012_elimination_engine.sql:73-93` |
| `room_players.avatar text not null default 'bee' check (avatar = any(avatar_keys()))` | `0012_elimination_engine.sql:343-345` |
| A client may set the avatar on insert and update (the column grants above). An off-list key fails the CHECK. | `0016_score_integrity.sql:33`, `0012_elimination_engine.sql:359`, `src/lib/rooms.ts:210-233` |
| `avatar_keys()` is revoked from anon and executable by `authenticated`. | `0020_grant_cleanup.sql:24`, `grants.test.mjs:46` |
| The client's one copy of the list, `coerceAvatar` (unknown values fall back to `bee`), is asserted equal to the database by `verify_elimination_client.mjs`. | `src/lib/avatars.ts:13-82` |
| Remembered locally as `spellingbee:avatar` | `src/lib/storage.ts:46-60` |
| *(redesign)* Art: each key is a hand-drawn bee from fixed path data. `wasp` is a body variant, `drone` has big eyes, and five keys are a bee plus one accessory. Colours are tokens only (`--bee-body`, `--bee-stripe`, `--mark`, …). | *(redesign)* `src/lib/beeArt.ts` |
| *(redesign)* Picker: a `role="radiogroup"` of 8 buttons (`AvatarPicker`). `AvatarBadge` carries the label as a `title`. The art is `aria-hidden`. | *(redesign)* `src/components/AvatarPicker.tsx`, `src/components/ui/Art.tsx` |

### 1.5 How much of Dash and Spotlight already exists

**Dash is about 70% built: it is Race with a different finish line.** Already in place: the
shared-word round, server-measured timing, the atomic first-correct claim, one attempt, feedback
window, advance path, sweeper, `RoundScreen`, and the race results screen.

Missing:
- round-win counting, first to 3, the 5-round cap and sudden death;
- the fairness changes in §4: a scheduled reveal, edge receipt stamps, a human floor, and
  fixed-length announcements.

**Spotlight is about 75% built: it is Elimination with a different clock and a live feed.**
Already in place: the rotation, lives, the elimination rule, the frozen per-turn clock, the
feedback fold, sweeper, `TurnScreen` with spectators, knockout, and results.

Missing:
- the shrink-and-reset clock rule;
- the live typing feed (no broadcast exists anywhere yet);
- the `timeout-turn` fast path, an existing gap.

**Hourglass is new.** Nothing scores every player per round, and nothing stores a per-player time
bank.

### 1.6 Existing issues this work must fix, found while reading

1. **Lead-ins differ between devices.** Each client rolls its own random lead-in (`tts.ts:344-348`),
   so in a race different players hear phrases of different lengths before the same word. That is
   up to about 0.5 s of unfairness today.
2. **The speech rate is a per-player setting**: a saved rate clamped to 0.5–1.4, otherwise 0.85, or
   0.90 for the default voice (`tts.ts:16-18,188-201`). So the word finishes at different
   moments on different devices.
3. **The clock sync is one sample** (`serverClock.ts:36-47`). One slow or asymmetric round trip
   skews it.
4. **Elimination has no client timeout fast path** (`useMultiplayerGame.ts:604-625`).

### 1.7 Citation spot-check (2026-10-04, review pass)

I picked ten cited statements from §1 at random (PowerShell `Get-Random -Count 10 -SetSeed
20261004` over the 42 lines in §1 that carry a `file:line` citation). For each, I opened the cited
lines on `main` and compared them with the claim.

| # | Statement (§1) | Cited | Result |
|---|---|---|---|
| 1 | Elimination decay: a player-count cut from ceil(N/2), 10% then +5%, max 30%, none at N=2; a streak cut of −10% at 5 and −25% at 9; one clamp to [6 s, base] | `0012:106-275` | **Match** (lines 114-142, 247-268) |
| 2 | Only the turn holder may answer; `not_your_turn`, `eliminated`, `stale_round`, `turn_not_started` and `turn_expired` are rejected | `0012:898-1032` | **Match** (lines 947-999) |
| 3 | 8 fixed avatar keys, one SQL definition `avatar_keys()` | `0012:73-93` | **Match** |
| 4 | Round length per tier, from 22 s down to 13 s | `0010:53-66` | **Match** |
| 5 | The client sends only `{room_id, round_num, guess}` | `submit-answer/index.ts:1-35`, `rooms.ts:352-370` | **Match**. The file is 36 lines; the range covers the handler. |
| 6 | Race start: host only, 2+ players, scores and streaks zeroed, word picked, `round_started_at = now()` | `0016:113-187` | **Match** (lines 141-176) |
| 7 | The speech rate is a per-player setting | `tts.ts:16-18` | **Mismatch (citation incomplete).** Lines 16-18 hold only the default and bounds; the saved per-player rate is read at 188-197. **Fixed:** cited 188-201, and the default (0.85, or 0.90 for the default voice) is stated. |
| 8 | A client may set the avatar on insert and update; an off-list key fails the CHECK | `0016:33`, `0012:359`, `rooms.ts:210-233` | **Match** |
| 9 | Retention: "guesses 10 min after a game ends", rooms 30 days, lobbies 24 h, anon users 30 days | `0019:221-345` | **Mismatch (wording).** Guesses are deleted by a job that runs every 10 min, i.e. *within* 10 min, not *at* 10 min. The member-less-lobby rule (10 min) was missing, and the day counts live in `abuse_limits()` (54-68), outside the cited range. **Fixed:** the row is reworded and the citation widened. |
| 10 | Elimination start: host only, 2+ players, random rotation, lives 1–9 default 3, counters reset | `0012:296-297,505-622` | **Match** (lines 537-607) |

8 match, 2 mismatched, both corrected. Neither mismatch changes any rule in §2–§8.

---

## 2. Avatar maker

### 2.1 What the player does (the interaction pattern)

skribbl.io's picker has a big character preview with a pair of arrows per feature row. We take
that **interaction pattern only**: no art, colours, layout or name from skribbl.io. The character
is the redesign's own bee *(redesign)* `beeArt.ts`, drawn for this project.

```
            ┌─────────────┐
            │   (bee in   │
            │  top hat)   │
            └─────────────┘
   [ ◀ ]    Colour: Plum  (5 of 8)    [ ▶ ]
   [ ◀ ]    Hat: Top hat  (6 of 10)   [ ▶ ]
            [ Surprise me ]
     "Plum bee in a top hat"
```

The old 8-choice radiogroup and its distinct bee types (wasp body, big-eyed drone) are removed.
Every avatar is the same bee, customised by **colour** and **hat**.

### 2.2 Data model

Two small integers per player, both indexes into fixed lists:

| Column (`room_players`) | Type | Default | Range |
|---|---|---|---|
| `avatar_color` | `smallint not null` | 0 (Honey) | 0 to `colors − 1` |
| `avatar_hat` | `smallint not null` | 0 (No hat) | 0 to `hats − 1` |

There is one definition, an immutable SQL function in the shape of `avatar_keys()`:

```sql
create function public.avatar_options() returns jsonb language sql immutable
as $$ select jsonb_build_object('colors', 8, 'hats', 10) $$;
```

The CHECKs read it:
`check (avatar_color between 0 and (avatar_options()->>'colors')::int - 1)` and the same for hats.

**Indexes are append-only.** A value is never reordered or reused. A retired item stays in the
list and is drawn as a fallback, so a stored index always means the same thing. That is the price
of ints over keys. It buys a compact row, trivial CHECKs and arrow arithmetic with no lookup.

Starting lists (names are spoken, see §2.5):

| # | Colour (token pair, both palettes) | Hat |
|---|---|---|
| 0 | Honey (`--av-honey`, today's `--bee-body`) | No hat |
| 1 | Amber | Party hat |
| 2 | Clover | Beanie |
| 3 | Sky | Flower |
| 4 | Plum | Straw hat |
| 5 | Rose | Graduation cap (it's a spelling bee) |
| 6 | Slate | Top hat |
| 7 | Cream | Headphones |
| 8 | | Paper crown |
| 9 | | Bow |

- Colours are 8 new body tokens (`--av-0` … `--av-7`), each added to **both palettes in the same
  edit** (CLAUDE.md colour rule). Stripes, outline and eyes keep their existing tokens.
- Each body colour must reach **3:1 against `--bee-line`** (the outline) in both themes, so the
  shape reads.
- Colour is never the only way to tell players apart, because every avatar sits next to a name.
- Hats are new fixed path data in `beeArt.ts` (the same hand-placed style, no runtime jitter),
  drawn to sit above the head inside the existing `12 4 76 90` viewBox. The two flower-and-clover
  style accessories that exist today are redrawn as hats 3 and 8, so no art is lost.
- `avatarSvg(color, hat)` replaces `avatarSvg(key)`. It is still memoised, and still a string built
  only from constants.

### 2.3 Server-side validation

- **Range:** enforced by the two CHECKs above. There is no edge function: avatars aren't a game rule
  (the same reasoning as `rooms.ts:210-224`).
- **Column grants (new migration):**
  - `grant insert (room_id, player_id, display_name, avatar, avatar_color, avatar_hat)`
  - `grant update (display_name, avatar, avatar_color, avatar_hat)`

  Both are revoked and re-granted, never widened table-wide. This touches the 0016 rule "never widen
  these grants". The two columns are cosmetic, like `avatar`, and the change is flagged in
  Decisions C1.
- **The 0016 backstop trigger is unchanged.** It guards game columns only, and these aren't game
  columns.
- `avatar_options()` is revoked from `public` and `anon` and granted to `authenticated`. The
  `grants.test.mjs` list becomes 14 names.
- **Client copy:** `src/lib/avatars.ts` exports `AVATAR_COLORS` and `AVATAR_HATS` (name lists).
  `test:db` reads those array lengths and fails if they differ from `avatar_options()`, the same
  pattern as `PLAYER_CAP` (`rooms.ts:55-59`). `coerceAvatarPart(n, max)` falls back to 0 for an
  unknown index, like `coerceAvatar`.

### 2.4 Storage and migration while the old client still runs

The deployed client (main or redesign) inserts and updates `avatar` (a key) and knows nothing about
the new columns. The plan:

1. **Migration A (additive):**
   - Add both columns with defaults.
   - Backfill them from the existing `avatar` key with a fixed mapping:

     | old key | colour | hat |
     |---|---|---|
     | `bee` | Honey | none |
     | `queen` | Honey | Paper crown |
     | `drone` | Sky | Headphones |
     | `hive` | Amber | Beanie |
     | `honey` | Amber | none |
     | `blossom` | Rose | Flower |
     | `clover` | Clover | Flower |
     | `wasp` | Slate | none |

   - Add a `BEFORE INSERT OR UPDATE` sync trigger on `room_players`:
     - If the row's `avatar` changed and the parts did NOT (an old client), derive the parts from
       the mapping.
     - If the parts changed and `avatar` did not (a new client), derive `avatar` as the nearest
       legacy key: hat Paper crown → `queen`, Flower → `blossom`, Headphones → `drone`, Beanie →
       `hive`; else colour Slate → `wasp`, Amber → `honey`; else `bee`.
     - If both changed, the parts win.

     Old and new clients in the same room then each see a sensible avatar.
   - Extend the rollback file to drop the trigger, the function and the columns.
   - **Fully compatible:** an old client's insert names only legacy columns, and the parts fill
     themselves in.
2. **The new client** writes the parts (and lets the trigger keep `avatar`), and reads the parts.
3. **Migration Z, the retirement stage, months later** (after the 30-day room retention has
   cycled past the last old-client room and a deploy has replaced every cached bundle):
   - drop the sync trigger;
   - keep `avatar` and `avatar_keys()` as dead-but-harmless columns, or drop them in a
     separately rolled-back migration;
   - remove `verify_elimination_client.mjs`'s key check.

   This doesn't block anything.

**localStorage:**
- New keys `spellingbee:avatar:color` and `spellingbee:avatar:hat`.
- On the first read, when they are missing, they are derived from the legacy `spellingbee:avatar`
  key with the same mapping.
- The legacy key is left in place (harmless, and rollback-friendly).
- The `spellingbee:` prefix rule holds.

### 2.5 Keyboard behaviour and spoken description

Structure (one `AvatarMaker` component, used in the lobby and the waiting room):

- `<fieldset>` with `<legend>` "Your bee".
- Per row: `<div role="group" aria-labelledby="row-label">` containing:
  - `<button aria-label="Previous colour">` (lucide `ChevronLeft`, aria-hidden)
  - `<span id="row-label">Colour</span>`, then a value `<span>` "Plum, 5 of 8"
  - `<button aria-label="Next colour">`
- A "Surprise me" `<Button>` (random colour and hat, never the current pair).

Keys:

| Key | Effect |
|---|---|
| Tab / Shift+Tab | Moves through: Colour prev, Colour next, Hat prev, Hat next, Surprise me. Every control is a real button. |
| Enter / Space on an arrow | Steps one item. Wraps at both ends (8 → 1, 1 → 8), as skribbl does. |
| ← / → while either button in a row has focus | Same as prev/next, so a keyboard player can sit on one button and arrow through. Focus does NOT move. |
| Home / End in a row | First or last item |

There is deliberately no ↑/↓ binding, so a row never traps vertical page scrolling.

- **Targets:** each arrow is at least 44×44 px. The hit area is its layout box (no clip-path), and it
  is measured with `elementFromPoint` anyway, per the redesign rule.
- **Focus ring:** the one `ui.css` focus rule; never a per-component outline.

**Spoken description:** one function, `describeAvatar(color, hat)` in `lib/avatars.ts`:
- "Plum bee in a top hat", "Honey bee" (no hat), "Sky bee with headphones".
- Per-hat preposition table, so the phrases read naturally.

Where it is used:
- **Preview:** a polite live region under the preview carries the description. It changes once per
  step: one short phrase per key press, never per animation frame.
- **Waiting-room roster:** "Sam, host, plum bee in a top hat" (the avatar art stays `aria-hidden`).
- **In-game tokens and lanes:** name only. The description isn't repeated every turn.
- **`AvatarBadge` `title`:** the description, replacing the old key label.

**Motion:** a hat change may do a 150 ms hop. Its resting state is the drawn avatar, so the global
reduced-motion block removes it with no information lost.

**Where it lives:**
- The lobby's "You" panel, replacing `AvatarPicker`.
- The waiting room, replacing `AvatarPicker` (it writes through `updateAvatar(roomId, {color, hat})`,
  optimistic as today, *(redesign)* `WaitingRoom.tsx`).
- Not in-game: the picker would steal focus from play.

---

## 3. Modes

### Common to all three

- Players: **2 to 8** (`player_cap()`, `0019:48-52`). Start is host only, from the lobby, with 2 or
  more players.
- Joining only in `lobby` (`0016:86-98`); no spectator joins.
- One attempt per round or turn (the `round_attempts` PK).
- Correctness is decided only by the server.
- All timing is server-measured (see §4).
- **Leaving mid-game is a forfeit, not a special event.** The row stays (0005), your rounds or turns
  resolve as "no answer", and the game does not know or care whether you closed the tab or lost
  signal. Same principle as Elimination (CLAUDE.md, Session 20).
- **Presence (who has the tab open) is never used for a game rule.** It is client-asserted, so it is
  cosmetic at most. See D14.
- **Words run out** (about 150 per tier, `pick_unused_word`): the game ends by the mode's tiebreak
  below. This is degenerate, not expected.
- **Word-only announcement at a scheduled reveal** (all three modes), detailed in §4:
  - a 1.5 s "Get ready" countdown, then the word alone at the same server instant on every device;
  - no spoken lead-in (the lead-in is shown as text during the countdown instead);
  - "Hear it again" stays (`repeatWord`).

### 3.1 Dash (mode `dash`)

**Rules**
1. Each round, everyone gets the same word at the same reveal instant.
2. The correct answer with the lowest **adjusted** time wins the round. The adjusted time is the
   server-measured time minus the player's server-measured latency credit (§4.5).
   - The round is awarded 150 ms after the first correct arrival (the 100 ms credit cap plus 50 ms),
     or as soon as every contender has an attempt, whichever is first. This is because a later
     arrival can still have the lower adjusted time.
   - It is +1 to that player's `round_wins`.
   - Points, if shown at all, are not used for ranking.
3. A wrong answer uses up your attempt for that round. You wait out the round.
4. **First to 3 round wins ends the game at once.**
5. Regular play is **at most 5 rounds**. A round nobody gets right is **void**: no one wins it, and it
   *does* use up one of the five (D5).
6. After round 5, if exactly one player leads on round wins, they win (for example 2–1–1 or 2–1–0).
7. **Sudden death:** if two or more players share the lead after round 5 (2–2, 1–1–1, or 0–0 after
   five void rounds), only the **tied leaders** keep playing.
   - Each sudden-death round is a normal round, but only contenders may submit (`not_contending`
     otherwise). The others watch with the input absent, like non-holders in `TurnScreen`.
   - The first sudden-death round with a winner ends the game: that winner now leads uniquely.
   - A void sudden-death round just repeats.
8. Sudden death is capped at **10 rounds** (`dash_params()`). After that the game is a **draw**
   between the tied leaders (`winner_id NULL`, same honesty rule as Elimination's draw).

**Timing:** the tier's `round_seconds` (`0010:53-66`). After a winner, the round holds for the 1.1 s
feedback window, then advances, exactly as Race does today.

**Edge cases**

| Case | What happens |
|---|---|
| Two correct answers with the same adjusted time | The earlier `round_attempts.created_at` wins. Resolution runs once, inside `close_round_tx` under the room lock, with the `ended_at IS NULL` conditional update (the `0006:304-320` pattern), so exactly one winner is recorded however many clients and sweepers ask. |
| Second correct answer arrives inside the 150 ms settle window with a bigger latency credit | It can win: the comparison is on adjusted time. That is the purpose of the window. |
| Correct but below the human floor (§4.4) | Refused as `too_fast` **before** the word is compared, so it reveals nothing. The attempt is NOT used up; the player may resubmit. |
| Wrong answer | Attempt used. "Not quite — wait for the next word." The word is not revealed until the round ends (the hardening #13 rule in `announce.ts`). |
| Nobody answers before the deadline | Void round. It uses up a regular slot; in sudden death it repeats. |
| Everyone answers wrong before the deadline | The round **closes early** as void (no need to wait out the clock). `close_round_tx` checks "every contending player has an attempt". |
| Player leaves or disconnects | Their rounds go unanswered. They can still hold wins already earned, and if they are a tied leader after round 5 they are a contender who never answers, so the others can win sudden death. |
| All but one player leave | The remaining player keeps playing. Each round they answer correctly is a win, so they reach 3 (or lead after 5). Rounds they miss are void. |
| Only contenders left are absent | Sudden-death rounds are void until the 10-round cap, then a draw. (Bounded: at most 10 × round length.) |
| Host leaves | Nothing special. Advancement already falls back to any member (`useMultiplayerGame.ts:592-595`), and the sweeper covers an empty room. |
| Late join | Refused (`0016`). |
| Player reaches 3 in round 3 | The game ends immediately; rounds 4 and 5 are not played. |
| Words run out | Finish: a unique leader wins, otherwise a draw. |
| 2 players, 2–2 after round 4 | Round 5 decides it: whoever wins it has 3. A void round 5 leads to sudden death between both. |
| Stale or replayed submission | `stale_round` (existing guard). |

**Results screen** (on the redesign's `RaceResults` pattern):
- **Winner card:** the rosette, "Dash winner" (or "A draw"), and the winning score in round wins
  ("3 rounds to 1").
- **Standings:** ranked by `round_wins`, with ties sharing a place (`standings.ts` already does
  this; rank on `round_wins` instead of `score`). Each lane shows win pips (●●●○○) and the name.
- **Round list** (collapsed `<details>` on phones), one line per round:
  - "Round 2 — *accommodate* — Sam, 2.4 s"
  - "Round 4 — *rhythm* — no one"
  - sudden-death rounds are marked.

  All of it is read from `round_results` (winner, `response_time_ms`) and `words`, after the game,
  when revealing words is fine.
- **The viewer's line:** "You won 1 round."

### 3.2 Hourglass (mode `hourglass`)

**Rules**
1. Everyone starts with a bank of **10.0 s** (`hourglass_params().start_bank_ms = 10000`).
2. Each round, every standing player gets the same word at the same reveal and has one attempt.
3. The round closes when every standing player has submitted, or at the deadline plus grace.
4. Let **F** be the fastest correct **adjusted** time this round: server-measured time minus the
   capped latency credit (§4.5). Each standing player's
   **charge** is:
   - correct at time t: `t − F` (the fastest pays 0);
   - wrong, missing or timed out: `min(L − F, miss_cap)`, where L is the round limit and
     `miss_cap` is **4.0 s** (decided by Ian on 2026-10-04 in place of "the full round time", to be
     tuned with real players in stage 12; D7).
   - Then the fairness rounding from §4.7 is applied: differences under the **dead band (200 ms)**
     are charged 0, and every charge is rounded to the nearest **100 ms**.
5. **If nobody answers correctly, nobody is charged** (Ian's rule). The round is void.
6. A bank at or below 0 is **knocked out**: the player becomes a spectator.
7. The last player with time left wins.
8. **Guaranteed survivor:** whenever charges happen, someone was fastest-correct and paid 0, so
   at least one player always survives a round. "Everyone knocked out at once" cannot happen. State
   it in a code comment and test it.
9. **Length cap:** at most **30 rounds** (`max_rounds`). After that, the most time left wins; an
   exact tie is a draw. This keeps two evenly matched experts from playing 60 rounds of 0.1 s
   charges.

**Edge cases**

| Case | What happens |
|---|---|
| Two players tie exactly for fastest | Both pay 0. F is a value, not a person. |
| A difference within the dead band | 0 charge, by design (§4.7). |
| Below the human floor | `too_fast`, not used up, as in Dash. |
| Wrong answer early | The attempt is used. The round stays open for others; you see "Waiting for the others". |
| Player leaves or disconnects | A missing answer each round costs `miss_cap` (4 s) when someone else is right, so they are out within 3 rounds. The game never needs to detect leaving. |
| Everyone standing misses | Void, nobody pays (Ian's rule). The round still counts toward the 30-round cap. |
| Only absent players and one active player | The active player answers correctly and pays 0, while the absent ones pay 4 s each round, so the active player wins. If the active player also misses, the round is void. |
| Several players hit ≤ 0 in the same round | All are knocked out together. Their placement among themselves is by final bank (less negative = higher), and an exact tie shares the place. The fastest-correct player is never among them. |
| Round closing early | It closes as soon as every *standing* player has an attempt. Knocked-out players are not waited for. |
| Late join | Refused |
| Words run out | Most time left wins; a tie is a draw. |
| Charge larger than the bank | The bank is stored as is (it may go negative) for honest placement, but displayed as "0.0 s, out". |

**Results screen:**
- **Winner card:** "Last sand standing: Sam, 3.4 s left" (or a draw).
- **Standings:** survival order (last out places highest), the same principle as Elimination's
  results (CLAUDE.md Session 20). Each lane has a small hourglass bar of the time left at the
  finish, or the round they ran out.
- **Round table** (collapsed): per round, the word, F, and each player's charge ("−0.4 s", "miss
  −4.0 s", "fastest"). From the new `round_scores` table (§6).
- **The viewer's line:** "You lasted 14 rounds and were fastest 5 times."

### 3.3 Spotlight (mode `spotlight`)

**Rules**
1. As Elimination today: a random fixed rotation, one turn holder, lives from `lives_setting`
   (1 to 9, default 3); a wrong answer or a timeout costs a life; 0 lives eliminates; last standing
   wins (`0012:646-886`).
2. **Clock:** each turn's length is
   `spotlight_round_seconds(tier, streak) = greatest(min_seconds, round(base × shrink^streak))`, where:
   - `streak` is the table's consecutive correct answers (the existing `rooms.table_streak`, which
     already resets on any miss or timeout, `0012:716-738`);
   - `shrink` = **0.94** per correct turn;
   - `min_seconds` = 6.

   So the clock shrinks slightly with every correct turn **by anyone** and snaps back to full on any
   miss. On a 16 s tier that runs 16, 15, 14, 13, 12, 12, 11, … down to the 6 s floor after
   16 straight correct turns. The value is frozen on the turn row when the turn opens, as today, and is read by
   clients rather than computed (CLAUDE.md, Session 9b rule).
3. Elimination's player-count trigger does **not** apply in Spotlight (D9). One understandable rule:
   "every correct turn tightens the clock; any miss resets it."
4. **Live feed:** everyone in the room sees the holder's input as they type it, with a live speed,
   ephemeral and stored nowhere (§5).
5. Scoring (for display only, not placement): unchanged, `10 + whole seconds left`.

**Edge cases**

| Case | What happens |
|---|---|
| Holder's time runs out | Timeout: one life, streak and clock reset. Resolved by the new `timeout-turn` fast path (any watcher's client, ~150 ms) or the 5 s sweeper. |
| Holder leaves or disconnects | Their turns time out (one life each) until they are eliminated: the existing forfeit rule. The feed simply shows nothing for that turn ("Waiting for Sam…"). |
| Holder submits during the feedback window | `turn_not_started` (existing, `0012:983-991`) |
| Non-holder submits | `not_your_turn` (existing) |
| A spectator or eliminated player tries to broadcast typing | Their send policy only lets them send on their **own** topic (§5.2). Clients render only the current holder's topic, so the message is ignored. Cosmetic either way. |
| Feed messages arrive after the turn ended | Dropped: every message carries `round_num`, and clients drop anything not equal to the current open turn. |
| Feed drops or is rate-limited | No effect on the game. The feed area shows "Live view unavailable", and the turn resolves by the server as always. |
| Single player left | The game ends (`elimination_survivors() <= 1`, existing). |
| Lives 1 and the last two both miss | Can't happen at once: turns are sequential, so the first miss ends the game. The NULL-winner draw stays only for words running out (existing). |
| Late join | Refused |
| Words run out | The existing rule (lives, then score; else a draw) |
| Very long streak | The clock floors at 6 s. A run of 16+ correct turns stays at 6 s until a miss. |

**Results screen:** the existing `EliminationResults` layout *(redesign)* (winner card, survival
standings, "placement is survival order, not score"), plus two facts read from `round_results`:
- the longest table streak and the shortest clock reached ("The clock got down to 7 s");
- each player's fastest correct turn ("Sam's best: 2.1 s, 74 WPM", from `lib/wpm.ts`).

---

## 4. Fairness and cheating in the timed modes

### 4.1 What is being measured

**The time from a single server-chosen reveal instant to the moment the server receives the
answer.** Both endpoints are server facts. This is already the race's model (`0006:271-275`); this
section tightens where each endpoint is taken and removes the per-device differences in between.

### 4.2 Where the clock starts for everyone: a scheduled reveal

The round row is written with `turn_started_at = now() + preroll_ms` (1500 ms), so the reveal is
in the future. Elimination already does this for its feedback fold (`0012:856-867`).

| Step | Detail |
|---|---|
| Clients learn of the round | The `round_results` insert arrives over Realtime, typically 50 to 300 ms later. |
| Clients wait | Every client shows "Get ready 3 · 2 · 1" against the synced server clock (`serverClock.ts`), and at `turn_started_at` speaks the word and shows the definition and input. |
| Download latency drops out | Every client started at the same server instant, however late it heard about the round, as long as it heard within 1.5 s. |
| A client that hears late (over 1.5 s) | It starts late and loses that time. The countdown already shows the true remaining time (`useMultiplayerGame.ts:533-584`). Rare, visible, and not exploitable. |

**The new modes never write `rooms.round_started_at`.** Their clocks live on
`round_results.turn_started_at` plus `round_results.round_seconds`, as Elimination's do, so the
0009 race sweeper never selects them (the CLAUDE.md "interlock is the data shape" rule).

**Better clock sync** (client only): at game start, take 5 `server_now()` samples and keep the one
with the smallest round trip (NTP-style). Re-sync once per 10 rounds. On a normal connection the
expected error is under 20 ms. One sample is what ships today (`serverClock.ts:36-47`).

### 4.3 Speech differences between devices

| Source of difference | Size (expected) | Handling |
|---|---|---|
| Random lead-in per client (`tts.ts:344-348`) | up to ~0.5 s | **Removed.** Timed modes speak the word only, at the reveal. The lead-in is shown as text during the countdown. |
| `useAnnouncedWord`'s 200 ms paint delay (`useAnnouncedWord.ts:40`) | 200 ms, the same everywhere | Removed for scheduled reveals: the word renders before the reveal, so audio starts at the reveal instant. |
| Speech rate setting, 0.5 to 1.4 (`tts.ts:16-18`) | ~0.1 to 0.4 s on one word | **Kept** (D11). It is an accessibility setting, open to everyone, and the definition is on screen from the reveal, so typing can start before the audio ends. |
| Voice engine start-up (local vs cloud voices) | ~0 to 0.5 s, device dependent | **Not compensated** (see §4.6). Measured in the Dash real-player test (stage 7). The Settings voice list may later mark local voices "best for timed modes". |
| `cancel()` settle (`tts.ts:255-283`) | 0 or 60 ms | Nothing is speaking at a reveal (the countdown is silent), so the 0 ms path is taken. |

### 4.4 Who measures elapsed time, and the bounds

**Options considered:**

| Option | Cheat-proof | Latency bias | Verdict |
|---|---|---|---|
| A. Server receipt − server reveal (today's model) | Yes: the client controls nothing but when it sends | Upload latency, plus the edge function's path to the DB | **Chosen** (with B's stamp point) |
| B. Same, but **stamped at edge-function entry** (`Date.now()` as the first line of the handler, before auth) and passed to SQL as `p_received_at` | Yes: the edge code is ours, and the stamp is server-observed | Upload latency only. It removes `getUser()` and edge→DB time (~20 to 150 ms, region dependent) from the measurement. | **Chosen** |
| C. Client measures (`performance.now()` from reveal to submit) | **No**: any number can be sent | None | Rejected |
| D. Server time minus a **client-claimed** latency credit, capped | Bounded, but a cheater simply claims the cap | Reduced for honest far players | Rejected. The number is whatever the client says. |
| E. Clock starts at the client's "audio started" event | No: the client can report any instant | Removes voice start-up | Rejected for the same reason |
| F. B, minus a **server-measured** latency credit: the server times echo round trips itself, takes the median, and subtracts a capped one-way estimate (§4.5) | Bounded. A client can only make its echoes *slower*, so its gain is at most the cap. | Removes upload latency up to the cap | **Chosen with B** (resolved 2026-10-04) |

**Rules for B:**
- SQL accepts `p_received_at` only within `[now() − 3 s, now() + 50 ms]`, so a clock or stamp
  fault fails loudly rather than scoring.
- **Every game call is pinned to the database's region** (verified available, §4.4.1). Then every
  stamp, echo and submission is taken by the same regional pool of edge machines, and the
  edge-to-DB clock skew is one constant for all players, which `t − F` cancels.

#### 4.4.1 Region pinning: checked against Supabase's docs (2026-10-04)

From the "Regional invocations" page:
- By default, "Edge Functions automatically execute in the region closest to the user making the
  request".
- A call can be pinned three ways:
  - `region: FunctionRegion.<Region>` in supabase-js;
  - an `x-region: <region>` header;
  - a `forceFunctionRegion=<region>` query parameter, "for requests where headers cannot be added".
- The docs list 15 regions.
- **Neither that page nor the Edge Function limits page mentions any plan restriction**, so this is
  available on Free as far as the published docs say.

One caveat is stated in the docs: "When you explicitly specify a region via the x-region header,
requests will NOT be automatically re-routed to another region" during an outage. For this game
that costs nothing, because the database lives in that region anyway and a game can't run
without it.

What changes in the spec:
- **D20 is resolved:** pinning is no longer "if available". It is **required** for the latency
  credit in §4.5, because echo stamps and answer stamps must come from the same clock pool to be
  comparable.
- **Use the query parameter,** not the header. `callEdge` (`src/lib/rooms.ts:286-322`) calls `fetch`
  directly, and a new custom header would need adding to the functions' CORS allow-list. A query
  parameter needs no CORS change. Preflights aren't billed in any case (Supabase usage docs).
- **The project's region** is read once from the dashboard (Project Settings → General) in stage 6
  and stored as `VITE_SUPABASE_FN_REGION`. That isn't a secret; it is like the URL.
- If a future plan change ever removed pinning, the fallback is to **turn the latency credit off**
  (cap 0, one constant). Answers are then still stamped at edge entry, which is option B alone, and
  the dead band absorbs region-to-region clock skew. The spec would lose §4.5's compensation for
  slow connections and nothing else.

**Human floor (lower bound):**
`floor_ms(word) = reaction_ms + per_char_ms × length(word)`, with `reaction_ms = 300` and
`per_char_ms = 50` (`timing_params()`). That is 450 ms for "cat" and 900 ms for a 12-letter word,
below anything a person does after hearing a word (a 200 WPM burst is about 60 ms per character,
before any reaction time).
- An answer under the floor returns **`too_fast` before the guess is compared to the word**.
  Otherwise "too fast" vs "wrong" would be an oracle.
- No `round_attempts` row is written, so the attempt is not used up, and a human who somehow beats
  the floor just presses Enter again.
- The floor is relative to the reveal, so reading the word early (it is delivered before the
  reveal, §4.2) gains nothing below it.
- The floor is compared with the **adjusted** time (after the §4.5 credit), so the credit can never
  be used to slip under it.

**Upper bound:**
- Accept answers up to `round_seconds × 1000 + late_grace_ms` (existing).
- The **measured value is capped at the limit** for scoring and charging, so the grace can never
  produce a charge longer than a miss.
- A late arrival is `round_expired` (existing).

**What the floor cannot do (stated plainly):**
- The client must receive the word to speak it, so a scripted client that waits until just past the
  floor and then submits will beat most humans.
- Without server-generated audio (no audio files here, by the sfx and tts rules) this cannot be
  closed.
- The floor stops instant bots. Turnstile on sign-in, the room caps and private rooms by code
  limit the rest.
- The spec does not claim more.

### 4.5 Server-measured latency credit (added 2026-10-04)

**Goal:** a player on a slower connection is not charged for the time their answer spends on the
network. Without this, upload latency (player → edge) is the one network delay §4.2 and §4.4 B
still count.

**How the server measures each player's round trip itself:**

1. **The echo endpoint.** A new edge function, `echo`, pinned to the DB region (§4.4.1).
   - **First line of the handler:** `T2 = Date.now()`, before auth or anything that awaits.
   - **Auth:** verify the caller's JWT (needed to bind the sample to a player).
   - **Then, if the request carries a challenge token:** verify its HMAC-SHA256 signature. The secret
     is a new edge secret, `ECHO_SECRET`, and the token binds `room_id`, `player_id` and the
     server's `T1`.
     - If it verifies, the sample is `rtt = T2 − T1`.
     - Return a **signed sample receipt** `{room_id, player_id, T1, T2}`.
   - **Last line before responding:** `T1' = Date.now()`, put into a fresh signed challenge.

   **Both ends of every sample are server stamps.** The sample spans "server sent the challenge" to
   "server received it back", which is one network round trip plus the client's turnaround. Auth
   time falls outside it.
2. **When it runs.** During the 1.1 s feedback window and the 1.5 s "Get ready" countdown before
   each reveal (§4.2), the client chains 6 echo calls back to back, giving 5 samples. It answers each
   challenge immediately. These windows are dead time for the player anyway.
3. **What is subtracted.**
   - With the answer, the client sends its latest receipts.
   - The submit edge function verifies each receipt's signature, room and player, and that its `T2`
     is in the 15 s before this answer's `received_at`.
   - It takes the **median** of the valid `rtt`s and computes
     `credit = min(median_rtt / 2, CAP)`, with `CAP = 100 ms`.
   - It passes `p_latency_credit_ms` to SQL.
   - With **fewer than 3 valid receipts, the credit is 0.** There is no credit without evidence, and
     an honest client always has 5.
4. **Adjusted time** = `(p_received_at − reveal) − credit`, floored at 0. It is compared with the
   human floor (§4.4) and used for the Dash winner and Hourglass charges. Spotlight doesn't use it:
   no answer is ever compared with another player's, and its 750 ms grace already covers the
   deadline.
5. **Stores nothing.** Receipts are stateless signed tokens that live in the client for 15 s. No
   table, no new retention job, nothing for PRIVACY.md. `round_scores` records the applied
   `credit_ms` beside `response_time_ms`, so stage 7's test can study it.

**Exposure (stated plainly):**
- A hostile client cannot make a sample *shorter* than its real network round trip. It can't answer
  a challenge before receiving it, and both stamps are inside the server's signature.
- It **can** make samples longer by holding each challenge before replying, and so claim a credit up
  to the cap however good its connection is.
- **Its gain per round is at most `CAP − its true one-way delay` ≤ 100 ms.** Replaying another
  player's receipts fails the player binding, and stale receipts fail the 15 s window.

**Choosing the cap and the dead band together.** The dead band (200 ms, Ian's decision) is the
difference Hourglass treats as noise. The rule is that a cheater's maximum gain, plus the honest
measurement error, must fit inside it, so cheating can never manufacture a charge difference the
band would otherwise count.

| Item in the 200 ms budget | Worst case (ms) | Why |
|---|---|---|
| Cheater's maximum unearned credit (= CAP) | **100** | Delays echoes to claim the full cap |
| Error of the RTT/2 one-way estimate for an honest player | 30 | Up/down asymmetry; the median of 5 rejects outliers |
| Device start skew from clock sync (5-sample min-RTT) | 20 | §4.2 |
| Edge stamp jitter within one pinned region | 10 | Different machines, NTP-synced |
| **Total** | **160** | |
| **Dead band** | **200** | **Margin: 40 ms** |

Why 100 and not another cap:

| CAP | Who is fully compensated (one-way = RTT/2) | Budget total | Fits 200 ms? |
|---|---|---|---|
| 50 ms | Wired and Wi-Fi only (one-way 10–50) | 110 | Yes, but 4G players keep up to ~30 ms of uncompensated delay |
| **100 ms** | **Wired, Wi-Fi and typical 4G/5G (one-way 30–80)** | **160** | **Yes** |
| 150 ms | Also poor mobile | 210 | **No**: a cheater plus normal error can exceed the band |

Planning figures for one-way delay to a same-continent region:
- wired 10–30 ms;
- home Wi-Fi 20–50 ms;
- 4G/5G 30–80 ms;
- poor mobile or another continent 100–200 ms.

These are estimates, to be **measured in stage 7** (`round_scores.credit_ms`). A player beyond the cap
is compensated 100 ms and keeps the rest: still better than today, where they keep all of it.

**What the exposure means in play:**
- **Hourglass:** each round, a cheater can at most turn a true gap of up to 300 ms (band plus cap) into
  0, or shave 0.1 s (one quantum) off a larger charge. Over a 20-round game that is at most 2 s of a
  10 s bank. That is real but bounded, and it needs a modified client. The band itself is unchanged.
- **Dash:** there is no band, so the credit decides rounds closer than 100 ms. A cheater wins those
  close rounds, and only those. The 150 ms settle window (§3.1) is what makes the credit usable in
  Dash: the winner is picked by adjusted time once every answer that could still win has arrived.

**Cost in Edge Function invocations.** Each echo is an invocation; Supabase counts 500,000 a month on
Free and 2,000,000 on Pro, and doesn't bill preflights. Per player per round: 6 echo calls plus
1 submit, about 7; plus about 2 `close-round` calls per room per round.

| Game | Invocations | Games a month on Free | on Pro |
|---|---|---|---|
| Dash, 8 players, ~8 rounds: 8 × 7 × 8 + 2 × 8 | 464 | ~1,077 | ~4,310 |
| Hourglass, 8 players, ~20 rounds: 8 × 7 × 20 + 2 × 20 | 1,160 | ~431 | ~1,724 |
| Dash, 4 players, ~6 rounds: 4 × 7 × 6 + 2 × 6 | 180 | ~2,777 | ~11,111 |

If this ever binds, drop to 3 samples (4 echo calls, still a median); that removes 2 of the 7 calls
per player per round.

### 4.6 How latency bias is limited (summary)

| Bias | Before | After |
|---|---|---|
| Realtime download of the round | Counted (the race starts the clock at the commit) | **Removed** (scheduled reveal) |
| Edge auth plus edge→DB | Counted | **Removed** (stamp at entry, pinned region) |
| Upload latency, player → edge | Counted | **Credited up to 100 ms** by server-measured echoes (§4.5). Beyond that, still counted. |
| Clock-sync error | One sample | 5-sample min-RTT, under 20 ms typical |
| Voice start-up | Counted | Still counted. Measured in stage 7 (Dash test); the Hourglass dead band absorbs small cases. |

### 4.7 Hourglass subtracts small differences: how it stays fair

Hourglass is the mode where 0.1 s matters, because charges add up. Five rules:

1. **Same zero for everyone.** Every time is `p_received_at − turn_started_at − credit`, against
   one reveal instant. F and t come from the same pinned clock pool, so `t − F` cancels any
   constant offset (edge-to-DB skew, the reveal itself).
2. **Integer milliseconds in SQL**, no floats. Banks are `int` ms.
3. **Dead band:** if `t − F < 200 ms`, the charge is 0. This absorbs the measurement error and the
   bounded cheating exposure in §4.5, so two players who are effectively tied are treated as tied.
4. **Quantum:** charges are rounded to the nearest 100 ms and shown to one decimal ("−0.4 s"), so the
   screen never claims more precision than the measurement has.
5. **Miss cap:** a miss costs at most `miss_cap` (4 s), so one network hiccup that turns into a
   timeout can't end your game on its own (D7).

These are all `hourglass_params()` tunables. The Hourglass real-player test (stage 12) logs the
distribution of `t − F` and of `credit_ms` between players on different devices (server-side, in
`round_scores`). It then tunes `miss_cap` and confirms the 200 ms band before Hourglass leaves its
feature flag.

### 4.8 Dash: adjusted time, settled

Dash no longer awards the round to the first arrival. Once the latency credit exists, a later
arrival can have the lower adjusted time.
- The round is settled by `close_round_tx` 150 ms after the first correct arrival (CAP plus 50 ms), or
  as soon as every contender has an attempt.
- The winner is the lowest adjusted time, with ties going to the earlier attempt. It is recorded once
  with the conditional-update pattern from `0006:304-320`.
- The cost is 150 ms of extra wait before the feedback appears, inside the existing 1.1 s window.
- The residual (voice start-up, delay beyond the cap) decides only genuinely close rounds. That is
  documented, not hidden (D12).

---

## 5. Spotlight's live typing feed

### 5.1 Transport: ephemeral Broadcast, nothing stored

- **Supabase Realtime Broadcast**, not `postgres_changes`. No table, no row, no log written by the
  app. A keystroke is never stored.
- One **private** channel per player per room: topic `typing:<room_id>:<player_id>`, created with
  `{ config: { private: true, broadcast: { self: false, ack: false } } }`.
- **Payload:** `{ r: round_num, s: seq, t: text, ms: client_elapsed }`.
  - `t` is capped at 40 characters (the longest bank word is well under that).
  - `ms` is display-only and is never sent to the server's scoring (§4.4 C).
- **Sender (the holder only):**
  - sends on every input change, throttled to at most one message per **250 ms**;
  - always sends the latest state (coalesced, no queue);
  - sends a final message on submit;
  - nothing while idle.
- **Receivers:** subscribe at game start to every dealt player's topic. Render only the topic whose
  `player_id` equals `rooms.current_turn_player_id` and whose `r` equals the open turn. Drop
  out-of-order `s`.

### 5.2 Only room members, verified sender

Realtime Authorization uses RLS on `realtime.messages`. Policies are evaluated **when a client joins
a channel, and cached for the connection** (Supabase docs, Realtime Authorization). So:

- **Receive** (`for select`): the topic's room id must be a room the caller is a member of. Uses
  `is_room_member()` (`0002:32-51`).
- **Send** (`for insert`): the topic's room id must be the caller's room, **and the topic's
  player id must be `auth.uid()`**, and `extension = 'broadcast'`. A player can only ever speak on
  their own topic, so receivers know who typed without trusting the payload.
- Policies can't check "is it your turn" per message (the cache), which is why turn ownership is
  enforced on the receiving side by the topic and `current_turn_player_id`. The worst a member can
  do is type on their own topic, which nobody renders out of turn.
- **A parsing helper:**
  - `public.typing_topic_ok(p_topic text, p_send boolean) returns boolean`, SECURITY DEFINER,
    `search_path` pinned;
  - it parses `typing:<uuid>:<uuid>`, checks membership and that the room's mode is `spotlight` and
    its status `active`;
  - it is revoked from `public` and `anon`.

  Every new function needs an explicit revoke (CLAUDE.md, 0020).
- Spectators and eliminated players can receive; that is the point of watching.

### 5.3 Message volume against the Supabase quotas

Published limits (Supabase docs, fetched 2026-10-04; the project is on the Free plan, per the audit's
"free-tier DB", HARDENING #5):

| Limit | Free | Pro |
|---|---|---|
| Messages per month | 2,000,000 | 5,000,000, then $2.50 per million |
| Messages per second (project) | 100 | 500 |
| Concurrent connections | 200 | 500 |
| Channel joins per second | 100 | 500 |
| Channels per connection | 100 | 100 |

**Counting rules** (Supabase docs):
- A broadcast counts 1 sent plus 1 per receiving client.
- A database change counts 1 per listening client.

The docs don't say whether the per-second limit counts received messages; this assumes it does
(worst case).

**Feed, per broadcast,** with N players in the room and `self: false`: `1 + (N − 1) = N` messages.

| | N = 2 | N = 4 | N = 8 |
|---|---|---|---|
| Messages per broadcast | 2 | 4 | 8 |
| Peak rate while typing (4 sends/s × N) | 8/s | 16/s | **32/s** |
| Rooms typing at once before the 100/s Free cap | 12 | 6 | **3** |

**Feed, per turn:** a planning figure of 10 sends (an ~8-letter word typed in ~2.5 s plus
corrections, capped at 4/s, plus 1 final).

| | N = 2 | N = 4 | N = 8 |
|---|---|---|---|
| Feed messages per turn (10 × N) | 20 | 40 | 80 |

**Database changes per turn** (unchanged from Elimination): the turn close (`round_results`
UPDATE), the next turn (INSERT), the room bump (`rooms` UPDATE), and the holder's row
(`room_players` UPDATE), so 4 changes × N listeners.

| | N = 2 | N = 4 | N = 8 |
|---|---|---|---|
| DB messages per turn (4 × N) | 8 | 16 | 32 |
| **Total per turn** | 28 | 56 | 112 |

**Per game** (3 lives; turns ≈ needed misses ÷ miss rate; with a 30% miss rate, the N−1 players
times 3 lives give 3(N−1) misses, so turns ≈ 10(N−1)):

| | N = 2 | N = 4 | N = 8 |
|---|---|---|---|
| Turns | ~10 | ~30 | ~70 |
| Messages per game | 280 | 1,680 | 7,840 |
| Games per month within Free's 2,000,000 | ~7,100 | ~1,190 | **~255** |
| … within Pro's 5,000,000 | ~17,800 | ~2,980 | ~640 |

**Baseline for comparison, today's Race** (N = 8, 10 rounds):
- per round: a winner UPDATE, the next-round INSERT, a `rooms` UPDATE, the winner's score, and the
  streak reset rewriting the other 7 `room_players` rows, so about 11 changes × 8 = 88;
- that is about **880 per game**.

So an 8-player Spotlight game costs about 9 Race games, and the feed is 71% of it. Dash costs the
same as Race.

**Hourglass:**
- Its `round_scores` table is deliberately **not** published to Realtime. Clients read it in the
  `refresh()` they already run on every `rooms` change.
- So a round is N bank updates plus 3, which is 11 × 8 = 88 per round at N = 8.
- That is about **1,760 per 20-round game**.

**Conclusions:**
- The monthly quota is not the constraint at hobby scale.
- **The 100 messages-per-second cap is.** Three simultaneous 8-player Spotlight rooms typing at once
  reach it.
- Supabase's limits page (re-checked 2026-10-04) says what happens past the cap: "Connections will be
  disconnected if your project is generating too many messages per second", followed by automatic
  reconnection.
  - That drops **every** Realtime subscription on those connections, including the `postgres_changes`
    the game runs on, not just the feed.
  - The game survives it: `refresh()` re-reads everything on reconnect, and the sweepers keep rounds
    moving.
  - But it is visible, which is why the kill switch below exists.
- **Mitigations (in the spec):**
  - the 250 ms throttle;
  - change-only sends;
  - no presence;
  - a **kill switch**: `spotlight_params()->>'live_feed'` is read by clients at game start. Setting
    it false (a one-line migration) stops all feed traffic, and dropping the INSERT policy enforces
    that server-side.
- If real use grows, move to Pro (500/s) or raise the throttle to 400 ms (20/s at N = 8).
- The Spotlight test (stage 10) reads the actual counts from the Supabase dashboard's Realtime usage report rather than
  trusting these estimates.

### 5.4 Screen readers

- **The feed text is `aria-hidden="true"`.** A screen reader never hears keystrokes. One message per
  250 ms would be unusable, and it would read the holder's misspellings aloud.
- One **visually hidden, static** line beside it: "Sam is spelling. Live view of their typing is
  shown on screen." It is announced once, when the turn changes, by TurnScreen's existing
  `role="status"` region (CLAUDE.md, Session 20).
- **Outcome:** the existing announcement ("Sam: correct" / "Sam missed — the word was …").
- Live speed is visual only. The official time arrives with the outcome and is announced there
  ("2.4 seconds").
- The holder's own field is the normal `AnswerField`. Nothing about the feed touches it.

### 5.5 Live speed

- **chars/s, and WPM by `lib/wpm.ts`'s convention**, computed by receivers from the message `ms`
  values. Labelled "live".
- The official time (server-measured) replaces it when the turn resolves.
- It is never stored or sent to the server, so it can't move a score even if a client lies about it.

### 5.6 What PRIVACY.md must say (same commit as the feed)

Add under **Multiplayer**:

> In Spotlight, what you type on your turn is shown live to the other players in your room as you type it, including mistakes you then delete. It travels through Supabase Realtime and is not stored. Your final answer is stored like any other guess.

Also bump "Last checked against the code". Nothing else changes:
- the avatar parts replace "avatar" and are covered by the existing sentence;
- `round_scores` holds scores and timings, already covered by "scores … every guess with its timing";
- retention is unchanged (§6.4).

---

## 6. Data and security changes

### 6.1 Principles carried over

- New migrations only, numbered from **0021**.
- Each one is backward compatible with the client deployed at the time it ships.
- Each has a matching section in a new rollback file, `supabase/rollback/0021-00NN_down.sql`, plus a
  `rollback.test.mjs` assertion (CLAUDE.md: "Any new migration must extend this file and its test").
- Game state changes only in `service_role` plpgsql functions.
- Edge functions are auth plus HTTP.
- Every new function is revoked from `public` and `anon` explicitly.
- Every new engine guards **both directions**: new functions reject old modes, and old functions
  already reject anything that is not their mode. 0015 makes the race functions check
  `mode <> 'race'`; 0012's check `mode <> 'elimination'`. Verify both in `test:db` for every new
  mode value.

### 6.2 Migrations

| # | Name | Contents | Compatible with the deployed client because |
|---|---|---|---|
| — | `word_start` (stage 3) | Race: `start_game_tx` and `advance_round_tx` set `round_started_at = now() + preroll_ms`, and `submit_answer_tx` refuses an answer before it (`round_not_started`), so a negative elapsed can never score. Elimination: the opening turn also gets the preroll (later turns already start in the future, `0012:856-867`). `preroll_ms()` constant (1500), revoked from anon. | The client from stage 3 shows "Get ready" for a future start. It ships **before** this migration, so a client never meets a future start it can't display. The old client would merely show a full, still bar for 1.5 s. |
| — | `echo_credit` (stage 6) | `p_latency_credit_ms` parameters on the stage-6 submit overloads; `round_scores.credit_ms`; `timing_params()` gains `latency_cap_ms` (100), `echo_min_samples` (3) and `echo_window_ms` (15000). The echo edge function and `ECHO_SECRET` need no SQL. | New overloads only. |
| 0021 | `avatar_parts` | `avatar_options()`; `room_players.avatar_color` and `avatar_hat` plus CHECKs; backfill from `avatar`; the legacy sync trigger (§2.4); column grants re-issued with the two columns | The old client names only legacy columns; the trigger fills the parts. |
| 0022 | `mode_schema` | Widen the `rooms.mode` CHECK to add `dash`, `hourglass` and `spotlight`. Add `room_players.round_wins int not null default 0`, `time_bank_ms int` (null until start) and `contending boolean not null default true`. Add `rooms.phase text` (`regular` / `sudden_death`, null otherwise). Add the `round_scores` table. Add `dash_params()`, `hourglass_params()`, `spotlight_params()` and `timing_params()`. **Extend the 0016 backstop trigger** to reject client rows with non-default `round_wins`, `time_bank_ms` or `contending`. | Purely additive. The old client never creates the new modes (its lobby offers Race and Elimination only), and the column grants are unchanged, so it cannot set the new columns. |
| 0023 | `timing_core` | `p_received_at` overloads of the submit functions; `floor_ms()`; the `too_fast` path; nothing for `timeout-turn`: `timeout_turn_tx` already takes an optional caller and is already granted to `service_role` (`0012:1052-1057,1152-1157`), so stage 1 needs no migration. The old signatures stay until the old edge functions are redeployed. | The old edge functions call the old signatures, which are unchanged. |
| 0024 | `dash_engine` | `start_dash_tx`, `submit_dash_tx`, `close_round_tx` (the single resolution path for Dash rounds: winner bookkeeping, end checks, sudden death), `sweep_expired_dash_rounds()` plus a 5 s cron job | New functions only. Mode-guarded. |
| 0025 | `hourglass_engine` | `start_hourglass_tx`, `submit_hourglass_tx`, `close_hourglass_round_tx` (charges, knockouts, end), a sweeper and its cron job | Same |
| 0026 | `spotlight_engine` | `spotlight_round_seconds()`. `apply_turn_outcome` gets **one** call-site change: the next turn's length comes from `next_turn_seconds(room, remaining, streak)`, which returns `decayed_round_seconds` for `elimination` (unchanged) and `spotlight_round_seconds` for `spotlight`. The 0012 mode guards widen to `mode in ('elimination','spotlight')`. `sweep_expired_turns` widens its `mode = 'elimination'` filter the same way. | Elimination's behaviour is byte-identical: `test:db` replays 0012's decay table against the new path. |
| 0027 | `typing_channel` | `typing_topic_ok()`, plus the two RLS policies on `realtime.messages` (§5.2) | Nothing old uses Broadcast. |

**Migration numbers** follow the order in which stages ship (§8, revised 2026-10-04). The table is in
topic order, and the numbers in it are from the first draft. The real sequence will be:
`word_start`, `avatar_parts`, `mode_schema` + `timing_core` + `echo_credit` + `dash_engine`,
`spotlight_engine` + `typing_channel`, (`hourglass_engine`), then `retire_old_modes`. Each takes the
next free number when its stage is built.

**Why the engines are separate functions and not branches:** Dash and Hourglass both resolve a
shared-word round, but they decide different things (one winner vs. every player's charge). A
shared `close_round_tx` with a mode branch would be one function holding two rule sets. Each mode
gets its own single resolution path, the same reason `apply_turn_outcome` exists (`0012:628-645`).
Spotlight is the exception because it genuinely *is* Elimination's rule set with one different
number, so a branch at that one number is the smaller change.

**`round_scores`:**
- Columns:
  - `room_id`, `round_num`, `player_id`;
  - `outcome` (`correct`, `wrong`, `missed`, `void`);
  - `response_time_ms` (nullable);
  - `charge_ms` (Hourglass, nullable);
  - `bank_after_ms` (nullable).
- PK `(room_id, round_num, player_id)`. `room_id` cascades from `rooms`, `player_id` from
  `auth.users`. Written only at round close by the engine.
- Grants: `select` to `authenticated` plus a members-only SELECT policy (`is_room_member`), the same
  as `round_results` (`0002:170-181`). No client writes. Not added to the Realtime publication
  (§5.3).
- It holds **no guess text**, so it can be member-readable without leaking a word to players still
  typing. It is written only once a round has closed in any case.

### 6.3 Edge functions

| Function | Calls | Notes |
|---|---|---|
| `timeout-turn` (stage 1) | `timeout_turn_tx(room, round, caller)` | Closes the known Elimination gap and serves Spotlight. Any member may nudge; SQL re-derives the deadline. |
| `start-match` | `start_dash_tx` / `start_hourglass_tx` / `start_elimination_game_tx` | Routes on the room's mode **inside SQL** (`start_match_tx`), so the edge function stays auth plus HTTP. |
| `submit-round` | `submit_dash_tx` / `submit_hourglass_tx` | Stamps `received_at` as the first line of the handler. |
| `close-round` | `close_round_tx` / `close_hourglass_round_tx` | The client fast path, like `advance-round`. |
| `submit-turn` (existing) | redeployed to pass `p_received_at` | |
| `echo` (stage 6) | none (no SQL, no table) | Stamps `T2` first and `T1'` last; signs challenges and receipts with `ECHO_SECRET` (§4.5). Pinned to the DB region like every game call. |
| `submit-round` (stage 6) | as above | Also verifies the echo receipts and passes `p_latency_credit_ms` |

Every one returns only `{ok:false, error:"internal_error"}` on a 500 (hardening #17,
`_shared/mod.ts`).

### 6.4 Limits and retention extended to the new modes

| Existing control | How the new modes are covered |
|---|---|
| 8-player cap (`room_players_enforce_limits`, `0019:159-181`) | Not mode-specific: applies automatically. |
| 3 open / 20 per hour per host (`0019:106-154`) | Not mode-specific: applies. |
| No mid-game joins (`0016:86-98`) | Not mode-specific: applies. |
| Empty-lobby delete, stale-room purge (`0019:191-262`) | Status-based: applies. |
| `purge_finished_round_attempts` | Status `finished`: applies to new-mode guesses. |
| `purge_anonymous_users` FK list (`0019:277-301`) | **Must add `round_scores.player_id`** to its NOT EXISTS checks. The rule: check every FK column, even ones that cascade. |
| `round_scores` retention | Cascades with its room (30 days). |
| Feed | Stores nothing. Supabase keeps its own Realtime logs under its policy (PRIVACY.md already says this of Supabase). |
| **New write path: Broadcast** | Not covered by any existing limit (Decisions C2). Bounded by membership (Turnstile plus caps), own-topic sends only, the client throttle (honest clients), and the kill switch. A hostile member *can* flood their own topic up to the project's per-second cap, which would degrade Realtime for every room. Accepted for a hobby project, with the kill switch as the response. |

### 6.5 Tests (same style as now)

**`npm run test:db` (PGlite, real migrations, SET ROLE).** New files:
- `avatar_parts.test.mjs`. Every case runs as `authenticated` through `SET ROLE` (the real client
  path) and is repeated on INSERT (joining) and on UPDATE (changing your bee in the waiting room).
  - **Out-of-range values are rejected (23514, `check_violation`):**
    - `avatar_color` −1, 8 (one past the last of 8), and 32767 (smallint max);
    - `avatar_hat` −1, 10 (one past the last of 10), and 32767;
    - the boundary values 0, 7 and 9 are accepted;
    - `null` for either is rejected (23502, `not_null_violation`);
    - a fractional value (2.5) and a string (`'2'::text` cast through PostgREST's JSON path) are
      rejected by the type (22P02) rather than silently rounded. The test sends the value the way
      PostgREST would, as JSON, not as a SQL literal.
  - **The new avatar columns cannot set score or any other game state:**
    - An INSERT that names any game column alongside the avatar parts fails 42501 (column grant).
      The game columns are `score`, `streak`, `lives`, `is_eliminated`, `turn_order`, `round_wins`,
      `time_bank_ms`, `contending` and `connected_at`. The 0016 backstop trigger is proven
      independently by temporarily granting the column inside the test transaction, the way
      `score_integrity.test.mjs` does today.
    - An UPDATE of `avatar_color` / `avatar_hat` on your own row leaves **every other column
      byte-identical**. The whole row is snapshotted with `to_jsonb(rp) - 'avatar' - 'avatar_color'
      - 'avatar_hat'` before and after, so the sync trigger is proven to write only the three
      avatar columns.
    - The same UPDATE **during an active game**, in each mode (Dash mid-round, Hourglass with a
      bank, Spotlight on your turn), leaves `rooms`, `round_results`, `round_scores` and every
      `room_players` game column unchanged. Changing your bee is never a game event.
    - An UPDATE aimed at **another player's** row changes 0 rows (the 0002 own-row policy). The
      sync trigger can't be used to reach across rows.
    - The sync trigger is `SECURITY INVOKER` (asserted from `pg_proc.prosecdef = false`), so it runs
      with the client's privileges and can't write anything the client couldn't.
    - `avatar_options()` is not SECURITY DEFINER and takes no arguments, so it can't be a write
      path. `has_function_privilege` shows anon can't execute it.
  - grants: the exact column lists for INSERT and UPDATE are asserted from
    `information_schema.column_privileges`, so a later migration that widens them fails here;
  - the old-client insert shape still works and gets mapped parts;
  - sync in both directions;
  - "both changed: the parts win";
  - backfill of every legacy key;
  - `avatar_options()` equals the client lists (reads `src/lib/avatars.ts`).
- `echo_credit.test.mjs`:
  - the credit is capped at 100 even for a 900 ms median;
  - 0 with fewer than 3 receipts;
  - the median, not the mean, of a sample set containing one outlier;
  - adjusted time is floored at 0 and compared with the human floor after the credit.

  Signature and freshness checks run in the edge tests below.
- `dash_engine.test.mjs`:
  - first to 3, the 5-round cap, a void round uses a slot, sudden death limited to contenders;
  - `not_contending`, the 10-round draw;
  - `too_fast` doesn't use the attempt and doesn't compare the word;
  - the cross-mode guards in both directions.
- `hourglass_engine.test.mjs`:
  - charges, the dead band, the quantum, the miss cap, the void round;
  - simultaneous knockouts and their placement;
  - "fastest-correct never knocked out" (a property test over random time vectors);
  - the 30-round cap.
- `spotlight_engine.test.mjs`:
  - the shrink/reset sequence;
  - floor at 6;
  - **Elimination's decay table replayed unchanged**.
- `typing_channel.test.mjs`: `typing_topic_ok` for member/non-member, own/other topic, wrong mode,
  malformed topic. The harness gets a stub `realtime.messages` plus `realtime.topic()`, alongside
  its existing publication stub.
- **Extended:**
  - `grants.test.mjs`: the authenticated function list, and anon executes nothing new;
  - `score_integrity.test.mjs`: the backstop rejects the new columns;
  - `abuse_limits.test.mjs`: the purge sees `round_scores`;
  - `rollback.test.mjs`: the catalog after rollback equals a fresh 0001–0020.

**`supabase/concurrency` (real Postgres 17, separate connections).** Each race has a negative
control that must break the invariant:
- 8 simultaneous correct Dash submissions give exactly one winner, and `round_wins` sums to the
  number of won rounds. *Control:* the `winner_id is null` predicate removed.
- `close_hourglass_round_tx` called by 6 clients plus the sweeper together charges each player
  exactly once. *Control:* the room lock removed.
- Spotlight submit vs. `timeout-turn` at the deadline resolves exactly one outcome. *Control:* the
  `ended_at is null` predicate removed.
- The player that claims the 3rd win and a concurrent sudden-death transition end in exactly one
  `finished`.

**`npm test` (Vitest, client):**
- `describeAvatar` wording for every pair;
- the localStorage legacy mapping;
- arrow wrap-around and the Home/End reducer;
- the feed throttle with fake timers (≤ 4 sends/s, coalesces, final flush, drops stale `r` and old `s`);
- the multi-sample clock sync picks the min-RTT sample;
- `standings` ranked by `round_wins`;
- Hourglass charge formatting.

**Edge (`edge_errors.test.mjs` pattern):**
- the new handlers stamp `received_at` before awaiting anything, and return the generic 500 shape;
- `echo` stamps `T2` before auth and `T1'` after it;
- a receipt fails if any of these is wrong: the signature (tampered or forged), the player
  (another player's receipt), the room, or freshness (more than 15 s old);
- a receipt whose `T2` is after the answer's `received_at` fails.

---

## 7. UI (on the redesign's components)

All of this builds on `redesign/spelling-bee` after it merges:
- `Panel`, `Sticker`, `Placard`, `Button`, `AnswerField`, `TimerBar`, `AvatarArt`, `Rosette`;
- `lib/standings.ts`;
- the one focus rule in `ui.css`;
- the single global reduced-motion block.

Engine extras arrive through `MultiplayerExtras`; `GameState` / `GameEngineApi` don't change
(CLAUDE.md, Session 20 seam).

| Screen | What changes |
|---|---|
| **Lobby** | "Game mode" stays a `role="radiogroup"` of buttons, now Dash / Hourglass / Spotlight, each with a one-line blurb. Lives select only for Spotlight. Hourglass shows "10 s of sand each" as text (fixed in v1). `AvatarMaker` replaces `AvatarPicker` in "You". Room preview names the mode. |
| **Waiting room** | `AvatarMaker`. The roster reads "name, avatar description". Mode rules in one sentence. |
| **Get ready** (all three) | The `TimerBar` slot shows a 3·2·1 count and the lead-in text. Input hidden until the reveal. Under reduced motion the numbers change with no scale or fade. |
| **Dash round** | `RoundScreen` plus a win-pip row per player (●●○, "first to 3"), "Round 3 of 5" or a "Sudden death" `Sticker`. Non-contenders in sudden death get no form in the tree (the TurnScreen rule, not a disabled input). |
| **Hourglass round** | `RoundScreen` plus a bank bar per player: a pure view of `time_bank_ms` with a step change under reduced motion, never a second clock (the Session 17 `TimerBar` rule). After each round, a 1.1 s line per player ("−0.4 s", "fastest", "miss −4.0 s") in the reserved feedback slot. Knocked-out players: no form, a "Watching" sticker. |
| **Spotlight turn** | `TurnScreen` plus a feed `Panel` between the pronouncer and the table: the holder's text in Atkinson at the answer-field size, a caret, and "live 3.4 chars/s". The holder sees their own `AnswerField` instead. The clock indicator: "Clock 13 s", with "reset" after a miss. Caret blink is decoration (static under reduced motion). |
| **Results** | Per §3: `DashResults` (round wins, round list), `HourglassResults` (survival, time left, charge table), and `EliminationResults` with Spotlight facts. |

**Keyboard and focus:**
- `useScreenFocus` on each new screen.
- At the reveal, focus goes to `AnswerField` **only** for a player who can answer. Spectators and
  watchers keep their focus where it was; focus is never stolen into a feed.
- The Leave/Quit confirm keeps its two-step focus behaviour (the redesign 4h fix).
- `keyboard-elimination.mjs` gets siblings: `keyboard-dash.mjs`, `keyboard-hourglass.mjs` and
  `keyboard-spotlight.mjs`, on mocked state.

**Contrast gate:**
- Each new screen and state is added to `design/harness/measure.mjs` with mocked engine state,
  including:
  - the Get-ready count;
  - sudden death;
  - a knocked-out Hourglass spectator;
  - the feed with text;
  - all 8 avatar colours in both themes.
- **The merge gate stays 0 failing pairs.**
- `unused-selectors.mjs` and `unused-tokens.mjs` stay at 0.
- `check-reduced-motion.mjs` covers the countdown, the feed caret, bank bars and the hat hop.

**Network:** the redesign's "no off-origin request" check is unchanged for singleplayer.
Multiplayer adds no host: Broadcast uses the same Supabase Realtime socket.

---

## 8. Build stages

Each stage is one or more sessions, one commit per logical piece, and is **safe to push to `main`
on its own**: nothing the live site does changes until its UI stage ships.

New modes stay behind a client flag (`?modes=next`, read once) until their UI stage is signed off.
The flag hides UI only. The server accepts a new mode as soon as its engine migration is applied,
which is safe because the engine is complete and mode-guarded.

**Revised 2026-10-04 (Ian's review).** The fixes that stand alone come first, then avatars, then
Dash, then Spotlight. Hourglass is last and **optional**, and the old-mode cleanup closes the
project.

| # | Stage | Sessions | Ships | Who tests |
|---|---|---|---|---|
| 0 | **Merge the redesign** (Ian) | 0 | the redesign | (already listed in CLAUDE.md) |
| | ***Fixes that stand alone (they improve today's Race and Elimination)*** | | | |
| 1 | **Elimination timeout fast path:** a `timeout-turn` edge function plus the client nudge in `useMultiplayerGame` (replacing the early return at `:604-625`). No migration: `timeout_turn_tx` already takes an optional caller (`0012:1052-1057`). | 1 | expired turns end in ~150 ms instead of up to ~5 s | Ian alone, two browsers (Chrome + Edge are two guest identities): let a turn expire and watch it advance. |
| 2 | **Multi-sample clock sync:** 5 `server_now()` samples, keep the min-RTT one, re-sync every 10 rounds (`serverClock.ts` only). Done **before** stage 3, which depends on it: a word start shared across devices is only as good as the clocks that agree on it. | 0.5 | a steadier countdown | Unit tests only |
| 3 | **Word start that doesn't depend on the device:** the `word_start` migration (scheduled reveal for Race and Elimination's opening turn), the "Get ready" countdown, a word-only announcement at the reveal, and no spoken lead-in in multiplayer. The speech-rate setting stays. **Ship the client before the migration** (§6.2). | 2 | every player hears the word at the same server moment | Ian alone, two browsers side by side (one on a slow voice, one fast): the word starts together. |
| | ***Avatars*** | | | |
| 4 | `avatar_parts` migration: schema, sync trigger, backfill, rollback, plus the §6.5 range and no-game-state tests | 1 | nothing visible | test:db |
| 5 | Avatar maker UI, hats art, 8 colour tokens, localStorage migration, contrast gate at 0, keyboard pass | 2 | the new picker | Ian: a taste check on screenshots plus a keyboard pass |
| | ***Dash*** | | | |
| 6 | **Dash engine plus timing core:** `mode_schema`, `timing_core`, `echo_credit` and `dash_engine` migrations; the `start-match`, `submit-round`, `close-round` and `echo` edge functions; region pinning (`forceFunctionRegion`); edge stamps; human floor; Dash sweeper; test:db plus concurrency | 3 | nothing visible | Tests only |
| 7 | Dash UI behind `?modes=next`: Get ready, pips, sudden death, `DashResults` | 2 | Dash (flagged) | **Real players:** 3–4 people, at least one phone on mobile data. Log `credit_ms`, `t − F` and voice start-up per device. |
| 8 | Dash replaces Race in the lobby (flag off for Dash) | 0.5 | Dash live | — |
| | **⏸ Stopping point A: a good game.** Dash for everyone, plus Elimination (with the fast timeout) and the avatar maker. Nothing below is needed for the site to be complete. | | | |
| | ***Spotlight*** | | | |
| 9 | `spotlight_engine` plus `typing_channel` migrations and tests | 2 | nothing visible | Tests only |
| 10 | Spotlight UI plus the live feed, **PRIVACY.md in the same commit**; then Spotlight replaces Elimination in the lobby | 2.5 | Spotlight live | **Ian with NVDA** (checklist below) **and real players:** 3+ people. Read the Realtime peak messages per second in the dashboard. |
| | **⏸ Stopping point B: the full game Ian described, minus the optional mode.** Dash and Spotlight live, with the new avatars. Skip to stage 13 if Hourglass isn't wanted. | | | |
| | ***Hourglass (optional)*** | | | |
| 11 | `hourglass_engine` migration plus tests | 2 | nothing visible | Tests only |
| 12 | Hourglass UI behind the flag; **tune `miss_cap` (4 s to start) and confirm the 200 ms band** from logged `t − F` and `credit_ms`; then switch it on | 2 | Hourglass live | **Real players, essential:** 3+ people on mixed devices. Do the charges feel fair? |
| | ***Cleanup*** | | | |
| 13 | **Old-mode removal**, at least 30 days after stage 10, so retention has deleted every Race/Elimination room and every cached old bundle has reloaded. Details below. | 1.5 | cleanup | test:db (rollback), and Ian's quick smoke test of both live modes |

**Sessions:**
- to stopping point A: 1 + 0.5 + 2 + 1 + 2 + 3 + 2 + 0.5 = **12**;
- to stopping point B: 12 + 2 + 2.5 = **16.5**;
- with Hourglass: 16.5 + 4 = **20.5**;
- with the cleanup: **about 18 without Hourglass, about 22 with it**.

**Stage 13, the cleanup, in detail.** A `retire_old_modes` migration, with its own rollback section.
1. A NOT VALID CHECK so new rooms can't be `race` or `elimination`. Old rows are gone by then; NOT
   VALID just avoids a pointless scan.
2. Drop the race engine: `start_game_tx`, `submit_answer_tx`, `advance_round_tx` and
   `sweep_expired_rounds()`, and unschedule its cron job. `rounds_per_game()` goes too, once the
   client stops reading it.
3. Elimination's functions **stay**, because Spotlight runs on them (`apply_turn_outcome`,
   `submit_turn_answer_tx`, `timeout_turn_tx`). Their mode guard narrows to `spotlight`, and
   `decayed_round_seconds` / `decay_params` are dropped when nothing calls them.
4. Drop the avatar sync trigger (D19: the `avatar` column stays).
5. Delete the `start-game`, `submit-answer`, `advance-round` and `start-elimination-game` edge
   functions.
6. Remove the race and elimination branches from `useMultiplayerGame`, the lobby and the results
   screens.
7. Update the function list in `grants.test.mjs`, and `rollback.test.mjs`.

**Real players are still needed in stages 7 (Dash), 10 (Spotlight) and 12 (Hourglass, optional).**
Everything else is test suites, Ian alone with two browsers, or Ian with NVDA.

### 8.1 Stage 10: Ian's own screen-reader test with NVDA

NVDA is free and open source, from NV Access.

**Setup (once, about 15 minutes, Windows):**
1. Download NVDA from `https://www.nvaccess.org/download/`. The donation is optional: choose
   "Skip donation this time".
2. Run the installer and pick **"Create portable copy"** if you'd rather not install it. Either way,
   leave "Use NVDA during sign-in" off.
3. Start NVDA (Ctrl+Alt+N if installed). Learn three keys:
   - the **NVDA key** (Insert, or Caps Lock if you choose the laptop layout at first start);
   - **Ctrl** stops speech;
   - **NVDA+Q** quits.
4. Open **NVDA menu (NVDA+N) → Tools → Speech Viewer**. It shows everything NVDA says as text. Keep it
   beside the browser: it is how you'll **count** announcements rather than trust your ears.
5. Settings (NVDA+N → Preferences → Settings → Speech): set a rate you can follow. Under **Keyboard**,
   set "Speak typed characters" on (it is the default).
6. Player 1 is **Firefox or Chrome with NVDA**, the screen-reader player. Player 2 is **Edge**, a
   second guest identity, driven by mouse and keyboard with NVDA ignoring it (it only reads the
   focused window). Join one Spotlight room with 3 lives, then add a third identity (another browser
   profile or a phone) so turns rotate past someone who isn't you.
7. Turn the game's own voice to a different voice from NVDA's (Settings → Voice), so the spelling
   word and the screen reader are easy to tell apart.

**Checklist.** Tick each item and write down any that fail, with what Speech Viewer showed.

*While someone else is spelling (the live feed):*
- [ ] When the turn passes to another player you hear **one** line, "*Name* is spelling. Live view of
  their typing is shown on screen", **once**, not repeated.
- [ ] While they type, **Speech Viewer shows no new lines**: no letters, no "live 3.4 chars/s", and
  no timer seconds. This is the main check. Watch it for a whole word.
- [ ] Browse mode (arrow down through the page): the feed panel is skipped. You meet the static
  "is spelling" line, not the moving text.
- [ ] Their outcome is announced once: "*Name*: correct, 2.4 seconds", or "*Name* missed — the word
  was *X*", including on a timeout.
- [ ] When a miss resets the clock, nothing extra is spoken beyond the outcome (the "reset" is
  visual).

*When the turn comes to you:*
- [ ] Focus moves into the answer field by itself at the reveal, and NVDA says its label. You did not
  have to press Tab.
- [ ] The countdown before the reveal doesn't announce every number.
- [ ] You hear the game's voice say the word **once** (not twice), with no lead-in phrase.
- [ ] Typing echoes your own characters normally; nothing else talks over them.
- [ ] Enter submits; you hear your outcome once.
- [ ] "Hear it again" is reachable by Tab and replays only the word.

*Turn changes and the end:*
- [ ] Losing a life, and being knocked out, are each announced once, on your turn and on others'.
- [ ] After you're knocked out, focus is not stolen when other players' turns start.
- [ ] Leave: the two-step confirm puts focus on "Keep playing" and returns it to the link when
  closed.
- [ ] Results: the heading is read on arrival, focus lands on the main button, and placement is
  spoken in order.

*Pass condition:* every box ticked. A single failure in the "no new lines while they type" item
blocks the stage, because that is the one an automated check can't hear.

---

## 9. Decisions and conflicts

**Every item below is resolved as of 2026-10-04.** "Ian" means Ian decided it in his review of the
first draft. "Default" means the draft's recommendation was kept, because the review accepted the
spec and did not change it. Nothing is left open; a later change is a new dated decision, not a
reopened question.

### 9.1 Conflicts with the security work or the fairness goals

| # | Conflict | Resolution | Status |
|---|---|---|---|
| **C1** | The avatar parts **widen the `room_players` INSERT/UPDATE column grants**, against 0016's "never widen these grants". | Widened by exactly the two cosmetic columns. The full column lists are pinned in `avatar_parts.test.mjs`, and the tests prove the parts can't set any game state (§6.5). The backstop trigger still guards every game column. | Resolved 2026-10-04 (default) |
| **C2** | Spotlight's feed is **a new client write path (Broadcast) that the 0019 abuse limits don't cover**. A flood past 100 msg/s gets the project's Realtime connections disconnected, including `postgres_changes` (§5.3). | Accepted: own-topic sends, members only, the 250 ms throttle, the kill switch; Pro if it binds. | Resolved 2026-10-04 (default) |
| **C3** | The live feed **sends every keystroke, including deleted mistakes, to other players**. | The PRIVACY.md text in §5.6, in the same commit as the feed. Nothing is stored. | Resolved 2026-10-04 (default) |
| **C4** | **The client must hold the word to speak it**, so a scripted client can answer just above the human floor. | The floor stops instant bots and nothing more, and the spec says so (§4.4). | Resolved 2026-10-04 (default) |
| **C5** | A miss costing the full round time ends nearly every Hourglass game. | **A miss costs at most 4 s, to be tuned with real players (stage 12).** | **Resolved 2026-10-04 (Ian)** |
| **C6** | Spotlight had no end condition without lives. | **Spotlight keeps lives.** | **Resolved 2026-10-04 (Ian)** |
| **C7** | Speech rate, lead-ins and voice start-up make "fastest" partly a device property. | **No spoken lead-in: every round starts with the countdown, then the word alone at the same server moment on every device. The speech-rate setting stays.** Upload latency is credited up to 100 ms by server-measured echoes (§4.5). Voice start-up is measured in stage 7. | **Resolved 2026-10-04 (Ian)** |
| **C8** | Old cached clients mislabel a new-mode room as "Race", then fail safely with `wrong_mode`. | Accepted. A reload fixes it, and the guards prevent corruption. Stage 13 removes the old modes after 30+ days. | Resolved 2026-10-04 (default) |
| **C9** (new) | The latency credit lets a hostile client that delays its echoes claim up to the cap every round. | Cap 100 ms, under the 200 ms dead band with a 40 ms margin (§4.5 budget). At most 0.1 s per Hourglass round, and only rounds closer than 100 ms in Dash. | Resolved 2026-10-04 (this review) |

### 9.2 Decisions

| # | Question | Decision | Why | Status |
|---|---|---|---|---|
| D1 | Do Race and Elimination stay? | **Dash replaces Race and Spotlight replaces Elimination in the lobby. The old modes are removed in the last cleanup stage (stage 13)**, at least 30 days after Spotlight ships. | Three modes, without breaking cached clients. | **Ian** |
| D2 | Mode names | Dash, Hourglass, Spotlight | Original and descriptive | Default |
| D3 | Player range | 2 to 8 in all three (`player_cap()`) | The cap already exists. | Default (Ian's earlier answer) |
| D4 | Dash sudden death: who plays? | **Only the tied leaders**; others watch with no input. | A non-leader winning a sudden-death round would change nothing. | **Ian** |
| D5 | Does a void Dash round use up one of the five? | **Yes.** After five, the leader wins. | Bounded at 5 regular rounds. | **Ian** |
| D6 | Dash sudden-death cap | **10 rounds, then a draw** | Bounded. A draw is honest. | **Ian** |
| D7 | Hourglass miss cost | **`min(L − F, 4 s)`, tuned with real players in stage 12** | One miss no longer ends the game. | **Ian** |
| D7b | Hourglass dead band | **200 ms stays.** The latency cap is chosen to fit under it (§4.5). | | **Ian** |
| D8 | Spotlight lives | **Keep lives**, 1–9, default 3 | It reuses the verified engine and gives Spotlight an end. | **Ian** |
| D9 | Spotlight clock | × 0.94 per correct turn, a 6 s floor, a full reset on any miss or timeout, no player-count trigger | One sentence a player can learn | Default |
| D10 | Hourglass bank | A fixed 10 s in v1 | One less control | Default |
| D11 | Speech in timed modes | **No spoken lead-in, a countdown, then the word alone at one server moment; the speech-rate setting stays.** This applies to Race and Elimination too, from stage 3. | Fairness, and accessibility for the rate | **Ian** |
| D12 | Dash winner | **Changed 2026-10-04:** the lowest *adjusted* time (server-measured time minus the capped latency credit), settled 150 ms after the first correct arrival or when every contender has answered. It was first correct arrival. | The credit makes arrival order no longer speed order (§4.8). | Resolved (this review) |
| D13 | Human floor | 300 ms + 50 ms per letter, compared with adjusted time; `too_fast` doesn't use the attempt and is checked before the word is compared. | It never costs a human anything, and it isn't an oracle. | Default |
| D14 | Presence for "left the game"? | No | It is client-asserted. Timeouts handle leaving. | Default |
| D15 | Feed content | Letters | The spectacle is the point; C3 covers privacy. | Default |
| D16 | Feed throttle | 250 ms; 400 ms if the Realtime cap binds | 32 msg/s at 8 players | Default |
| D17 | Avatar model | Two append-only smallint indexes (8 colours, 10 hats) | A range CHECK, asserted against the client | Default |
| D18 | "Surprise me" button | Yes | Cheap, and keyboard reachable | Default |
| D19 | Legacy `avatar` column after the cleanup | Keep the column; drop the sync trigger in stage 13 | No user benefit in dropping it | Default |
| D20 | Pin edge functions to the DB region? | **Yes, required.** Verified against Supabase's docs on 2026-10-04: regional invocation via `forceFunctionRegion` / `x-region` / supabase-js `region`, with no plan restriction documented (§4.4.1). Uses the query parameter, which needs no CORS change. | Echo and answer stamps must share one clock pool. | Resolved (this review) |
| D21 | Plan tier | Stay on Free. Move to Pro only if the Realtime cap (stage 10) or Edge invocations (§4.5 table) bind. | The estimates fit Free at hobby scale. | Default |
| D22 | Hourglass round cap | 30 rounds, then the most time left wins | Bounded games | Default |
| D23 | Live speed for watchers | Yes, labelled "live", replaced by the official time | Ian asked for "how fast". | Default |
| D24 (new) | Latency credit | **Server-measured echoes:** 6 chained calls (5 samples) before each reveal; the median RTT; credit `min(median/2, 100 ms)`; 0 with fewer than 3 samples. Used by Dash and Hourglass, not Spotlight. | A slower connection isn't charged for network delay, and the exposure stays inside the dead band. | Resolved (this review) |
| D25 (new) | Build order | Fixes that stand alone, then avatars, Dash, Spotlight, Hourglass (optional), cleanup. Stopping points after Dash and after Spotlight. Clock sync before the word start it supports. | Ian's order. The one swap is explained in §8. | **Ian** (the order) / this review (the swap) |
