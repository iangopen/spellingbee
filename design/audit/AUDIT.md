# Design audit: Spelling Race, before the Spelling Bee redesign

Date: 2026-09-28. Branch `redesign/spelling-bee`, taken from `main` at `1b7d1a4`
(the live build).

**Method**
- Every screen was rendered from the real components in `src/` through
  `design/harness/`. Multiplayer screens use mocked props, with `lib/rooms`,
  `lib/supabaseClient` and `hooks/useSupabaseUser` stubbed.
- No anonymous user was created and no request left localhost; the shot script
  counts these, and both counts were 0.
- Captured 16 screens × 2 widths (1280×800, 390×844) × 2 themes = 64 PNGs in
  `screens/`.

Skills applied:
- `redesign-existing-projects`: the audit checklist
- `design-taste-frontend`: the design read and anti-default rules
- `web-design-guidelines`: code-level rules fetched from vercel-labs
- `accessibility-review`
- `ux-copy`

## Design read

**Reading this as:** a casual word game (a web app, not a landing page) for
general-audience players on phones and laptops. It has a warm, playful language,
it is currently leaning on a "dark card UI + honeycomb wallpaper" family, and it
has to become a brand that owns the name *Spelling Bee* without looking like NYT
Games.

Dial reading of the current build:

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | 2 | Every screen is one centred 480px column. |
| MOTION_INTENSITY | 3 | A streak pulse, a timer drain and a ghost drift. |
| VISUAL_DENSITY | 4 | |

The redesign target is roughly **5 / 4 / 4**: more character, but a game screen
under a clock must stay calm and legible. Accessibility constraints override
aesthetics here.

## Verdict, bluntly

The app is **competent and accessible, but anonymous**. Take the name and the
honeycomb wallpaper away and nothing on screen says "spelling bee". It reads as
a generic dark dashboard card kit wearing a hexagon pattern.

The strongest bee signals it has are exactly the ones §C10 and the new name make
risky:
- the honeycomb texture
- the hexagon favicon
- hexagon tier buttons
- honey-yellow as the accent

What it lacks is any idea about the **thing the game actually is**, a spelling
bee contest: a word is pronounced, you get the definition, you spell it under
pressure, and a bell or a pass decides it.

## What reads as generic or templated

1. **Home is two equal cards under a centred title.** It is a stock
   "choose a plan" layout (`ModeSelect.tsx`). No mascot, no mark, no moment.
2. **The honeycomb wallpaper carries the whole brand** (`index.css:184`). At 7%
   opacity it is texture, not identity. It's also the one motif that must go
   now: a hex field next to the words "Spelling Bee" invites the NYT
   comparison.
3. **Lucide everywhere, including the avatars.** "Bee" is lucide's `Bug` (a
   beetle), "Drone" is a `Feather`, "Wasp" is a `Zap` bolt and "Hive" is a
   `Hexagon` (`lib/avatars.ts:65-72`). The avatar set is a list of borrowed
   metaphors rather than a family. This is the weakest part of the identity.
4. **Stat rows are the stock "big number over tiny caps label" dashboard
   pattern** (`ScoreBar.tsx`). There are four equal columns, all weighted the
   same, so the clock (the thing under pressure) gets the same weight as "to
   go".
5. **All-caps tracked micro-labels on nearly every block:**
   - SCORE / STREAK / LEFT / TO GO
   - YOUR NAME, YOUR AVATAR, GAME MODE, DIFFICULTY, ROOM CODE
   - every Settings section and field, including "VOICE (AUTO: MICROSOFT DAVID
     - ENGLISH (UNITED STATES))"
   - FINAL STANDINGS

   This is the eyebrow tell at full volume.
6. **Uniform 12px-radius, 1px-border, same-surface cards** for the prompt, the
   lobby panels, the standings rows, the champion card and the turn banner.
   There is one container style, so nothing is more important than anything
   else.
7. **Space Grotesk + Inter** is the default pairing of the last few years of
   generated UI. Inter is the body face, which the taste rules flag as a
   default.

## Hierarchy

- **The round screen buries the task.**
  - Reading order: Quit, then four equal stats, then the lead-in, then a card
    containing the *definition*, then a secondary button, then the input.
  - The input (what you act on) and the clock (what pressures you) are lower
    and quieter than the definition card.
  - The placeholder "Type the word you hear" is set in the *display* face at
    the largest size on the screen, so the emptiest thing is the loudest.
- **The lead-in line ("Here's your word:", "Next word:", "Get ready:") floats**
  as a honey caption above the card. On the incorrect screen it says "Next
  word:" directly above the definition of the word you just missed, because it
  describes the announcement, not the state. Visually it reads as a mislabel.
- **Results say "Round complete" for a whole game.** A single trophy icon
  carries all of the celebration. A new best gets eight words of body text
  (`Best: 118 — new best!`) and no visual moment.
- **Race results have no race in them.** `App.tsx:145` reuses the singleplayer
  `ResultsScreen` with `best={mp.state.score}`, which causes three problems:
  - It always prints "Best: N — new best!" (confirmed in
    `race-results--*.png`).
  - It never shows who won or where you placed, although `winnerName` and the
    players' scores are already in `MultiplayerExtras`.
  - Its secondary button says "Change difficulty" but actually leaves the room.

  This is the biggest UX gap found. The fix is presentation-only: the data is
  already on the client.
- **Elimination is the best-designed screen** (the token table, reserved
  feedback slot and ghost state all came out of real thought). Its stat row
  still repeats the dashboard pattern, though, and "speeds the clock up" wraps
  under STREAK as 9px text.

## Spacing and layout

- **Everything is centred** in a single ~480px column at every width. At 1280px
  that leaves about 60% of the viewport as wallpaper. The desktop layout is the
  phone layout, magnified by nothing.
- The **lobby is a long form of stacked cards**: name, avatar, a Create panel,
  "OR", a Join panel. At desktop width it scrolls past the fold, although the two
  panels could sit side by side.
- The spacing scale is not tokenised. Gaps are hand-set per rule (6, 8, 10, 12,
  14, 16, 20, 24, 28px...). The elimination screen documents its rhythm
  carefully, and the other screens don't share it.
- **The settings launcher is a floating 44px disc in the top right corner.** It
  is fine as a control, but on phone it sits on top of the page's first row with
  nothing aligning to it.

## Type

- There are about **25 distinct font sizes** in `App.css`, mixing px, rem, em
  and two `clamp()`s, from 9.5px up. There is no scale.
- Numbers use `tabular-nums` in exactly one rule, so score digits shift width
  as they tick.
- No `text-wrap: balance` or `pretty` is used anywhere; the definition wraps
  with a widow at phone width ("of sound\"").
- **Definitions are wrapped in straight ASCII quotes** (`RoundScreen.tsx:162`,
  `TurnScreen.tsx:338`).
- **Em-dashes run through the UI copy.** There are about 22 in visible
  strings, for example:
  - "Answer locked in — waiting…"
  - " — new best!"
  - "Missed — the word was"
  - "Automatic — best available"
  - "Room code — share to invite"
  - the avatar labels read by screen readers ("Maya — 2 lives")

  The house style for the new voice should drop them. The ~60 in code comments
  don't matter.

## Colour

Measured with `design/harness/contrast.mjs` (inputs in `current-palette.json`).

- **Text contrast is good in both themes.** Every text pair passes AA, and dark
  body text is 16.2:1.
- **Non-text contrast fails where it matters:**
  - Text inputs (lobby name, room code, Settings name) have no boundary other
    than `--border`. That measures **1.47:1 on dark and 1.30:1 on light**,
    against a 3:1 requirement (WCAG 1.4.11). The honey guess input passes
    (8.8:1), so the fix already exists in-house.
  - The light theme's timer fill against its track is 2.15:1. It's exempt only
    because `ScoreBar` duplicates the number as text; a redesign shouldn't lean
    on that.
- **The palette is honey-yellow on warm charcoal.** It is not NYT's
  yellow-on-white-and-grey, but it's the same hue family. With the name
  changing, yellow can no longer be the lead colour.
- The eight tier gradients (sage to amber to rust) are the richest colour in
  the app, and they're only visible on the difficulty screen.

## Motion

- The motion is sparse and principled. There is one global reduced-motion
  block, and every animation decorates a state that is already visible. **Keep
  this architecture exactly.**
- Correct, incorrect and new-best moments get almost nothing: a border colour
  and a 0.3s pop or shake. There's room for one well-made celebratory beat per
  game, as decoration, under the same guarantee.

## Consistency

- **Three different "choose one" controls** do the same job:
  - hex tier bars (difficulty)
  - a `<select>` of tiers (lobby)
  - radio cards (game mode)
- **Two exit patterns:** a "back-link" (`← Modes`) and a "Quit / Leave"
  two-step. The styling is the same but the meaning differs.
- **Primary buttons change shape by screen:**
  - Results has an auto-width pill-ish 8px-radius button.
  - The lobby and elimination results have full-width 8px buttons.
  - The replay button is a 999px pill.
  - Mode chips are pills.

  There is no documented radius rule.

## Accessibility baseline: what the redesign must not regress

All of this is working and verified, and the redesign plan treats it as fixed
contract:

- `role="status"` outcome and score announcements in `RoundScreen`
  (`lib/announce.ts`, hardening #13), plus TurnScreen's live regions.
- Settings is a native `<dialog>` + `showModal()`:
  - focus goes in on open
  - Tab is trapped
  - Escape closes it
  - focus returns to the trigger (#18)
- `useScreenFocus` on every screen change, and the guess input is `readOnly`
  (not `disabled`) during feedback (#19).
- Visible `:focus-visible` on every control. There are 4 × `outline: none`, and
  each has a replacement (the tier rim, the input border, `[tabindex=-1]`
  headings).
- One global `prefers-reduced-motion` block plus the in-app override, which can
  only add suppression.
- Zoom is not blocked (the viewport meta is clean), and tap targets are 44px or
  more. The hex-clipped tier bars were measured with `elementFromPoint`.
- Every colour is a token defined in both themes (the CLAUDE.md rule), and the
  theme is resolved before first paint.

## Web-interface guideline checks (code level)

- `src/App.css:1001` `.text-input`: the boundary is `--border` only (1.47:1).
  Its `:focus` changes only the border colour; use a ring or a thicker edge.
- `src/components/RoundScreen.tsx:162`, `TurnScreen.tsx:338`: straight quotes
  should be curly (`“ ”`).
- `index.html`:
  - no `<meta name="theme-color">`
  - no Open Graph or Twitter tags
  - no manifest
  - no apple-touch-icon
- `src/App.css`: `font-variant-numeric: tabular-nums` is missing on the score
  bar, timers, standings and room code.
- `src/App.css`: `text-wrap: balance` is missing on headings and `pretty` on
  definitions.
- `src/index.css`: no `touch-action: manipulation` on buttons, which leaves a
  double-tap zoom delay during a timed round.
- Native `<select>` in the lobby and Settings: needs an explicit
  `background-color` / `color` pair for Windows dark mode. It renders as the
  system control in the dark screenshots.
- Pass:
  - no `transition: all`
  - no zoom blocking
  - no `div` click handlers (the settings scrim is a backdrop)
  - labels on every field
  - `aria-label` on icon-only buttons

## Every user-facing place the old name appears

| Where | Now | Note |
|---|---|---|
| `index.html:7` `<title>` | "Spelling Race — Hear it. Spell it." | The browser tab and every shared link's title. |
| `index.html:8` meta description | "A word-spelling race game. Hear it, spell it, beat the clock — solo or against friends." | Doesn't name the game, but describes it as a race game. Rewrite. |
| `src/components/ModeSelect.tsx:17` `<h1>` | "Spelling race" | Home heading. |
| `src/components/DifficultySelect.tsx:25` `<h1>` | "Spelling race" | Difficulty heading (duplicated). |
| `public/favicon.svg` | Hexagon cell, no text | No name, but it is the honeycomb mark. Replace. |
| Web manifest | **none exists** | Create it (name, short_name, icons, theme colour). |
| `og:*` / `twitter:*` share tags, share image | **none exist** | Create them; shared links currently get no card. |
| In-app share text | **none exists** | The waiting room says "Room code — share to invite" but there is no share action or share string. |
| `CLAUDE.md:1`, `:4`, `:653-657` | "# Spelling Race — CLAUDE.md", naming note | Dev docs. Update in the rename stage. |
| `README.md` | Still the stock Vite template; no name at all | Docs session (out of scope here). |
| GitHub About | "It's just the client with a local word bank…", no homepage URL | Docs session (out of scope here). |
| `package.json` `"name"` | `spelling-race` | Not user-facing and never published. Leave it: renaming is churn with no user benefit. |
| `C:\devwork\portfolio-audit` | 4 × CLAUDE.md, 6 × HARDENING.md, 5 × REPORT.md, 2 in the `repos/` snapshot | Audit docs. The name decision is recorded there; wording updates are for the docs session. |

**Not renamed:** the game *mode* "Race" (`LobbyScreen.tsx:284`,
`WaitingRoom.tsx:133`, "Race friends in a shared room"), which stays by
decision.

**Kept unchanged:**
- the `/spellingbee/` base
- the repo slug
- all `spellingbee:*` localStorage keys
- the tier ids

## Screenshot index

`screens/<screen>--<desktop|phone>--<dark|light>.png`, for these screens:

- home
- difficulty
- sp-round (idle)
- sp-correct
- sp-incorrect
- sp-results
- settings
- lobby
- waiting-room
- race-round
- race-locked
- race-roundend
- race-results
- elim-watch
- elim-myturn
- elim-results

**Artifact note:** in full-page captures taller than the viewport (the lobby,
and the settings drawer on phone) the fixed honeycomb layer stops at the
viewport height. That's how Playwright stitches `position: fixed`, not a bug
in the app.
