# Blue Ribbon, glowing: the chosen direction's prototypes

**Open this first:** `compare.html` (straight from disk). It has live frames
of every variant, theme and bee switches, the avatar sheets, and all
screenshots.

**Direction (Ian, 2026-09-28):**
- the Blue Ribbon base (palette, Bricolage Grotesque + Atkinson Hyperlegible,
  rosette, placards, bell)
- a decorative blue honeycomb background
- C's race lanes for race results

Still pending, both on this page:
- the background variant (static, shimmer or reactive)
- bee or no bee

## Files

| File | What |
|---|---|
| `home.html`, `round.html`, `race-results.html` | The three screens. Parameters: `?bg=static\|shimmer\|reactive`, `?bee=0\|1`, `?theme=light\|dark`, `?state=correct\|incorrect` (round). The round screen has a working field: type `rhythm` and press Enter, or anything else. |
| `avatars.html` | The eight avatars (`?bee=0\|1`). |
| `compare.html` | The side-by-side comparison. |
| `honeycomb.css` / `honeycomb.js` | The background: one generated SVG tile as a CSS background, gradients, and transform/opacity-only motion. No canvas, no libraries. |
| `style.css` | Tokens (dark and light), lit glass panels, focus, buttons, the answer moments, race lanes. |
| `art.js` | Original sketches: the rosette (tick or bee centre), the bee mascot, and the bee contestants for the existing eight avatar keys. |
| `params.js` | Turns URL parameters into `<html>` attributes before first paint. |
| `screens/` | 52 screenshots (`design/harness/shoot-glow.mjs`); `screens/index.js` feeds the gallery. |
| `contrast.md` / `contrast.json` | The contrast table (`design/harness/measure.mjs`). |
| `perf.txt` | Phone performance (`design/harness/perf-glow.mjs`). |
| `checks.txt` | The no-yellow and decoration-only checks (`design/harness/check-glow.mjs`). |

## The honeycomb

- **Decoration only:**
  - it's a fixed layer behind everything, marked `aria-hidden`
  - it takes no pointer events and holds no text or controls
  - no content element is hexagon-shaped
  - answers are typed into a normal text field

  Checked on every page (`checks.txt`).
- **Never yellow:**
  - 0 yellow, gold, amber or honey colour literals in the source
  - 0 such pixels across 35.2M screenshot pixels

  The detector's hue range (32–70°) is deliberately wide. It flags NYT's
  `#f7da21` and today's honey `#e8a63d`, and even an earlier, narrower version
  found 1,580 yellow pixels in two screenshots of today's app, so it isn't
  blind.
- **Layers:**
  - a navy-to-ribbon-blue gradient
  - glowing cell edges (a crisp line plus a blurred copy, rasterised once)
  - a depth vignette, with the cells fading toward the edges
  - a calm top band, so header controls never sit on the brightest cells
- **Three variants:**
  - **Static glow:** no motion.
  - **Slow shimmer:** a soft band of brighter cells crosses every 18s and then
    rests. It ramps in over about 1.5s and peaks at a fixed low opacity, so it
    never flashes or strobes.
  - **Reactive glow:** a soft light eases toward the mouse (one rAF write per
    frame, and the loop stops when it settles). On touch there's no tracking:
    the light rests behind the focused control and glides when focus moves.
- **Motion:**
  - Only `transform` and `opacity` animate. The window/counter-window trick
    moves the light without repainting the blurred glow.
  - A hidden tab pauses every background animation (`data-paused`).
  - `prefers-reduced-motion` removes the moving light entirely. The still
    version is exactly the static glow: 8 of 8 reduced-motion captures are
    pixel-identical to static (largest channel difference 2 of 255).
  - Every UI animation is gated on `prefers-reduced-motion: no-preference`,
    and every state stays visible without it.

## The UI on top

- **Lit glass panels:** an inner highlight, a 1px edge and a soft shadow.
  - A backdrop blur is applied only on a desktop with a fine pointer. Over a
    moving background, blur re-renders every frame, so phones get a slightly
    more opaque panel instead.
  - `prefers-reduced-transparency` gives solid panels.
- **Glow on the primary button and on focus.**
- **Focus is a 3px solid ring inside a 7px moat** of solid background colour,
  with the halo beyond it. The ring never touches glow, which is why every ring
  passes in its real focused state.
- **Answer moments:**
  - **Correct:** the field lights up green (one light-up pulse), a tick
    appears, the placard glows and "+14" floats up.
  - **Missed:** the bell icon rings, the field gives one 0.42s shake, the edge
    turns red and the word is shown.

  Both are also announced through the `role="status"` region, as in the app.
- **Screen transitions:** panels rise and fade in (60ms stagger), with
  cross-document view transitions where the browser supports them.
- **Race results:**
  - A's winner card and rosette, over C's lanes: each player's token sits on a
    dashed track at their score, up to a ribbon-striped finish.
  - The lane numbers carry ribbon colours: blue, red, then white.
  - Tokens fly in once.

## Bee or no bee

- **No bee:** the rosette has a tick at its centre. Avatars are placards with
  the eight glyphs.
- **Bee:** an original blue bee mascot sits on the hero panel (a gentle 5s
  hover, off under reduced motion) and inside the rosette. Every contestant is a
  bee:
  - queen: crown
  - drone: big eyes
  - hive: a skep behind it
  - honey: a blue drop
  - blossom: a flower
  - clover: a clover leaf
  - wasp: slim, with swept wings
- **The keys are unchanged,** because the room_players.avatar CHECK validates
  them; only the art differs.
- The bee is periwinkle with navy bands. It's never yellow.

## Light and dark

**The glow is a dark-theme effect.** In dark, the cell edges read as light, and
that's what makes the look premium. In light, the same honeycomb becomes fine
blue linework on pale paper: clean and on-brand, and every pair passes, but it
reads as a pattern, not a glow.

Recommendation: keep both, and treat dark as the showcase. Both themes still
follow the OS as they do today, and the stored `spellingbee:theme` choice is
unchanged.

## Verification (all re-run on the final files)

- **Contrast** (`contrast.md`): 152 pairs, 0 failing. Every visible text
  element, control edge and focus ring is measured against the **worst pixel
  behind it** with the honeycomb lit to its peak everywhere. That covers both
  themes, both widths, bee and no bee, and the playing, correct and missed
  states (984 measurements).
  - Minimums: body text 5.62:1, large text 5.76:1, control edges 4.1:1, focus
    rings 4.86:1 (measured focused).
  - For light text, "worst" is the brightest glow; for dark text it's the
    darkest line.
- **Reduced motion:** 8 of 8 stills match static (the `still-*` screenshots).
- **Phone** (`perf.txt`), 390×844 with the CPU slowed 4× and all three
  variants live:
  - median frame 16.7ms, 95th percentile 16.8ms, 0 frames over 25ms
  - only `opacity` and `transform` animate
  - a hidden tab pauses the shimmer's 3 background animations; the other
    variants have none running

  This is headless Chrome on a desktop CPU with throttling, **not a real
  phone.** Check on a real mid-range Android before choosing shimmer or
  reactive.
- **No yellow, no letter layout:** see `checks.txt`.

## What the measurements caught (and what changed)

The first measurement run failed 6 pairs. The fixes:
- a calm top band under the header
- the mascot moved off the heading
- the focus moat and the gap ring under the field glows
- the correct glow's reach tightened
- control edges strengthened for margin

It also exposed two bugs in the measuring script:
- the focus-ring colour was parsed from a hex string wrongly
- the corners were measured as square

Both were fixed before the final run.
