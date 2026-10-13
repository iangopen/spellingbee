# Spelling Bee — CLAUDE.md

## Project overview
Word-spelling game: singleplayer, plus two multiplayer modes (Race and
Elimination) on Supabase. Stack: Vite + React + TypeScript, deployed to GitHub
Pages via GitHub Actions.
Repo: https://github.com/iangopen/spellingbee
Live: https://iangopen.github.io/spellingbee/

This file holds the standing rules and the current state only. The reasoning
behind each rule, the session-by-session build logs and every measurement live
in `docs/history.md`, which ends with this file's full text as it stood on
2026-10-12 before it was trimmed ("Archived CLAUDE.md"). When a rule below says
"see history", that is where to look before changing the thing it protects.

## CRITICAL: vite.config.ts
`base` must always be `'/spellingbee/'` — never change this, never remove it,
never revert to `base: '/'`. If the repo name above is wrong, update both
this file and vite.config.ts together, never just one.

## Deploy
Deploys via `.github/workflows/deploy.yml` on every push to `main`
(GitHub Actions → Pages). Do NOT introduce the `gh-pages` npm package or a
`gh-pages` branch — this project deploys via Actions only. Vite inlines the
`VITE_*` variables at build time, so they come from Actions secrets
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`);
locally they are in `.env.local` (ignored).

**Rolling back the redesign:** see "Redesign merge and rollback" under Current state.

## Architecture rules — never violate
- All game state flows through `GameState` (`src/types.ts`). Components only
  ever receive `GameState` as a prop — never call `useGameEngine`,
  `useMultiplayerGame` or any game-state hook inside a presentational component.
- Answer checking lives behind one function boundary in the engine hook
  (`checkAnswer`); never inline the comparison elsewhere. It is the seam where
  multiplayer swaps local comparison for the server.
- `WordEntry` is `id, word, tier, definition, partOfSpeech?`. Extend the
  interface (and this file) rather than bolting fields onto individual words.
- **Speech** goes through `src/lib/tts.ts` only, never `window.speechSynthesis`.
  Every speak path goes through `afterClearing()`: `cancel()` only when
  something is speaking or queued, then wait `CANCEL_SETTLE_MS`. The old
  cancel-then-speak in one tick clipped the lead-in in desktop Chrome; don't
  "simplify" it back (`tts.test.ts` pins it).
- `DEFAULT_VOICE_NAME` ("Google UK English Male") is a hard default checked in
  `pickAutoVoice` BEFORE the quality heuristic. Never turn it into a score
  bonus. Priority: saved override > this voice > heuristic. `DEFAULT_VOICE_RATE`
  (0.90) applies only when that voice is in effect, so `getRate()` consults
  `resolveVoice()`.
- **Word announcement** has ONE implementation, `useAnnouncedWord`. Screens
  call it (RoundScreen and TurnScreen, spectators included); engine hooks never
  speak, or every word is spoken twice. Initial reveal uses `announceWord()`
  (lead-in, pause, word; returns the phrase to show); "Hear it again" uses
  `repeatWord()` (word only). Don't reintroduce `speakWord`. A replay does not
  clear or re-roll the on-screen `.lead-in`.
- **Sound effects** go through `src/lib/sfx.ts` only: no `AudioContext`,
  oscillator or `<audio>` anywhere else, and no audio files (everything is
  synthesized). `useSfxForOutcome` decides WHEN (keyed so a re-render never
  replays); sfx.ts decides HOW. Its settings (`spellingbee:sfx:*`) are
  independent of the voice settings.
- No component may assume exactly one player in a way that is hard to reverse.
- **Every colour is a CSS custom property** in `src/index.css`. Never a hex in
  `App.css`, `ui.css` or a component. Adding a token means adding it to EVERY
  palette block in the same edit.
- **Theme:** `src/lib/theme.ts` is the only reader/writer. Stored value is
  `"light" | "dark" | null`; null means DARK. The OS setting is not consulted —
  never re-add a `prefers-color-scheme` branch or listener. Only an explicit
  toggle writes, so `spellingbee:theme` keeps its key and values and a stored
  light choice stays light. `:root` carries the dark palette, so first paint is
  dark with no script.
- localStorage keys use the `spellingbee:` prefix (e.g. `spellingbee:best:easy`).
  Never rename existing keys, tier ids or avatar keys.

## Core types
`DifficultyTier`, `WordEntry`, `RoundStatus`, `GameState`, `GameOptions` and
`GameEngineApi` live in `src/types.ts` — read them there. What the file can't say:
- `GameState.lastResponseMs` is additive and defaults to `null`, which means
  "not applicable" (timeout, skip, fresh round, no honest number). Nothing
  fabricates a duration. Multiplayer values are SERVER-measured (race from
  submit-answer's payload, elimination from the `round_results` row).
  Singleplayer uses `performance.now()` from reveal to submit, never `timeLeft`.
  WPM is `(length / 5) / (seconds / 60)` in `src/lib/wpm.ts`, one implementation.
- `untimed` (practice) and `hideDefinition` describe the CURRENT run, picked on
  the difficulty screen and passed through `GameOptions`, never localStorage.
  Singleplayer only; `useMultiplayerGame` ignores `options` and reports both false.
- Practice holds `timeLeft` at 0 (scoring is `10 + timeLeft`), and practice runs
  record no best score. `hideDefinition` runs do count.
- New best is decided in `App` against the PREVIOUS stored best. Never derive it
  as `score >= best` in a screen (ties, practice, races).

## Difficulty tiers
`TIER_ORDER` (types.ts) is the one ordering; `TIER_META`/`TIERS`
(`src/lib/tiers.ts`) the one set of labels. Round seconds: novice 22, easy 20,
building 18, medium 16, advanced 14, hard 13, expert 13, master 13. The curve
flattens at 13 on purpose (top tiers are hard by content); never go below 13.
`easy/medium/hard/expert` keep their exact strings forever (stored keys and DB
rows depend on them). `ROUND_SECONDS` in `useGameEngine.ts` and
`public.round_seconds()` must stay in sync; multiplayer reads the SQL function
by RPC and never imports `ROUND_SECONDS`. The word bank (~1200 words, 150 per
tier) has its own rules in `src/data/words/CLAUDE.md` and `supabase/CLAUDE.md`.

## Multiplayer rules
**Race (0006 + edge functions `start-game`, `submit-answer`, `advance-round`):**
- Game logic lives in plpgsql transition functions (one transaction each), not
  in edge functions, which do auth + HTTP only.
- `*_tx` functions take the acting player as a parameter, so they are granted to
  `service_role` ONLY. Never grant them to `authenticated`.
- `submit-answer` accepts no client correctness or timing; response time is
  `rooms.round_started_at` to server receipt.
- The winner is claimed by `UPDATE ... WHERE winner_id IS NULL`; never a
  read-then-write.
- `useMultiplayerGame` satisfies `GameEngineApi` and computes NO outcomes;
  everything arrives as database changes over Realtime. Its deadline is
  server-derived (`round_started_at` + `round_seconds(tier)`, clock from
  `serverClock.ts`). `timeLeft` derives from the ticking `nowMs` STATE, never
  from `serverNow()` inside a memo (that froze the countdown once).
  `skipWord` is a no-op and the Skip button is hidden with `canSkip={false}`.
- `sweep_expired_rounds()` (pg_cron, 5 s) has NO game rules and no deadline
  predicate; `advance_round_tx` is the single authority. The client polling
  loop stays as the fast path; both can't conflict (row lock + expected round).
- Leaving mid-game: the row stays (0005 permits self-delete only in `lobby`),
  the score stays, the player forfeits.

**Elimination (0012-0015, edge functions `start-elimination-game`, `submit-turn`):**
- Chosen by `rooms.mode` (`'race'` | `'elimination'`). Elimination never writes
  `rooms.round_started_at`; its clock is `round_results.turn_started_at`. That
  data shape is what keeps the race sweeper out; setting it would corrupt the room.
- `turn_order` defines who is in the game (`elimination_survivors()`); a row
  without a slot is a spectator. No mid-game joins in either mode.
- Turn order is randomized once and never renumbered.
- `apply_turn_outcome` is the single resolution path for answers and timeouts.
- Decay is `decayed_round_seconds(...)` only, tunables in `decay_params()`:
  player-count cut (N=2 exempt), streak stages at 5 and 9, combined
  multiplicatively and clamped once. The client reads the frozen
  `round_results.round_seconds`; never recompute decay in TypeScript.
- Two sweepers (`sweep_expired_rounds`, `sweep_expired_turns`), never folded
  together, neither with a deadline predicate; the turn sweeper passes no actor.
- Every engine's functions check `mode` first. When adding an engine, guard
  BOTH directions (0015 closed a cross-mode hole that failed open).
- `src/lib/avatars.ts` is the client's one copy of `public.avatar_keys()`
  (`verify_elimination_client.mjs` asserts they match); read stale values through
  `coerceAvatar`.
- Client: elimination has its own `TurnScreen`, not a mode flag in RoundScreen.
  The guess input is ABSENT (not disabled) for non-holders. `isMyTurn` derives
  from server facts only, never the clock. The knockout overlay is latched and
  dismissed by an elapsed-time check, not a bare `setTimeout`. `refresh()` reads
  everything first and commits state last, in one batch. Placement is survival
  order, not score. Leaving mid-game is a forfeit (turns time out).
- Known gap: no client fast path for an expired turn (`timeout_turn_tx` has no
  edge function); the 5 s sweep ends it. A `timeout-turn` edge function is the fix.

## Screen and design-system rules
- `.timer-track`/`.feedback` are shared by RoundScreen and TurnScreen. The timer
  bar (`TimerBar`) is a pure view of `timeLeft`: no clock, no round-length
  constant; its scale is the largest `timeLeft` seen for the word (`spanRef`); it aims one
  step ahead (`(timeLeft - 1) / span`) after a priming frame, with a 1 s linear
  `transition` (never an `animation`); it is keyed by word id; urgency classes
  read the displayed `timeLeft`; practice renders no bar; it is `aria-hidden`.
- TurnScreen rules are scoped under `.turn-screen`/`.ptoken*`. The token row sits
  below the timer bar; `.turn-feedback` is a fixed-height reserved slot; tokens
  are not focusable; a ghost is a swap (lucide `Ghost`), never a ninth avatar;
  lives sit below a token; a ghost's name is `--muted`, `--out` is for the disc.
- Every line of text sits on a `Panel` (or a scrim pill), never bare honeycomb.
- Buttons are `<Button>`. ONE focus rule in `ui.css` outranks every marker
  shadow; tier bars and `.answer-field` are the exceptions. Never add a
  per-component outline. Disabled is a dashed `--muted` outline, not a fade.
- `AnswerField`/the guess input stays `readOnly` (not `disabled`) during feedback.
- Tier bars and tier cards are `clip-path` shapes: measure tap targets with
  `elementFromPoint`, never `getBoundingClientRect`; focus thickens the inset rim.
  Eight bars stay one page-scrolling stack (no inner scroll). It is tier BUTTONS,
  never a letter board.
- `isNewBest`, standings (`lib/standings.ts`, ties share a place) and
  `RaceResults`/`ResultsScreen` (solo only) are separate; never pick a winner by
  row order.
- **Motion only decorates a state that is already visible.** One global
  reduced-motion block in `index.css` (also zeroing delays) plus the in-app
  override, which can only ADD suppression. Every animation needs a resting state
  that reads the same (`check-reduced-motion.mjs`, zero tolerance). A screen change
  the PLAYER asks for goes through `lib/viewTransition.ts`; one the GAME causes
  does not. The streak pulse replays by remounting via `key`.
- **Compositing and hover (2026-10-06):** a hover or press inside a panel moves
  with `top`/`left`, never `transform` and never `will-change`. `.tier-bar` and
  `.sticker` are the deliberate `will-change` exceptions (comments say why); don't
  remove either. Don't add `will-change` to text fields.
- **The flicker criterion:** visible flicker means sampled compositor frames
  visibly CHANGE outside the hovered/focused element (shimmer frozen). Paint area
  only finds candidates (`sweep-hover-repaint.mjs`); a fix is justified only when
  frames change (`check-hover-flash.mjs`).
- **Layering:** `.panel` isolates and `.panel::after` (the outline) is its last
  layer, so art hanging off a panel edge needs `z-index: 1` or more
  (`.panel > :is(.mascot, .rosette)`); stickers are z-index 2.
  `check-layering.mjs` is the gate.
- **Homemade strength `light`** is three tokens in `src/index.css`
  (`--hm-roughness` 2.4, read by `WobbleFilters` via `getPropertyValue`;
  `--hm-tilt` 1deg; `--hm-texture` 0.16) plus `ART_WOBBLE` 0.8 in `lib/beeArt.ts`.
  `.bg-grain` is the LAST layer of `HoneycombBackground`; no `backdrop-filter` on
  panels at any width. `more`-only touches (washi tape, panel tilts, grain inside
  panels, double outline) stay out.
- **Art pinning:** `beeArt.ts` draws the prototype's jittered blobs, seeded per key
  and memoized, tokens only. `ui.test.tsx` pins the wobble and a digest of every
  drawing. Never swap it for smooth curves; after any change rerun
  `design/harness/build-brand-assets.mjs` and update the digest. Never hand-edit
  the PNGs in `public/`.
- **Honeycomb background** (`HoneycombBackground`): decoration only, honey hue
  28-42 (never lemon or flat grey), `aria-hidden`, no pointer events, `.bg` at
  `z-index: -1` inside `.app-shell`, only `transform`/`opacity` animate, paused
  when hidden, still under reduced motion. `data-peak="1"` is for the harness
  only. If the shimmer stutters on phones, `.bg-light { display: none }` is the
  static-glow fallback.
- **Contrast:** AA (4.5:1 text, 3:1 UI and focus) against the WORST pixel with the
  background at peak (`TARGET=app node design/harness/measure.mjs`). Focus rings
  sit in a solid 7px moat; a pill or button leaves >= 24px before the next panel.
  `.text-input` uses `--edge`. Texture is measured by its worst pixel.
- **Fonts:** self-hosted only. Caveat Brush (letters-only subset) is for the
  title, headings and badges only; words, input, buttons and numbers stay in
  Atkinson Hyperlegible / Bricolage Grotesque. A new font needs its `OFL-*.txt` in
  `src/assets/fonts/` and a `CREDITS.md` row, or the build fails.
- **Trademark distance:** no honeycomb letter layout, no NYT-style yellow/grey, no
  serif wordmark; the favicon is a bee rosette, not a hexagon.
- Lean bundle: no animation or UI libraries without asking; `lucide-react` icons
  only.
- Settings is a native `<dialog>` + `showModal()`, closed through its native
  `close` event. It holds only global preferences. The Leave/Quit confirm focuses
  "Keep playing" and returns focus on close. `useScreenFocus` never moves focus on
  the first screen of a load. RoundScreen's one `role="status"` region never names
  the word while other racers are typing.
- The answer field scrolls itself into view on focus (`RoundScreen.tsx`).
  Measured 2026-10-12 on desktop (no touch): it runs ONCE per game, on the
  input's first focus (0 px where the page fits, 57-97 px on 520-480 px tall
  windows), and the page does not move between words. Leave it as it is; if that
  ever changes, limit it to touch and re-check phone width with touch emulation.

## Security rules (hardening, live since 2026-09-28)
- Scores are server-only: `room_players` INSERT is a column grant on
  `(room_id, player_id, display_name, avatar)`, UPDATE `(display_name, avatar)`,
  plus a backstop trigger. Room INSERT is `(id, code, tier, host_id, mode,
  lives_setting)`; `created_at` stays server-set. Never widen these.
- Names: CHECK (1-24 code points, no control chars) plus a SECURITY DEFINER
  trigger against `private.blocked_name_terms` (sha256 digests only; the term list
  is never in the repo). Add terms with `supabase/scripts/hash_name_terms.mjs`
  and a NEW migration. The client mirrors only the CHECK (`lib/displayName.ts`).
- Abuse limits live in `abuse_limits()`/`player_cap()` (3 open rooms per host,
  20 per hour via `private.room_creations`, 8 players). Joins/leaves share the
  per-room advisory lock `lock_for('room', id)`.
- Retention is exactly 0019's pg_cron jobs. In a SECURITY DEFINER trigger a
  "clients only" check reads `current_setting('role')`, not `current_user`.
- **Every new SQL function needs an explicit revoke** (Supabase grants anon
  EXECUTE by default). test:db asserts anon executes nothing and a guest exactly
  13 named functions.
- Edge functions log internal errors and return `{ok:false,
  error:"internal_error"}`. `_shared/mod.ts` sends `Access-Control-Max-Age: 7200`;
  keep `OPTIONS` handled before the auth check.
- Guarded paths for presentation work: `src/hooks/*`, `checkAnswer`,
  `GameEngineApi`, `src/lib/rooms.ts`, `auth.ts`, `captcha.ts`, `supabase/`.
- **Any new migration must extend `supabase/rollback/0016-0020_down.sql` and its
  test, or ship its own rollback.**
- **PRIVACY.md** (last checked 2026-09-29) must be updated in the same commit as
  anything that sends or stores something new. It must never promise less than
  the code does. No published file (README, PRIVACY, LICENSE, `public/`,
  `index.html`, `dist`) may contain TODO/TBD/FIXME. Privacy contact is GitHub
  Issues. Singleplayer contacts only the site's own origin (the Supabase client
  is lazy).

**Edge-function rollback** (pre-CORS-cache `mod.ts` is commit `8b979dc`):
```
git checkout 8b979dc -- supabase/functions/_shared/mod.ts
npx supabase functions deploy --use-api --project-ref wjorfdfpbgyykbhxydqj
```

## Tests and checks
- `npm run build` (the gate), `npm run lint` (0 errors), `npm test` (src +
  scripts), `npm run test:db` (real migrations under PGlite).
- `npm --prefix supabase/concurrency ci && npm --prefix supabase/concurrency test`:
  real Postgres 17 races against the advisory locks, each with a negative control.
- Browser checks, one command: `PW_MODULE=<playwright/index.mjs> node
  design/harness/run-checks.mjs` (Playwright is never a repo dependency; install
  it outside the repo). It builds and serves static builds on `127.0.0.1` (never
  `localhost`) and runs contrast, tier bars, tier focus, settings dialog, keyboard
  passes, reduced motion (zero tolerance), network, layering, hover flash and the
  unused-selector/token checks. `check-glow.mjs` is the Blue Ribbon check and
  fails honey by design. Use viewport captures, never `fullPage`, for pixel diffs.
- On this laptop memory is tight: read `(Get-Counter '\Memory\Available
  MBytes').CounterSamples.CookedValue` before each heavy step and run them alone.
- With CAPTCHA on, no script can sign up users; the `verify_*.mjs` scripts need
  CAPTCHA off temporarily or an existing session. Don't create guest users on the
  live site from an agent.

## Current state
Everything below is live unless marked open.

- **Singleplayer:** difficulty -> timed word round with speech -> scoring and
  streaks -> results; 30 words per game; best scores per tier in localStorage.
- **Multiplayer:** Supabase backend live (tables with RLS, anonymous guests,
  Turnstile CAPTCHA, Realtime). Race and Elimination are both playable end to
  end; rounds advance with no client attached (pg_cron sweepers). Hardening
  (migrations 0016-0020) and the 2 h CORS preflight cache are live and verified.
- **Redesign "Spelling Bee"** (honey and ribbon, homemade strength `light`, dark
  default): LIVE since 2026-10-12, squash commit `08e95d0` on main, deploy run
  38332652884 (success). Verified on the live site that day: title, manifest,
  icons and share card (200, right types and sizes), one word played with every
  request on the site's own origin, the Privacy link, the README screenshots and
  the About text. Saved data from before the redesign (best scores, display
  name, voice and sound settings, a light theme, reduce motion) loads unchanged.
- Docs: README, PRIVACY.md (last checked 2026-09-29), LICENSE (MIT, Ian Gopen).
  `design/README.md` maps the design folder; `design/PHASE3.md` is the design
  system spec. The design images (prototype screenshots, baselines, stage
  results, crops) are NOT on main; links to them from the design docs resolve on
  tag `redesign-final`.

### Redesign merge and rollback
- Tags on GitHub: `pre-redesign` = main before the merge (`21c2601`);
  `redesign-final` = the branch tip that was squashed (`743847e`), full history
  and every design image. Branch `redesign/spelling-bee` is kept.
- **Rollback** (from an up-to-date `main`, clean working tree). It reverts the
  squash and keeps the current CLAUDE.md and docs/history.md, which later
  commits edit, so they would otherwise conflict; then pushes, which redeploys:
  ```
  git revert --no-edit 08e95d0 || { git checkout --ours CLAUDE.md docs/history.md && git add CLAUDE.md docs/history.md && git -c core.editor=true revert --continue; }
  git push origin main
  ```
  Then record the rollback in CLAUDE.md. Dry-run result: see docs/history.md,
  2026-10-12.
- Docs: README, PRIVACY.md (last checked 2026-09-29), LICENSE (MIT, Ian Gopen).
  `design/README.md` maps the design folder; `design/PHASE3.md` is the design
  system spec.

### Open
- Ian: the shimmer on a real mid-range phone, on the live site. If it stutters,
  the static-glow fallback is one rule at the end of `src/honeycomb.css`:
  `.bg-light { display: none; }` (the glow and cells stay; only the moving band
  goes).
- The frame-sampling flicker check on the Settings drawer ("Close settings"
  focus) and the lobby text fields; fix only if frames visibly change outside the
  element.
- Elimination has no client fast path for an expired turn (needs a
  `timeout-turn` edge function).
- The README screenshots were retaken from a local build; README has no user or
  games-played numbers (add them only from real data).
- The name: a distinct look lowers the risk of confusion with NYT's game but
  doesn't clear the name (HARDENING #14 / §C10).
- Known limits: `check-settings-dialog.mjs` cannot see two focus mutations; the
  elimination keyboard pass in the harness runs on mocked state; race lanes show
  no per-player correct count (the client doesn't have it).
- Follow-ups not started: move the deploy workflow to `npm ci` and Node 22
  (it uses `npm install` and Node 20; the 2026-10-12 run also warned that
  `actions/deploy-pages@v4` targets the deprecated Node 20 runtime, and that
  `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19); the multiplayer modes
  spec on branch `plan/multiplayer-modes` (its CORS note predates the change
  shipping on main).
- `design/stage-results/*.json` (5.2 MB of contrast measurements) went to main
  with the squash because only images were excluded; they could be dropped from
  main later if the repo size matters.
