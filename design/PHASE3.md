# Phase 3: design system and build plan (planning only; nothing implemented)

**Final direction (Ian, 2026-09-28):**
- **Blue Ribbon:** palette, Bricolage Grotesque + Atkinson Hyperlegible,
  rosette, contestant placards, bell
- **slow-shimmer honeycomb** at the old live site's cell size (28×49px tile)
- **bee mascot and bee contestant avatars**
- **C's race lanes** for race results
- **dark as the default theme**

Reference implementation: `design/prototypes/blue-ribbon-glow/` (`?bg=shimmer&bee=1`,
which is now its default). Every value below comes from that prototype's
`style.css` / `honeycomb.*` and was measured there.

---

## Part 1: design system

### 1.1 Colour tokens

Dark is the base (`:root`); light is `[data-theme="light"]`. Every token exists
in both, per the existing CLAUDE.md rule "adding a token means adding it to
BOTH palettes".

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--bg-top` / `--bg-bottom` | `#070b1c` / `#050814` | `#f4f6fd` / `#e8edfb` | background gradient ends; `--bg-top` is also the calm header band |
| `--bg-glow`, `--bg-glow-2` | `rgba(35,70,216,.55)`, `rgba(92,124,255,.22)` | `rgba(35,70,216,.16)`, `rgba(35,70,216,.10)` | the ribbon-blue light in the gradient |
| `--bg-edge` | `rgba(3,5,14,.85)` | `rgba(214,222,246,.9)` | depth vignette |
| `--cell-line` / `--cell-line-bright` | `rgba(138,162,255,.34)` / `rgba(186,204,255,.85)` | `rgba(35,70,216,.20)` / `rgba(35,70,216,.55)` | honeycomb edges / the shimmer band's cells |
| `--cells-glow-opacity`, `--light-peak` | `.55`, `.55` | `.35`, `.6` | glow copy strength, shimmer peak |
| `--panel` / `--panel-solid` | `rgba(17,23,46,.86)` / `#121830` | `rgba(252,253,255,.9)` / `#fcfdff` | lit panels / the solid fallback |
| `--panel-edge`, `--panel-highlight` | `rgba(160,182,255,.16)`, `rgba(210,222,255,.10)` | `rgba(35,70,216,.14)`, `rgba(255,255,255,.9)` | panel inner edge and top highlight |
| `--scrim` | `rgba(5,8,20,.72)` | `rgba(246,248,254,.8)` | behind any text that isn't on a panel |
| `--raised` | `rgba(138,162,255,.10)` | `rgba(35,70,216,.07)` | timer track, subtle fills |
| `--field` | `#0c1126` | `#ffffff` | answer and text inputs; also their focus moat |
| `--text` / `--muted` | `#eef1f8` / `#a9b1ca` | `#141a2e` / `#4a5470` | ink |
| `--accent` / `--accent-strong` / `--on-accent` | `#8aa2ff` / `#aabcff` / `#0b1024` | `#2346d8` / `#1a37b8` / `#fcfdff` | ribbon blue |
| `--edge` | `#8f99bb` | `#5f6886` | control edges (inputs, secondary buttons) |
| `--ring` / `--focus-moat` / `--glow-soft` | `#b7c6ff` / `#070b1c` / `rgba(122,150,255,.32)` | `#1a37b8` / `#ffffff` / `rgba(35,70,216,.18)` | focus ring, its solid moat, and the halo beyond |
| `--good` / `--bad` | `#5fdcaa` / `#ff8b83` | `#146b45` / `#b02f28` | correct / missed |
| `--glow-accent` / `--glow-good` / `--glow-bad` | `rgba(122,150,255,.55)` / `rgba(95,220,170,.5)` / `rgba(255,139,131,.45)` | `rgba(35,70,216,.35)` / `rgba(20,107,69,.3)` / `rgba(176,47,40,.28)` | glows |
| `--ribbon-2` / `--ribbon-3` | `#ff8b83` / `#d8def0` | `#b02f28` / `#6f7896` | 2nd- and 3rd-place ribbons |
| `--bee-body` / `--bee-stripe` / `--bee-wing` / `--bee-line` / `--bee-cheek` | `#8aa2ff` / `#141a2e` / `rgba(225,233,255,.72)` / `#0b1024` / `#ff9fb2` | `#5d7cf2` / `#141a2e` / `rgba(255,255,255,.85)` / `#141a2e` / same | bee art (never yellow) |
| `--shadow` | `0 20px 50px -24px rgba(0,0,0,.8)` | `0 18px 40px -22px rgba(35,70,216,.35)` | panel lift |

**Tokens being retired:**
- `--honey*`, `--on-honey`
- the 8 `--tier-*-fill/edge/ink` gradients
- `--surface`, `--border`

During the transition (stages 1 to 4) they are **aliased** to the new tokens,
so unported screens keep rendering. They're deleted in stage 7. Elimination's
`--life`, `--out` and `--spectate` stay, re-tuned to the new palette and
re-measured.

**Measured** (`design/prototypes/blue-ribbon-glow/contrast.md`, at the old
cell size): 152 text/edge/focus-ring pairs against the worst pixel behind them
at peak glow, 0 failing. Minimums:

| Kind | Minimum |
|---|---|
| Body text | 5.67:1 |
| Large text | 5.61:1 |
| Control edges | 4.1:1 |
| Focus rings (measured focused) | 8.52:1 |

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
- Layers:
  - the gradient
  - the crisp cell lines plus a blurred copy (rasterised once)
  - the shimmer band (a transform-only window/counter-window, which never
    repaints the blur)
  - the depth vignette
  - a calm band under the header
- **Decoration only:** `aria-hidden`, no pointer events, no text or controls,
  never a letter board or answer layout. **Never yellow.**
- Verified by `design/harness/check-glow.mjs`: 0 yellow literals and 0 yellow
  pixels in 43.3M.
- Phone: at 390px with the CPU slowed 4×, the median frame is 16.7ms and no
  frame is over 25ms (headless; a real-phone check is still due).

### 1.6 Components

| Component | Replaces / lives in | Notes |
|---|---|---|
| `HoneycombBackground` | `index.css` `body::before` | Mounted once in `Shell`. Visibility pause. The in-app reduce-motion override also hides the shimmer. |
| `Panel` | the ad-hoc `.prompt-card`, `.lobby-panel`, `.results-*`, `.champion` | one lit-glass surface |
| `Button` (primary / secondary / text / danger) | `.primary-btn`, `.ghost-btn`, `.secondary-btn`, `.danger-btn`, `.skip-btn` | 54px primary; `:active` press; glow on primary only |
| Back link / quit | `.back-link`, `.exit-confirm` | pill on a scrim; the two-step confirm is unchanged |
| `AnswerField` | `.guess-input` (RoundScreen, TurnScreen) | moat + state glows; tick/cross icon; keeps `readOnly` (not `disabled`) during feedback |
| `TextInput`, `Select` | `.text-input`, native `<select>` | edge `--edge` (fixes the audit's 1.47:1 inputs); explicit select colours for Windows dark |
| **Tier selector** | the hex `.tier-bar` stack | 8 ribbon-marked rows (placard number + name + blurb + best), no clip-path. Keep one scrolling stack and ≥44px targets; the practice / hide-definition chips stay. |
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
| 1 | **Tokens + dark default.** The new token set in both themes, old tokens aliased. `theme.ts`: `resolveTheme()` becomes stored ?? **`"dark"`**; drop the OS listener in `SettingsPanel`; the pre-JS fallback becomes dark. The `spellingbee:theme` key and its values are unchanged, so a player who chose light keeps it. | `index.css`, `lib/theme.ts`, `SettingsPanel.tsx` (listener only) | new `theme.test.ts`: no stored value gives dark; stored light gives light; the OS setting is ignored |
| 2 | **Honeycomb background.** The `HoneycombBackground` component + CSS (28×49 tile, glow, shimmer, vignette, header band), replacing `body::before`. The shimmer is hidden under the OS setting AND the in-app override. | `components/HoneycombBackground.tsx`, `index.css` | render test (`aria-hidden`, no text, no focusables); check-glow on the app; the perf script at 390px |
| 3 | **Shared components.** Panel, Button, AnswerField (moat + states), TextInput/Select, Placard, Rosette, BeeMascot, AvatarArt, Clock/TimerBar and Tally restyles; the global focus-moat rule. | new `components/ui/*`, `AvatarPicker.tsx`, `TimerBar.tsx` (CSS only), `ScoreBar.tsx`, `lib/avatars.ts` (art mapping only) | `AVATAR_KEYS` unchanged (unit test pins the list); TimerBar tests unchanged and green; focus-ring contrast |
| 4a | **Home** (ModeSelect): hero panel + mascot + best-scores panel (from `getAllBests()`) | `ModeSelect.tsx`, `App.tsx` (pass bests only) | keyboard: heading focus via `useScreenFocus` is unchanged |
| 4b | **Difficulty:** the new tier selector + the modifier chips | `DifficultySelect.tsx` | tap-target measurement (every row ≥44px); `TIER_ORDER` / `TIER_META` untouched |
| 4c | **Round** (solo + race): the pronouncer panel, placard, clock, answer moments (light-up, bell + shake), "+14" | `RoundScreen.tsx` (markup/classes) | existing `RoundScreen.test.tsx` green, especially: no word reveal while `awaitingOthers`, `readOnly` focus kept, `role="status"` text unchanged |
| 4d | **Solo results:** the rosette moment on a new best | `ResultsScreen.tsx` | "new best" only when it truly is (solo) |
| 4e | **Race results:** the new `RaceResults` (winner + lanes). `App.tsx` routes race to it. This fixes the audit bugs: no false "new best!", a real winner and standings, and the button says what it does. | `components/RaceResults.tsx`, `App.tsx` (routing line only) | unit test: order by score, the "you" row, ties, 2 to 8 players; lane positions ∝ score |
| 4f | **Settings dialog** restyle (the theme picker stays Light/Dark) | `SettingsPanel.tsx` (classes), CSS | a dialog test: focus in / trap / Escape / restore, still green in Chrome |
| 4g | **Lobby + waiting room:** panels side by side at desktop, new inputs (fixes the 1.47:1 edges), avatar picker with bee contestants | `LobbyScreen.tsx`, `WaitingRoom.tsx` | contrast of every input edge; name validation copy unchanged |
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
