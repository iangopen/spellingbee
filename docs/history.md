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
