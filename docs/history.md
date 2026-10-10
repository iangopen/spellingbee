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
