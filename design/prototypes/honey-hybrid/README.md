# Honey hybrid: the old warmth with the new polish (pick pending)

**Open this first:** `compare.html` (straight from disk). It puts the old live
design, plain Blue Ribbon and the three hybrids side by side, on any of the
three screens, in either theme, at desktop and phone width.

**Brief (Ian, 2026-09-29):** Blue Ribbon stays approved, but the old design's
colours and warmth were missed. Prototype a hybrid: mainly the old palette and
character, with the new direction's polish. Nothing goes into `src/` until a
variant is picked.

## What comes from where

| From the old live design | From the Blue Ribbon glow direction |
|---|---|
| The palette: charcoal `#16130f` and card `#211c15` in dark, cream `#faf3e3` in light, honey `#e8a63d` as the accent | The glowing slow-shimmer honeycomb treatment (now in honey) |
| The honeycomb idea at the old cell size (28×49px tile) | Softly lit glass panels |
| The title in honey, and the tagline "Hear it. Spell it. Beat the clock." | Glow on focus and on the primary button; the 7px focus moat |
| The difficulty ramp (sage, olive, amber, burnt orange, honey, rust), as a swatch beside each tier | The correct-answer light-up and the bell with a short shake |
| The honey-outlined "Hear it again" pill | Screen transitions (rise and fade, view transitions) |
| | The bee mascot and bee avatars (now a honey bee with cocoa bands) |
| | Bricolage Grotesque + Atkinson Hyperlegible |
| | C's race lanes with the winner card and rosette |

## The three variants (`?v=`)

- **a. Hive** (`?v=a`, the default): the old palette throughout, kept almost
  exactly, in both themes. The glow is gentle, close to the old 7% wallpaper.
  Place ribbons are gold, silver and bronze.
- **b. Honey and ribbon** (`?v=b`): honey carries everything a player acts on
  (buttons, focus, field, timer). Ribbon blue appears only on the award marks:
  the rosette's ribbon and centre ring, the first-place ribbon, the winner
  line, the "(you)" tag and the "Your word is" cue. The glow is a step richer.
- **c. Split** (`?v=c`): dark takes the full Blue Ribbon glow intensity in
  amber, on a deeper cocoa black. Light is the old live site as it was: flat
  cream, the honeycomb evenly across the page at low alpha, no bloom, no
  vignette, no moving light. Only the UI polish is new in light.

All three default to dark, as picked for Blue Ribbon. Other parameters are the
same as `blue-ribbon-glow`: `?bg=static|shimmer|reactive`, `?bee=0|1`,
`?theme=light|dark`, `?state=correct|incorrect` (round), `?peak=1`.

## Files

| File | What |
|---|---|
| `home.html`, `round.html`, `race-results.html`, `avatars.html` | The screens. The round has a working field: type `rhythm` and press Enter, or anything else. |
| `compare.html` | The side-by-side comparison. |
| `style.css` | The three variants' tokens (dark and light each), then the shared UI. Built from `blue-ribbon-glow/style.css`. |
| `honeycomb.css` / `honeycomb.js` / `art.js` / `params.js` | Copies of the Blue Ribbon glow files, recoloured through tokens (`--hex-mask`, `--mark*`); `params.js` adds `?v=`. |
| `screens/` | 102 captures (`design/harness/shoot-hybrid.mjs`): per variant, 3 screens × 2 widths × 2 themes, both answer moments, keyboard focus, and 12 reduced-motion stills. `screens/index.js` feeds the gallery. |
| `contrast-a.md`, `contrast-b.md`, `contrast-c.md` (+ `.json`) | The contrast table per variant (`TARGET=hybrid node design/harness/measure.mjs`). |
| `checks.txt` | Reduced-motion stills, lemon-yellow and grey-tile checks, decoration-only checks. |

## Verification (all run on the final files)

- **Contrast, measured over the glow:** 154 pairs per variant, **0 failing** in
  all three. Every visible text element, control edge (the answer field, the
  buttons and the other bordered controls) and focus ring is measured against
  the **worst pixel behind it** with every cell lit to the shimmer's peak, in
  both themes, at both widths, and in the playing, correct and missed states.
  Minimums:

  | Variant | Body text | Large text | Control edges | Focus rings |
  |---|---|---|---|---|
  | a | 5.17:1 | 5.32:1 | 3.78:1 | 6.81:1 |
  | b | 5.30:1 | 5.29:1 | 3.53:1 | 6.81:1 |
  | c | 5.42:1 | 5.52:1 | 3.70:1 | 7.05:1 |

  The first run failed one pair: variant b's secondary-button edge hit 2.94:1
  against a lit cell on phone in dark. The dark `--edge` went from `#8f7f63` to
  `#9d8d70` in all variants, and the re-run passed.
- **Reduced motion:** 36 of 36 stills (3 variants × 3 screens × 2 widths × 2
  themes) are pixel-identical to the static background (largest channel
  difference 0 of 255).
- **Distinct from NYT's look:** 0 lemon-yellow pixels across 71.1M pixels (all
  102 captures, lossless). The detector flags NYT's `#f7da21` (hue 53) and is
  asserted to pass the old honey `#e8a63d` (hue 37). 0 flat grey filled
  elements. The honeycomb is `aria-hidden`, takes no pointer events, holds no
  text or controls, and no content element is hexagon-shaped, on every page in
  every variant and theme.
- **Page errors:** 0. The comparison page has no horizontal overflow at 1440
  or 390px and no broken images.
- **Not re-measured:** phone performance. The background code is the Blue
  Ribbon glow's, unchanged except for colours and a mask token, so
  `blue-ribbon-glow/perf.txt` still describes it. A real-phone check is still
  open (stage 7).

## Honest costs

- Honey plus hexagons is closer to NYT's imagery than blue plus hexagons. See
  `design/DIRECTIONS.md`, "Honey hybrid: how it stays distinct".
- The old `check-glow.mjs` "no yellow" check (hue 32-70) fails any honey
  variant by design, because it was written for the all-blue rule. The hybrid
  uses the narrower lemon test instead. If a hybrid is picked, PHASE3's stage
  checks must switch to it.
