# Homemade: warm and handmade, at two strengths (pick pending)

**Open this first:** `compare.html` (straight from disk). Off, light and more
side by side on any of four screens, in either theme, at desktop and phone
width, as live frames.

**Brief (Ian, 2026-10-02):** honey hybrid **b** is picked. Two tweaks before the
build: bring back the old live design's difficulty selection, and make the whole
look a little more homemade, warm and handmade rather than strictly professional.
Prototype only: nothing is in `src/`.

## What this folder is

The honey and ribbon hybrid (`../honey-hybrid/`, variant b, copied and locked to
b) plus:

1. **The old difficulty screen**, `difficulty.html`. Always on, at every strength.
2. **A homemade layer**, `homemade.css` + `homemade.js` + the rough drawing in
   `art.js`, chosen by `?h=off|light|more` (default `light`):
   - **off:** the hybrid exactly as picked.
   - **light:** wobbly panel, button and field corners; one thin hand-drawn
     outline round each panel (an SVG displacement filter on a pseudo-element);
     hand-lettered title, headings and badges with a drawn underline; one
     tilted sticker on the home and results cards; paper grain on the page
     behind the panels only; hard "marker" shadows on buttons and the Settings
     button instead of gloss; no backdrop blur; a calmer honeycomb glow; the bee
     and rosette redrawn with a slightly wobbly line.
   - **more:** all of light, plus a double outline, faint grain inside panels,
     washi tape on three cards, small tilts on panels, tier bars and avatar
     tokens, an irregular hexagon on each tier bar, wobbly icon strokes, and a
     sketched bee and avatars (wobbly double outline, colour fill nudged off the
     line).
   - **Kept at every strength:** the correct-answer light-up, the bell and
     shake, the rise-and-fade screen entry and view transitions, the shimmer
     (calmer), the visible focus moat and ring, 44px targets, the single global
     reduced-motion block. Nothing new animates.

URL parameters: `?h=off|light|more`, `?theme=light|dark`, `?bg=static|shimmer`,
`?bee=0|1`, `?state=correct|incorrect` (round), `?peak=1` (contrast testing: every
cell lit to its peak, rotations off).

## The difficulty screen

Rebuilt from main `src/App.css:44-275` and `DifficultySelect.tsx`:

| Kept from the old design | Restyled with the hybrid |
|---|---|
| Elongated hexagon bars (flat top and bottom, 18px points), one stacked column, 420px wide | Tints are `color-mix` of the hybrid's tier tokens over its panel colour; focus uses the hybrid's ring colour and honey glow |
| The ramp: sage, olive, amber, burnt orange; Expert is solid honey, Master ember | Master's dark fill is a little deeper so its cream label clears 4.5:1 |
| Title, tagline, Practice mode and Hide definition chips, hint line, "Best n" on the right | Body text is Atkinson, labels Bricolage; the header sits on one lit panel |
| The rim that thickens on focus (a clip-path hides outlines) | Focus is three bands: a 3px moat just outside, the 5px focus-colour rim, a 3px moat inside; plus the honey glow |
| The clip-path IS the tap target | Unchanged |

**One layout change:** the header text sits on a panel instead of the bare
background, because text may not sit on the bare honeycomb at its peak (the rule
every other screen follows). The bars themselves are solid fills, so they float.

It is a stack of tier **buttons**, never a letter board: eight bars, one per
row, same left edge and width. `shoot-homemade.mjs` asserts that on every view,
and narrows the old "no hexagon-shaped content" check to allow exactly these
bars.

## Fonts

| Face | Where |
|---|---|
| **Caveat Brush** (OFL), hand-lettered | Decorative text only: the title (and the brand wordmark), "Your best scores", "Your word is...", the race winner kicker, the stickers |
| Bricolage Grotesque | Definitions, numbers, names, tier names, headings that carry data |
| Atkinson Hyperlegible | The answer field, instructions, hints, buttons, labels, body |

Handwriting fonts blur l, I and 1, so the spelling words, the answer field,
instructions, buttons and every number never use the hand face.
`fonts/caveat-brush-letters.woff2` is subset to A-Z, a-z, space, comma, full stop and
the ellipsis (**15.3 KB**, no digits on purpose). With the redesign fonts
(111.6 KB) the total is 126.9 KB, inside the 150 KB budget. Licence:
`fonts/OFL-CaveatBrush.txt`. Source: Google Fonts (Caveat Brush v12).

## Verification (all run on the final files)

Reproduce: `PW_MODULE=<playwright/index.mjs> TARGET=homemade node design/harness/measure.mjs`
and `PW_MODULE=... node design/harness/shoot-homemade.mjs`.

- **Contrast, over the glow AND the texture:** `contrast-off.md`,
  `contrast-light.md`, `contrast-more.md`. Every visible text element (hand
  lettering included), control edge (answer field, buttons, mode chips) and
  focus ring against the worst pixel behind it, honeycomb lit to its peak, grain
  on, both themes, both widths, four screens, and the playing, correct and missed
  states. **0 failing at every strength** (224 / 228 / 228 pairs). Minimums:

  | Strength | Body text | Large text | Control edges | Focus rings |
  |---|---|---|---|---|
  | off | 4.52:1 | 5.29:1 | 3.53:1 | 6.81:1 |
  | light | 4.52:1 | 5.29:1 | 3.24:1 | 3.09:1 |
  | more | 4.52:1 | 5.05:1 | 3.14:1 | 7.06:1 |

- **Tier bar focus:** the rim is measured against the pixels just inside and just
  outside it (section "Tier bar focus indicator" of `checks.txt`): 12/12
  configurations pass, lowest 7.35:1. `checks.txt` ends with one summary line
  covering these and the contrast tables (0 failures). At "more" the focused bar
  drops its tilt. An earlier version of the check reported 8/12 (1.10:1 at
  "more"); that came from locating the rim by colour, which also matched the
  neighbouring Expert/Master bars, so the checker now samples fixed band centres
  and asserts the sample is the focus colour.
- **Reduced motion:** 48 of 48 stills (3 strengths x 4 screens x 2 widths x 2
  themes) are pixel-identical to the static background.
- **Fonts:** `checks.txt` lists every hand-lettered string (title, headings,
  badges only), confirms none contains a digit and none is an input, button,
  label or instruction, and confirms Atkinson / Bricolage on the answer field,
  definition, feedback, instructions, labels, buttons, tier names, standings and
  numbers.
- **Distinct from NYT's look:** 0 lemon-yellow pixels in every capture at every
  strength, 0 grey tiles, honeycomb `aria-hidden` / no pointer events / no text,
  and the only hexagon-shaped content is the eight-bar stack.
- **Side-by-sides:** `screens/side-by-side--difficulty--*.jpg`: the old live
  difficulty screen, then off, light and more, both widths and themes.
- Page errors: 0.

## Honest costs and choices

- **Texture is measured by its worst pixel, not its average.** The first grain
  (peak alpha about 0.4) failed 30 pairs. The version here peaks near 0.06 on the
  page and 0.04 in panels; it is subtle on purpose. If Ian wants it bolder, the
  tables must be re-run.
- **Rotations are switched off while measuring** (`?peak=1`): the bounding box
  of rotated text includes pixels that are not under any letter. Every tilt is 5
  degrees or less.
- **A shadow can silently remove focus.** The marker shadows first replaced the
  focus moat on buttons (found by measuring, 5 ring failures). The global focus
  rule now outranks the strength rules; keep it last.
- **SVG displacement filters cost a repaint** on large panels. They are static, so
  it happens once, but a real-phone check belongs in stage 7 with the shimmer.
- **The lemon detector's lightness cap went from 0.85 to 0.75.** Pale cream-olive
  anti-aliasing pixels (about 235,226,192) in the light Building bar tripped it;
  NYT's yellow (lightness about 0.54) is still flagged, asserted at the top of
  `shoot-homemade.mjs`.
- **The hand face is a Google Fonts family**, self-hosted here, with its licence.
- **Handmade is not sloppy:** panels still align to the same grid, targets are
  44px or more, and the wobble is a long slow wave (low frequency), not noise.
