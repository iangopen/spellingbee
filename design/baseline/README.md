# Stage 0 baseline: the current app, measured the redesign's way

This is where the redesign starts, and what every later stage is gated
against. It was produced on 2026-09-29 from `redesign/spelling-bee` after
merging `main` (self-hosted fonts), so it's the live look.

The run:
- **Screens:** all 16 real screens, rendered from `src/` by `design/harness`
  (network modules stubbed, so no guest users)
- **Widths:** desktop 1280 and phone 390
- **Themes:** dark and light

## Contrast (`contrast-app.md` / `.json`, from `TARGET=app node design/harness/measure.mjs`)

Every visible text element, control edge and focus ring was measured against
the **worst pixel behind it**. With a modal open, only what's inside it is
measured.

**715 measured pairs, 47 failing, and 44 focusable controls show focus
without an outline.**

| Group | Pairs failing | Worst | Notes |
|---|---|---|---|
| Light-theme text over the honey wallpaper | 26 | 3.96:1 | The lead-in ("Your word is:"), muted labels ("to go") and correct-green lines pass against the flat cream (the Phase 1 audit said 4.60:1), but the honeycomb wallpaper's lines darken the pixels under them. This is exactly what the worst-pixel rule exists to catch. |
| Control edges | 10 | 1.24:1 | Lobby and Settings text inputs and selects (`--border` #e6d6b4 / #3a3226), as the audit found. |
| Master tier text | 4 | 3.81:1 | Cream on the orange Master fill, both themes. |
| "Create room" / "Join room" | 2 | 3.19:1 | **Disabled state only** (no name yet). WCAG 1.4.3 exempts inactive controls; listed for completeness. |
| Eliminated player's name | 4 | 2.86:1 | The ghost state's struck-through `--out` name. It's informational text, so it isn't exempt. |
| Focus ring | 1 | 2.14:1 | The Settings button's default ring over the gold champion card (elimination results, phone). |

**Controls with no outline when focused (44):** the 8 hexagon tier bars (focus is a
thicker rim, because the clip-path hides outlines), the guess input and text
inputs (a border colour change), the Settings selects, and the theme segments.
The redesign gives every control the solid ring-in-a-moat, so this count
goes to 0.

## Trademark distance (`checks-app.txt`, from `TARGET=app node design/harness/check-glow.mjs`)

- **Yellow colour literals in `src/`, `index.html` and `public/`:** 26 (the
  honey palette and the tier fills).
- **Yellow pixels:** 5,177,667 across 64 renders (43.3M pixels).
- **The legacy `body::before` honeycomb wallpaper:** present on every screen.
- **Hexagon-clipped elements in content:** 8 on the difficulty screen (the
  tier bars).
- **Honeycomb component (`[data-honeycomb]`):** absent. It arrives in stage 2.

## Gates by stage (from `design/PHASE3.md`)

| After stage | Must hold |
|---|---|
| every stage | build, lint, `npm test`, `npm run test:db` untouched; no diff in `src/hooks`, `src/lib/rooms.ts`, `auth.ts`, `captcha.ts`, `supabase/` |
| 1 (tokens) | 0 yellow source literals, except the aliased legacy tokens scheduled for deletion |
| 2 (background) | `[data-honeycomb]` is present, `aria-hidden`, no pointer events, no text or focusables; the legacy wallpaper is gone |
| 4 (screens) | 0 failing contrast pairs (disabled controls excepted), 0 controls without an outline, 0 hexagon-clipped elements, 0 yellow pixels |
| 7 (polish) | all of the above, plus the real-phone check |
