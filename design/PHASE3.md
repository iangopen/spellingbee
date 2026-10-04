# Phase 3: design system and build plan (stages 0 and 1 built; the rest is planned)

**Direction (Ian, 2026-09-28, revised 2026-10-02 and 2026-10-03):**
- **Honey and ribbon** (honey hybrid variant b): honey carries everything a player
  acts on (buttons, focus, field, timer); ribbon blue appears only on the award
  marks. The Blue Ribbon palette is closed, and so are the other three directions.
- **Homemade strength: light** (Ian, 2026-10-03). `more` and `off` are closed:
  no washi tape, no tilts, no grain inside panels, no double outline, no
  irregular hexagon points, no sketched redraw of the avatars beyond the bee's
  slight wobble. Delete those rules, never ship a `data-h` switch.
- Bricolage Grotesque + Atkinson Hyperlegible, Caveat Brush for decorative text only
- a slow-shimmer honeycomb at the old live site's cell size (28x49px tile), in
  honey, as background decoration only
- a bee mascot and bee contestant avatars; C's race lanes for race results
- **difficulty selection follows the old live design** (the eight hexagon bars)
- dark as the default theme

Reference implementation: `design/prototypes/homemade/` (`?h=light`, bee on). The
token VALUES live in `src/index.css`, which is the source of truth since stage 1;
this file describes what each group is for.

---

## Part 1: design system

### 1.1 Colour tokens

**The values are in `src/index.css`** (built in stage 1), not copied here, so they
cannot drift. Dark is the base (`:root`); light is `[data-theme="light"]`. Every
token exists in both, per the standing rule "adding a token means adding it to
BOTH palettes". Groups, and what each is for:

| Group | Tokens | Used for |
|---|---|---|
| Background layers | `--bg-top`, `--bg-bottom`, `--bg-glow`, `--bg-glow-2`, `--bg-edge`, `--cell-line`, `--cell-line-bright`, `--cells-opacity`, `--cells-glow-opacity`, `--light-peak` | the honeycomb background (stage 2): gradient, glow, vignette, cell edges, shimmer peak |
| Surfaces | `--panel`, `--panel-solid`, `--panel-edge`, `--panel-highlight`, `--scrim`, `--raised`, `--field` | lit panels and their solid fallback, the scrim behind loose text, timer track, inputs |
| Ink | `--text`, `--muted`, `--accent`, `--accent-strong`, `--accent-fill`, `--on-accent`, `--heading` | body and secondary text, honey as text/border, honey as a fill, ink on that fill, headings |
| Award accent | `--kicker`, `--you`, `--mark`, `--mark-2`, `--mark-ring`, `--ribbon-1..3` | the ONLY ribbon-blue uses: winner kicker, the "you" tag, rosette ribbon, first-place ribbon |
| Controls | `--edge`, `--ring`, `--focus-moat`, `--glow-soft`, `--glow-accent`, `--glow-good`, `--glow-bad`, `--good`, `--bad` | control edges, focus ring + its solid moat + halo, state glows, correct / missed |
| Difficulty ramp | `--t-novice` ... `--t-master` | the eight tier bars (stage 4b); sage to olive to amber to burnt orange to honey to rust |
| Bee art | `--bee-body`, `--bee-stripe`, `--bee-wing`, `--bee-line`, `--bee-cheek`, `--bee-eye`, `--bee-leaf` | the mascot and avatars |
| Homemade (light strength) | `--sketch`, `--sketch-faint`, `--ink-shadow`, `--paper-shadow`, `--sticker-bg`, `--sticker-ink`, `--sticker-line`, `--btn-sheen`, `--grain`, `--grain-bg-opacity` | the one hand-drawn panel outline, marker shadows, the sticker, page grain. (`--tape*` and `--grain-panel-opacity` were deleted in stage 3: they only served the closed `more` strength.) |
| Elimination | `--life`, `--out`, `--spectate` | unchanged from Session 20 |
| Elevation | `--shadow` | panel lift |
| Not themed (`:root` only) | `--display`, `--body`, `--hand`, `--r-sm/md/lg/pill`, `--hm-r-panel/btn/field`, `--ease-out` | type families, radii (incl. the irregular homemade corners), easing |

**Aliases (stages 1 to 6, deleted in stage 7):** `--bg`, `--surface`, `--border`,
`--field-edge`, `--honey`, `--honey-solid`, `--honey-dark`, `--honey-glow`,
`--on-honey` point at the new tokens so unported screens keep rendering. Two
families are deliberately NOT aliased yet: `--font-display` / `--font-body` still
name Space Grotesk / Inter (switched to `--display` / `--body` with the shared
components, stage 3), and the old `--tier-*-fill/edge/ink` gradients stay until
stage 4b rebuilds the bars from `--t-*`. `--field-edge` aliases `--edge`, which
is at least as strong as the old value on every field background.

**Measured at stage 1** (`design/stage-results/stage1-contrast-app.md`, the real
app through `design/harness`, worst pixel behind each pair): 728 pairs, 11
failing, against the stage 0 baseline of 715 pairs and 47 failing. No pair that
passed at baseline fails now. The 11 are all pre-existing: the Master bar's
text (4.24 dark, 3.81 light), "Championship rarities" (4.48 dark, 4.00 light),
the eliminated player's name `--out` (2.86 to 2.88; stage 4h), the lobby's
primary buttons in dark (3.19; stage 3's Button), and the default focus ring on
the Settings button over a honey fill (1.82, was 2.14; stage 3's global focus
rule). Each is owned by the stage named.

**Measured at stages 2 and 3** (peak shimmer, `design/stage-results/stage{2,3}-contrast-app.md`):

| After | Pairs | Failing | Why |
|---|---|---|---|
| Stage 1 | 728 | 11 | tokens only, no background |
| Stage 2 | 701 | 265 | the honeycomb now sits behind loose text; text on bare glow is not allowed |
| Stage 3 | 715 | 217 | 48 fewer: every focus ring passes, the lobby buttons pass |

Of the 217, 7 are not honeycomb problems (Master and "Championship rarities" on
the tier bars, the eliminated name `--out` on four screens): stages 4b and 4h.
The other 210 are loose text with no panel behind it (muted captions, headings,
the "Your word is" kicker, the scoreboard labels). They are the reason stage 4
exists: each screen moves onto a `Panel`, and the count has to reach 0 there.
Focus on controls that show it another way (the eight tier bars; the lobby's
disabled buttons, which cannot take focus) is listed separately by the script.


### 1.2 Type

Fonts are **self-hosted** woff2, Latin subset, `font-display: swap`. This also
closes HARDENING #24: no Google Fonts request.

- **Bricolage Grotesque** (OFL): variable, opsz 12..96, weights 500/700/800.
  For display text, numbers and the placard.
- **Atkinson Hyperlegible** (OFL): 400 and 700. For body text, labels and the
  typed answer. Its distinct letterforms are the point in a spelling game.

| Token | Value | Where |
|---|---|---|
| `--fs-caption` | 0.8rem | placard sub-label, meta |
| `--fs-small` | 0.9rem | notes, lane meta ("8 of 10 spelled") |
| `--fs-body` | 1.0625rem (17px) | body, buttons |
| `--fs-lead` | 1.2rem | hero lede |
| `--fs-title` | 1.1rem display 700 | panel headings |
| `--fs-definition` | clamp(1.25rem, 3.2vw, 1.6rem) display 500 | the definition |
| `--fs-stat` | 1.5rem display 800 | scores, lane points, placard number |
| `--fs-answer` | 2.1rem (phone 1.8rem) body 700, +0.08em tracking | the typed answer |
| `--fs-clock` | 2.3rem (phone 2rem) display 800 | round clock |
| `--fs-h1` | clamp(2.2rem, 5vw, 3.4rem) display 800, -0.03em | results, lobby titles |
| `--fs-hero` | clamp(3rem, 7vw, 5.4rem) display 800, -0.035em | home title |

**Rules:**
- `font-variant-numeric: tabular-nums` on every number that changes.
- `text-wrap: balance` on headings and `pretty` on definitions.
- Sentence case everywhere.
- Curly quotes and `…`; no em-dashes in UI copy (the voice rules in
  `DIRECTIONS.md`).

### 1.3 Space, radius, elevation, layers

- **Spacing:** 4px base. `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20,
  `--s-6` 24, `--s-7` 28, `--s-8` 36, `--s-9` 44, `--s-10` 56 (px). The page
  gutter is 20px. Content widths:
  - round: 720px
  - results: 820px
  - home: 1120px, in two columns
- **Radius:** `--r-sm` 8 (placards, tokens, rows), `--r-md` 14 (buttons,
  fields), `--r-lg` 22 (panels), `--r-pill` 999 (chips, the round header strip,
  back link).
- **Elevation:** a panel is `--panel` + inset `--panel-highlight` + inset 1px
  `--panel-edge` + `--shadow`. There is no second card style.
  - A backdrop blur of 12px applies **only** with
    `(hover:hover) and (pointer:fine) and (min-width:900px)`. Over a moving
    background it re-renders every frame, so phones get an opaque panel
    instead.
  - `prefers-reduced-transparency` swaps in `--panel-solid`.
- **Glows** (always outside a solid moat, never touching an edge or ring):
  - focus: `0 0 0 7px var(--focus-moat), 0 0 0 13px var(--glow-soft)`
  - answer-field focus: `0 0 0 7px var(--field), 0 0 0 11px var(--glow-accent), 0 0 26px -4px var(--glow-accent)`
  - correct and missed use the same shape with `--glow-good` / `--glow-bad`
  - primary button: `0 8px 28px -8px var(--glow-accent)`
- **Layers:**

  | z-index | Layer |
  |---|---|
  | 0 | the background layer (fixed, `aria-hidden`, `pointer-events:none`) |
  | 1 | content |
  | top layer | the Settings `<dialog>` (native) |

  No other z-index values.

### 1.4 Motion

Every animation decorates a state that is already visible (the standing Session
12 rule). **The single global reduced-motion block** zeroes animations *and
transitions* under the OS setting, and so does the in-app override. The
prototype proved this: without the transition half, hover and focus glows kept
fading for reduced-motion users.

| Token | Value | Used by |
|---|---|---|
| `--ease-out` | cubic-bezier(.2,.8,.2,1) | nearly everything |
| `--ease-pop` | cubic-bezier(.2,1.4,.4,1) | the tick/cross pop, rosette pin |
| `--dur-press` | 150ms | button press / hover lift |
| `--dur-state` | 200–350ms | border / glow changes |
| `--dur-enter` | 550ms, 60ms stagger | panels rising in on a screen change |
| `--dur-light-up` | 700ms | correct: field light-up |
| `--dur-float` | 1000ms | "+14" floating up; lane tokens flying in |
| `--dur-pin` | 800ms (+200ms delay) | winner rosette |
| `--dur-shake` | 420ms | missed: one field shake |
| `--dur-ring` | 900ms | missed: bell icon swing |
| `--dur-sweep` | 18s cycle | honeycomb shimmer (crosses in ~9s, rests ~9s) |
| mascot idle | 5s | bee hovers 5px (reduced motion: still) |

Only `transform` and `opacity` animate (box-shadow only in the one-off
light-up). The honeycomb pauses in a hidden tab.

### 1.5 The honeycomb background

- A 28×49px pointy-top tile, generated SVG, stretched 1% vertically so the pitch
  is exactly the old site's.
- Honey, not blue: cell edges use `--cell-line` / `--cell-line-bright` (amber at 28-42 degrees of hue). Never lemon yellow, never flat grey tiles.
- A paper-grain layer (`.bg-grain`, peak alpha about 0.06) sits over the page background only.
- Layers:
  - the gradient
  - the crisp cell lines plus a blurred copy (rasterised once)
  - the shimmer band (a transform-only window/counter-window, which never
    repaints the blur)
  - the depth vignette
  - a calm band under the header
- **Decoration only:** `aria-hidden`, no pointer events, no text or controls,
  never a letter board or answer layout.
- Verified by the lemon test in `design/harness/shoot-homemade.mjs` (NYT yellow is
  hue 53; the honey sits at 30-42). `check-glow.mjs` is for the Blue Ribbon
  direction and fails honey by design.
- Phone: at 390px with the CPU slowed 4×, the median frame is 16.7ms and no
  frame is over 25ms (headless; a real-phone check is still due).

### 1.6 Components

| Component | Replaces / lives in | Notes |
|---|---|---|
| `HoneycombBackground` | `index.css` `body::before` | Mounted once in `Shell`. Visibility pause. The in-app reduce-motion override also hides the shimmer. |
| `Panel` | the ad-hoc `.prompt-card`, `.lobby-panel`, `.results-*`, `.champion` | one lit-glass surface |
| `Button` (primary / secondary / text / danger) | `.primary-btn`, `.ghost-btn`, `.secondary-btn`, `.danger-btn`, `.skip-btn` | 54px primary; `:active` press; glow on primary only |
| Back link / quit | `.back-link`, `.exit-confirm` | pill on a scrim; the two-step confirm is unchanged |
| `AnswerField` | `.guess-input` (replaced in stage 3) | moat + state glows; tick/cross icon; keeps `readOnly` (not `disabled`) during feedback |
| `TextInput`, `Select` | `.text-input`, native `<select>` | edge `--edge` (fixes the audit's 1.47:1 inputs); explicit select colours for Windows dark |
| **Tier selector** | the hex `.tier-bar` stack | **Changed 2026-10-02 (Ian): the OLD hexagon bars return**, restyled with the hybrid's tokens (prototype: `prototypes/homemade/difficulty.html`). 8 bars in one scrolling stack, ≥44px targets, the rim that thickens on focus, the practice / hide-definition chips. Replaces the earlier "ribbon-marked rows, no clip-path" plan. Never a letter board. |
| `Placard` | new | word counter ("4 of 10 words"); in Race/Elimination, the player's seat |
| `Rosette` | favicon, results trophy | petal ring + tails; bee at the centre (bee chosen) |
| `BeeMascot` | new | home hero and rosette; idle hover |
| `AvatarArt` | the lucide icons in `lib/avatars.ts` | bee contestants for the SAME 8 keys; `AVATAR_KEYS` and `coerceAvatar` unchanged, so `verify_elimination_client.mjs` still passes |
| `Clock` + `TimerBar` | `.score-bar` timer, `TimerBar` | TimerBar's rules (pure view of `timeLeft`, look-ahead, priming frame, keyed snap, urgency classes on the displayed value, `aria-hidden`) are unchanged; only the look changes |
| `Tally` | `ScoreBar` | points + "in a row" + words left; streak pulse kept (remount by key) |
| `RaceResults` (new) | race's reuse of `ResultsScreen` in `App.tsx` | winner card + lanes from `mp.extras.players` / `winnerName` (data already on the client) |
| `ResultsScreen` | solo results | rosette moment on a new best |
| `EliminationResults`, `TurnScreen` tokens | existing | bee contestant tokens; ghost state and lives unchanged |
| Settings dialog | `SettingsPanel` | restyle only; the native `<dialog>` behaviour (focus in, Tab trap, Escape, focus return) is untouched |
| Status / announce | `role="status"` regions | unchanged. `lib/announce.ts` is copy-only if at all. |
| Toasts | none today | **none added.** The lobby errors stay inline next to their fields. |

---

## Part 2: stage-by-stage build plan

One commit per stage on `redesign/spelling-bee`. After every stage the app
builds, passes lint and tests, and every flow works by keyboard. **Nothing
reaches `main` without Ian's OK.** The recommended release points are after
stage 5 (the whole new look and name together) and after stage 7. Shipping the
middle stages alone would show a half-old, half-new UI.

**Standing gates for every stage:**
- `npm run build`, `npm run lint` and `npm test` all pass.
- `npm run test:db` passes untouched, which shows no Supabase change.
- `git diff main -- src/hooks src/lib/rooms.ts src/lib/auth.ts src/lib/captcha.ts supabase` is empty.
- The harness screenshots are re-shot.
- The contrast measurement against the real app (the prototype's `measure.mjs`,
  pointed at `design/harness`) shows 0 failing.
- Reduced-motion stills match static.
- A keyboard walkthrough of the touched flows.

| # | Stage (one commit) | Files | Tests / checks added |
|---|---|---|---|
| 0 ✅ | **Groundwork (done 2026-09-29).** Self-host the two fonts (woff2, Latin + Latin Extended) and add `CREDITS.md` (the OFL fonts, lucide ISC). Port `measure.mjs` / `check-glow.mjs` to the real screens (`TARGET=app`, through `design/harness`), and record the baseline in `design/baseline/`. The current fonts were self-hosted on `main` first (HARDENING #24; live, 0 Google requests). | `src/fonts.css`, `src/assets/fonts/`, `CREDITS.md`, `design/harness/*`, `design/baseline/*` | prototype regression: 152 pairs, 0 failing, unchanged; app baseline: 715 pairs, 47 failing, 44 controls without an outline |
| 1 ✅ | **Tokens + dark default (done 2026-10-03).** The honey-and-ribbon token set (homemade `light`) in both themes in `index.css`, old tokens aliased (see 1.1). `theme.ts`: `resolveTheme()` is stored ?? `"dark"`, the OS listener and `getSystemTheme`/`onSystemThemeChange` are gone, `SettingsPanel`'s listener removed. The `spellingbee:theme` key and its values are unchanged, so a player who chose light keeps it. The harness now stores its theme pick like a player would (the OS emulation no longer selects a theme). Stage 0 gap closed: Caveat Brush added to `src/fonts.css`, `src/assets/fonts/` and `CREDITS.md`. | `index.css`, `fonts.css`, `lib/theme.ts`, `main.tsx`, `SettingsPanel.tsx`, `CREDITS.md`, `design/harness/main.tsx` | `theme.test.ts` (7 tests; negative control: following the OS again fails 2 of them); contrast 728 pairs / 11 failing vs baseline 47, no new failure |
| 2 ✅ | **Honeycomb background (done 2026-10-03).** `HoneycombBackground` + `src/honeycomb.css`, mounted once in `Shell`, replacing `body::before`. The 28x49 tile is an SVG used as a CSS MASK painted with `--cell-line` / `--cell-line-bright`, so both palettes and every theme switch work with no JavaScript. Layers: gradient, blurred + crisp cells (faded by `--hex-mask`), paper grain, the shimmer (a window over brighter cells, transform and opacity only), a calm header band and vignette. It lives at `z-index: -1` INSIDE `.app-shell`: z-index 0 painted it over the in-flow screen and hid every screen (caught by the first measurement, which reported 371 failures that were really the background). The shimmer is removed under the OS setting and the in-app override; the tab being hidden freezes it. `?peak=1` (harness only) shows every bright cell at once. | `components/HoneycombBackground.tsx`, `honeycomb.css`, `index.css`, `App.tsx`, `design/harness/*` | render test (aria-hidden, no text, no focusables, pause/resume/cleanup); lemon pixels 0 of 1.02M on home and round, both themes; phone, CPU 4x: median frame 16.7ms, p95 16.8ms, worst 49.9ms (one-off, headless) |
| 3 ✅ | **Shared components (done 2026-10-03).** `components/ui/`: `Button` (primary / secondary / text / danger, `sm` size; replaced `.primary-btn`, `.secondary-btn`, `.ghost-btn`, `.danger-btn`, all 18 call sites; disabled is a dashed muted outline, not a faded fill), `TextInput` / `Select` (`--edge`, native option colours for Windows dark), `AnswerField` (replaced `.guess-input` in both screens; moat + state glows, tick/cross, `readOnly` kept), `Panel`, `Sticker`, `Placard`, `WobbleFilters` (mounted in Shell), and `Art` (`AvatarArt`, `BeeMascot`, `Rosette`) drawn by `lib/beeArt.ts` from tokens, seeded per avatar key. `AvatarPicker` / `AvatarBadge` now draw the bee contestants; `lib/avatars.ts` lost its lucide icons and keeps the keys. The global focus rule (`ui.css`) outranks the marker shadows. `--tape*` / `--grain-panel-opacity` deleted. Panel, Sticker, Placard, BeeMascot and Rosette are built and tested but have no screen yet: their first consumers are stages 4a (home), 4c (round), 4d and 4e (results). | `components/ui/*`, `ui.css`, `lib/beeArt.ts`, `lib/avatars.ts`, `AvatarPicker.tsx`, call sites, `App.css` (old rules removed) | `ui.test.tsx` (12), `AVATAR_KEYS` pinned; focus rings 0 failing (Settings 11.47 / 7.35, was 1.82); lobby buttons 7.06 / 6.47 (was 3.19) |
| 4a ✅ | **Home** (ModeSelect): hero panel + mascot + best-scores panel (from `getAllBests()`) | `ModeSelect.tsx`, `App.tsx` (pass bests only) | keyboard: heading focus via `useScreenFocus` is unchanged |
| 4b ✅ | **Difficulty:** the OLD hexagon tier bars restyled with the new tokens (see 1.6 and `prototypes/homemade/`) + the modifier chips, with the header on a lit panel | `DifficultySelect.tsx`, `App.css` (`.tier-bar` rules adapted, not deleted) | tap-target measurement with `elementFromPoint` probes (every bar ≥44px, the clip-path IS the target); focus rim contrast (`shoot-homemade.mjs` section 5); `TIER_ORDER` / `TIER_META` untouched |
| 4c ✅ | **Round** (solo + race): the pronouncer panel, placard, clock, answer moments (light-up, bell + shake), "+14" | `RoundScreen.tsx` (markup/classes) | existing `RoundScreen.test.tsx` green, especially: no word reveal while `awaitingOthers`, `readOnly` focus kept, `role="status"` text unchanged |
| 4d ✅ | **Solo results:** the rosette moment on a new best | `ResultsScreen.tsx` | "new best" only when it truly is (solo) |
| 4e ✅ | **Race results:** the new `RaceResults` (winner + lanes). `App.tsx` routes race to it. This fixes the audit bugs: no false "new best!", a real winner and standings, and the button says what it does. | `components/RaceResults.tsx`, `App.tsx` (routing line only) | unit test: order by score, the "you" row, ties, 2 to 8 players; lane positions ∝ score |
| 4f ✅ | **Settings dialog** restyle (the theme picker stays Light/Dark) | `SettingsPanel.tsx` (classes), CSS | a dialog test: focus in / trap / Escape / restore, still green in Chrome |
| 4g ✅ | **Lobby + waiting room:** panels side by side at desktop, new inputs (fixes the 1.47:1 edges), avatar picker with bee contestants | `LobbyScreen.tsx`, `WaitingRoom.tsx` | contrast of every input edge; name validation copy unchanged |
| 4h | **Elimination:** TurnScreen HUD, bee contestant tokens, ghost state, knockout overlay; EliminationResults | `TurnScreen.tsx`, `EliminationResults.tsx` | the Session 21 rules re-verified (tokens not focusable, the reserved feedback slot, ghost drift decoration-only) |
| 5 | **Rename.** "Spelling Race" becomes "Spelling Bee" in `<title>` ("Spelling Bee \| Hear the word. Spell it right."), the meta description (rewritten, no "race game"), the two `<h1>`s, and the CLAUDE.md heading and naming note. The mode "Race" is unchanged. Slug, base, `package.json` name and localStorage keys are unchanged. | `index.html`, `ModeSelect.tsx`, `DifficultySelect.tsx`, `CLAUDE.md` | grep: 0 user-facing "Spelling Race"; `vite.config.ts` base still `/spellingbee/` |
| 6 | **Assets.** Rosette favicon (SVG + 32px PNG), 180px apple-touch-icon, `manifest.webmanifest` (name/short_name "Spelling Bee", `theme_color` `#070b1c`, `background_color` `#050814`, 192/512 icons, start_url `/spellingbee/`), `theme-color` meta, OG/Twitter tags + a 1200×630 card (rosette + bee on the honeycomb). Remove the unused Vite scaffold files (`public/icons.svg`, `src/assets/*`). | `public/*`, `index.html`, `CREDITS.md` | manifest validates; the icons resolve under `/spellingbee/`; the card renders in a share preview |
| 7 | **Polish.** The miss sound becomes a soft **bell**: inharmonic sine partials (about 1 : 2.76 : 5.4) with a fast attack and ~0.6s decay, as gentle as today's, never a buzzer, still in `sfx.ts` only. Screen transitions (a same-document View Transition around screen changes, reduced motion is instant). Delete the aliased old tokens. Final full passes: keyboard traces of every flow, a screen reader smoke test, contrast on the real app in both themes, a **real mid-range Android check** of the shimmer, and a bundle check. | `lib/sfx.ts`, `App.css`, `index.css` | sfx unit test (the bell fires once per miss via `useSfxForOutcome`); bundle budget |

**Budgets:**
- no new runtime dependencies
- fonts ≤ 150 KB of woff2 **downloaded per page** (the Latin files; Latin Extended loads only for names that need it). Redesign fonts: Bricolage 76.9 KB + Atkinson 400/700 34.7 KB = 111.6 KB. Inter and Space Grotesk leave in stage 7.
- JS growth ≤ 6 KB gzip over `main`
- the honeycomb adds no JS beyond its component (the tile is generated CSS)
- Lighthouse mobile performance no worse than `main`

**Risks and how they're handled:**
- **Glow and contrast on real content:** the prototype's worst-pixel
  measurement becomes a standing gate (stage 0) rather than a one-off.
- **Phone smoothness:** headless numbers are good. The real-device check in
  stage 7 decides whether the shimmer ships on by default. The static glow is
  the automatic fallback.
- **Accessibility regressions:** the #13/#18/#19 behaviours have tests or
  scripted checks in every stage that touches them.
- **The name itself:** a distinct look reduces confusion with NYT's game but
  doesn't clear the name (HARDENING #14, §C10). It's Ian's decision, still
  open.

## Decisions (Ian, 2026-09-29)
- **Build all stages on `redesign/spelling-bee`.** Do NOT merge to `main`
  stage by stage. Ian reviews the finished redesign, and it merges once at the
  end.
- **The Google Fonts removal went to `main` on its own,** ahead of the
  redesign: the current fonts are self-hosted and live, with 0 requests to
  Google.
- **Multiplayer screens** will be tested locally against the real backend with
  localhost added to the Turnstile widget. This also needs
  `VITE_TURNSTILE_SITE_KEY` in `.env.local`.

## Adjustments from the homemade pass (Ian, 2026-10-02)

Ian picked **honey hybrid b (Honey and ribbon)** and asked for two tweaks before
the build. Prototype: `design/prototypes/homemade/` (start at `compare.html`).
Nothing is in `src/`. Stage 0 (commit `c80cc61`, the self-hosted fonts and the
measurement baseline) is the only stage built, and the tweaks change it and
the stages below like this:

| Stage | What the tweaks change |
|---|---|
| 0 (built) | **Add one font:** Caveat Brush (OFL), subset to A-Z, a-z, space, comma, full stop and the ellipsis (15.3 KB woff2, no digits). `src/fonts.css` gets one `@font-face`, `src/assets/fonts/` gets the file and `OFL-CaveatBrush.txt`. Total redesign fonts 126.9 KB, inside the 150 KB budget. Nothing already built is undone. |
| 1 Tokens | The token source is now `prototypes/homemade/style.css` variant **b** (not Blue Ribbon). New tokens, both palettes: `--sketch`, `--sketch-faint`, `--ink-shadow`, `--paper-shadow`, `--sticker-bg`, `--sticker-ink`, `--tape`, `--tape-line`, `--grain`. Radius tokens for the irregular corners (`--hm-r-panel`, `--hm-r-btn`, `--hm-r-field`). `--hand` joins the type tokens. **Ian picked `light` (2026-10-03)**, so the strength is a build-time constant: `more` and `off` rules are deleted, never switched. Stage 1 is built this way. |
| 2 Honeycomb | The grain layer (`.bg-grain`) joins the background component, and the two SVG wobble filters mount once in `Shell`. The shimmer peak is calmer (`--light-peak` 0.36 light, 0.30 more in dark). |
| 3 Shared components | Panel gets the irregular corners, the drawn outline (`::after`, wobble filter) and, at "more", the grain `::before`. Button gets the hard marker shadow and irregular corners. **The global focus rule must outrank the strength rules** (a bug caught by measuring: the marker shadows silently replaced the focus moat). `AvatarArt` and the rosette take the rough drawing (`art.js`: jittered blobs, seeded per avatar key, so each avatar is drawn the same way every time); `AVATAR_KEYS` unchanged. New `Sticker` and `Tape` bits (decorative, `aria-hidden`). |
| 4a Home | Hand-lettered title, "Your best scores" heading and a sticker on the hero card; the hero gets extra top padding for the sticker; the mascot sits lower on phones so it never touches the Settings button's focus ring. |
| 4b Difficulty | **Rebuilt:** see the table row above. |
| 4c Round | "Your word is..." is hand-lettered; everything the player reads or types stays Atkinson. The placard tilts. |
| 4e Race results | The winner kicker is hand-lettered; a "Race over" sticker hangs off the winner card's bottom edge (not the top, where on phones it met the Settings focus ring). |
| 5 to 7 | No change, except stage 6's favicon and share card should use the same sketched bee as the in-page art if "light" or "more" wins. |

**New measurement rules learned here (keep for the build's gates):**
- Texture is measured by the worst pixel, so its peak alpha matters, not its
  average. The first grain (peak alpha about 0.4) failed 30 pairs; at about 0.06
  it passes everything.
- `measure.mjs` switches `rotate` off under `?peak=1`, because the bounding
  box of rotated text takes in pixels that are not under any letter. Tilts are
  5 degrees or less.
- A clip-path hides outlines, so the tier bars' focus indicator needs its own
  measurement (`shoot-homemade.mjs`, section 5).

## Stage 4a to 4d: what was built (2026-10-03)

Contrast failures after each screen (peak shimmer, real app, `design/stage-results/`):

| After | Failing | Screens still failing |
|---|---|---|
| Stage 3 | 217 | everything |
| 4a home | 212 | home: 0 |
| 4b difficulty | 187 | difficulty: 0 |
| 4c round | 90 | all four round states (solo correct / wrong, race locked / round end): 0 |
| 4d solo results | 64 (race results: 0 too) | elimination 46, lobby 10, waiting room 8 |

The 64 left are exactly the screens not yet ported: elimination (4h), lobby and
waiting room (4g). Race results already pass because it shares `ResultsScreen`;
4e still owes it a winner and standings.

- **4a:** hero panel (hand-lettered title and underline, sticker, mascot), "Your
  best scores" panel (rosette), Privacy link inside the hero. The phone mascot sits
  clear of the fixed Settings button.
- **4b:** the old hexagon bars on `--t-*`; header on a panel; `.back-link` is now a
  scrim pill with 24px below it (a 12px gap let the focus ring touch the next
  panel's drawn outline). Master's gradient was darkened (4.24:1 became passing).
  `check-tier-bars.mjs` measures the real app: 8 bars, one per row, tap target
  58px tall at the centre, focus rim 11.47 / 7.35:1. The old `--tier-*` gradients
  are deleted except Expert and Master, which are fixed solid bars.
- **4c:** `ScoreBar` is now a pill (tally, placard, clock) and is RoundScreen-only;
  the pronouncer and answer are panels; the draining bar stays welded to the input;
  "+N" (derived from the score prop) and a bell on a miss; `.round-screen` max width
  720. `.prompt-card`, `.lead-in`, `.feedback`, `.timer-track`, `.stat`, `.score-bar`
  are untouched and still serve TurnScreen until 4h.
- **4d:** `ResultsScreen` is one panel. "New best" is decided by `App` (previous
  stored best beaten) and passed as `isNewBest`; it used to be `score >= best`,
  which also fired on ties, on practice runs against an empty best, and on every
  race. Practice runs say they do not set best scores; the race shows no best line.
- Phones: `.app-shell` has 76px top padding so no first row sits under the fixed
  Settings button.

## Stage 4e to 4g: what was built (2026-10-03)

| After | Failing | Screens still failing |
|---|---|---|
| 4d | 64 | elimination 46, lobby 10, waiting room 8 |
| 4e race results | 63 | race results and a tie: 0 |
| 4f settings | 64 | settings: 0 (the +1 is animation timing inside elimination, not touched) |
| 4g lobby + waiting room | 45 | lobby 0, waiting room 0; **all 45 left are elimination (4h)** |

- **4e:** `lib/standings.ts` ranks the scoreboard the server already holds
  (standard competition ranking: 1, 1, 3), words the winner line and the line to
  the viewer ("You came 2nd with 205 points, 6 behind", "You tied for 1st"),
  and scales lane position to score / leader. A tie names every tied player and
  picks nobody by row order; nobody scoring is "No points this time" with no
  rosette. `RaceResults` renders it (winner card, labelled standings list, the
  tokens decoration-only); `ResultsScreen` is now solo-only. Lane subtitles
  ("8 of 10 spelled") from the prototype are NOT shown: the client has no
  per-player correct count, and none was invented.
- **4f:** the drawer is an opaque panel (`--panel-solid`, hand-drawn left edge,
  hand-lettered title), controls use `--edge` and the honey fill, the switch
  keeps >= 3:1 in both states. New token `--scrim-modal`. Behaviour checked in
  real Chrome by `design/harness/check-settings-dialog.mjs`: focus moves in, 46
  Tab / Shift+Tab presses never land on the page behind (a native modal does let
  Tab pass through browser UI, so "never leave" would be the wrong test), Escape
  closes, focus returns to the Settings button, the drawer is opaque. That check
  has no negative control yet.
- **4g:** the lobby is a grid: who you are across the top, Create and Join side
  by side at desktop, one column on phones; the hint and error moved into the
  "you" panel. The waiting room is a column of panels (code, avatar, players,
  start). `.lobby-panel` and `.lobby-divider` are gone.

