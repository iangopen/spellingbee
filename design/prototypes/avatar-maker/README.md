# Avatar maker prototype (pick pending)

**Open this first:** `compare.html` (straight from disk). It has every screenshot, the two
cosmetic sets side by side, the contrast result and the legacy mapping. `index.html` is the
maker itself; `contrast.html` re-runs the contrast measurement live.

**Brief (Ian, 2026-10-13):** a skribbl-style avatar maker: a bee preview in the middle, arrow
pickers for colour and cosmetic with a label and an "n of 8" counter, a randomise button and a
name field. 8 bee colours and 8 cosmetics. Take only skribbl.io's interaction pattern; draw
original bees in the light homemade style, reusing `src/lib/beeArt.ts` so the art drops into the
app; the default mascot stays exactly as it is. Two cosmetic sets to pick from, one playful and
one spelling-themed. Prototype only: nothing in `src/` or the database changes. Spec:
`docs/multiplayer-modes-spec.md` §2 and D17 on branch `plan/multiplayer-modes`.

**What Ian picks:** the cosmetic set (Playful or Spelling-themed). The colours, the halo and the
mapping mechanism don't depend on it; the mapping table below has a column for each.

## Files

| File | What |
|---|---|
| `compare.html` | The comparison page: screenshots, the choice, contrast, legacy mapping |
| `index.html`, `maker.css`, `maker.js` | The maker, the token mock-ups (lobby, waiting room, scoreboard), the colour and cosmetic grids. URL parameters: `?theme=light`, `?set=spelling`, `?color=0-7`, `?cosmetic=0-7`, `?motion=reduce`, `?name=` |
| `bee-art.js` | The drawing: `beeArt.ts` copied verbatim plus a body-colour parameter, the 8 colours, both cosmetic sets, `describe()` |
| `contrast.html`, `contrast.js` | The silhouette contrast measurement, in the browser |
| `contrast.md` / `.json` | The result after the fix (0 failures). `contrast-before.md` / `.json`: the first run (128 failures) |
| `colorlab.mjs`, `pick-colors.mjs` | Colour maths (WCAG, CIEDE2000, colour-vision simulation) and the search that chose the 7 new colours |
| `check-mascot.mjs` | Proves colour 0 + none is the app's `mascotSvg()` byte for byte (imports the real `beeArt.ts`) |
| `check-maker.mjs` | Keyboard, touch, names, targets, focus ring, live region, reduced motion (35 checks) |
| `measure-contrast.mjs`, `shoot.mjs` | Drive the contrast page and take the screenshots headless |
| `screenshots/` | 20 PNGs: maker, tokens, colours, playful cosmetics, spelling cosmetics × dark/light × desktop/phone |

Reproduce (Playwright installed outside the repo, as for `design/harness`):

```
node --experimental-strip-types design/prototypes/avatar-maker/check-mascot.mjs
node design/prototypes/avatar-maker/pick-colors.mjs
PW_MODULE=<playwright/index.mjs> node design/prototypes/avatar-maker/check-maker.mjs
PW_MODULE=<playwright/index.mjs> node design/prototypes/avatar-maker/measure-contrast.mjs
PW_MODULE=<playwright/index.mjs> node design/prototypes/avatar-maker/shoot.mjs
```

## The bee: the mascot, varied

`bee-art.js` is `beeArt.ts`'s `blobPath`, `shape`, `beeInner`, seeded generator, `ART_WOBBLE`
0.8 and viewBox, copied verbatim, with two additions:

1. `beeInner({ body })`: the fill of the body and head. It defaults to `"var(--bee-body)"`, so
   colour 0 is the mascot's own token. Colours 1–7 are `var(--av-1)` … `var(--av-7)`.
2. `beeInner({ antennae: false })`, used only by an earlier contrast run; no avatar is drawn
   without antennae.

Every maker bee is seeded like the mascot (`hash("bee")`), so all 64 share its wobbly outline.
Each cosmetic has its own fixed seed, so it wobbles identically on every colour and screen.
`check-mascot.mjs` passes: colour 0 + none === the app's `mascotSvg()` (4,328 characters), all
64 per set are distinct, drawing order doesn't matter, and the Crown and Flower are the app's
`queen` and `blossom` accessories byte for byte.

**Dropping it into the app** (stage 10 of the reordered plan):
- Add `body` to `beeInner`.
- Add the cosmetic strings and `COLORS` to `beeArt.ts`.
- `avatarSvg(color, cosmetic)` memoised per pair; `mascotSvg()` unchanged.
- Add the eight tokens (`--av-1` … `--av-7`, `--av-halo`) to both palette blocks in
  `src/index.css`.
- Add the `#av-halo` filter next to `WobbleFilters`, and `filter: url(#av-halo)` on `AvatarArt`
  only (never `BeeMascot` or `Rosette`).
- Update the `ui.test.tsx` digest, and rerun `build-brand-assets.mjs`: the favicon draws the
  mascot, which doesn't change, so its output must be identical.

## Colours

One colour per hue family, so every bee has a plain name a player can say, chosen by
`pick-colors.mjs` under three constraints:
- 3:1 against the dark panel, so the body draws the shape where the outline can't.
- 3:1 against `--bee-line` in both themes (the spec's rule), so stripes and edge read.
- Luminance at most 0.72, so the white eyes and wings still show.

Within those, the search maximised the smallest CIEDE2000 distance between any two colours under
normal vision AND simulated protanopia, deuteranopia and tritanopia (Machado 2009, severity 1).
Pure distance alone chose two near-identical greys, which is why the hue families exist.

| Colour | Hex | vs dark panel | vs outline (dark / light) | Closest colour, worst vision (ΔE2000) |
|---|---|---:|---:|---|
| Honey (the mascot, `--bee-body`) | `#f0b24c / #eaa640` | 9.00 | 9.71 / 7.30 | 15.3 (Green) |
| Red | `#c85b32` | 4.03 | 4.34 / 3.64 | 13.8 (Rose) |
| Rose | `#a8669a` | 4.05 | 4.37 / 3.66 | 11.7 (Blue) |
| Purple | `#796ce0` | 4.05 | 4.37 / 3.67 | 11.9 (Blue) |
| Blue | `#5aa0d0` | 5.94 | 6.40 / 5.37 | 11.7 (Rose) |
| Aqua | `#64d1d7` | 9.38 | 10.11 / 8.48 | 11.8 (Blue) |
| Green | `#83aa84` | 6.48 | 6.99 / 5.86 | 11.7 (Blue) |
| Grey | `#867e7f` | 4.27 | 4.61 / 3.86 | 12.0 (Rose) |

**What this does and doesn't promise:**
- A ΔE2000 of 11.7 is clearly different side by side.
- It is not always nameable alone: a deuteranope may not be able to say whether a lone token
  is Rose or Blue.
- That's why the cosmetic is the second cue and the **name is the identity**:
  - every token sits next to a name;
  - colour is never the only difference the game relies on;
  - two players may pick the same bee, and that is fine.

The blue is sky blue, kept apart from the ribbon blue (`--mark-2`) that the palette reserves for
award marks. The colour values are the same in both palettes; only Honey differs, because it is
`--bee-body`.

## Cosmetics

Both sets use only existing art tokens: `--mark`, `--bee-eye`, `--bee-cheek`, `--bee-leaf`,
`--bee-stripe` and `--bee-line`. Round parts are `blobPath` blobs, so they wobble like the bee.
Index 0 is "None" in both, the draft spec's "No hat" convention, so each set is the plain bee plus
7 things to wear.

| # | Playful | Spelling-themed |
|---|---|---|
| 0 | None | None |
| 1 | Crown (the legacy queen crown) | Graduation cap |
| 2 | Party hat | Pencil (held) |
| 3 | Flower (the legacy blossom) | Reading glasses |
| 4 | Sunglasses | Quill |
| 5 | Headphones | Book (held) |
| 6 | Bow tie | Letter block "A" (held) |
| 7 | Honey pot (held) | Headphones |

The spoken description is `${Colour} bee ${phrase}`, with the phrase taken from a
per-cosmetic table:
- "Blue bee wearing a crown"
- "Grey bee holding a pencil"
- "Honey bee" (no cosmetic)

## Accessibility (all checked by `check-maker.mjs`, 35 checks, 0 failures)

- **Real buttons, real names.** The arrows are `<button>`s named "Previous bee colour, 3 of 8",
  "Next cosmetic, 3 of 8"; the name updates with each step.
- **Each row** is a `role="group"` labelled "Colour" or "Cosmetic".
- **Tab order:** colour previous, colour next, cosmetic previous, cosmetic next, Surprise me,
  name.
- **Keys:**
  - Enter and Space step;
  - ← and → step while focus stays on the button;
  - Home and End jump to the first and last item;
  - both ends wrap (8 → 1, 1 → 8);
  - there is no ↑/↓ binding, so a row never traps page scrolling.
- **Spoken result:**
  - the preview is `role="img"`, named by the visible description;
  - the description is an `aria-live="polite"` region that changes exactly once per step;
  - waiting-room rows read "Zoë, rose bee wearing a party hat";
  - in-game tokens give the name only (spec §2.5).
- **Focus ring:** the app's one rule (3 px ring in a 7 px moat), verified computed on an arrow.
- **Targets:**
  - arrows are 48 × 48, Surprise me 181 × 54, the name field 197 × 48;
  - each was probed with `elementFromPoint` at the centre and at 8 points on a 44 px circle
    (Chrome's hit test follows `border-radius`, so rounded corners aren't counted);
  - the same holds at phone width, where there is no horizontal scroll.
- **Touch:** taps step both rows on a 390 px phone context.
- **Reduced motion:** a step does a 150 ms hop whose resting state is the drawn avatar.
  - Under the OS setting the hop doesn't run.
  - Under the in-app override (`?motion=reduce`) it collapses to 0.001 ms, the app's two-block
    pattern.
- Nothing leaves `file://`.

## Contrast: 64 combinations × 2 sets × 2 themes

**Method (`contrast.js`):**
- Each avatar is rasterised at 3 px per viewBox unit with the theme's real token values.
- The silhouette is every pixel at 50% opacity or more, antennae included.
- For each point on its edge, take the best contrast against the background of any silhouette
  pixel within 4 units inward (the outline or the fill just inside it). The avatar's figure is
  its **worst** edge point. Needed: 3:1 (WCAG 1.4.11).
- Backgrounds, per theme:
  - the token disc / tile / lane token (`--panel-solid`);
  - the panel over the page;
  - the panel over the honeycomb's brightest line at its peak.

**First run (`contrast-before.md`): 128 failures, every dark-theme avatar, the mascot's colour
included,** at 1.06–1.08:1. Light theme: 0 failures (14.32:1, the cocoa outline).
- **Where it fails:** the cocoa stripes run into the cocoa outline, and on a dark panel that
  stretch of edge is cocoa on cocoa. That is 8–16% of every edge, and 30–32% with the graduation
  cap's dark board.
- The run left the antennae out, which only made it more lenient.
- **No colour change can fix it.** A disc would need luminance ≥ 0.12 to clear the outline and
  ≤ 0.03 to clear the darkest body. Lightening the stripes or outline would change the mascot.

**Fix: a 1 px sticker edge on dark-theme tokens.**
- `--av-halo` is #9d8d70 in the dark palette and `transparent` in the light one.
- The `#av-halo` filter is a `feMorphology` dilate of the drawing's alpha, flooded with
  `--av-halo`, under the drawing. It is applied by CSS to avatar tokens only.
- The SVG strings don't change, so the mascot on the home screen stays as it is.
- `contrast.js` models the filter exactly (a rectangular dilate) at the 30 px and the 140 px box
  and keeps the worse.
- A 1.5 px edge also passed, but it merged with the cream wings into a blob at 30 px, so 1 px
  was kept.

**After (`contrast.md`): 0 failures in 256.** Every dark avatar's worst edge point is 4.27:1
(the halo against the honeycomb's peak; 5.22:1 on the disc). Every light avatar is 14.32:1.
The tables are uniform by construction: the halo, or in light the outline, is the edge
everywhere. That is the point of the fix.

## Legacy mapping (spec §2.4): existing rows, old client still deployed

The mechanism is the spec's, unchanged:
- **Migration A** adds `avatar_color` and `avatar_cosmetic` (smallint, default 0).
- It backfills them from `avatar` with the forward table below.
- It adds a `BEFORE INSERT OR UPDATE` sync trigger:
  - an old client changes only `avatar`, so the parts are derived (forward table);
  - a new client changes only the parts, so `avatar` is derived (reverse rules);
  - both changed: the parts win.
- The old client's INSERT names only legacy columns, so it keeps working.
- The new client reads the parts.
- `localStorage`: `spellingbee:avatar:color` / `:cosmetic`, derived once from
  `spellingbee:avatar` with the same table; the legacy key stays.
- **The indexes are append-only from the day the set is picked:** a stored number must always
  mean the same bee.

**Forward (old key → colour, cosmetic):**

| Old key (its art) | Playful | Spelling-themed |
|---|---|---|
| `bee` (plain) | Honey, None (= the mascot) | Honey, None |
| `queen` (crown) | Honey, Crown | Honey, Graduation cap |
| `drone` (big eyes) | Blue, Headphones | Blue, Headphones |
| `hive` (holds a skep) | Grey, Honey pot | Red, None |
| `honey` (holds a drop) | Honey, Honey pot | Honey, None (**lossy**: same as `bee`) |
| `blossom` (flower) | Rose, Flower | Rose, None |
| `clover` (green sprig) | Green, Flower | Green, None |
| `wasp` (slim) | Grey, None | Grey, None |

**Reverse (parts → old key, first rule that matches), so old clients still draw something
sensible:**
- **Playful:**
  - by cosmetic: Crown → `queen`; Headphones → `drone`; Honey pot → `hive` if Grey, else
    `honey`; Flower → `clover` if Green, else `blossom`;
  - otherwise by colour: Grey → `wasp`; Rose → `blossom`; Green → `clover`; else `bee`.
- **Spelling-themed:**
  - by cosmetic: Graduation cap → `queen`; Headphones → `drone`;
  - otherwise by colour: Red → `hive`; Rose → `blossom`; Green → `clover`; Grey → `wasp`;
    else `bee`.

Round trip, old → parts → old: Playful returns every key to itself. Spelling returns all but
`honey`, which comes back as `bee`. An old client's own row keeps its key anyway, because the
trigger derives `avatar` only when the parts change. Old clients see a new player's bee as the
nearest of their 8. That is acceptable for the 30-day retention window, after which stage 16
drops the trigger.

**Why Playful maps better:** it keeps two legacy accessories byte for byte (Crown, Flower), and
every old key lands on its own distinct bee.

## Choices made without asking (conservative)

- "8 cosmetics" counts "None" as one, as the draft spec counted "No hat".
- The colour names (Honey, Red, Rose, Purple, Blue, Aqua, Green, Grey) are plain words that are
  easy to say; Ian can rename them freely, since names are spoken, not stored.
- The randomise button is labelled "Surprise me" (the spec's D18 name).
- The halo is on every avatar token in the dark theme, including colour 0; the home-screen
  mascot and the rosette never get it.
- The prototype copies the tokens into `maker.css` instead of linking `src/index.css`, so it
  opens from disk with no build. The values are main's at `447214b`.
