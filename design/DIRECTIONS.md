# Spelling Bee: brand basics and three visual directions

Status: **direction chosen (Ian, 2026-09-28):**
- **Blue Ribbon (A)**, as the base
- a **glowing, decoration-only blue honeycomb** behind the whole app
- **C's race lanes** for race results

**Final picks (Ian, 2026-09-28):**
- the **slow shimmer** background
- at the **old live site's cell size** (28×49px tile)
- **with the bee**
- **dark as the default theme**

See `prototypes/blue-ribbon-glow/` and `PHASE3.md` (design system and build
plan). Nothing here touches `src/`, and
the live game is unchanged.

The three directions below are kept as the record of what was considered.

## Brand basics

**Positioning (one line):** Spelling Bee is the spelling contest you can play
anywhere. You hear a word and its definition, and you spell it before time runs
out, alone or against friends.

That line is deliberately about the *contest*, the generic meaning of "spelling
bee" (the school competition), because that is exactly what this game is:
dictation under a clock. It is not a letter-puzzle about making words from a
set.

**Voice (for UI copy):**

| Principle | Do | Don't |
|---|---|---|
| Plain and warm, like a good pronouncer | "Your word is…", "Spell it", "Hear it again" | "Oops!", "Awesome!!", exclamation marks on routine outcomes |
| Say what happened, then what's next | "Missed. The word was *rhythm*." | "Incorrect answer submitted." |
| Short under the clock, fuller outside it | Round screen: 1 to 4 words per label. Home and results: a sentence. | Long hints mid-round |
| Numbers as numerals, units spelled out | "9 seconds", "3 in a row", "8 of 10 spelled" | "9s left", "STREAK: 3" |
| Sentence case everywhere | "Play with friends" | "PLAY WITH FRIENDS" (except C's poster wordmark) |
| No em-dashes; curly quotes; the `…` character | “A strong, regular…” | `"quotes"` / `--` / `...` |

**What stays:**
- **The bee is yours**: the mascot, the "bee" avatar key and the contest.
  Rethink the execution, not the idea.
- **The mechanics and screens:** 8 tiers with the same ids and names, the 10-word
  games, Race and Elimination (the mode is still called "Race"), and the 8
  avatar *keys* (the DB CHECK validates them; only the art changes).
- **All the accessibility work** (see `audit/AUDIT.md` → baseline), and the
  light and dark themes that follow the OS.

**What goes:**
- the *yellow* honeycomb wallpaper. It's replaced by a blue, glowing,
  decoration-only honeycomb (Ian, 2026-09-28).
- hexagon-clipped tier buttons
- the hexagon favicon
- honey yellow as the lead colour
- the lucide-as-avatar set (a beetle for "bee", a feather for "drone")

## Trademark distance: the rules every direction follows

- No honeycomb letter board, no seven-hexagon layout, and no hexagon buttons
  or hexagon logo. **Answers stay typed into a text field**, as they are today.
- **Amended 2026-09-28 (Ian's decision):** a honeycomb is allowed as
  **background decoration only**. It must be:
  - blue and never yellow
  - behind everything, `aria-hidden`, with no pointer events
  - free of any text, letters or controls

  It is never a letter board or an answer layout. The reasoning: a blue,
  decorative honeycomb reads as this game's own, while NYT's yellow hexagon
  letter board is theirs. `prototypes/blue-ribbon-glow/checks.txt` verifies
  every one of these points.

  Honest cost: hexagons are closer to NYT's imagery than Direction A alone
  was.
- No NYT Games look:
  - no yellow-and-grey palette (yellow isn't the accent of any direction)
  - no serif newspaper-style wordmark (every direction uses a sans display
    face)
  - no black-rule masthead
- The name is always shown as a descriptive title alongside a **distinct mark**
  (rosette, clover or striped bee). It is never styled to echo another
  product's wordmark.
- Bees, hives, flowers and honey remain fine as *themes*. In the chosen
  direction **nothing is yellow**, and that includes the honey-drop and the bee
  illustrations, which are blue.

This lowers the risk of the look being mistaken for NYT's, but **it does not
clear the name itself**: NYT holds "Spelling Bee" as a mark for its game (§C10
and HARDENING #14 have the notes). The visual work can't answer that question.

### Honey hybrid: how it stays distinct (added 2026-09-29, pick pending)

Ian asked for hybrids that bring back the old live design's honey palette
with the Blue Ribbon polish (`prototypes/honey-hybrid/`, variants a, b and c).
Those variants deliberately break the "blue, never yellow" rule above, so this
is what replaces it **if a hybrid is picked**. If Blue Ribbon stays, the rule
above stands unchanged.

- **Honey and amber, never lemon.** NYT's Spelling Bee yellow is a bright
  lemon (`#f7da21`, hue 53°). Every warm colour in the hybrids sits at hue
  30-42°: honey `#e8a63d`, the heading `#f2bd62`, the light-theme fill
  `#e09a2c`, and deep amber `#8f5a0e` for text in light. Checked on pixels: 0
  lemon-yellow pixels across all 102 captures, with a detector that is
  asserted to catch NYT's yellow and pass the old honey
  (`prototypes/honey-hybrid/checks.txt`).
- **No yellow on flat grey.** NYT pairs its yellow with flat light-grey hexagon
  tiles on white. The hybrids have no grey surface at all: the dark theme is a
  warm charcoal or cocoa, the light theme is cream, and panels are warm
  off-white. Checked: 0 neutral-grey filled elements on every page.
- **The honeycomb is background only, as before.** It is `aria-hidden`, takes
  no pointer events, holds no text, letters or controls, is never a letter
  board or answer layout, and no content element is hexagon-shaped. Answers
  are typed into a text field. It is outline-only line work, never filled
  tiles.
- **A distinct mark beside the name.** The rosette with a bee at its centre,
  and a sans display face (Bricolage Grotesque). No serif wordmark and no
  black-rule masthead.
- **Variant b keeps a trace of the ribbon:** blue appears on the award marks
  only, which ties the look to the "blue ribbon" contest meaning of the name.

Honest cost: honey plus hexagons is closer to NYT's imagery than blue plus
hexagons. The differences above (amber not lemon, no grey tiles,
background-only line work, the rosette) are real but smaller than Blue
Ribbon's. None of it clears the name itself.

---

## A. Blue Ribbon: the contest itself

**Mood:** a school spelling bee, the evening final. Calm, fair, a little
ceremonial: the pronouncer at the mic, a numbered contestant placard, a blue
rosette for the winner. Warm, dignified, readable.

**Palette:** light-first ("school hall"), dark = "evening final". One accent:
**ribbon blue** (1st place). Race places use real ribbon colours: blue, then
red, then white.

| Token | Light | Dark |
|---|---|---|
| bg / surface | `#f3f5fb` / `#fcfdff` | `#0f1322` / `#181e33` |
| text / muted | `#141a2e` / `#4f5873` | `#eef1f8` / `#a0a8c2` |
| accent / on-accent | `#2346d8` / `#fcfdff` | `#8aa2ff` / `#0b1024` |
| control edge | `#7a83a0` | `#6b7494` |
| correct / incorrect | `#17734b` / `#b8322b` | `#55d6a0` / `#ff8078` |

Measured contrast:

| Pair | Light | Dark |
|---|---|---|
| Body text | 15.8:1 | 16.3:1 |
| Muted text | 6.5:1 | 7.8:1 |
| Accent text | 6.6:1 | 7.7:1 |
| Button text | 7.0:1 | 7.8:1 |
| Correct | 5.8:1 | 9.1:1 |
| Incorrect | 5.9:1 | 6.8:1 |
| Input edge | 3.7:1 | 3.6:1 |
| Focus ring | 6.6:1 | 7.7:1 |
| Timer fill | 5.5:1 | 5.5:1 |

**Type:**
- **Bricolage Grotesque** (OFL) for display and numbers. It's a grotesque with
  a hand-cut, school-poster warmth.
- **Atkinson Hyperlegible** (OFL) for body text and the answer field. It was
  designed by the Braille Institute so that confusable letterforms stay
  distinct, which is ideal for a game about letters. (Its slashed zero shows in
  "of 10 words".)

**Logo and wordmark:** a blue rosette with a bee at its centre (the rosette is a
ring of circles, and two ribbon tails hang below). The wordmark is "Spelling
Bee" set in Bricolage ExtraBold, tight tracking. The favicon is the rosette
alone. It reads at 16px because it is one round silhouette.

**Icons and avatars:**
- **UI icons:** keep lucide (already in the bundle, ~2 kB). Use 2px strokes
  consistently.
- **Avatars are contestant placards:** a square card with a heavy ink edge and
  the avatar glyph inside. In a race the placard can carry the player's seat
  number.
- **Glyphs:** redrawn as a bee-yard family, one per existing key:
  - bee, queen (crown), drone (big eyes), hive (a skep dome, not a hexagon)
  - honey (drop), blossom, clover, wasp (narrow waist)

**Motion:** ceremonial and sparing.
- The rosette "pins on" at the winner reveal: a 0.7s overshoot.
- The placard flips to the next word number.
- The timer is a smooth transition, as today.

Everything is decoration over a visible state, and it collapses under the
existing reduced-motion block.

**Sound feel:** the contest's own sounds, synthesized in `sfx.ts` (still no
audio files):
- **submit:** a soft wooden tick
- **correct:** a two-note rising chime
- **incorrect:** a single muted *bell* (the judge's bell, which is how a real
  spelling bee signals a miss)
- **win:** a short three-note fanfare

**Trademark distance:** this is the strongest of the three. Blue and white with
ribbons and placards is the iconography of the *school contest*, which is the
generic meaning of the name. There is no yellow, no hexagon and no serif. The
rosette, not the name, is the thing people will recognise.

**Strengths:**
- The clearest story: it says "spelling bee" by showing the contest.
- The most legible type.
- It finally gives race results a real winner moment.

**Risks:** it's the least "gamey" of the three. Blue-on-white can drift toward
generic SaaS unless the rosette and placards are used confidently.

Screens:
- `screens/a-blue-ribbon__{home,round,race-results}--{desktop,phone}--{light,dark}.png`
- live files: `a-blue-ribbon/*.html`

---

## B. Clover Field: the naturalist's field guide

**Mood:** a meadow notebook. Calm, curious and a bit scientific: bees working
clover, specimen labels in mono, progress as growth. It's the quietest and the
most "made by a person".

**Palette:** light-first ("sage paper"), dark = "night meadow". One accent:
**clover magenta** (the flower bees actually work), with leaf green for growth.

| Token | Light | Dark |
|---|---|---|
| bg / surface | `#eff3ea` / `#fafcf6` | `#0f160f` / `#172117` |
| text / muted | `#1c281d` / `#515f4c` | `#e8efe2` / `#a2b39c` |
| accent / on-accent | `#a3275f` / `#fff7fb` | `#f27db3` / `#2a0b19` |
| leaf (timer, growth) | `#3c7a3f` | `#7fd79a` |
| correct / incorrect | `#26703f` / `#a8401a` | `#7fd79a` / `#ff9a72` |

Measured contrast:

| Pair | Light | Dark |
|---|---|---|
| Body text | 13.6:1 | 15.7:1 |
| Muted text | 6.0:1 | 8.3:1 |
| Accent text | 6.2:1 | 7.3:1 |
| Button text | 6.6:1 | 7.2:1 |
| Correct | 5.9:1 | 9.6:1 |
| Incorrect | 6.0:1 | 8.0:1 |
| Input edge | 3.5:1 | 3.8:1 |
| Focus ring | 6.2:1 | 7.3:1 |
| Timer | 3.9:1 | 7.6:1 |

**Type:**
- **Hanken Grotesk** (OFL) for display and body. It's a humanist grotesk, soft
  but exact.
- **IBM Plex Mono** (OFL) for specimen-style labels ("Word 4 of 10", "time
  left") and the answer line.

**Logo and wordmark:** a clover head (a dome of small circles on a stem with a
leaf), with a bee looping in on a dotted flight path. The wordmark is "Spelling
Bee" in Hanken ExtraBold. The favicon is the clover head alone.

**Signature element: the tiers grow.** The 8 tiers are 8 plants, from seed
(Novice) through sprout and bud to full clover bloom (Master). Bests sit on one
baseline underneath, and a played tier's flower is filled. This could replace
the difficulty screen's stack and gives the home page a reason to exist.

**Icons and avatars:**
- **UI icons:** lucide, with thin 1.8px strokes.
- **Avatars:** round "specimen" badges, with a leaf-green glyph on a pale disc.
  The winner's badge turns magenta.

**Motion:** organic and slow.
- Growth bars in race results scale in from the left (transform only).
- The winner's flower fills.
- The timer is a vine with a leaf tip draining.

It all collapses under reduced motion.

**Sound feel:** soft and wooden, synthesized:
- **submit:** a marimba tap
- **correct:** two rising marimba notes
- **incorrect:** a low, soft thud (no buzzer)
- **win:** a short arpeggio

**Trademark distance:** green and magenta, never yellow. It has organic curves
and no geometry at all, so there's nothing hex-shaped even by accident. Sans
type only. The clover and field-guide framing sits a long way from a puzzle
masthead.

**Strengths:**
- The most original single idea (the growth chart).
- The calmest reading experience.
- The tier progression becomes visible and motivating.

**Risks:**
- The quietest energy for Race mode.
- The plant illustrations need real craft to avoid looking clip-art. The
  prototype plants are sketches.
- Magenta and leaf green in the same view need discipline.

Screens:
- `screens/b-clover-field__{home,round,race-results}--{desktop,phone}--{light,dark}.png`
- live files: `b-clover-field/*.html`

---

## C. Bee Line: fast, striped, poster-loud

**Mood:** a race-night poster: big expanded type, ink and cream **stripes** (a
bee's body, which also reads as a finish line), and a dotted flight path
("make a bee line"). It's the most energetic, built for Race mode and phones.

**Palette:** dark-first ("night race"), light = "day print". One accent:
**signal orange**, which appears only on the primary action, the clock and the
leader.

| Token | Dark | Light |
|---|---|---|
| bg / surface | `#0e0e0c` / `#1b1a17` | `#f2eee3` / `#fbf9f3` |
| text / muted | `#f3efe4` / `#a6a293` | `#141310` / `#5b574c` |
| accent fill / accent text | `#ff7a2f` / `#ff7a2f` | `#ff7a2f` / `#b8430a` |
| ink on accent fill | `#160700` | `#140600` |
| correct / incorrect | `#46dd8f` / `#ff5c86` | `#16703f` / `#b3204a` |

Measured contrast:

| Pair | Dark | Light |
|---|---|---|
| Body text | 16.8:1 | 16.0:1 |
| Muted text | 7.6:1 | 6.2:1 |
| Accent text | 7.4:1 | 4.7:1 |
| Ink on orange | 7.6:1 | 7.7:1 |
| Correct | 9.9:1 | 5.8:1 |
| Incorrect | 5.9:1 | 6.2:1 |
| Input edge | 3.7:1 | 17.7:1 |
| Focus ring | 7.4:1 | 4.7:1 |
| Timer | 5.6:1 | 3.8:1 |

The light accent *text* is the thinnest margin of any palette (4.7:1). It
passes, but don't lighten it.

**Type:** **Archivo** (OFL, variable width 62 to 125) is the only family:
- Expanded Black for the wordmark, the clock and the typed answer
- normal width for body text

One family keeps the bundle lean (one variable file).

**Logo and wordmark:** a striped bee body (a capsule with two ink bands and two
wing ovals) trailing a dotted orange flight line. The wordmark is
"SPELLING BEE", expanded and all caps; this direction's one exception to
sentence case, as a poster headline. The favicon is the striped capsule.

**Signature elements:**
- **The typed answer is the hero:** your letters are set huge (about 7rem) in
  expanded black type on an orange rule, so you watch the word being built.
- **Race results are lanes:** each player's token sits along a dashed track at
  their score, finishing at a striped line. The leader's token is orange.
- **Progress** is 10 bars in the HUD rather than "6 to go".

**Icons and avatars:**
- **UI icons:** lucide at 2px.
- **Avatars:** round tokens with a heavy ink ring (the "race token"); the
  leader's token is filled orange.

**Motion:** the fastest of the three, but still decoration only:
- Tokens fly in along their lanes (transform only).
- The timer is a diagonal-striped "fuse".
- The caret blinks.

All of it is off under reduced motion. No stripe animation runs during a round:
continuous motion beside a timed text field is a distraction, and a reduced-motion
concern even for people who haven't set the preference.

**Sound feel:** arcade and snappy, synthesized:
- **submit:** a short click
- **correct:** a bright upward blip pair
- **incorrect:** a quick downward buzz, short and never harsh
- **win:** a rising sweep

**Trademark distance:** black, cream and orange with stripes. The bee is
signalled by stripes and flight, **with no yellow or hexagon at all**. The
wordmark is an expanded sans poster headline, the opposite of a newspaper
serif. It's the most distinct palette of the three.

**Strengths:**
- The most personality and the best phone presence.
- The race-lanes results make multiplayer feel like a race.
- The answer-as-hero layout serves the core loop directly.

**Risks:**
- It's loud, which is tiring over a 10-word solo session unless the HUD stays
  quiet.
- The top stripe band can read as a chequered flag (fine for Race, a bit off
  for solo practice).
- All-caps display type must stay limited to headlines.

Screens:
- `screens/c-bee-line__{home,round,race-results}--{desktop,phone}--{dark,light}.png`
- live files: `c-bee-line/*.html`

---

## Mixing (examples, if you want to)

- **A + C lanes:** Blue Ribbon everywhere, with C's race lanes for race results
  (in blue, with the rosette on the winner's lane).
- **A + B growth:** Blue Ribbon, with B's seed-to-bloom tier chart replacing the
  difficulty stack.
- **C's answer-as-hero inside A:** A's calm frame, with the typed word set much
  larger.

**My recommendation: A (Blue Ribbon) with C's race lanes.** A anchors the name in
its generic "contest" meaning, which is both the honest description of the game
and the best trademark posture. Atkinson Hyperlegible fits a spelling game.
The lanes fix the weakest screen in the app today. I can build other mixes
equally well.

## Prototype notes

- The prototypes are static HTML, one folder per direction, with three screens
  each. Open them straight from disk. They follow the OS theme, which is how
  the screenshots were captured in both themes.
- Icons are lucide (ISC), emitted inline by `harness/icons.mjs` from the copy
  already in `node_modules`.
- The avatar glyphs and marks are original sketches (`_shared/avatars.js` and
  each direction's `mark.js` / `art.js`). They get redrawn properly in the
  build's assets stage.
- Fonts load from Google Fonts in the prototypes only. The build would
  self-host them (HARDENING #24: no visitor IPs sent to Google).
- `palettes.json` holds every pair measured, and `contrast-report.txt` is the
  output. **All 69 pairs pass** (text 4.5:1, large text and UI 3:1).
- No prototype overflows horizontally at 320, 390 or 1280px (checked with
  Playwright).
- Every page includes the `role="status"` region, `:focus-visible` rings,
  44px+ targets, no zoom blocking, and motion gated on
  `prefers-reduced-motion: no-preference`.
