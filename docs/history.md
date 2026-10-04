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
