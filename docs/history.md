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

## 2026-10-02: honey hybrid b picked; homemade prototype (design only)

Ian picked honey hybrid variant b and asked for two tweaks before the build:
the old live difficulty selection back, and a more homemade, handmade feel.
Nothing went into `src/`; the work is `design/prototypes/homemade/`,
`design/harness/shoot-homemade.mjs`, a `TARGET=homemade` mode in `measure.mjs`,
`design/PHASE3.md` (new "Adjustments from the homemade pass") and this file's
CLAUDE.md Redesign section.

- Difficulty screen rebuilt from the old design (hexagon bars, ramp, chips, focus
  rim) in the hybrid's tokens; the header sits on a lit panel.
- Homemade at two strengths, `light` and `more`, beside `off`: pick pending.
- Hand lettering (Caveat Brush, subset to letters) only on the title, headings
  and badges.
- Only build stage 0 existed (self-hosted fonts); the tweaks add one font to it.

Found by measuring, not by looking: (1) grain with a 0.4 peak alpha failed 30
contrast pairs, 0.06 passes; (2) the marker-style button shadows silently
replaced the focus moat until the global focus rule was made to outrank them;
(3) a sticker hung off the winner card's top edge sat on the phone Settings
button's focus ring, so it moved to the bottom edge.

## 2026-10-03: homemade prototype gaps closed

The 10-02 prototype was committed as it stood, then: the tier-bar focus check
(8/12, 1.10:1 at "more") was found to be partly a measurement fault (it located the
rim by colour and matched neighbouring Expert/Master bars) and is now geometric;
the focused bar drops its tilt at "more". Result 12/12, lowest 7.35:1, and a single
summary line in `checks.txt` (0 failures: 680 pairs + 12 focus configs). The four
side-by-sides were missing because an interrupted run had wiped `screens/` while
`checks.txt` kept its old success text; the script now writes to `screens.new`,
swaps on success and asserts the files exist. The light/more pick is still open.

## 2026-10-03: homemade `light` picked, stage 1 built, package renamed

Ian's decisions: homemade strength `light` (`more` and `off` closed), the difficulty
screen follows the old live design, and the npm package is `spelling-bee`.

**The focus checker was proven able to fail before anything was built.** The tier-bar
focus check was moved out of `shoot-homemade.mjs` into `design/harness/tier-focus.mjs`
(the shoot script calls it), with `check-tier-focus.mjs` to run it alone on any copy
of the prototype folder. On a temporary copy in the scratchpad:
- real files: 12/12 PASS, lowest 7.35:1;
- focus rim removed (focused bar keeps its normal look): 0/12 PASS, 1.00:1, exit 1;
- rim present but the same colour as its moat: 0/4 PASS at `light`, 1.00:1, exit 1;
- copy restored (byte-identical to the original): 4/4 PASS, lowest 7.35:1, exit 0.
The 1.00:1 in the first mutant comes from the "rim colour not found" branch; the
second mutant exercises the ratio branch. The repo's prototype files were never edited.

**Stage 1** (tokens and dark default): see CLAUDE.md "Build progress" and PHASE3 1.1.
Things found by measuring: (1) once the OS is ignored, the harness's
`colorScheme: "light"` stopped producing light screens (SettingsPanel re-applies the
stored theme on mount), so every "light" measurement silently ran dark until the
harness stored its pick like a player; (2) measuring overwrites `design/baseline/`,
so stage results go to `design/stage-results/` and the baseline is restored.
Caveat Brush, which the 2026-10-02 plan said stage 0 would carry, had never been
added; stage 1 added it.

## 2026-10-03: stages 2 and 3

Stage 2 (honeycomb) and stage 3 (shared components, global focus rule) on
`redesign/spelling-bee`. App-wide contrast failures: 11 after stage 1, 265 after
stage 2, 217 after stage 3; the target is 0 before merge.

- **The first stage 2 measurement said 371 failing and was wrong.** The
  background was `z-index: 0` inside `.app-shell`, which paints over unpositioned
  content, so the screens were hidden and the measurer read the honeycomb. A
  screenshot showed it. Moving it to `-1` gave the real figure, 265.
- **The 265 are expected, not a bug:** the real app has loose text (captions,
  headings, scoreboard labels) that the old near-invisible wash never threatened.
  Against the shimmer at peak it fails. Panels fix it, which is stage 4.
- **Both named failures are fixed and measured:** the Settings focus ring
  (1.82:1) is 11.47 dark / 7.35 light from the global focus rule; the lobby
  primary buttons (3.19:1) are 7.06 / 6.47 because a disabled button is now a
  dashed muted outline instead of a 50% fade. WCAG exempts disabled controls, but
  the script measures them and the shape change is also the clearer cue.
- `--tape*` and `--grain-panel-opacity` deleted (they only served `more`).
- Found and fixed while checking: the correct/incorrect answer field kept the
  honey focus outline around a green or red border; the outline now takes the
  state colour.

## 2026-10-03: stages 4a to 4d

Home, difficulty, round and solo results moved onto panels. Contrast failures:
217 (stage 3), 212, 187, 90, 64 after 4a, 4b, 4c, 4d. The 64 are elimination,
lobby and waiting room.

- **A scripted edit deleted a span of App.css, and the next measurement exposed it.**
  Replacing the back link, `s.index(".back-link {")` matched
  `.round-exit .back-link {` first and cut everything up to `.sp-home`, taking the
  exit-confirm, results and the new home rules with it. The tier bars then
  measured as transparent (their CSS was gone too). Caught because a focus-ring
  probe showed a 24px-high link where 44px was set; restored from git and redone
  with exact anchors. The lesson is in the commit trail, not a rule: after any
  scripted multi-rule edit, diff the stat and read the removed selectors.
- **The Modes link's focus ring failed (2.08:1)** because 12px below it sat the
  next panel's drawn outline, inside the ring's 3 to 6px band. The fix is spacing
  (24px), not a thicker moat.
- **"New best" was wrong in three cases** (ties, practice runs against an empty
  best, every race). It is now decided once, in `App`, and passed in.
- **I replaced a rule by renaming it, then had to undo it:** a stray script line
  renamed `.replay-btn`, which TurnScreen still uses. Reverted before the commit.

## 2026-10-03: stages 4e to 4g

Race results, settings, lobby and waiting room. Failures 64, 63, 64, 45 after 4d,
4e, 4f, 4g; everything left is elimination. Pushed after each stage.

- **4f measured nothing new on purpose.** The settings screen already measured 0
  because `measure.mjs` opens the real dialog itself; an auto-open I added to the
  harness collided with that click (a 30s timeout and a partial result file with
  689 pairs). Removed. A partial measurement is not a result: the run that crashed
  was discarded and redone before any number was reported.
- **The first dialog check was wrong, not the dialog.** "Tab never leaves the
  dialog" failed because a native modal lets Tab pass through browser UI; the
  test now asks the right question (never lands on the page behind). The negative
  control I tried (a non-modal dialog) broke React's own dialog handling and
  proved nothing, so it is recorded as missing.
- **The tied-race screenshots drove a wording rule:** a tie is never worded as a
  win for whoever's row is first, and a zero-point race has no winner or rosette.

## 2026-10-03: stage 4h (elimination), contrast gate at 0

Failures 45, 2, 2, 0, 0 across the four sub-steps; pushed after each commit.

- **The keyboard pass found a real bug the contrast work could not:** Enter on Leave
  replaced the link with the confirm and focus fell to `<body>`; Keep playing did it
  again on the way back. RoundScreen's Quit had the same defect (since the Session 13
  era). Fixed in both: the confirm focuses Keep playing, the link takes focus back.
- **Dialog check, negative control:** three mutations of `SettingsPanel.tsx` in turn,
  each restored with a byte-identical check against HEAD. `show()` instead of
  `showModal()` with no focus-in: FAIL 5 (Tab reaches the page behind, Escape does
  nothing). Dropping focus to `<body>` on open: FAIL 2. Removing the explicit
  `triggerRef.focus()` on close, and replacing it with a blur: PASS, not detected.
  Chrome restores focus to the opener itself when a modal dialog closes, so that line
  is redundant in Chrome and the check cannot tell; this is a limit of the check, not
  evidence the line is needed. The first control attempt crashed the script (Escape
  timed out); the check now converts a timeout into a FAIL.
- **A count laid across a ring is a contrast failure by construction.** The lives
  badge sat on the token's border, and the measurer saw the border colour behind the
  digits (2.83:1). Moving it below the name fixed it; padding and a shadow did not.
- **Ghost names:** `--out` as text colour was 2.88:1. It stays a disc colour.

## 2026-10-04: stages 5 to 7 and the review pass

Merged `main` into the branch first (nothing newer; "already up to date"), then built the
rest of PHASE3 and verified it. Pushed after every commit.

- **Art:** the stage 3 bee was drawn at run time from a seeded random wobble. It is now fixed
  path data, hand-placed, and the favicon, icons and share card are rendered from the same
  drawing. The first share card used a system font because `setContent` pages cannot load
  local fonts; it now renders from a real `file://` page.
- **A commit that broke the build:** the brand-asset test imported `node:fs` inside the typed
  app, and `tsc -b` failed; I had pushed it before running the build. Fixed in the next commit by
  moving the test to `scripts/tests/` (and `npm test` now runs it). Lesson kept: run
  `npm run build`, not only the unit tests, before a commit.
- **Reduced motion found a real bug:** the global block collapsed animation durations but not
  delays, so the ghost drift (delayed 0 to 1.65 s) kept moving. Fixed (`animation-delay` and
  `transition-delay` are zeroed). The checker itself needed three fixes before it said
  anything true: seed `Math.random` (the lead-in phrase is random), await `document.fonts.ready`
  (a late font swap read as motion), and inject the caret-hiding style before load (adding it to
  a live page forced a re-raster that showed as 300-pixel "differences"). It then reported
  46 identical and 22 within a printed 0.2% tolerance. Negative control: removing the OS
  reduced-motion block makes the elimination screens fail (1300+ pixels move). An earlier
  "control" (hiding the shimmer rule) did not fail, because the shimmer is also at opacity 0
  without its animation, which is defence in depth, not a gap in the check.
- **The sound and speech check has two negative controls:** a `cancel()` 200 ms into the first
  lead-in fails two checks; making a miss play the bell twice fails the per-outcome count
  (7 oscillators, not 4). The speech side uses a fake `speechSynthesis` with Chrome's cancel
  semantics: real audio cannot be heard headless, so this catches the cause (a cancel landing on
  live speech), not the sound.
- **The first bundle comparison was wrong by 116 kB.** `main` built in a clean worktree has no
  `.env.local`, so the Supabase client was tree-shaken out; the branch build had it. Built with
  the same `.env`, the real difference is +3.6 kB gzip of JS. I bisected commit by commit
  (140.5 kB gzip at the last commit, against 136.6 for a `.env`-less main) before finding it.
- **I damaged `node_modules` and repaired it.** Removing the temporary worktree with a
  directory junction to `node_modules` inside it deleted `node_modules/.bin`. `npm ci` fixed it
  (it first failed with EPERM because two Vite servers held the rolldown binary). Everything
  was re-run afterwards: build, 117 unit tests, 94 database tests and the whole browser
  suite. No source or lockfile changed.
- **Licences:** the build now checks fonts, not just lists them (see CLAUDE.md). Demonstrated:
  removing `OFL-CaveatBrush.txt` fails the build naming the font; removing its CREDITS row fails
  it too; restoring both passes.
- **Choices I made without asking** (conservative): kept dark as the only default and the OS
  setting ignored; kept `og:image` an absolute URL under `/spellingbee/`; left the multiplayer
  screens untouched by real traffic (mocked only); tolerated 0.2% anti-aliasing noise in the
  reduced-motion check, printed per case; used `--muted` rather than a new token for ghost
  names; made `design/` scripts take `PW_MODULE` like the existing ones rather than adding
  Playwright as a dependency.


## 2026-10-04: Access-Control-Max-Age on the edge functions (main)

Added `Access-Control-Max-Age: 7200` to `corsHeaders` in
`supabase/functions/_shared/mod.ts`. Nothing else changed: no client code, no
game logic, no function entry point.

Why: `callEdge` sends non-simple headers, so every call is preflighted, and with
no max-age the browser keeps the permission for only 5 s. Race rounds are 13 s
or more apart, so most answers paid an extra `OPTIONS` round trip. MDN: Chromium
76+ caps the value at 2 h and Firefox at 24 h, so 7200 is the most that helps.

Tests: `edge_errors.test.mjs` gained a "CORS preflight" block (header present on
an unauthenticated OPTIONS with no handler call and no Auth fetch; the other
three headers unchanged; exactly four headers). The first and third fail
without the change (checked by stashing `mod.ts`). `npm run build`, `npm test`
(46) and `npm run test:db` (97) pass; `npm run lint` has only the existing
warnings.

Deployed with `npx supabase functions deploy --use-api` (all five). Live check,
before and after:
- `OPTIONS` to all five: 200, and `access-control-max-age: 7200` appears only
  after the deploy; the other three CORS headers are identical.
- POST with the public anon key and no user, `{}` body: 401
  `{"ok":false,"error":"unauthorized"}` for all five, before and after. A POST
  with no Authorization header at all gets the gateway's 401
  (`UNAUTHORIZED_NO_AUTH_HEADER`), also unchanged.

No guest user was created for any of this.

### Browser check on the live site (for Ian)

1. Open https://iangopen.github.io/spellingbee/ in Chrome in a normal window and
   do a hard reload (Ctrl+Shift+R) so you have the current client.
2. Open DevTools (F12) -> Network. Tick **Preserve log**, and untick **Disable
   cache**. Type `functions/v1` in the filter box. Clear the list.
3. Start a multiplayer race (create a room, have a second browser or person
   join, then Start) and answer several words.
4. Expected: the first answer shows two rows for `submit-answer`, an `OPTIONS`
   (status 200, type `preflight`) followed by the `POST`. Every later answer
   shows only a `POST`. Click the `OPTIONS` row -> Headers -> Response Headers:
   `access-control-max-age: 7200`.
5. Not expected: an `OPTIONS` before each answer. (Chrome sometimes lists
   preflights under type `Other`; clear the type filter if you can't see one.
   Check that `start-game` and `submit-answer` each preflight once, because the
   cache is keyed per URL.)
6. If you still see a preflight on every answer, check the response header on
   it. A missing header means the old function is still live. A present header
   means the browser is not caching it, so tell me which browser.

Firefox keeps preflights up to 24 h, Chromium 2 h; Safari's cap isn't documented
by MDN, so a Safari check is a bonus and not a requirement.

### Rollback

```
git checkout 8b979dc -- supabase/functions/_shared/mod.ts
npx supabase functions deploy --use-api --project-ref wjorfdfpbgyykbhxydqj
```

Also in CLAUDE.md.

### Open

- The multiplayer spec on `plan/multiplayer-modes` still lists this as pending in
  stage 1 (§8) and §4.5.4 part 1. Update it there; that branch was not touched.

## 2026-10-06: homemade strength restored, touch by touch (redesign branch)

Ian chose the `light` homemade strength, but the built app felt less handmade than the
prototype. The earlier "match the prototype" checks compared whole screens, where a
single lost touch hides, so this session compared one touch at a time.

- **Pre-check:** the layering and hover-flash fixes were not on any branch (all refs and
  commit messages searched, stashes, worktrees). GitHub was unreachable at first (`git
  fetch` failed twice); Ian confirmed the fixes were never made and said to go ahead
  without them. The connection came back at the first push, and every commit since was
  pushed as it was made.
- **Inventory:** 20 light touches from `homemade.css`, `homemade.js` and `art.js`. 13
  present, 5 partly present, 2 missing: the Settings button (still the Session 13
  round button), no backdrop blur (desktop still blurred), the page grain (under the
  header band and vignette), the winner name's underline, and the wobbly line on the
  bee, avatars and rosette. The full table, with where each was lost in git, is in
  CLAUDE.md "Homemade strength, touch by touch".
- **New:** `design/harness/shoot-touches.mjs` (prototype vs app, one cropped touch at
  2x, both widths and themes) writes `docs/review/touches/`; `before--*` are the seven
  lost touches as they were.
- **Restored** (one commit each): the strength as three tokens (`--hm-roughness`,
  `--hm-tilt`, `--hm-texture`); grain as the top layer of `.bg`; no backdrop blur;
  `.winner h1` underline (race and elimination); the Settings button as the prototype's
  icon button; `beeArt.ts` back to the prototype's jittered blobs (wobble 0.8), with the
  favicon, icons and share card regenerated by `build-brand-assets.mjs`.
- **Mistakes caught on the way:** the first art-pinning test used `node:crypto`, which
  the app's TypeScript types do not include, so `npm run build` failed; replaced with an
  inline FNV-1a hash. `unused-tokens.mjs` flagged `--hm-roughness` because only script
  reads it; the script now counts `getPropertyValue("--x")` (its header already said
  script use counts), and a misspelled read makes it fail again.
- **main merged in** (CORS preflight cache), so the guarded paths equal `main` again. One
  conflict, in this file: both sides had appended entries; both were kept.
- **Checks:** `npm run build` passes; lint 0 errors (11 old warnings, none in files this
  session touched); `npm test` 119; `npm run test:db` 97; `run-checks.mjs` 11/11 (contrast
  842 pairs, 0 failing; tier focus lowest 7.35:1; reduced motion 68/68, 60 identical and 8
  within tolerance). One earlier batch run had `check-reduced-motion` and
  `check-network-screens` crash with a Node stack trace (only the last line was kept). Both
  passed when run alone straight after, and the next full batch passed 11/11. The cause
  was not found; a reload of the harness during Vite's dependency re-optimisation after
  the merge is plausible but unconfirmed.
- **Bundle vs the branch before this session:** first load 348.9 -> 348.5 kB gzip (JS
  -0.4, CSS 0.0, fonts 0); the regenerated icons and share card are 23 kB smaller.

### Choices made without asking (conservative)
- Restored the prototype's bee drawing (no stinger, its own accessory shapes) rather than
  wobbling stage 6's redrawn curves, because the brief was "the prototype's values" and
  only the prototype was approved.
- The Settings button keeps an opaque `--panel-solid` fill (the prototype is translucent)
  because it is fixed over scrolling content; hover is unchanged.
- The bee wobble stays a constant in `beeArt.ts`, not a CSS token, because the same
  drawing is rendered at build time into the icons.
- No tilt token for panels: `rotate` on a panel would change its containing block for
  fixed descendants, and panels are not tilted at `light` anyway.
- No z-order or stacking changes in Panel, Sticker, BeeMascot or Rosette, no new hover
  effect, and no layering or flash checks (Ian's instruction; that is the next session).

### Open
- The layering and hover-flash session, built on these panels: start from the overlap
  list in CLAUDE.md.

## 2026-10-06 to 2026-10-09: layering, hover flash, and a stable check harness (redesign branch)

Commits 337703f to fef91ca, all pushed. Full detail is in each commit message and in
CLAUDE.md "Where an outline overlaps a decoration" and "Hover flash and harness stability".

- **Layering (337703f):** the home bee, home rosette and the solo new-best rosette sat
  under the panel's drawn outline. `.panel > :is(.mascot, .rosette) { z-index: 1 }`.
  `check-layering.mjs`: old build 6 of 22 overlaps fail, fixed 22/22 (0 of 3,084 points).
- **Hover flash, the shared compositing layer (18289a0, 55d99be, 5580ca7, 329f4ee):** a
  `transform` on hover split a squashed layer and re-rastered everything sharing it. The
  tier bars got stable layers (`will-change`); buttons and avatar options now move with
  `top`/`left`, which needs no layer (a `will-change` on buttons had re-layered the lobby
  once after load). Evidence in `docs/review/flash/`.
- **The IPv6-only dev server (8d0a84f):** the harness dev server listened on `[::1]` only;
  Chromium's IPv4 attempts stalled 2 s each on Windows, which explains the unexplained
  batch "crashes" from the 2026-10-06 entry. Checks now run against static builds on
  `127.0.0.1`, health-checked, with logs kept.
- **The full-page screenshot redraw (03c9fcd):** Playwright's `fullPage` capture
  occasionally re-rastered a layer just for that image (5 of 30 loads; 0 of 30 with
  viewport captures). The reduced-motion check now uses viewport captures and runs at
  zero tolerance (c7b40e1): three runs in a row of that check, 68/68 identical.
- **The criterion for visible flicker,** settled here: frames visibly change outside the
  element (sampled compositor frames, shimmer frozen). Paint area only finds candidates;
  a re-raster that restores the same pixels is not flicker. `sweep-hover-repaint.mjs`
  (fef91ca) is the candidate finder: it starts unfocused, ignores pixels that were
  already green (the clover avatar's art) and can hide the caret (`NO_CARET=1`).

### 2026-10-09: write-up only, nothing run
Ian asked for a memory check before each heavy step. Measured on 2026-10-09:
- First check: 3.57 GB free of 15.8 GB (Free, under the then 4 GB floor). Stopped.
- Second check, as Available (`\Memory\Available MBytes`): **2315 MB**, under the 3000 MB
  floor. Stopped again. No node or chrome process from this session was running either time.
- Ian then said to skip the heavy steps and do only this write-up. No build, server or
  browser was started, so there are no before/after numbers to log for heavy steps.

### Open (unverified on the current HEAD)
- The frame-sampling check on the Settings drawer ("Close settings" focus) and on the
  lobby text fields; fix only if frames visibly change outside the element.
- Three consecutive full `run-checks.mjs` runs, then the build, lint, unit, database and
  contrast gates.
- Whether the answer field's `scrollIntoView` on focus moves the page on desktop at each
  word; limit it to touch only if it does, and re-check phone width with touch emulation.

## 2026-10-12: redesign merged to main and verified live

Ian's review: the two-browser multiplayer pass was fine ("keyboard pass good enough").
The answer-field question was left open, so it was measured (below). The phone shimmer is
checked by Ian on the live site after the deploy.

### Before the merge (branch `redesign/spelling-bee`)
- main had nothing new for the branch (`git log HEAD..origin/main` empty).
- **Fresh clone** of the branch from GitHub into a temp folder, `npm ci`, `npm run build`
  with only the workflow's three `VITE_*` variables exported (no `.env` file in the clone):
  passed; the Supabase URL and Turnstile key were each found once in the bundle.
- Gates, one at a time, with Available memory read before each: lint 3738 MB (0 errors,
  11 warnings, exit 0); `npm test` 3732 MB (119/119); `npm run test:db` 3783 MB (97/97).
- **`run-checks.mjs` first failed for two harness bugs, not app bugs** (660394f):
  - its harness build passed an absolute `--outDir` through `spawn(..., { shell: true })`
    and the repo path has a space ("github projects"), so the argument split and the build
    failed; it is now `dist`, relative to the harness config's root (same folder);
  - with that fixed, 6 of 19 rows were "the app server is not answering before this
    script", every other script, while each of those scripts then passed against the same
    server. Cause: the probe used `fetch`'s keep-alive pool; each script runs under
    `spawnSync`, which blocks the runner's event loop for minutes; `vite preview` closes
    the idle socket after 5 s, the runner never processes the close, and the next probe is
    written onto a dead socket (ECONNRESET). Reproduced with both servers and blocking
    spawns: app `true, ECONNRESET, true, ECONNRESET...`, harness always `true`. With
    `http.get` and `agent: false`: 6/6 on both.
  - Playwright 1.64 was installed outside the repo and needed its own headless shell
    (chromium-headless-shell v1248).
- **Full suite after the fix (5955 MB): 13/13.** Contrast 840 pairs, 0 failing; tier bars
  0 failures (focus lowest 7.35:1); tier focus 0 of 12; settings dialog 0; keyboard
  elimination 0; reduced motion 68/68 pixel-identical at zero tolerance; network 36 loads,
  250 requests, 0 off-origin; layering 22 overlaps, 3,084 points, 0 under the outline;
  hover flash 32/32; real app 0; keyboard real app 0; unused selectors 0; unused tokens 0.
- **Saved-data compatibility, 17/17.** On the live site (pre-redesign main) a headless
  browser played a whole easy game (5 correct, 25 wrong), then set through the live Settings
  UI a display name, the three sliders, sound effects off, Light, and reduce motion on. Its
  localStorage (`best:easy` 150, `displayName`, `voice:rate` 1, `voice:volume` 0.85,
  `sfx:volume` 0.45, `sfx:enabled` false, `theme` light, `reduceMotion` true) was loaded
  into the branch build: light stays light (and paints the light palette), reduce motion
  stays on, "Best 150" on easy and 0 elsewhere; a lower score (1 correct) is not a new best
  and leaves 150; a higher score (30 correct) is a new best and stores 900; name, theme,
  switches and all three sliders show the stored values; after a reload nothing else was
  rewritten; the build contacted only its own origin. (A first run failed the slider row
  because the sound-effects volume slider only renders while sound effects are on, on main
  and on the branch alike; the test now switches it on to read it and off again.)
- **The answer field does not nudge the page at each word on desktop.** Counting the app's
  own `scrollIntoView` calls: exactly 1 per game (the input's first focus). At 1280x600 the
  page never moved; at 1366x520 and 1024x480 it moved once at round start (57 and 97 px)
  and then stayed put for every word. An apparent 8 px per word was the test's own reset
  plus the browser revealing the caret when typing. No change made.
- **CLAUDE.md trimmed** from 1,437 lines / 94.9 kB to about 20.8 kB (743847e); its full text
  is the "Archived CLAUDE.md" section below, checked line by line and in order, with a
  negative control (a planted line) that fails.

### The merge
- Tags pushed: `pre-redesign` -> 21c2601 (main before), `redesign-final` -> 743847e
  (branch tip). Branch kept.
- One squash commit, **08e95d0**, built in the temp clone: `git merge --squash` of the
  branch onto main, then the 540 images under `design/` and `docs/review/` removed from
  the index. Checked: the staged tree differs from `redesign-final` in exactly those 540
  paths; 14 images kept (6 README screenshots + `elimination.jpg`, and every icon, the
  favicon and the share card in `public/`); every image referenced by README, PRIVACY,
  `index.html`, the manifest and `src` resolves; all 32 design markdown docs kept; the tree
  builds. The design docs' links to the excluded images resolve on `redesign-final`.
- Sizes (uncompressed objects): main before 4.6 MB, after 13.2 MB (8.6 MB new); the same
  squash with the images would have added 57.4 MB; everything on GitHub including the tags
  and branch history is 72.9 MB.
- Pushed 21c2601..08e95d0. Deploy run 38332652884: build and deploy both success.

### After the deploy, on the live site
- Title "Spelling Bee | Hear the word. Spell it right."; the bundle hash
  (`index-BFZyqfqC.js`) equals the local build of the squash tree.
- 200 with the right types: `manifest.webmanifest` (application/manifest+json; name and
  short name Spelling Bee, start_url and scope `/spellingbee/`, three icons),
  `favicon.svg` (image/svg+xml, viewBox 0 0 100 100), and image/png at the declared sizes:
  favicon-32 32x32, apple-touch-icon 180x180, icon-192 192x192, icon-512 512x512,
  icon-maskable-512 512x512, og-card 1200x630 (and the og:image width/height tags agree).
- One word played in a browser (easy, "rocket", "Correct!"): 7 requests, all to
  `https://iangopen.github.io`. The Privacy link goes to PRIVACY.md on GitHub (200).
- README on main shows the six new screenshots, the same blobs as `redesign-final`. About:
  "Spelling Bee: a timed spelling game. Hear a word, type it. Singleplayer or real-time
  multiplayer on Supabase.", homepage the live URL, licence MIT.

### Rollback dry run
In a throwaway clone of local main (squash 08e95d0 plus the commit recording it), push URL
disabled, with the tags fetched:
- A plain `git revert --no-edit 08e95d0` conflicts on exactly `CLAUDE.md` and
  `docs/history.md` (this session's record edits both), which is why the documented command
  keeps the current version of those two and continues.
- The documented command produced revert commit a2d5902. Against `pre-redesign`, every path
  except those two docs is identical (`git diff --quiet pre-redesign HEAD -- . ':!CLAUDE.md'
  ':!docs/history.md'`); the code is therefore the exact tree that deployed successfully in
  run 37271108951.
- `git push --dry-run https://github.com/iangopen/spellingbee.git HEAD:main` reported
  `08e95d0..a2d5902  HEAD -> main` (a fast-forward), and `git ls-remote` showed GitHub's main
  still at 08e95d0: nothing was pushed.

### Choices made without asking
- The answer-field line was not filled in; it was measured instead of assumed, and no
  touch-only change was made because there is no per-word nudge.
- `design/stage-results/*.json` (5.2 MB) went to main: the rule excluded images only.
- Commits keep this repo's configured author name (`iangopenbusinessai`); the "Ian Gopen"
  name change discussed at the start of the session was for another repo.
- The fresh-clone build used `npm ci` as asked, while the workflow still runs
  `npm install`; both install from the same lockfile here.

## 2026-10-12: deploy workflow on a pinned runner, Node 22, npm ci

Why: run 38333072617 warned that `checkout@v4`, `setup-node@v4`,
`upload-artifact@v4` (inside `upload-pages-artifact@v3`) and `deploy-pages@v4`
target Node 20 and were being forced onto Node 24, and noticed that
`ubuntu-latest` moves to Ubuntu 26. It also built with `npm install` on Node 20,
which warned EBADENGINE for `@supabase/*` 2.110.8 (they require Node >= 22).

### What GitHub's own notices say (read 2026-10-12)
- Changelog 2025-09-19, "Deprecation of Node 20 on GitHub Actions runners":
  Node 24 default for JavaScript actions from 2026-06-16; Node 20 removed from
  runners on 2026-09-23 (the `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` opt-out
  works only until then). Changelog 2026-09-23, "Node 20 is no longer available
  in GitHub Actions", confirms the removal; Node 20 actions run on Node 24.
- actions/runner-images issue #14748 (opened 2026-09-17): `ubuntu-latest`
  becomes Ubuntu 26.04 in a rollout beginning 2026-10-19, to be complete by
  2026-11-19 (kernel 7.0, systemd 259; Java 17 default unchanged).

### Release notes read before each major bump
- `checkout` v4 -> v7: v5 Node 24 (runner >= 2.327.1); v6 persists credentials
  to a separate file; v7 ESM and blocks checking out fork PRs under
  `pull_request_target`/`workflow_run`. None apply (push to main only).
- `setup-node` v4 -> v7 (7.1.0): v5 auto-caches when `package.json` has a
  `packageManager` field (it has none, so no cache); v6 limits that to npm; v7
  ESM and drops the dummy `NODE_AUTH_TOKEN` export (we don't publish).
- `upload-pages-artifact` v3 -> v5: v4 excludes dotfiles from the artifact
  (`dist` has none); v5 uses `upload-artifact` v7 and adds
  `include-hidden-files`.
- `deploy-pages` v4 -> v5 (5.0.1): Node 24; 5.0.1 adds polling backoff.
- `configure-pages`: this workflow never used it, so it was not added.

### Change (commit a21e46a)
`runs-on: ubuntu-24.04` on both jobs, `node-version: 22`, `npm ci`, and the four
action bumps. Permissions, the three `VITE_*` secrets and the comments are
unchanged; there was no `concurrency` block before and none was added. The repo
has no `.nvmrc` or `engines` field, so nothing else names a Node version.

### Verification
- Local: fresh clone, Node 22.23.3 + npm 10.9.9 (the pair setup-node gives),
  `npm ci` with no EBADENGINE, the three `VITE_*` values from `.env.local`,
  `npm run build`: `index-BFZyqfqC.js`, `index-y9rZHhoN.css`.
- Deploy run 38350187205: success. Image `ubuntu-24.04`, node v22.23.3,
  `npm ci` added 114 packages (111 on Windows; platform-specific optional
  bindings). No annotations on either job; the log has no Node 20, runner-image
  or EBADENGINE lines. The one deprecation line left is Node's own `punycode`
  DEP0040, printed from inside `deploy-pages@v5`.
- Live vs the local build: all 19 files fetched; 15 byte-identical, 4 text files
  (`index.html`, `favicon.svg`, `manifest.webmanifest`,
  `third-party-licenses.txt`) differ only by CR characters (the Windows clone
  checks out CRLF under `core.autocrlf=true`) and are identical with CR removed.
- Live site: title "Spelling Bee | Hear the word. Spell it right."; manifest,
  favicon.svg, favicon-32, apple-touch-icon, icon-192, icon-512,
  icon-maskable-512 and og-card all 200 with the right types. One easy word
  played in Playwright ("zebra", Correct): 7 requests, all to
  `https://iangopen.github.io`.

## 2026-10-12: Node declared, deploy concurrency, npm audit triage

- Added `.nvmrc` (`22`) and `engines.node >=22.12.0` in `package.json` (also in
  the lockfile's root entry). No engine-strict. `npm ci` on Node 24.14.1: no
  EBADENGINE, 111 packages.
- Added `concurrency: { group: pages, cancel-in-progress: false }` to the deploy
  workflow. Nothing else in the workflow changed.
- Audit before: 1 high, `source-map-js` 1.2.1, GHSA-68fv-2mgg-jv7q (CWE-1284,
  CVSS 7.5 AV:N/AC:L/PR:N, availability only), range 1.0.0-1.2.1, fix available.
  Reach: dev-only. `npm ls` shows it under `vite > postcss` and
  `jsdom > css-tree`; `npm ls --omit=dev --all` finds no `source-map-js`, and the
  lockfile marks it `"dev": true`. The bug is in parsing indexed source maps
  (`sections`), which neither the app nor our build feeds it. Decision: apply the
  fix anyway because it is a patch release inside the existing `^1.2.1` range
  (`npm audit fix`, not `--force`; the only lockfile change is 1.2.1 -> 1.2.2).
  Audit after: 0 vulnerabilities.
- After the change: `npm test` 119/119, `npm run test:db` 97/97, build gives the
  same `index-BFZyqfqC.js` and `index-y9rZHhoN.css` as the live site. Memory read
  before each step: 2790, 2697, 3423, 5375 MB.
- Dependabot: `gh api .../dependabot/alerts` returns 403 "Dependabot alerts are
  disabled for this repository", so there are no alerts to compare; the
  advisory above came from `npm audit` alone.

## 2026-10-13: phone singleplayer: touch auto-submit, first-word speech, debug log

Reported: on a phone a correct word still needs Enter, and the word isn't spoken
when the round starts, only on "Hear it again". (Which phone and how often were
not given.) Branch `fix/mobile-singleplayer`, merged to main.

### Where the word is spoken, and whether it is inside a user gesture
1. `announceWord` (lead-in, pause, word) from `useAnnouncedWord`: an effect, a
   200 ms timer, then `await loadVoices()`. NOT in a gesture. For the first word
   the tap only starts the game (through a view transition); later words follow
   the 1.1 s feedback timer.
2. The word after the lead-in: the lead-in's `onend`, or a fallback timer. Not
   in a gesture.
3. `repeatWord` ("Hear it again", RoundScreen and TurnScreen): `onClick`, then
   one `await`. In a gesture.
4. `speakSample` (Settings "Test voice", choosing a voice): `onClick`.
5. `stopSpeaking` (Quit): cancel only.

### The four known causes, against the code
- iOS drops a first speak() outside a gesture: SUPPORTED. Every announcement is
  outside one; only the tap paths are inside, which matches the report exactly.
- Android voices load late: SUPPORTED, and worse than expected. After the 3 s
  wait timed out with no voices, `loadVoices()` returned that empty list for the
  rest of the page, so every later word was spoken with no voice set.
- cancel() straight before speak(): NOT supported. `afterClearing` only cancels
  when something is playing, then waits `CANCEL_SETTLE_MS` (the earlier fix).
- On-screen keyboard pausing speech: possible, not provable from code. The input
  is focused around the moment the announcement starts. The debug log shows it.

### Fixes
- `unlockSpeech()`: one silent utterance (empty, volume 0) spoken synchronously
  in singleplayer's start taps (tier bar, Play again), once per page; it also
  starts loading voices. Measured in headless Chrome: the engine ends it after
  ~1.1 s cold and ~0.2 s warm, and it was still "speaking" when the first word
  arrived, so the first announcement now WAITS for it (at most 1.5 s) instead of
  cancelling it.
- `loadVoices()` reads the list afresh after a timed-out wait.
- `speakTracked()`: an utterance not started after 1 s while nothing is speaking
  is cancelled and spoken again, once; the lead-in's fallback timer restarts with
  the retry (extending it instead broke an existing timing test).
- Touch auto-submit: `(pointer: coarse) and (hover: none)`, the comparison moved
  to `lib/answer.ts` (`guessMatches`; `checkAnswer` calls it), the same
  `submit()` as Enter, composition-aware, singleplayer only, Settings switch on
  touch devices (on by default).
- `?debug=speech`: lazy `SpeechDebug` chunk (0.9 kB gz). At phone width a
  three-line strip; measured clear of the answer field and Skip at 390x844
  (panel top 724, Skip bottom 610) and 360x640 (520 vs 517).

### Multiplayer
`unlockSpeech()` is called only from the two singleplayer start taps. The 1.5 s
wait is in the shared `afterClearing` but runs only while the unlock's own
utterance is playing. The retry and the late-voices fix are shared and change
nothing with a working engine. Three unit tests pin the multiplayer path: lead-in
in the same tick, word on its end, nothing else for 20 s.

### Verification
- Unit: 144/144 (was 119). On the old code 11 of the new tests failed (unlock,
  retry, late voices, auto-submit); the rest are guards that pass on both.
  `guessMatches` agrees with the old `checkAnswer` expression on all 1200 words x
  14 kinds of guess.
- `check-touch-autosubmit.mjs` (phone emulation 390x844, touch, isMobile): old
  build (`index-BFZyqfqC.js`, = live) 10 failures, exactly the new behaviour;
  the fix 23/23. While writing it, a race in the TEST: Settings returns focus to
  its gear from the dialog's `close` event ~10 ms after the open attribute goes,
  so fast typing landed on the gear and Enter reopened Settings. The test now
  waits for focus to settle; the app is unchanged.
- `check-real-app.mjs` (speech and sound): 0 failures, one silent unlock, 60
  utterances, 0 interrupted, same-origin only; its CONTROL=cancel negative still
  fails. `keyboard-real-app.mjs`: 0 failures. Unused selectors 0, dead tokens 0.
- Full run-checks did not complete on this laptop. Run 1: the app preview on
  4173 died silently mid-run (its log shows only the start line; later scripts
  got ERR_CONNECTION_REFUSED, i.e. nothing listening, not another project's
  server). Run 2 was stopped by Claude Code for low system memory after these
  passed: contrast (841 pairs, 0 failing), tier bars, tier focus, Settings
  dialog, elimination keyboard, reduced motion 68/68, network, layering. No app
  file changed after run 2 started; the five remaining checks above were run one
  at a time on the same bundle (`index-Dp6w6GCi.js`).
- Harness ports: run-checks now uses `SB_APP_PORT` (default 4273) and
  `SB_HARNESS_PORT` (default 5199) and refuses a taken port before building
  (0.1 s with a dummy server on 4273).
- The two contrast reports that run 2 regenerated were reverted: every changed
  row was a randomly chosen lead-in phrase (the lead-in colour), not a new
  element; the harness renders neither the touch-only switch nor the debug strip.
- Lint 0 errors (11 known warnings). Build passes. Database tests not run: nothing
  under `supabase/` or the data layer changed (the only guarded path touched is
  `useGameEngine.ts`, where `checkAnswer` calls `guessMatches` with the same
  expression).
- Memory was read before each step; two steps were skipped at 2269 and 2275 MB
  and resumed later; one check ran after a 2272 MB reading because the reading
  and the run were chained in one command (it passed).

## 2026-10-14: avatar parts, database side (branch feature/avatar-db, not applied)

**Brief (Ian).** Build only the database side of the approved avatar maker, plus a data-only
module. It must work with the deployed client. No UI, nothing applied to production.

**Picks:**
- **Cosmetics:** "make all of both playful and spelling themed". That is 14 cosmetics with
  None as 0: the playful set keeps its prototype indices 0–7, the spelling-themed items follow
  at 8–13, and Headphones is the same item in both. The cosmetic CHECK is therefore 0–13, not
  the brief's 0–7. The colour CHECK stays 0–7.
- **Display precision:** exact milliseconds only in the Hourglass results table.

**How avatars work today** (read on main `447214b`):
- `avatar_keys()` is defined in `0012_elimination_engine.sql:73-93`.
- `room_players.avatar` is `text not null default 'bee' check (avatar = any(avatar_keys()))`
  (`0012:343-345`).
- The UPDATE grant is `(display_name, avatar)` (`0012:359`). The INSERT grant is `(room_id,
  player_id, display_name, avatar)` (`0016:32-33`), and the backstop trigger is INSERT-only on
  four game columns (`0016:44-68`).
- RLS pins insert and update to the caller's own row (`0002:149-163`).
- **The deployed client:**
  - inserts the key only: `rooms.ts:119-121` (create) and `:178-180` (join);
  - updates the key only: `:225-230`;
  - reads an explicit column list: `PLAYER_COLUMNS`, `:52-53`.

**What was built:**
- **`supabase/migrations/0021_avatar_parts.sql`:**
  - the two smallint columns with range CHECKs;
  - the backfill from the key;
  - `room_players_avatar_sync` (security invoker, `search_path ''`, assigns only the three
    avatar fields);
  - grants widened by exactly the two columns, with the widening stated in the file;
  - the 0016 backstop extended to every game column on INSERT and UPDATE (plus `room_id` /
    `player_id` on UPDATE).
- **`supabase/rollback/0021_down.sql`**, with `avatar_parts_rollback.test.mjs`: the catalog
  returns to exactly 0001–0020 (columns and their grants, constraints, triggers, functions and
  their ACLs, policies). The snapshot moved to `tests/catalog.mjs`, and the 0016–0020 rollback
  test now stops at 0020.
- **`supabase/tests/avatar_parts.test.mjs`** (70 tests, writes in PostgREST's shapes):
  - bad values on insert and update (−1, past the end, 32767, null, 2.5, strings);
  - the exact grants;
  - game columns refused with or without the new columns;
  - the backstop refusing on its own when the grants are widened table-wide;
  - a bee change leaving every other column identical in race and elimination, lobby and
    mid-game;
  - another player's row untouched;
  - the old-key client path end to end;
  - all 8 keys round-trip, and all 112 pairs agree with the TS module;
  - one trigger firing at depth 1;
  - the backfill of rows that existed before 0021.
- **`src/lib/avatarParts.ts`** with 30 unit tests. Nothing imports it, so the built bundle is
  `index-Dp6w6GCi.js`, identical to live.
- **`supabase/scripts/verify_avatar.sql`:** one DO statement acting as throwaway guests
  through a transaction-local role and claims. It runs 34 checks and ends by raising its report,
  which rolls everything back.
  - Tested in PGlite (`verify_avatar_script.test.mjs`): 34 PASS / 0 FAIL with nothing kept,
    FAILs on a weakened migration, and a clean stop on a 0020 database.
  - It doesn't use an explicit BEGIN/ROLLBACK, so an error can't leave the editor's pooled
    connection in an aborted transaction.

**Weakened-migration runs** (`SB_MIGRATION_OVERRIDE`, a new harness hook), avatar suite:

| Weakening | Result |
|---|---|
| No CHECKs | 13 failures (every range test and the schema test) |
| No sync trigger | 14 failures (the mapping, the old-client path, the identical-row tests) |
| 0016 backstop unchanged | 6 failures (the backstop-alone tests) |
| Table-wide grants | 1 failure (the exact-grants test). The game-column tests still passed, because the widened backstop refused them: defence in depth working. |

**Gates:**
- `npm test`: 174 passed.
- `npm run test:db`: 175 passed (10 files).
- Lint: 0 errors (the known 11 warnings).
- Build: passes.
- Memory was read before each heavy step; the lowest reading was 2,432 MB (floor 2,000).

PRIVACY.md is unchanged: it already says the game stores your avatar and that room players see
it, and colour and cosmetic are that avatar.

**Open:** Ian applies 0021 (CLAUDE.md, Open, has the steps). The picker UI comes next.

## Archived CLAUDE.md (2026-10-12, before the trim)

CLAUDE.md had grown to 1,437 lines (95 kB), re-read at every session. On 2026-10-12, before
the redesign merged to main, it was cut to the standing rules and the current state. This is
its full text as it stood then, word for word; the only change is that every heading is two
levels deeper so it nests under this one. The rationale, measurements and session notes for
every rule in the trimmed file are here.

### Spelling Bee — CLAUDE.md

#### Project overview
Word-spelling game (Spelling Bee), built singleplayer first, multiplayer planned.
Stack: Vite + React + TypeScript, deployed to GitHub Pages via GitHub Actions.
Repo: https://github.com/iangopen/spellingbee
Live: https://iangopen.github.io/spellingbee/

#### CRITICAL: vite.config.ts
`base` must always be `'/spellingbee/'` — never change this, never remove it,
never revert to `base: '/'`. If the repo name above is wrong, update both
this file and vite.config.ts together, never just one.

#### Deploy
Deploys via `.github/workflows/deploy.yml` on every push to `main`
(GitHub Actions → Pages). Do NOT introduce the `gh-pages` npm package or a
`gh-pages` branch — this project deploys via Actions only.

#### Architecture rules — never violate
- All game state flows through the `GameState` shape in `src/types.ts`.
  Components only ever receive `GameState` as a prop — never call
  `useGameEngine` (or any future game-state hook) directly from inside a
  presentational component like `RoundScreen` or `ScoreBar`.
- Answer checking lives behind a single function boundary inside the engine
  hook — never inline the string-comparison logic anywhere else. This is the
  seam where multiplayer later swaps local comparison for a server
  round-trip without touching the UI.
- `WordEntry`'s shape is stable: `id, word, tier, definition, partOfSpeech?`.
  Don't bolt ad-hoc fields onto individual words — extend the interface if a
  field is genuinely needed everywhere, and update this file when you do.
- All speech synthesis goes through `src/lib/tts.ts` — never call
  `window.speechSynthesis` directly from a component.
  Every speak path goes through `afterClearing()` (2026-09-28 fix). It calls
  `cancel()` only when something is actually speaking or queued, then waits
  `CANCEL_SETTLE_MS` before speaking. The old unconditional cancel-then-speak
  in the same tick clipped the start of the lead-in in desktop Chrome. Don't
  "simplify" it back; `tts.test.ts` pins the sequencing.
- `DEFAULT_VOICE_NAME` ("Google UK English Male") is a chosen-by-ear hard
  default, checked in `pickAutoVoice` BEFORE the quality heuristic. Don't
  "simplify" it into a big score bonus: a bonus would still lose to some
  future Neural/Premium voice on another platform, and the point is that this
  exact voice wins wherever it exists. Priority is saved override > this >
  heuristic. The heuristic itself is untouched and still covers every browser
  that doesn't ship this voice. Its companion `DEFAULT_VOICE_RATE` (0.90)
  applies only when this voice is the one actually in effect, which is why
  `getRate()` has to consult `resolveVoice()` rather than return a constant.
- Word announcement has exactly ONE implementation: `useAnnouncedWord`
  (`src/hooks/useAnnouncedWord.ts`). Screens call that hook; the engine hooks
  deliberately never speak. Adding a speak call to `useGameEngine` or
  `useMultiplayerGame` would speak every word twice, because the screen already
  announces it.
  Through Session 17 this rule read "`RoundScreen` is the ONLY place that speaks
  a word", which was true while both modes rendered `RoundScreen`. Session 20
  gave elimination its own `TurnScreen` (a turn belongs to one player while
  everyone else watches — not `RoundScreen`'s shape), so the announcement moved
  into the hook rather than being copied into a second component. COPYING it
  is what would have broken the rule; the intent was always one implementation,
  so the spoken and displayed lead-in can never disagree.
  Both screens call it, including for eliminated spectators — someone watching
  the rest of the match should hear the words read out.
  It uses two entry points, and the split is deliberate (Session 17):
  - initial reveal -> `announceWord()`, which speaks a lead-in phrase, pauses,
    then the word, and returns the phrase so the screen can show it;
  - "Hear it again" -> `repeatWord()`, which speaks ONLY the word. On a replay
    the lead-in is pure latency in front of the thing the player asked for.
    `repeatWord` replaced the old unused `speakWord`; don't reintroduce it.
  The on-screen `.lead-in` line is NOT cleared or re-rolled by a replay — it
  still describes the announcement that introduced this word.
- All sound effects go through `src/lib/sfx.ts` — never construct an
  `AudioContext`, oscillator or `<audio>` element anywhere else. Exactly the
  rule `tts.ts` holds for speech, for the same reason: one file owns the
  device, so muting, volume and the autoplay-policy dance have a single
  implementation. Everything is synthesized from oscillators and gain
  envelopes; there are no audio files in this project and adding one would
  bring hosting, decoding, a loading state and a licence for three short UI
  sounds. WHEN a chime fires is `useSfxForOutcome`'s job (one hook, both
  screens, keyed so a re-render never replays it); HOW it sounds is sfx.ts's.
  Its settings are deliberately independent of the voice settings — separate
  toggle, separate volume, separate `spellingbee:sfx:*` keys — because
  narration and UI feedback are different preferences and neither reads the
  other's value.
- No component may assume there is exactly one player in a way that's hard
  to reverse later (e.g. hardcoded "your score" logic that can't extend to
  multiple players' scores once multiplayer exists).
- Every colour comes from a CSS custom property defined in `src/index.css`.
  Never hardcode a hex value in `App.css` or a component — the app ships a
  light and a dark theme, and a literal colour is invisible in one of them.
  Adding a token means adding it to BOTH palettes in the same edit.
- `src/lib/theme.ts` is the only place that reads or writes the theme. The
  stored value is `"light" | "dark" | null`, where null means DARK (redesign
  stage 1: the OS setting is no longer consulted, and nothing may re-add a
  `prefers-color-scheme` branch or listener). Only an explicit toggle writes,
  so the `spellingbee:theme` key and values are unchanged and a player who
  chose light before the redesign keeps light. `index.css` puts the dark
  palette on `:root`, so the first paint is dark with no script.

#### Core types

`DifficultyTier`, `WordEntry`, `RoundStatus`, `GameState`, `GameOptions` and
`GameEngineApi` all live in `src/types.ts` — read it there rather than from a
copy here that can drift. What that file cannot tell you:

`GameState.lastResponseMs` (Session 23) is the SECOND deliberate extension of
the Session 6 contract, following Session 13's `untimed`/`hideDefinition`
precedent exactly: additive, and defaulting to a value that means "not
applicable", so an engine that cannot supply it leaves every screen behaving as
it did before the field existed. It is how long the player took on the word that
just resolved, and it drives the "2.1s, 61 WPM" tail on the correct-feedback
line.

- `null` is a real state, not a placeholder for zero. It covers a timeout, a
  skip, a fresh round, and any mode that has no honest number. Nothing
  fabricates a duration — a screen given null renders exactly the old text.
- Every value is SERVER-measured in multiplayer: race reads `response_time_ms`
  out of submit-answer's payload, elimination reads it off the resolved
  `round_results` row (submit-turn does not return it, so the fast path from
  Session 22 reports null until the row lands rather than timing the client).
  Singleplayer measures with `performance.now()` from reveal to submit —
  deliberately not from `timeLeft`, which moves in whole seconds and would
  quantise every WPM figure.
- WPM uses the standard single-word convention, `(length / 5) / (seconds / 60)`,
  in `src/lib/wpm.ts` — one implementation, so the two screens cannot drift.

`untimed` and `hideDefinition` describe how the CURRENT game is being played,
not a stored preference — they're picked per run on the difficulty screen and
live in `GameState` so screens render from state alone, like every other field.
They are singleplayer-only: `useMultiplayerGame` accepts `options` and drops it
(a room's clock is enforced by `advance_round_tx` and the word is shared, so one
client cannot opt out of either) and always reports both as `false`.

#### Current state
Singleplayer is complete and deployed: difficulty select → timed word round
with spoken pronunciation → scoring/streak tracking → results screen.

The multiplayer backend schema is live and verified (Sessions 7 / 7b). A real
Supabase project holds the `words`, `rooms`, `room_players`, and
`round_results` tables with RLS enforced; the migrations live in `supabase/`
and were applied via `supabase db push`. Verified against the live project:
anonymous sign-in works, `words` is seeded from the word bank (see below),
and the write-protection policies hold — clients cannot directly change
`rooms.status` or `room_players.score`, and `get_room_by_code()` leaks no
`host_id`.

The multiplayer **lobby** is wired up (Session 8) and runs alongside
singleplayer, which is untouched. `src/lib/supabaseClient.ts` exports the one
client (env vars only, never hardcoded); `useSupabaseUser` signs the visitor in
anonymously once per load using supabase-js's default session persistence.
`src/lib/rooms.ts` is the only place that talks to the room tables — create,
join-by-code via `get_room_by_code()`, self-leave, and a Realtime subscription
to `room_players`. Lobby cap is `PLAYER_CAP = 8`. Since 0019 the database enforces it race-free
(`player_cap()`, see Security below); the client constant only words the error,
and the old join-then-back-out is gone.
Migrations `0004_realtime.sql` (adds `room_players` to the realtime publication)
and `0005_self_leave.sql` (a player may DELETE only their own row, only while
`status='lobby'`) were applied via `supabase db push`.

The **server-authoritative round engine** is live (Session 9a). Migration
`0006_round_engine.sql` adds `rooms.round_started_at`, the `round_attempts`
audit table, and three plpgsql transition functions; three edge functions
(`start-game`, `submit-answer`, `advance-round`) are deployed. Verified against
the live project by `supabase/scripts/verify_functions.mjs` and
`verify_race.mjs`.

Rules this engine must keep:
- Game logic lives in the plpgsql functions in `0006`, NOT in the edge
  functions, because each transition is multi-statement and contended and a
  plpgsql function is a single transaction. Edge functions do auth + HTTP only.
- `start_game_tx` / `submit_answer_tx` / `advance_round_tx` take the acting
  player as a parameter, so they are granted to `service_role` ONLY. Never
  grant them to `authenticated` — that would let any client impersonate anyone.
- `submit-answer` accepts no client-supplied correctness or timing. Response
  time is measured from `rooms.round_started_at` to server receipt. Don't add a
  client-time parameter "for accuracy".
- The winner is claimed by a conditional `UPDATE ... WHERE winner_id IS NULL`.
  Don't refactor that into a read-then-write.
- `ROUND_SECONDS` in `useGameEngine.ts` and `public.round_seconds()` must stay
  in sync — the client renders the countdown, the server enforces it.

**Multiplayer is playable end to end** (Session 9b). `useMultiplayerGame(roomId)`
satisfies `GameEngineApi` exactly, so `App.tsx` runs it beside `useGameEngine`
and the screens can't tell which engine produced their `GameState`.
`rooms.ts`'s `startGame()` is no longer a stub — it, `submitAnswer` and
`advanceRound` call the edge functions. Migration `0007` publishes `rooms` and
`round_results` to Realtime; `0008` adds `server_now()`.

Rules this hook must keep:
- It computes NO outcomes. Correctness, winner, scores and game-over all
  arrive as database changes over Realtime. Never add a local answer
  comparison — that seam belongs to the server.
- Round timing is server-derived: the deadline is `rooms.round_started_at` plus
  `round_seconds(tier)` fetched by RPC, and "now" comes from `serverClock.ts`,
  which syncs against `server_now()`. Never import or copy `ROUND_SECONDS`
  from `useGameEngine.ts` into the multiplayer path.
- `timeLeft` must derive from the ticking `nowMs` STATE. Deriving it from
  `serverNow()` inside a memo silently freezes the countdown, because React
  can't see the clock move (this bug shipped and was caught in testing).
- `skipWord` is intentionally a no-op: the word is shared and rounds end on a
  winner or the server clock, so there is no per-player skip to perform. The
  Skip button is hidden via `RoundScreen`'s `canSkip={false}` rather than left
  as a dead control.
- Leaving mid-game: the player's `room_players` row stays (0005 permits
  self-delete only in 'lobby'), so their score remains on the scoreboard and
  they simply forfeit the remaining rounds. The game continues without them.

**Rounds now advance with no client attached** (Session 10). Migration `0009`
enables pg_cron (1.6.4 on this project, which supports sub-minute interval
schedules) and runs `sweep_expired_rounds()` every 5 seconds. Verified live:
with both browser tabs CLOSED, a game advanced rounds 2→10 and reached
`finished` entirely on its own, at a steady 20.0s per round.

Rules this sweeper must keep:
- It contains NO game rules. It selects rooms on `status = 'active'` and calls
  `advance_round_tx`, which stays the single authority on whether a round is
  over. Do NOT add a deadline predicate to the sweep's WHERE clause — that
  would create a second copy of the rule that can drift. `advance_round_tx` is
  already a cheap no-op for a room that isn't due.
- It passes the room's earliest-joined member as the acting player purely to
  satisfy `advance_round_tx`'s membership guard; `p_player` is used for nothing
  else and no game rule depends on which member is named.
- It is not an exposed RPC — revoked from anon/authenticated, so a client
  calling it gets 42501. The pg_cron job runs as the function owner.

The client polling loop from 9b is KEPT as the primary fast path, deliberately
against the "make it a 30s fallback" suggestion. Reason: the sweeper's floor is
its 5s tick, so relying on it alone would stretch every round transition's
feedback window from ~1.25s to 1.1-6.1s for games someone is actually watching
— a visible regression in the common case. Keeping both gives ~150ms
transitions when anyone is present and a guaranteed ≤5s backstop when nobody
is. They cannot conflict: `advance_round_tx` takes `for update` on the room and
rejects any call whose expected round no longer matches, so at most one caller
can ever advance a given round (verified with 6 concurrent client calls per
round racing the sweeper — exactly one winner each time, contiguous rounds, no
errors).

The UI was **redesigned around the bee/honeycomb concept** (Session 12). This
was a presentation-only change: `src/hooks/`, `src/types.ts`, `src/lib/rooms.ts`
and `src/lib/tts.ts` were not touched, and `checkAnswer`/`GameEngineApi` are
unchanged. Icons come from `lucide-react` (the lighter install of the two
candidates; +5.2 kB raw / +2.0 kB gzip for 8 icons, so it tree-shakes). No emoji
are used as UI any more.

Rules this redesign must keep:
- The tier cards' `clip-path` hexagon IS the tap target — browsers hit-test
  against the clipped shape, not the layout box. So `getBoundingClientRect`
  alone OVERSTATES the target and is not a sufficient check; measure the
  inscribed area with `elementFromPoint` probes. Measured live: 90px inscribed
  square at 380px viewport, 84px at 320px, against a 44px floor.
- `.tier-card` needs both `width: 100%` (form controls resolve `normal` grid
  alignment to `start`, not `stretch`, so a bare button won't fill its column)
  and `min-width: 0` (otherwise the blurb's min-content width floors the grid
  and it silently eats the shell's padding on narrow phones). Both were real
  bugs caught by measuring.
- A `clip-path` also clips borders, outlines and box-shadows, so the hex rim is
  an inset `::before` and `:focus-visible` thickens that rim. Don't "fix" focus
  by adding an outline — it will not be visible.
- All motion is decoration on top of a state that is already visible without it
  (a coloured border, a number changing). That is what makes the single global
  `prefers-reduced-motion: reduce` block in `index.css` safe: it can switch
  everything off without hiding information. Keep new animations inside that
  guarantee rather than adding per-rule opt-outs.
- The streak pulse re-triggers by REMOUNTING the span via a changing `key`.
  A CSS animation does not replay on a re-render, only on a remount. It fires
  on an increase only — a streak reset deliberately doesn't animate.

A **global settings panel** and a **redesigned difficulty screen** landed in
Session 13. `SettingsPanel` is the single home for cross-cutting preferences —
display name, voice/rate/volume, theme, an in-app reduce-motion override, and a
reset-best-scores action behind a two-step in-panel confirm. It absorbed Session
11's `VoiceSettings` and Session 12's floating `ThemeToggle`; **both components
were deleted**, so don't go looking for them.

Rules this session must keep:
- Settings holds only genuinely global preferences. Per-run modifiers
  (practice mode, hide definition) belong on the difficulty screen and travel
  through `startGame`'s `GameOptions`, never through localStorage.
- The in-app reduce-motion override can only ADD suppression on top of the OS
  `prefers-reduced-motion`. There is deliberately no way to use it to force
  animation back on for someone whose system asked for less.
- Practice mode holds `timeLeft` at 0 rather than freezing it at the round
  length. Scoring is `10 + timeLeft` per word, so a frozen full clock would
  hand out a perfect time bonus on every word. At 0 the scoring code needs no
  special case.
- For the same reason, practice runs do NOT record best scores — an untimed
  score isn't on the same scale as a timed one. `hideDefinition` runs DO count;
  that mode is harder, not easier.
- The tier bars are `clip-path` shapes, so the same Session 12 rule applies:
  `getBoundingClientRect` overstates the tap target and `elementFromPoint`
  probing is the only honest measurement.

**Eight difficulty tiers** since Session 15 (migration `0010_eight_tiers.sql`,
applied and verified live by `supabase/scripts/verify_tiers.mjs`).

Order, easiest to hardest, with round length:

| tier     | seconds | notes                                  |
|----------|---------|----------------------------------------|
| novice   | 22      | new                                    |
| easy     | 20      | unchanged anchor                       |
| building | 18      | new                                    |
| medium   | 16      | unchanged anchor                       |
| advanced | 14      | new                                    |
| hard     | 13      | unchanged anchor                       |
| expert   | 13      | **raised from 11s**                    |
| master   | 13      | new                                    |

Rules this scheme must keep:
- The original four keep their EXACT string values (`easy`/`medium`/`hard`/
  `expert`) even though their relative position shifted. That is the only
  reason no data migration was needed: existing `spellingbee:best:<tier>`
  localStorage keys and existing `words.tier`/`rooms.tier` rows stayed valid.
  Never rename them.
- The curve descends smoothly to `hard` and then FLATTENS — expert and master
  sit at hard's 13s. Deliberate: the top three tiers get their difficulty from
  word content, not extra time pressure. Do not tighten them below 13.
- `ROUND_SECONDS` in `useGameEngine.ts` and `public.round_seconds()` in 0010
  must stay in sync, and the multiplayer path must keep reading the SQL
  function by RPC rather than importing the client constant (the Session 9b
  rule). Verified live: an expert room rendered a 13s countdown from the server.
- `TIER_ORDER` (types.ts) is the one place the ordering lives; `TIER_META` /
  `TIERS` (src/lib/tiers.ts) is the one place labels live. Before Session 15
  the difficulty screen, the lobby picker and the waiting room each kept their
  own list — don't reintroduce that.
- Eight bars stay ONE page-scrolling stack. Bars went 64px -> 54px and the gap
  8px -> 6px so all eight fit ~474px, inside a phone viewport. An inner scroll
  container was rejected: it would hide the hardest tiers behind a scrollbar
  inside a page that already scrolls.

The **word bank is ~1200 words, 150 per tier** (Session 16). Its sourcing, id
prefixes, definition rule and verify gate live in `src/data/words/CLAUDE.md`,
and the generated seed migration in `supabase/CLAUDE.md` — both load when you
work in those directories. Read them before touching word content.

A **draining timer bar** sits under the guess input (Session 17). It is shared
by both modes for free, because both render `RoundScreen`.

Rules this bar must keep:
- It is a pure VIEW of `GameState.timeLeft`. No timer, interval, animation
  clock or round-length constant lives in `RoundScreen` — adding one would put
  a second source of truth next to the engine that already owns the countdown.
- Its full scale comes from the largest `timeLeft` seen for the current word
  (`spanRef`), NOT from a constant. That is the whole reason one bar can serve
  both engines: singleplayer's `ROUND_SECONDS` and multiplayer's server-derived
  `round_seconds()` each arrive as the opening value of `timeLeft`. Never
  "improve" this by importing `ROUND_SECONDS` — the Session 9b rule forbids the
  multiplayer path from ever seeing it. In multiplayer the peak can't overshoot
  either, because `useMultiplayerGame` already clamps `timeLeft` to
  `constants.roundSeconds`.
- The smooth drain is a 1s linear CSS `transition` on width, nothing else. Both
  engines tick in whole seconds; the transition is what makes that read as
  motion. It costs a ≤1s visual lag behind the numeral, which is the accepted
  price of not running a second clock.
- The fill is keyed by word id so a new round SNAPS back to full instead of
  animating upward.
- Practice mode renders no bar at all (`untimed` holds `timeLeft` at 0, so a
  track would just sit empty), and the bar is `aria-hidden` because `ScoreBar`
  already exposes the same countdown as text.
- Urgency is two threshold classes (`low` <=45%, `critical` <=20%), not a
  computed gradient, so both themes stay readable and the colours stay tokens.
  Under reduced motion the global `index.css` block collapses the transition
  and the pulse; the bar then steps once a second and loses no information,
  which is exactly the Session 12 guarantee.

A **turn-based elimination engine** landed in Session 18 (migration
`0012_elimination_engine.sql`, applied and verified live by
`supabase/scripts/verify_elimination.mjs` — all 9 sections pass). This is a
different game from the 0006 race, not an extension of it: one player at a time
gets a word, correct survives and passes the turn, a wrong answer OR a timeout
costs a life, 0 lives eliminates, and the game ends the instant one player
remains. Schema + plpgsql only — **no edge function, sweeper or `src/` changes
yet**, so nothing routes to this engine until the next session wires it up.

Both engines coexist, chosen by the new `rooms.mode` (`'race'` | `'elimination'`,
defaults to `'race'`). 0006's functions are untouched.

Rules this engine must keep:
- **The sweeper interlock is the data shape, not a rule.** An elimination game
  never writes `rooms.round_started_at`; it keeps its clock on
  `round_results.turn_started_at`. 0009's sweep selects on
  `status='active' AND round_started_at IS NOT NULL`, so elimination rooms are
  excluded without editing 0009. If you ever set `round_started_at` here, the
  race sweeper will corrupt the room. Per-turn timing also has to live on the
  turn row because each turn has its own decayed length.
- **`turn_order` defines who is in the game.** `start_elimination_game_tx` deals
  a slot to everyone present; every later question (still standing? who's next?
  won yet?) is asked only of players holding one, via
  `elimination_survivors()`. A row without a slot is a spectator. This is load
  bearing: 0002 lets a client INSERT into `room_players` with no status
  predicate, and before this guard one uninvited join made survivors exceed
  `starting_players`, so `decayed_round_seconds` raised 22023 and every later
  answer and timeout aborted — a permanent wedge any stranger could trigger. A
  restrictive INSERT policy now also refuses mid-game joins, scoped to
  elimination rooms past the lobby so race rooms keep 0002's behaviour exactly.
  It needs the `room_accepts_new_players` SECURITY DEFINER helper because a
  joiner is not yet a member and so cannot see the `rooms` row under its own RLS
  (unlike 0005's self-leave policy, where the actor already is a member).
- **Turn order is randomized once** (`row_number() over (order by random())`)
  and never renumbered. Elimination removes players from the rotation; the
  survivors keep the order they have been watching.
- **`apply_turn_outcome` is the single resolution path.** Both a submitted
  answer and a timeout go through it, so a timeout cannot grow its own copy of
  the elimination rule. Same reasoning that made `advance_round_tx` the single
  advancement path in 0006. It assumes its caller holds the room lock.
- **`rounds_per_game()` does not apply here.** That was the race model's budget;
  this mode ends on elimination. It is neither read nor changed.
- Decay is `decayed_round_seconds(tier, starting_players, remaining, streak)` —
  the single source of truth, callable standalone for testing, and read by the
  client rather than recomputed (the Session 9b rule). Three stacking triggers,
  all tunables in `decay_params()`:
  - player count: starts at `remaining <= ceil(N/2)`, −10% then −5% per further
    elimination, capped at −30%. **`N=2` is exempt entirely** (a 1v1 is already
    a duel).
  - streak stage 1: table-wide consecutive correct >= 5 → −10%.
  - streak stage 2: >= 9 → an **additional** −15%, so −25% total, not a
    replacement for stage 1.
  - combined **multiplicatively**: `round(base * (1-player_cut) * (1-streak_cut))`,
    then clamped ONCE, last, to `[min_seconds, base]`. Multiplicative so raising
    a tunable can never reach a zero-second turn; one clamp so the order the
    factors are applied in cannot matter. Don't sum them, don't clamp between.
- Avatars are a fixed preset set in `avatar_keys()`, which the `room_players.avatar`
  CHECK reads — so the list has one definition. `avatar` joins `display_name` as
  the only client-updatable column, and is the one per-player column the engine
  does NOT reset at game start.

**Elimination mode is reachable over HTTP** since Session 19: edge functions
`start-elimination-game` and `submit-turn`, migrations `0013` (widened
`get_room_by_code`), `0014` (elimination sweeper) and `0015` (race-mode guards),
all deployed and verified live by
`supabase/scripts/verify_elimination_functions.mjs` (7 sections, all passing).
Still **no `src/` changes** — Session 20 wires up the client and the spectator
view.

Rules this session must keep:
- The two new functions are `auth + HTTP` and nothing else, like every 9a
  function. Host-ness, mode, status, player count, turn ownership, correctness,
  timing, lives, elimination and the next turn's duration are ALL decided inside
  the 0012 SQL. Notably the minimum player count is never named in TypeScript.
  A precondition re-checked in the edge function would be a second, racy copy of
  a rule the SQL already enforces inside its row lock.
- `submit-turn` passes `next_round_seconds` straight through from
  `submit_turn_answer_tx`. Never recompute a duration from `decay_params()` in
  TypeScript — that would be a second implementation of the three-trigger curve
  in a language that cannot see the room's state.
- **Two sweepers, not one.** `sweep_expired_rounds()` (0009) is untouched;
  `sweep_expired_turns()` (0014) is a separate function on a separate 5s
  `pg_cron` job. Folding them together would need a branch on `mode` inside a
  sweeper, which is exactly the "no game rules in the sweep" rule 0009 sets.
- `sweep_expired_turns()` has **no deadline predicate**, deliberately, and this
  is the one place a session brief and 0009's stated rule disagreed — 0009 wins.
  A turn's deadline is `turn_started_at` + that turn's own frozen
  `round_seconds` + `late_grace_ms()`, where the duration came from the decay
  curve; restating that in a scheduler would put a copy of the decay contract
  somewhere that silently drifts the day `decay_params()` is retuned.
  `timeout_turn_tx` is already a cheap no-op for a turn that isn't due.
- It passes **no acting player** — `timeout_turn_tx`'s `p_caller` is optional
  precisely for this. 0009 had to invent an actor to satisfy `advance_round_tx`'s
  membership guard; don't copy that here.
- **0015 closed a real cross-mode hole, found by actually testing the direction
  nobody had.** The 0012 functions all reject non-elimination rooms, but 0006
  predated `rooms.mode` and rejected nothing, and its endpoints are public.
  Worst case was `advance_round_tx`: its "is the round over?" check compares
  `now()` against `round_started_at + limit`, which is NULL in an elimination
  room, so the comparison was NULL and the guard **failed open** — any member
  could advance another player's turn, and the advance wrote `round_started_at`,
  putting the room into both sweepers at once. All three race functions now
  check `mode = 'race'` first. For every real race room this is invariably true,
  so 9a behaviour is unchanged; only the previously-undefined cross-mode case
  differs. When adding an engine, guard BOTH directions.
- Avatars needed no new code: the `room_players.avatar` CHECK against
  `avatar_keys()` validates, the column default supplies `'bee'`, and joining is
  a plain client INSERT with no edge function to add a check to. Re-validating
  the preset list in TypeScript would duplicate the constraint. Verified on the
  real join path, including that an off-list key is refused on INSERT and UPDATE.
- `get_room_by_code()` needed a DROP and recreate, not `create or replace` —
  for a `RETURNS TABLE` function the column list is the OUT parameters, so
  replacing in place fails with 42P13. DROP also discards the grants, so they
  must be reissued in the same migration.
- Verification scripts reuse a **cached pool of anonymous users**
  (`POOL_SIZE`, cached in the OS temp dir). Supabase rate-limits anonymous
  sign-ups per IP per hour and a script that signs up fresh users per section
  exhausts it and then fails halfway, which reads as a verification failure but
  is only a harness limit. Save the cache after every acquisition, not at the
  end, or a rate-limited run throws away the identities it did get.
- `verify.mjs` (Session 7b) was repaired, not changed in intent: its room and
  player INSERTs asked for `return=representation`, and Postgres applies the
  SELECT policy to an INSERT's RETURNING clause. The host is not yet a member
  when creating a room, and `is_room_member()` cannot see the row being inserted
  by that very statement, so both RETURNINGs were refused with 42501 while the
  INSERTs themselves were perfectly legal. It now uses a client-side id and
  `return=minimal`, which is what `src/lib/rooms.ts` always did.

**Elimination mode is playable in the browser** since Session 20. This was a
`src/`-only session: no migration, no edge function, and no change to
`checkAnswer`, `useGameEngine` or the 0012 SQL. `GameEngineApi` did NOT need to
change — everything elimination-specific arrived as `MultiplayerExtras` fields,
the same seam Session 9b used for `winnerName` / `awaitingOthers`.

New files: `TurnScreen`, `EliminationResults`, `AvatarPicker`, `TimerBar`,
`useAnnouncedWord`, `lib/avatars.ts`.

Rules this session must keep:
- **Elimination gets its own screen, not a mode flag inside `RoundScreen`.**
  `RoundScreen`'s premise is "the word is yours and you are typing it".
  Elimination inverts it: one player answers while everyone else watches, and
  some watchers can never answer again. What genuinely fits is shared as
  COMPONENTS — `TimerBar` (Session 17's bar, extracted unchanged) and
  `useAnnouncedWord` — not copied.
- **The guess input is ABSENT for non-holders, not disabled.** For anyone whose
  turn it is not, the `<form>` is not in the tree at all, so there is nothing to
  re-enable from devtools and nothing to submit. Verified live: the turn holder's
  DOM had 1 input / 1 form, both other clients had 0 / 0. The server is still
  the real guard (`not_your_turn`); this only stops the UI lying about what you
  can do. A disabled input would also just read as a broken page.
- **`src/lib/avatars.ts` is the client's ONE copy of the preset list** and must
  equal `public.avatar_keys()` (0012), which the `room_players.avatar` CHECK
  validates against. The database is the authority. The coupling is ASSERTED,
  not just commented: `supabase/scripts/verify_elimination_client.mjs` reads
  `avatar_keys()` off the live database and fails if the two disagree. Same
  discipline as Session 15's tier de-duplication. Read stale values back through
  `coerceAvatar` so an unknown key renders as a bee instead of crashing a roster.
- **No decay arithmetic on the client, ever.** The turn's length is read from
  `round_results.round_seconds`, which the server froze when the turn opened —
  deliberately NOT from `submit-turn`'s `next_round_seconds`, because only the
  player who answered ever sees that HTTP response. Every other client (the next
  holder, waiting players, eliminated spectators) learns the duration from that
  row over Realtime. Both carry the identical server value, so reading the row is
  the same number for strictly more clients.
- **The knockout overlay is LATCHED, and dismissed by an elapsed-time check.**
  `amEliminated` is true forever after, but the moment is one event and gets its
  own beat (`KNOCKOUT_MS` 4.2s) before spectating begins; latching also captures
  the word before the next turn arrives underneath. A bare `setTimeout` was the
  first version and was wrong: background tabs throttle timers and it held the
  full-screen overlay up for 24s in testing, hiding the rest of the match from
  the player it had just knocked out. It now re-checks a deadline on every
  render, which during a live game is far more often than once every 4s.
- **`isMyTurn` must not depend on the clock.** It derives from server facts only.
  An earlier version also required `!inFeedback`, which is derived from the
  ticking `nowMs`; a throttled hidden tab left it true for the whole turn, so the
  holder's input never appeared and they could only time out. Making the
  countdown lag is the accepted Session 9b cost; making the CONTROL vanish is not.
- **`refresh()` reads everything first and commits state LAST**, in one batch.
  Interleaving `await`s with `setState` ends React's batching and produced renders
  where `players` (carrying `is_eliminated`) committed a tick before `prevTurn`
  (carrying the word that did it) — so the elimination moment latched with no
  word and fell back to generic text. Anything that latches on a transition must
  be able to trust what it reads alongside it.
- **Placement is survival order, not score.** 1st is `rooms.winner_id`; 2nd..Nth
  is `extras.eliminationOrder` REVERSED, so whoever was knocked out last places
  highest. `eliminationOrder` is presentation-only: it orders players the SERVER
  already flagged `is_eliminated`, keyed by the round of their last losing turn
  (which is by definition the turn that took their final life, since a player gets
  no turns after elimination). Score is displayed but explicitly labelled as not
  deciding the order. A NULL `winner_id` (the degenerate words-ran-out tie) renders
  an honest draw rather than "undefined wins".
- **Leaving mid-game is a forfeit, not an instant elimination.** This was a free
  choice and it follows 0005: the self-delete policy only permits leaving in
  'lobby', so a leaver's `room_players` row stays, their score stays on the
  scoreboard, and their turns simply time out — one life each — until they are
  eliminated by the ordinary rule. Instant elimination was rejected because it
  would need a new server transition this session was not allowed to add, and
  because a dropped connection and a deliberate quit are indistinguishable to the
  client; letting the existing timeout rule handle both keeps ONE rule. The exit
  control says so ("you forfeit — your turns will time out and cost a life each")
  and is a two-step confirm, matching `RoundScreen`'s quit.
- **The known gap, carried forward from Session 19:** elimination has no client
  fast path for an expired turn. `timeout_turn_tx` is service_role-only with no
  edge function in front of it, so a watching client cannot nudge a dead turn the
  way race mode's `advance-round` can, and an abandoned turn ends only when
  0014's 5s sweep reaches it. `useMultiplayerGame` therefore returns early for
  elimination rooms rather than working around it: calling `advance-round` would
  return `wrong_mode` since 0015 and belongs to the other engine, and
  reimplementing the timeout locally is exactly the duplication the architecture
  forbids. A `timeout-turn` edge function is the fix.

**TurnScreen's table is a row of avatar tokens** since Session 21, and the screen
got a spacing pass. Presentation only: `useMultiplayerGame`, `GameEngineApi`,
0012 and `checkAnswer` are untouched, and everything renders from data that was
already in `MultiplayerExtras`. Two files plus one token.

Rules this session must keep:
- **Every new rule is scoped under `.turn-screen` or `.ptoken*`.** `.prompt-card`,
  `.lead-in`, `.answer-field`, `.timer-track`, `.feedback`, `.result-note` and
  `.score-bar` are all SHARED with `RoundScreen`, so an unscoped tweak silently
  moves singleplayer and race mode. Verified by measuring: outside `.turn-screen`,
  `.prompt-card` still computes `margin-bottom: 20px` and `.timer-track` `0px`.
- **The reading order is deliberate**, and replaced a flat `gap: 12px` that made
  everything equidistant and therefore unrelated: HUD -> who is up -> the word ->
  the action -> the clock -> the outcome -> the table. Gap now encodes grouping,
  tight within a group and loose between. The biggest break on the screen is
  between the definition card and the input: above it is what you are being
  asked, below it is what you do about it.
- **The token row goes BELOW the timer bar, not between input and bar.** Session
  17 welded the bar to the guess input — it drains under the thing it is timing —
  so putting faces between them would split that pair. Input and bar sit 6px
  apart; the tokens are the last thing on the screen because they are ambient
  state, not the task.
- **`.turn-feedback` is a reserved slot with a fixed min-height.** Feedback shows
  for the ~1.1s server window and leaves; letting it insert and remove itself
  shoved everything below it up and down every single turn. It sits directly
  above the tokens so "Missed — the word was X" reads into the token that just
  lost a heart.
- **The tokens are purely informational.** No button, no link, no tabindex,
  nothing focusable, and deliberately no `:hover`/`:focus` styling — suggesting
  they can be pressed would be a lie. So there is no tap target to measure here;
  confirmed by querying the row for interactive elements and getting zero.
- **Ghost state is a swap, not a dim.** The avatar glyph is replaced by lucide's
  `Ghost`, the disc goes translucent + dashed + `--out`, and the name is struck
  through. This is a STATE, never a ninth avatar: `AVATAR_KEYS` is untouched and
  is still the one preset list the 0012 CHECK validates.
- **The ghost drift must stay decoration.** Its resting state is `transform: none`,
  which is what `.ptoken-disc` already has, so when the Session 13 reduce-motion
  block collapses the animation to 0.001ms/1 iteration with no fill-mode, the disc
  reverts to exactly that. Suppression cannot strand a ghost mid-drift. The
  desaturation is a `filter`, not an animation, so the ghost stays distinct with
  motion off. Verified through the real settings toggle, not by reading the CSS:
  drift on gave 10 distinct transforms in 1.8s, drift off gave 1 (`none`), and
  opacity/grayscale/dashed/ghost-icon all survived.
- **Ghosting is a fact about the game, not a private notification.** It is driven
  only by `p.is_eliminated` from the server row over Realtime; nothing branches on
  who is looking. Verified on three clients at once, including the ghosted
  player's own screen, which shows them as `ptoken ghost you`.
- `--honey-glow` was added for the turn-holder halo because a glow needs alpha
  and no existing token carries it. Added to all three palette blocks (dark, and
  both light) in the same edit, per the colour rule.

**The timer bar was one tick behind the numeral, and is now exact** (Session 23).

- Root cause, and it was NOT the span capture or the keyed reset: `.timer-fill`
  drains via `transition: width 1s linear` while the engines tick in whole
  seconds. Setting the width to `timeLeft / span` meant the bar only STARTED
  moving toward N/span when the numeral changed to N, arriving there as the
  numeral became N-1. At 16s the bar read 93.8% when the numeral already said
  14/16 = 87.5%, and it reached empty at t=17s while the numeral hit 0 at t=16s
  — which is why it looked synced to the next word (singleplayer's feedback
  delay is 1100ms, so the next word arrived ~100ms after the bar finally
  emptied).
- The fix aims one step AHEAD: the width target is `(timeLeft - 1) / span`, so
  during the second the numeral reads N the bar travels from N/span to
  (N-1)/span. The transition's 1s duration is exactly the tick interval, so the
  bar now arrives at each value as the numeral displays it and empties exactly
  as the numeral reaches 0.
- This keeps Session 17's rule: still a pure function of `timeLeft`, still no
  second clock, still no round-length constant. The one addition is a PRIMING
  frame — a fresh element (remounted by `key={wordId}`) has no width to
  transition from, so it mounts at the true current value and is re-pointed at
  the look-ahead value one frame later. Without that the bar would silently skip
  its first second of travel.
- Urgency classes deliberately still read the DISPLAYED `timeLeft`, not the
  look-ahead width, so the bar turns red when the player is actually at 20% of
  their time rather than a second early.
- A CSS `animation` would have been the obvious alternative and is WRONG here:
  the global reduce-motion block collapses `animation-duration`, which would
  empty the bar instantly and destroy the information. A `transition` degrades
  to a once-a-second step instead, which is the Session 12 guarantee.

#### Naming note
The npm package name is `spelling-bee` (renamed 2026-10-03 on the redesign
branch; it was `spelling-race` from the initial scaffolding). The local dev
folder may still differ; that's cosmetic. The GitHub repo and deployed URL are
"spellingbee". Use "spellingbee" as the prefix for any localStorage keys going
forward (e.g. "spellingbee:best:easy"), not "spelling-race".

#### Security (hardening pass, 2026-09-27)

Fixes for the portfolio audit (`C:\devwork\portfolio-audit\HARDENING.md`).
Migrations 0016–0020 and one edge-function change. **Live since 2026-09-28**:
migrations applied with `db push`, all five edge functions redeployed, the
client deployed from `2263581`, and CAPTCHA on. See "Live verification" below.

##### What changed, and the rules it adds
- **Scores are server-only (#1, 0016).** `room_players` INSERT is a column
  grant on `(room_id, player_id, display_name, avatar)`, and UPDATE stays
  `(display_name, avatar)`. A backstop trigger rejects non-default game columns
  from client roles. Race `start_game_tx` zeroes score/streak, as the
  elimination start already did. `room_accepts_new_players` is lobby-only for
  BOTH modes, so there are no mid-game joins at all. Never widen these grants:
  every client write the app makes fits in them.
- **Room creation is column-limited (§A1, 0017):** `(id, code, tier, host_id,
  mode, lives_setting)` only. `created_at` in particular must stay
  server-set, because retention and the hourly cap both age rooms by it. Room
  codes are CHECKed against the client's alphabet.
- **Names (#6, 0018):** a CHECK (1–24 code points, not blank, no control
  characters) plus a SECURITY DEFINER trigger against
  `private.blocked_name_terms`. The `private` schema isn't exposed by
  PostgREST and no client role can read it. The table holds sha256 digests of
  normalized terms, **never plain text**. The source term list is
  deliberately not in the repo. To add terms: `node
  supabase/scripts/hash_name_terms.mjs < terms.txt`, then write a NEW migration
  inserting its output. Long terms match as substrings, short ones only as whole
  words (or the whole name with separators removed), so "Therapist", "Dickens"
  and "Scunthorpe" pass. The client mirrors only the CHECK
  (`src/lib/displayName.ts`) and can never see the list.
- **Abuse limits and retention (#5, §C11, 0019).** All numbers live in
  `abuse_limits()` / `player_cap()`:
  - 3 open rooms per host, and 20 created per rolling hour. The hourly cap
    counts `private.room_creations`, not `rooms`, because leaving deletes empty
    lobbies and would otherwise reset it.
  - 8 players per room.
  - An empty lobby is deleted when its last member leaves. Joins and leaves
    take the same per-room advisory lock (`lock_for('room', id)`), so a join
    racing the last leave can't orphan a row. Room creation takes the per-host
    lock.
  - pg_cron:
    - guesses of finished games are deleted every 10 min
    - rooms after 30 days, lobbies after 24 h, and memberless lobbies after
      10 min (every 10 min)
    - anonymous users older than 30 days that NO game row references, daily. It
      checks all seven FK columns, because four are NO ACTION and `host_id`
      cascades into other players' history.
    - `cron.job_run_details` after 7 days, daily
  - Triggers that need to see past RLS are SECURITY DEFINER with `search_path`
    pinned. Inside one, `current_user` is the OWNER, so a "clients only" check
    must read `current_setting('role')`, not `current_user`.
- **Purged sessions (client).** `ensureAnonymousSession` checks a stored
  session with the Auth server. If the user was purged, it drops the session
  and signs in a new guest, once, silently. A network error keeps the session.
- **CAPTCHA (#5, client).** Turnstile runs only if `VITE_TURNSTILE_SITE_KEY` is
  set at build time. Supabase Auth does the enforcing.
- **Grants (#15, #16, 0020).** `round_attempts` has no client grants. The
  constant getters are revoked from `public`/`anon`, and `authenticated` keeps
  them because the multiplayer client calls four. test:db sweeps the whole
  schema: anon can execute nothing and touch no table, and a guest can execute
  exactly 13 named functions. **Every new function needs an explicit revoke**:
  Supabase's default privileges grant anon EXECUTE on anything created in
  public.
- **Edge functions (#17).** Internal errors are logged (Dashboard → Edge
  Functions → Logs) and return only `{ok:false, error:"internal_error"}`.
- **Accessibility (#13, #18, #19).** RoundScreen has one `role="status"`
  region (`src/lib/announce.ts`); it never names the word while other racers
  are still typing. Settings is a native `<dialog>` + `showModal()`, closed
  through its native `close` event (React's `onClose` prop didn't fire). The
  guess input is `readOnly`, not `disabled`, during feedback so focus survives.
  `useScreenFocus` moves focus on screen changes, but never on the first screen
  of a load.
- **Repo:** the word-bank blocklist lives in
  `scripts/data/wordbank-blocklist.txt` and no longer inline in JS.
  `supabase/.temp/` is untracked and ignored.

##### Tests
- `npm test`: client logic (names, error wording, announcements, session
  recovery, CAPTCHA wiring).
- `npm run test:db`: the REAL migrations under PGlite (Postgres 18 in WASM;
  production is 17.6), acting as anon / authenticated / service_role via
  `SET ROLE`. The harness stubs `auth.users`/`auth.uid()`, pg_cron (jobs are
  called directly, never scheduled), and the realtime publication, and
  reproduces Supabase's default privileges and its `extensions` schema. It first
  reproduces the original hole at 0015, then proves the fix.
- `npm --prefix supabase/concurrency ci && npm --prefix supabase/concurrency test`
  (2026-09-29): the same migrations on a REAL Postgres 17 (embedded-postgres),
  racing separate connections against the 0019 advisory locks. It is its own
  package on purpose: the root `npm ci` runs on every deploy and shouldn't pull
  ~100 MB of Postgres binaries. Needs the root `npm ci` first (it imports the
  PGlite harness's bootstrap SQL). Every race has a NEGATIVE CONTROL with
  `lock_for()` stubbed to a no-op that must break the invariant, so a pass can't
  come from the transactions simply never overlapping. Measured: 20 joins seat 8
  (control: 21), 30 creations stop at 20 (control: 30), and a join committing
  during the last leave survives (control: silently deleted by the cleanup).

##### Verified locally vs. still needs the live project
Verified locally (PGlite, Vitest, and Chrome against a dev server with a dead
Supabase URL and Cloudflare's always-pass test key):
- every grant, RLS, CHECK and trigger above
- retention with no orphan rows
- the user purge's FK safety
- the edge-function error shape (real `mod.ts` under a stub `Deno`)
- the focus, dialog and announcement behaviour
- the captcha token reaching `signInAnonymously`

Live only, and their status after the 2026-09-28 rollout:
- concurrency of the advisory locks: **verified 2026-09-29 on a real local
  Postgres 17** (`supabase/concurrency/`, above), not on the live project.
  The live project runs the identical 0019 SQL.
- pg_cron running the jobs: **verified** for all of them. On 2026-09-29 (read-only
  query) both daily jobs had succeeded on 09-28 and 09-29, and the 10-minute
  jobs were 195/195 succeeded over two days. `auth.users` then held 8
  anonymous users, none older than 30 days.
- `purge_anonymous_users` allowed to DELETE from `auth.users`: **verified**
  (rolled back).
- real Turnstile tokens accepted by Supabase Auth: **verified**.
- the deployed edge functions: **verified** through start-game / submit-answer
  in the race. The generic 500 shape wasn't triggered live.
- a real two-browser race: **verified**.

Running the legacy `verify_*.mjs` scripts repeatedly can now hit
`too_many_open_rooms`, because `buildRoom` leaves never-started lobbies behind.
That's the cap working, not a regression. `verify_hardening.mjs` cleans up
after itself.

##### Rollback
`supabase/rollback/0016-0020_down.sql` reverses 0016–0020 in one transaction.
It lives outside `migrations/`, so `db push` never runs it; run it by hand in
the SQL editor. `test:db` (`rollback.test.mjs`) applies the chain and then the
rollback, and asserts the whole catalog (functions with source/ACL/comments,
table and column ACLs, constraints, triggers, policies, indexes, schemas, cron
jobs) equals a fresh 0001–0015 database. It also asserts the chain can be
re-applied afterwards. Data the purge jobs deleted, and names 0018 trimmed,
cannot come back. **Any new migration must extend this file and its test, or be
given its own rollback.**

##### Live verification (2026-09-28)
Done in the order above. Each step below was observed, not assumed.
1. **Cleanup and dashboard (Ian):** the audit's probe user was deleted (0 rows
   confirmed). Email provider off, pg_cron on, no public buckets, rate limits
   reviewed.
2. **`db push`:**
   - The dry run listed exactly 0016–0020.
   - The push applied all five, and local and remote history now match from
     0001 to 0020.
   - All 5 edge functions were redeployed (`functions deploy --use-api`).
3. **SQL checks** (`supabase db query --linked`):
   - 6 active cron jobs.
   - The purge was called inside a `DO` block that always raises, so it was
     rolled back. It is allowed to delete from `auth.users` and would have
     removed 35 users; 185 anonymous users remained afterwards.
   - The blocklist caught 59 of 59 test variants, with 0 false positives, and
     all 58 hashed terms are present.
4. **`verify_hardening.mjs`:** 18 PASS. The blocklist case was covered by the
   SQL check instead.
5. **`probe.mjs`:** ALL AS EXPECTED.
   - **P-auth-8 is 42501** (it was 23503).
   - P-anon-5 / P-auth-5 (`round_attempts`) are 42501.
   - P-anon-15…20 (constants, anon) are 42501; a guest can still call them.
   - The private schema isn't exposed (406 PGRST106).
   - No probe row persisted, and the probe's guest user was deleted afterwards.
6. **Turnstile:**
   - The live bundle contained the site key, and the sign-up carried a real
     token (200 before CAPTCHA was on).
   - The first CAPTCHA attempt failed with `invalid-input-secret`: the wrong
     secret had been saved in Supabase. It was re-pasted.
   - After the fix, a fresh visitor signs in (200). No token gives 400
     `captcha_failed`, and a forged token gives 400 `invalid-input-response`.
7. **Two-browser race** (Chrome host plus Ian's separate browser, room
   `2TTFZR`):
   - 10 of 10 rounds played and the room reached `finished`.
   - Server-computed scores: 205 and 0, both starting from 0.
   - While an answer was locked in, the host's live region said only "Answer
     locked in"; the word was announced only after each round ended.
   - Results focused "Play again".
8. **pg_cron:** both 10-minute purge jobs had run 4 times, all successful, by
   00:42 UTC. The race above finished at ~00:41, and by 00:52 its 12 stored
   guesses were gone while all 10 scoreboard rounds remained, so the guess
   purge works live. The daily jobs first run at 03:17 / 03:37 UTC.

##### Audit follow-up (2026-09-29)
Everything in the audit for this repo was already fixed except the items below.
This session worked on `main`, like the hardening pass:
- **Locks under concurrency:** proven locally, see Tests.
- **Daily purges:** confirmed live, see above.
- **Third-party notices:** the minifier strips every `@license` comment, so the
  bundle shipped React, supabase-js, lucide-react and more with no notices.
  `scripts/licenseNotices.ts` (a Vite plugin) now writes
  `dist/third-party-licenses.txt`, derived from the modules actually bundled
  plus the fonts' OFL texts and SCOWL's notice (`licenses/SCOWL-Copyright.txt`,
  verbatim from wordlist-english 1.2.1). **A bundled package with no licence
  file fails the build.** Keep new self-hosted fonts' `OFL-*.txt` in
  `src/assets/fonts/`, where the plugin looks for them.
- **Text-input contrast (WCAG 1.4.11):** `.text-input` uses the new
  `--field-edge` token (3.25-3.70:1 against every background it sits on,
  including the honeycomb lines) plus a honey `:focus-visible` outline. The
  outline is required, not decoration: the resting edge is close to honey in
  lightness, so a border-colour change alone is too weak a focus cue.
- **Multiplayer keyboard pass:** the lobby passes by keyboard. The waiting room,
  race, elimination turn and results screens were NOT driven, because that needs
  the live server plus a second browser identity (one Chrome profile shares one
  guest session across tabs). Next time Ian runs a two-browser game, one side
  should play it by keyboard only: create/join, Start, type and submit, "Hear it
  again", quit's two-step confirm, and the results buttons in both modes.

##### Pending
- `verify_hardening.mjs` left 3 anonymous users and one finished race room.
  Retention removes them after 30 days.
- **With CAPTCHA on, no script can sign up users.** `probe.mjs` and the
  `verify_*.mjs` scripts need CAPTCHA switched off temporarily, or an existing
  session.
- #8 (privacy note): done 2026-09-29, see "Docs and disclosures". REPORT.md's
  "server-authoritative scoring" claim was restored the same day.

#### Edge function CORS preflight cache (2026-10-04)

`_shared/mod.ts` sends `Access-Control-Max-Age: 7200` on every response, so
all five functions get it. Before this, browsers used their 5 s default (MDN),
shorter than a race round (13 s or more), so most answers paid an extra
`OPTIONS` round trip before the real request. `callEdge` sends `apikey`,
`Authorization` and a JSON `Content-Type`, so every call is preflighted.
Browsers clamp the value (Chromium 76+ at 2 h, Firefox at 24 h), so 7200 is the
most that helps. Allowed origin, headers and methods are unchanged.

Deployed and checked live on 2026-10-04: an `OPTIONS` request to each of the
five URLs returns `access-control-max-age: 7200`, and a gateway-passing POST
(public anon key, no user) still returns 401 `{"ok":false,"error":"unauthorized"}`
exactly as before. `edge_errors.test.mjs` pins the header, that the other three
CORS headers are unchanged, and that the header set is exactly these four.

- Preflights aren't billed (Supabase invocation docs), so this changes no quota
  figure.
- The functions have JWT verification on at the gateway: a POST with no
  `Authorization` header gets the gateway's own 401 shape
  (`UNAUTHORIZED_NO_AUTH_HEADER`) and never reaches our code. A preflight
  carries no auth and is still answered, so keep `OPTIONS` handled before the
  auth check in `handler`.
- Browser check on the live site (not run by an agent, which must not create
  guest users): DevTools Network during a race, filter by `functions/v1`. You
  should see ONE `OPTIONS submit-answer` for the whole game, then only POSTs.
  See `docs/history.md`, 2026-10-04.

**Roll the functions back** (the pre-change `mod.ts` is commit `8b979dc`; the
function entry points are unchanged by this work). From the repo root:

```
git checkout 8b979dc -- supabase/functions/_shared/mod.ts
npx supabase functions deploy --use-api --project-ref wjorfdfpbgyykbhxydqj
```

Then check with `curl -s -i -X OPTIONS <url>/functions/v1/submit-answer -H
"Origin: https://iangopen.github.io" -H "Access-Control-Request-Method: POST"`:
the `access-control-max-age` header should be gone. If the checkout is staged
afterwards, undo it with `git checkout HEAD -- supabase/functions/_shared/mod.ts`
once the rollback is committed or abandoned. Supabase keeps no previous-version
button for these, so the deploy always comes from a file in git.

The multiplayer spec's stage 1 (branch `plan/multiplayer-modes`, §8, §4.5.4
part 1) planned this header. It has shipped here on `main`; that branch still
describes it as pending until it is rebased or its note updated.

#### Docs and disclosures (2026-09-29)

README.md, PRIVACY.md, LICENSE (MIT, Ian Gopen, 2026) and the GitHub About
section were written from a fact sheet in which every item was traced to code,
to the live site, or to a read-only query on the live project.

**PRIVACY.md last checked against the code: 2026-09-29.** Any change that
sends or stores something new MUST update PRIVACY.md in the same commit: a new
table or column holding player input, a new third-party host, analytics,
cookies, or a change to the 0019 retention jobs. PRIVACY.md is a policy the
operator is bound by, so it must never promise less than the code does. What it
rests on:
- Singleplayer contacts only `iangopen.github.io`. This was observed on the
  live site by playing a word in Playwright. The Supabase client is lazy
  (`getSupabase()`), and only the multiplayer modules call it.
- GitHub Pages logs visitor IP addresses (GitHub's "About GitHub Pages" docs).
- Speech only ever receives the word, its lead-in, the definition or the
  Settings sample sentence (`tts.ts`). Some browser voices are cloud voices.
- Multiplayer: Cloudflare Turnstile, and a Supabase anonymous guest with no
  email (live: 0 users with an email). `auth.sessions` stores the IP address
  and user agent (live: 8 of 8), and it and `auth.identities` cascade on user
  delete (live `pg_constraint`, confdeltype `c`).
- Retention is exactly 0019's jobs, which were verified live on 2026-09-29.
  Supabase's own log retention is plan-dependent, so PRIVACY.md gives no number.
- The app code never touches `document.cookie`.

In-app: a "Privacy" link on the mode screen (`ModeSelect.tsx`) opens
PRIVACY.md on GitHub. It measured 6.85:1 dark and 4.72:1 light, has a 44px
target, and was reached by keyboard.

Other changes this session:
- The README screenshots in `docs/screenshots/` came from a local production
  build with a dead Supabase URL and a stubbed guest sign-in, so no live row was
  created.
- The unused create-vite `public/icons.svg` (Bluesky, Discord, GitHub and X
  logos) was removed.
- The README's Node floor is 22.12 because Vitest 5 requires it.

**Privacy contact is GitHub Issues** (2026-09-29): PRIVACY.md sends deletion and
privacy requests to https://github.com/iangopen/spellingbee/issues, asks people
to post nothing beyond their guest display name, and keeps Ian's email private.
No published file (README, PRIVACY, LICENSE, public/, index.html, dist) may
contain TODO/TBD/FIXME; leave unfinished notes here in CLAUDE.md instead.

Open notes (Ian only, deliberately NOT in any published file):
- The README has no user or games-played numbers. There is no real data yet;
  add them only from real data.
- **Renamed to Spelling Bee on `main` (2026-09-30):** page title, meta description,
  the two `<h1>`s, README and PRIVACY.md. The game MODE "Race" keeps its name.
  The repo slug, `/spellingbee/` and every `spellingbee:*` key are unchanged. The
  `package.json` name became `spelling-bee` on the redesign branch (2026-10-03).
  There is no web manifest or social/share tag yet; the redesign adds them.
- The README screenshots in `docs/screenshots/` still show the old look and
  heading. They are retaken after the redesign merges, because it changes every
  screen.

#### Redesign (built and ready for Ian's review; started 2026-09-28)

The game is being renamed **Spelling Bee** (Ian's decision, 2026-09-28) and given
a distinct visual identity. Work happens on branch `redesign/spelling-bee`.
**Nothing merges to `main` without Ian's OK**, because pushing `main` redeploys
the live site.

##### Merge-readiness checklist (2026-10-04, re-run 2026-10-06)
The branch is `redesign/spelling-bee`; `main` was merged in again on 2026-10-06 (the
edge-function CORS preflight cache, 64f65f3 / 21c2601). Stage numbers follow `design/PHASE3.md`: 0 groundwork, 1 tokens, 2 honeycomb,
3 shared components, 4a-4h the screens, 5 rename, 6 assets, 7 polish. All are built.

**Verified, with the command that shows it** (`PW_MODULE=... node design/harness/run-checks.mjs`
runs the browser ones in one go; 11 of 12 browser scripts run (plus the two unused-* checks), the 12th is
`check-glow.mjs`, the Blue Ribbon prototype's check, which fails honey by design). The suite
has NOT been re-run in full since the hover-flash commits (fef91ca); see "Hover flash" below:
- [x] `npm run build`, `npm run lint` (0 errors, 11 warnings, all in old scripts or the harness except the old `TurnScreen` hook one),
  `npm test` (119 tests in 16 files: logic, screens, standings, sounds, brand assets,
  licences, the pinned bee art), `npm run test:db` (97, with main's CORS tests). There is no Playwright SPEC suite in the repo (it
  is deliberately not a dependency); the browser checks are the scripts above.
- [x] Contrast: 842 pairs, 0 failing (2026-10-06, over the restored grain and with no
  backdrop blur), every screen, both themes, both widths (`measure.mjs`, results in
  `design/stage-results/final-contrast-app.*`). The pair COUNT moves by one or two run
  to run because the lead-in phrase is random and is part of each pair's key.
- [x] Focus: every focus ring passes; tier bars (tap target + rim 7.35:1 at worst);
  Settings dialog (proven against three focus mutations; two others it cannot see).
- [x] `unused-selectors.mjs` 0, `unused-tokens.mjs` 0 (the old aliases, Inter and
  Space Grotesk are gone).
- [x] Reduced motion: 68/68 screen configurations are still and match the in-app
  switch, at ZERO tolerance (2026-10-06, 03c9fcd: three runs of that check in a row, 68/68
  pixel-identical each time). The 0.2% tolerance is gone; each of the 8 cases it used to
  hide was explained and fixed (c7b40e1). Proven able to fail (remove the global block and
  it fails).
- [x] A full 30-word game in the production build: each outcome sounds exactly once
  (miss = tick + one bell, 4 oscillators; correct = tick + chime, 3), no utterance is
  interrupted (60 of 60 ended normally), and every request goes to the site's own
  origin. Proven able to fail (a cancel on the lead-in; a double bell).
- [x] Network: all 18 screens x 2 themes make no request off-origin.
- [x] Keyboard-only passes: the real built app (home, difficulty, round, results,
  settings) and the mocked elimination screens (`keyboard-real-app.mjs`,
  `keyboard-elimination.mjs`). One real bug was found and fixed (focus lost on the
  Leave/Quit confirm).
- [x] Licences: every font family has an OFL file with a copyright line and a CREDITS
  row or the build FAILS (shown failing for Caveat Brush); `third-party-licenses.txt`
  carries the fonts, the artwork notice and CREDITS.md.
- [x] Guarded paths (`src/hooks`, `rooms.ts`, `auth.ts`, `captcha.ts`, `supabase/`):
  `git diff main` is empty (re-checked after the 2026-10-06 merge of main).
- [x] Bundle vs `main` (same `.env`, so Supabase is in both): JS +3.6 kB gzip (budget 6),
  CSS +4.7, fonts +1.8, first load 338.0 -> 348.5 kB gzip (+3%). A page downloads the
  latin font files only (126.9 kB of the 172 kB on disk).
- [x] **Homemade strength verified against the prototype, touch by touch** (2026-10-06):
  20 light touches, all present, each with a prototype-vs-app side-by-side at both
  widths and themes in `docs/review/touches/` (see "Homemade strength, touch by touch").
  Seven had been missing or partial and were restored. Bundle against the branch
  before that session: first load 348.9 -> 348.5 kB gzip (JS -0.4, CSS 0), icons -23 kB.
- [x] README and PRIVACY.md match the visible app and what it contacts (singleplayer:
  the site's own files only).

**Only Ian can do** (no real device, second identity or taste test here):
- [ ] The shimmer on a REAL mid-range phone. Headless Chrome at 4x CPU slowdown gave
  a 16.7 ms median frame; the static glow is the fallback (set `.bg-light` to
  `display: none`) if it stutters.
- [ ] A two-browser keyboard pass of the multiplayer screens (waiting room, race,
  results, elimination live), now that localhost is allowed on the Turnstile widget.
  Needs `.env.local` and the live Supabase project; I did not open those screens,
  because that signs a guest in on the live site.
- [ ] A final look at the screenshots (`docs/review/`, 16 whole-screen side-by-sides,
  and `docs/review/touches/`, one per homemade touch) and at the share card
  (`public/og-card.png`, regenerated 2026-10-06 with the wobbly bee), and the call on the name (HARDENING #14).
- [ ] Merging to `main` (which redeploys the live site). Nothing else needs doing
  first; `package.json` is already `spelling-bee`.

**Preview on a phone:** `npm run build && npx vite preview --host --port 4173`, then
open `http://<laptop LAN address>:4173/spellingbee/` on a phone on the same Wi-Fi
(`ipconfig`; this laptop was 10.45.84.181). Singleplayer works fully; multiplayer will
NOT sign in from that address (Turnstile only allows the hostnames on its widget).
If the network blocks it (client isolation, a work or guest Wi-Fi) or Windows
Firewall asks, allow Node on Private networks; otherwise use a tunnel
(`npx cloudflared tunnel --url http://localhost:4173`, or `npx localtunnel --port 4173`),
or an Android phone on USB (`adb reverse tcp:4173 tcp:4173`, then open
`http://localhost:4173/spellingbee/`), or Chrome DevTools device mode on the laptop.

##### Homemade strength, touch by touch (2026-10-06)
Ian felt the built app was less handmade than the approved `light` prototype. The
whole-screen comparisons had passed because a lost touch hides at that scale, so each
touch was compared on its own, cropped and shown at 2x:
`design/harness/shoot-touches.mjs` writes `docs/review/touches/<touch>--<width>--<theme>.jpg`
(17 touches x desktop/phone x dark/light), and `before--*.jpg` for the seven that were
missing or partial. Source: `design/prototypes/homemade/homemade.css` (line numbers
below), `homemade.js` and `art.js`, at `?h=light`.

| Touch | Prototype source | Before | Where it was lost | Now |
|---|---|---|---|---|
| Wobbly panel corners | homemade.css 97, 158-160 | present | | present |
| One hand-drawn panel outline (SVG displacement) | 165-168, homemade.js `hm-wobble-s` | present | | present |
| Buttons: wobbly corners, marker shadows, press | 187-193 | present | | present |
| Chips (mode, replay): wobbly corners | 194 | present | | present |
| Settings button: wobbly corners, marker shadow, control edge | 195 + style.css 170 | missing | never restyled; the Session 13 round button (8253cdc) | present |
| Answer field and text inputs: wobbly corners | 196, `--hm-r-field` | present | | present |
| Placard: tilt, wobbly corners, marker shadow | 197 | present | | present |
| Avatar token: wobbly corners | 198 | present | | present |
| Hand lettering: title, headings, kickers, stickers | 127-135 | present | | present |
| Drawn underline: title, difficulty title, best scores, winner name | 137-142 | partly (no winner) | stage 4e (418b8dd) never added `.winner h1::after` | present |
| Sticker on home and results cards | 148-155 | present | | present |
| Paper grain on the page | 106-107, 123-124, homemade.js (appended LAST in `.bg`) | partly | stage 2 (e3444b4) stacked it under `.bg-depth`: gone from the top band, 25-30% weaker at edges | present |
| No backdrop blur | 161 | partly (phones only) | stage 3 (5c5b61e) copied the hybrid's desktop blur, missed the override | present |
| Calmer glow | 109, 118 | present | | present |
| Hand tilts (title -1.4, difficulty title -1, sticker -5/+4, placard -1.6) | 131-132, 151, 155, 197 | present | | present |
| Bee and avatars: slightly wobbly line | art.js `blobPath`, AMP 0.8 | partly (smooth line) | stage 6 (f80906f) swapped the jittered blobs for smooth fixed curves | present |
| Rosette: wobbly petals and ring, marker drop shadow | art.js `rosette()`, 223 | partly (smooth line) | same, f80906f | present |
| Difficulty bars | homemade.css section 1 | present | | present |
| Focus rule outranks every marker shadow | 240 | present | | present |

Correctly absent (they are `more` only, closed): washi tape, grain inside panels, a
double outline, tilts on panels/tier bars/tokens, irregular hexagons, wobbly icons.
The `--tape*` and `--grain-panel-opacity` tokens dropped in stages 1 and 3 were these.
The prototype's brand wordmark in the header has no counterpart: the app has no brand
header, which is layout, not a homemade touch.

**The strength is three tokens** in `src/index.css` (the "THE HOMEMADE STRENGTH" block):
`--hm-roughness` 2.4 (the outline's displacement; `WobbleFilters` reads it with
`getPropertyValue`, because an SVG filter's scale is an attribute CSS cannot set),
`--hm-tilt` 1deg (every tilt is a multiple of it), `--hm-texture` 0.16 (page grain
opacity, was `--grain-bg-opacity`). The bee art's wobble is `ART_WOBBLE` 0.8 in
`lib/beeArt.ts`, not a CSS token, because the same drawing is rendered at build time
into the favicon and icons. Going to `more` is these four numbers plus adding the
`more`-only touches above, and every contrast table must be re-run (texture is
measured by its worst pixel).

Rules this adds:
- `beeArt.ts` is the prototype's jittered-blob drawing again, seeded per key and
  memoized. `ui.test.tsx` pins the wobble (blob segment counts) and a digest of every
  drawing. Never swap it for smooth curves; after any change rerun
  `build-brand-assets.mjs` and update the digest.
- `.bg-grain` is the LAST layer of `HoneycombBackground`.
- No `backdrop-filter` on panels.
- `unused-tokens.mjs` now also counts `getPropertyValue("--x")` as a use.

**Where an outline overlaps a decoration, and what the 2026-10-07 session did about it.**
`check-layering.mjs` now walks every panel's outline on every harness screen (both widths
and themes, and scrolled under the Settings button at phone width) and requires whatever
covers the line to paint above it: 22 overlaps, 3,084 probe points, 0 under the line
(the old build: 6 overlaps and 928 points under it). Before/after crops are in
`docs/review/layering/`.
1. Home hero bee: the outline cut across its lower body. **Fixed**:
   `.panel > :is(.mascot, .rosette) { z-index: 1 }` puts the art on the card, under the
   stickers (z-index 2).
2. Home best-scores rosette: cut across the ring and petals. **Fixed** by the same rule.
   (The check also found a third case the list had missed: the solo results card's
   new-best rosette, `.results-rosette`. Fixed by the same rule.)
3. Every panel at desktop without the backdrop blur: the outline runs over crisp
   honeycomb lines. Not a decoration and not a layering question (the honeycomb is the
   `.bg` layer under every panel); left as designed.
4. Settings button over panels when the page scrolls: it was always above every outline
   (fixed, z-index 20 at `.app-shell` level). Verified by the scroll sweep, unchanged.
5. Winner cards' underline and sticker: the stickers were always above the outline
   (z-index 2), measured at every point; underline and sticker do not touch.
6. The grain: inside `.bg` below every panel; never overlaps an outline.

The cause, for anyone adding art: `.panel` isolates, and its outline `.panel::after` is
the last positioned layer of that stacking context, so any positioned child at z-index
auto paints UNDER the line. Art that hangs off a panel edge needs z-index 1 (or more).

##### Hover flash and harness stability (2026-10-06)
**The criterion for visible flicker** is that compositor frames visibly CHANGE outside the
element being hovered or focused, sampled frame by frame with the shimmer frozen. Paint
area is NOT the criterion: paint flashing reports every re-raster, and a re-raster that
puts back the same pixels (a focus ring, a drawer, a caret blink) is invisible. Paint
area is how to FIND a candidate (`design/harness/sweep-hover-repaint.mjs`); a fix is
justified only when frames change. `check-hover-flash.mjs` applies the frame criterion
to the tier bars (old build 30/32 fail, fixed 32/32).

What was fixed, and the causes found:
- **The shared compositing layer.** The eight tier bars were squashed into one layer. A
  hover's `transform` split it (the hovered bar and every bar after it moved to new
  layers) and merged it back when the hover ended, re-rastering ~115,000 px twice per
  hover with the honeycomb showing through the gaps: the "flash". `will-change: transform`
  on `.tier-bar` (18289a0) gives each bar a stable layer; a hover now repaints the bar
  alone (~22,000 px, 0 outside it). The same split once after load was the strip the old
  reduced-motion tolerance hid.
  - Buttons had the same cause (hovering "Singleplayer" re-rastered the home hero panel,
    251,258 px). Their own layer fixed the hover but made Chrome re-layer the lobby
    once after load (5580ca7), so `.btn` and the avatar options (329f4ee) now lift and
    press with a relative `top`/`left`, which needs no layer at all: 0 px outside the
    control. **Rule:** a hover or press inside a panel moves with `top`/`left`, never
    `transform` and never `will-change`. `.tier-bar` and `.sticker` are the deliberate
    exceptions, each with its reason in a comment; don't "simplify" either away.
- **The IPv6-only dev server** (8d0a84f). The harness's Vite dev server listened on
  `[::1]` only, and Chromium sometimes tried localhost's IPv4 address first; on Windows an
  IPv4 connect to a closed loopback port retries for ~2 s, so loads stalled 2-8 s and
  sometimes passed Playwright's 30 s timeout. That was the batch run where two scripts
  "crashed" with only a Node version line. `run-checks.mjs` now serves static builds with
  `vite preview` on `127.0.0.1`, health-checks both servers before every script and keeps
  every log. Every script's default URL is `127.0.0.1`. Never go back to `localhost`.
- **The full-page screenshot redraw** (03c9fcd). Playwright's `fullPage` capture renders
  past the viewport and sometimes re-rasters a composited layer for that one image
  (pixels changed and changed back in 5 of 30 loads, 0 of 30 with viewport captures); the
  page itself never changed. `check-reduced-motion.mjs` grows the viewport to the page
  height once and takes plain viewport shots. Use viewport captures for any pixel diff.
- The rotated sticker under the Settings scrim rasterised differently load to load
  (up to 118 px); `will-change` on `.sticker` (already a stacking context) makes it
  identical (c7b40e1).

Still unverified (deliberately not run on 2026-10-09, because the laptop had under
3000 MB available; nothing changed since fef91ca):
- The frame-sampling check on the Settings drawer ("Close settings" focus) and on the
  lobby text fields. The paint sweep reports repaints there; whether frames visibly
  change outside the element is not known. Don't add `will-change` to the fields.
- Three consecutive full `run-checks.mjs` runs, then build, lint, unit, database and
  contrast gates, on the current HEAD.
- Whether the answer field's `scrollIntoView` (`RoundScreen.tsx`, on focus) moves the
  page on desktop at each word. If it does, limit it to touch / an on-screen keyboard and
  re-check phone width with touch emulation.

##### Status
- Phase 1 (audit) and Phase 2 (brand plus three directions) are done, in
  `design/`. See `design/README.md` for the map.
- **Superseded direction (2026-09-28):** the Blue Ribbon palette (blue honeycomb, no
  yellow). It is kept in `design/prototypes/blue-ribbon-glow/` as history. What
  survived into the build: Bricolage Grotesque + Atkinson Hyperlegible, the rosette,
  contestant placards, the slow-shimmer honeycomb at the old site's 28x49 cell size,
  the bee mascot and avatars, race lanes, dark as the default. The palette is the
  honey hybrid picked below.
- **Honey hybrid picked: variant b, Honey and ribbon (Ian, 2026-10-02).** Honey
  carries everything a player acts on (buttons, focus, field, timer); ribbon blue
  appears only on the award marks. The other three directions are closed. The
  hybrid prototypes are in `design/prototypes/honey-hybrid/` (the record) and the
  working prototype is now `design/prototypes/homemade/` (below). Consequences,
  all in force:
  - the "blue and never yellow" rule is replaced by `DIRECTIONS.md`'s "Honey
    hybrid: how it stays distinct" (amber not lemon, no grey tiles, honeycomb
    background only);
  - stage checks use `shoot-hybrid.mjs` / `shoot-homemade.mjs`'s lemon test, not
    `check-glow.mjs`'s no-yellow check, which fails honey by design;
  - PHASE3's tokens and honeycomb spec were rewritten for honey and ribbon on
    2026-10-03; the token VALUES now live in `src/index.css` only.
- **Difficulty selection returns to the old design (Ian, 2026-10-02).** The eight
  elongated hexagon tier bars come back in one stacked column: the old shapes,
  the sage-to-rust ramp, "Best n" on the right, the Practice mode / Hide
  definition chips, and the rim that thickens on focus. Restyled with the
  hybrid's tokens, with the header on a lit panel (text may not sit on bare
  honeycomb). It stays tier BUTTONS, never a letter board: `shoot-homemade.mjs`
  asserts eight bars, one per row, same left edge and width. PHASE3 1.6 and
  stage 4b are updated. Reference: `homemade/difficulty.html`.
- **Homemade strength: `light` (Ian, 2026-10-03).** The look is slightly warm and
  handmade, at the light strength of `design/prototypes/homemade/` (`?h=light`):
  wobbly corners, one hand-drawn panel outline, hand-lettered title/headings/
  badges, one sticker per card, page grain behind the panels, marker-style hard
  shadows instead of gloss, a calmer glow, a slightly wobbly bee. `more` and `off`
  are closed: no washi tape, tilts, grain inside panels, double outline or
  irregular hexagon points. The strength is a build-time constant, so delete the
  other rules rather than shipping a `data-h` switch. The prototype checks that
  led to the pick (`checks.txt`: 680 contrast pairs, 12/12 tier-bar focus
  configurations, lowest 7.35:1, reduced-motion stills identical to static) stay
  as the record.
  - **Fonts rule:** hand lettering (Caveat Brush, OFL, subset to letters, 15.3 KB)
    only for the title, section headings and badges. The spelling words, the
    answer field, instructions, buttons and every number stay in Atkinson /
    Bricolage (handwriting blurs l, I and 1). The subset has no digits on purpose.
  - **Texture rule:** measured by the worst pixel, so peak alpha matters. Grain
    peak is about 0.06 in the page layer and 0.04 in panels.
- **Dark default (built, stage 1):** `resolveTheme()` is stored ?? `"dark"`; the
  OS is no longer followed. `theme.test.ts` pins it. The `spellingbee:theme` key
  and its values are unchanged, so a player who chose light keeps light.
- **Phase 3 is written:** `design/PHASE3.md` has the design system (tokens,
  type, space, motion, the honeycomb spec, components) and the stage-by-stage
  build plan (stages 0 to 7, one commit each).
- **Build progress:** all stages are built on this branch, and nothing merges
  to `main` until Ian reviews the finished redesign (one merge at the end).
  - **Stage 0 is done (2026-09-29):** the redesign fonts are self-hosted, with
    `CREDITS.md`. `measure.mjs` and `check-glow.mjs` run against the real app
    (`TARGET=app`), and the baseline is in `design/baseline/` (715 pairs, 47
    failing; 44 controls without an outline; 5.2M yellow pixels). Caveat Brush
    was missing from it and was added in stage 1.
  - **Stage 1 is done (2026-10-03):** the honey-and-ribbon tokens (homemade
    `light`) are in `src/index.css` in both themes with the old names aliased,
    dark is the default, Caveat Brush is self-hosted. Measured on the real app
    (`design/stage-results/stage1-contrast-app.md`): 728 pairs, 11 failing, from
    715 and 47 at baseline, and nothing that passed before fails now. The 11
    pre-existing ones are owned by later stages (Master bar text, the
    eliminated name `--out`, the lobby's primary buttons, the default focus ring
    on Settings over honey): see PHASE3 1.1. `--font-display` / `--font-body`
    and the old `--tier-*` gradients are NOT switched yet (stages 3 and 4b).
    Stage 2 (honeycomb) and 3 (shared components) are below.
  - **Stage 2 is done (2026-10-03):** `HoneycombBackground` replaces
    `body::before`. Rules it keeps: it is `aria-hidden` with no text or
    focusables; `.bg` stays at `z-index: -1` INSIDE `.app-shell` (z-index 0 paints
    over the unpositioned screen and hides it); the tile is a CSS mask so the
    colour is always a token; only `transform` and `opacity` animate; the shimmer
    is removed by the OS setting AND `data-reduce-motion`; `data-peak="1"` exists
    only for `design/harness/measure.mjs` and is never set in the app.
  - **Stage 3 is done (2026-10-03):** `src/components/ui/` and `src/ui.css`.
    Rules it keeps:
    - ONE focus rule in `ui.css`, more specific than every button shadow, so a
      marker shadow can never replace the moat. The tier bars and `.answer-field`
      are excluded (clip-path hides outlines; the answer field has its own
      glow-and-gap). New controls inherit it: never add a per-component outline.
    - Buttons are `<Button>` only. Disabled is a dashed outline in `--muted`, not
      a faded fill (fading the primary put its label at 3.19:1).
    - `AnswerField` keeps `readOnly` (not `disabled`) so focus survives, and its
      tick/cross are `aria-hidden` (the `role="status"` region announces).
    - Avatars are drawn by `lib/beeArt.ts` from tokens only (a unit test rejects
      hex literals), seeded per key so each is identical everywhere.
      `lib/avatars.ts` is still the ONE list of keys (the DB CHECK).
    - Panel, Sticker, Placard, BeeMascot and Rosette have no screen yet; their
      first consumers are 4a, 4c, 4d and 4e.
  - **Stages 4a-4d are done (2026-10-03):** home, difficulty, round (solo + race)
    and solo results are on panels. Rules they keep:
    - Every line of text is on a `Panel` (or a scrim pill), never on the bare
      honeycomb. A new screen is not done until it measures 0.
    - `.timer-track` and `.feedback` are SHARED by the round and turn screens (one
      rule each, in the "Shared by RoundScreen and TurnScreen" block). `.prompt-card`,
      `.score-bar`, `.stat*`, `.replay-btn` and the base `.lead-in` style were deleted
      in 4h-4; do not reintroduce them.
    - `isNewBest` is decided in `App` against the PREVIOUS stored best. Never
      derive it as `score >= best` in a screen (ties, practice, races).
    - A pill or button must leave >= 24px before the next panel: the 7px focus moat
      plus the panel's drawn outline would otherwise overlap and fail contrast.
    - `design/harness/check-tier-bars.mjs` is the gate for the difficulty screen
      (tap target by `elementFromPoint`, rim contrast on the real app).
  - **Stages 4e-4g are done (2026-10-03):** race results (winner or tie, ranked
    lanes), the settings drawer, the lobby and the waiting room. Rules they keep:
    - Standings are `lib/standings.ts` over the server's scoreboard: ties share a
      place and name every tied player; never pick a winner by row order and never
      show a per-player stat the client does not have.
    - `ResultsScreen` is solo-only; a finished race is `RaceResults`.
    - The settings drawer stays opaque (it holds forms), and its behaviour is
      checked by `design/harness/check-settings-dialog.mjs`.
  - **Stage 4h is done (2026-10-03): elimination is on panels.** Turn screen (HUD
    pill, turn banner, pronouncer, answer + timer + feedback slot, the table of
    tokens), the knockout overlay and the results (winner card, survival standings).
    Rules it keeps, on top of Session 20/21's:
    - Lives sit BELOW a token, never across its rim (a count laid over the ring has
      the ring's pixels behind its digits: that is what failed 2.83:1).
    - A ghost's NAME is read at `--muted` (struck through, and the aria-label says
      "out"). `--out` is a state colour for the disc, not for text (2.88:1).
    - The Leave/Quit confirm focuses "Keep playing" when it opens and returns focus
      to the link when it closes (it used to drop focus to `<body>`, in both the
      round and the turn screen).
    - Placement is survival order, not score, and the screen says so.
  - **App-wide contrast failures, the merge gate: 0.** stage 1: 11; 2: 265; 3: 217;
    4a: 212; 4b: 187; 4c: 90; 4d: 64; 4e: 63; 4f: 64; 4g: 45; 4h-1: 2; 4h-2: 2;
    4h-3: **0**; after the 4h-4 cleanup: **0 of 843 pairs**, both themes, both widths,
    every screen including the knockout (a harness screen that mounts alive and flips
    to eliminated, so the real latch fires). Every focus ring passes. Results are in
    `design/stage-results/`; `design/baseline/` is untouched.
  - `design/harness/unused-selectors.mjs` lists class selectors no source file can
    produce (comments stripped; the few run-time-built names are listed in the
    script with what builds them). It reports 0, and a planted dead class proves it
    can fail. Run it after any CSS deletion.
  - `design/harness/keyboard-elimination.mjs` drives the elimination screens by
    keyboard alone on mocked state; `check-settings-dialog.mjs` now FAILS (rather
    than crashes) when Escape does nothing and was proven against focus mutations.
  - `design/harness/check-tier-focus.mjs` runs only the tier-bar focus check
    against any copy of the prototype (`HM_DIR`). It was proven able to fail on
    2026-10-03 (see docs/history.md), and exits 1 on any failing configuration.
  - Shipped to `main` separately (Ian, 2026-09-29): the current fonts
    self-hosted (HARDENING #24) and the race results button fix.
  - **Stages 5, 6 and 7 are done (2026-10-04).**
    - **5 rename:** was already on `main` (title, meta, both `<h1>`s, README, PRIVACY,
      this file). `package.json` is `spelling-bee`; a grep finds no user-facing
      "Spelling Race"; `base` is still `/spellingbee/`.
    - **6 assets:** `src/lib/beeArt.ts` was made fixed hand-placed path data here; that
      lost the wobbly line and was reverted on 2026-10-06 (see "Homemade strength,
      touch by touch" below). `design/harness/build-brand-assets.mjs` renders `public/favicon.svg`
      (the rosette, deliberately not a hexagon), `favicon-32.png`, `apple-touch-icon.png`,
      `icon-192/512.png`, a maskable icon and `og-card.png` (1200x630) from that same
      drawing, reading the palette from `src/index.css`. `public/manifest.webmanifest`
      (name and short name Spelling Bee, start_url and scope `/spellingbee/`, theme
      `#16130f`, background `#0f0c08`), `theme-color`, Open Graph and Twitter tags with
      absolute URLs under the deployed base. The Vite scaffold files are deleted.
      `scripts/tests/brandAssets.test.mjs` pins all of it. PHASE3's old
      colours (`#070b1c`) were Blue Ribbon leftovers and are corrected there.
    - **7 polish:** the miss sound is a soft bell (`sfx.ts` only: three inharmonic sine
      partials 1 : 2.76 : 5.4, one event, ~0.7 s); screen changes the player asks for
      go through `lib/viewTransition.ts` (no transition is started, and the update runs
      at once, under reduced motion); panels rise on first appearance; the
      correct-answer light-up and "+N" already existed from 4c. The global
      reduced-motion blocks now zero `animation-delay` and `transition-delay` too (a
      delayed ghost drift had kept moving). The aliased tokens, Inter, Space Grotesk and
      7 dead custom properties are deleted. `npm test` now runs `src` and `scripts`.
    - Rules these add: never hand-edit `public/` PNGs (rerun the build script); a new
      self-hosted font needs its `OFL-*.txt` and a CREDITS row or the build fails; a
      screen change the GAME causes is not wrapped in a view transition; every
      animation needs a resting state that reads the same (`check-reduced-motion.mjs`).

##### Rules for the build, whatever the direction
- **Presentation only.** Don't touch any of these:
  - `src/hooks/*` game logic, `checkAnswer`, `GameEngineApi`
  - `src/lib/rooms.ts`, `auth.ts`, `captcha.ts`
  - `supabase/`
  The hardening is verified live and must stay that way.
- **No accessibility regressions.** All of these must survive:
  - the `role="status"` announcements (`lib/announce.ts`, TurnScreen)
  - the native `<dialog>` Settings (focus in, Tab trap, Escape, focus return)
  - `useScreenFocus`, and the `readOnly` guess input
  - visible `:focus-visible`
  - AA contrast (4.5:1 text, 3:1 UI) against the worst pixel behind each
    pair: `TARGET=app node design/harness/measure.mjs`, compared with
    `design/baseline/`
  - the single global reduced-motion block plus the in-app override
  - no zoom blocking
  - 44px targets
- **Keep:**
  - the `/spellingbee/` base and the repo slug
  - every `spellingbee:*` localStorage key
  - the tier ids
  - the 8 avatar KEYS (DB CHECK); only their art changes
- The game **mode** "Race" keeps its name.
- **Rename scope:** the text rename is DONE on `main` (2026-09-30): title,
  meta description, both `<h1>`s, this file's heading, README.md and
  PRIVACY.md. What the redesign still owes:
  - a new web manifest, share tags and icons
  - the screenshots in `docs/screenshots/` (retake them from a local build
    with a stubbed backend, never the live site)

  Keep the mode screen's "Privacy" link (hardening #8).

  The `package.json` name stays (it isn't user-facing).
- **Trademark distance** (see `DIRECTIONS.md`):
  - No honeycomb letter layout, no NYT-style yellow/grey and no serif wordmark.
  - **The honeycomb is background decoration only:** honey (hue 28-42), NEVER
    lemon yellow or flat grey tiles, `aria-hidden`, no pointer events, no text
    or controls, and never a letter board or answer layout.
  - Re-run the lemon test in `design/harness/shoot-homemade.mjs` after any
    change to it (`check-glow.mjs` is the Blue Ribbon check and fails honey).
- **Text never sits on bare glow.** Every text/background pair, input border
  and focus ring must pass AA against the WORST pixel behind it with the
  background at peak (`design/harness/measure.mjs`, `?peak=1`). Focus rings
  sit in a solid 7px moat.
- **Background motion:**
  - CSS/SVG only; animate only `transform` and `opacity`
  - pause when the tab is hidden
  - under reduced motion the still version is exactly the static glow
  - no backdrop blur on panels at any width (the light strength sets it to none;
    restored 2026-10-06)
- **Lean bundle:** no animation or UI libraries without asking. Self-host fonts
  (HARDENING #24). Assets must be original or properly licensed, with credits.
- The existing CLAUDE.md rules still bind, especially "every colour is a token
  in both palettes" and "motion only decorates a visible state".

##### Open
- Merge-readiness: see the checklist at the top of this section. What is left is only
  what Ian can do (a real phone, a two-browser multiplayer pass, a final look, the
  merge).
- The layering and hover-flash fixes are built (see "Where an outline overlaps" and
  "Hover flash and harness stability"). Their three unverified checks are listed at the
  end of the latter; run them first, checking available memory (`(Get-Counter
  '\Memory\Available MBytes').CounterSamples.CookedValue`, floor 3000) before each.
- `.text-input` uses `--edge` (>=3:1 on every field surface); keep it that way.
- The name itself: a distinct look lowers the risk of being mistaken for NYT's game but
  doesn't clear the name. See HARDENING #14 / §C10. The favicon is a bee rosette on
  purpose (a plain hexagon was the closest overlap in the audit).
- Known limits, recorded rather than hidden: `check-settings-dialog.mjs` cannot see
  two focus mutations (Chrome restores focus itself on close); the
  elimination keyboard pass ran on mocked state; the lane subtitles from the prototype
  ("8 of 10 spelled") are not shown because the client has no per-player correct count.
- Not in the redesign and untouched on purpose: game logic, `supabase/`, edge functions.
