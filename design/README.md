# design/: Spelling Bee redesign (planning only)

Nothing in this folder is part of the app build. `tsconfig` includes only `src`,
and oxlint reports nothing here.

| Path | What |
|---|---|
| `audit/AUDIT.md` | Phase 1: critique of the current design, the accessibility baseline, and every place the old name appears |
| `audit/screens/` | The current app: 16 screens × desktop/phone × dark/light (64 PNGs) |
| `audit/current-palette.json` | The current colour pairs, measured |
| `DIRECTIONS.md` | Phase 2: brand basics and three directions (A Blue Ribbon, B Clover Field, C Bee Line), with contrast, trademark notes and a recommendation |
| **`PHASE3.md`** | **The design system and the stage-by-stage build plan** for the final direction (not implemented yet). |
| **`prototypes/blue-ribbon-glow/`** | **The chosen direction**: Blue Ribbon + glowing blue honeycomb + C's race lanes. Start at `compare.html`; the folder's README has the notes and verification. |
| **`prototypes/honey-hybrid/`** | **Pick pending:** three hybrids (a Hive, b Honey and ribbon, c Split) of the old honey palette with the Blue Ribbon polish. Start at `compare.html`, which also shows the old design and plain Blue Ribbon. |
| **`prototypes/homemade/`** | **Current working prototype (2026-10-02):** honey hybrid b as picked, the OLD difficulty screen returned, and the homemade feel at two strengths (`?h=off|light|more`, pick pending). Start at `compare.html`; the folder's README has the notes and verification. |
| `prototypes/<direction>/` | Phase 2 static prototypes (home, round, race-results) of A, B and C, kept as the record. |
| `prototypes/screens/` | 3 directions × 3 screens × desktop/phone × light/dark (36 PNGs) |
| `prototypes/palettes.json` + `contrast-report.txt` | Every palette pair and its measured WCAG ratio (69 pairs, 0 failing) |
| `harness/` | Tooling. See below. |

The harness tooling:

| File | What it does |
|---|---|
| `vite.config.ts`, `main.tsx`, `mock.ts`, `stubs/` | Renders the REAL `src/` screens with mocked props. Room, Supabase and session modules are stubbed, so no guest user is ever created. |
| `shoot.mjs` | Takes the Playwright screenshots. |
| `shoot-glow.mjs`, `measure.mjs`, `perf-glow.mjs`, `check-glow.mjs` | Screenshots, worst-pixel contrast, phone performance, and no-yellow / decoration-only checks for the glow prototypes. |
| `shoot-homemade.mjs` | The homemade prototype's screenshots (3 strengths x 4 screens), reduced-motion stills, lemon / grey-tile / decoration-only / tier-stack checks, the hand-font check, the tier bars' focus-rim contrast, and the old-vs-new difficulty side-by-sides. Its contrast runs through `measure.mjs` with `TARGET=homemade`. |
| `shoot-hybrid.mjs` | The honey hybrid's screenshots, reduced-motion stills, and its lemon-yellow, grey-tile and decoration-only checks. Its contrast runs through `measure.mjs` with `TARGET=hybrid`. |
| `contrast.mjs` | Checks the WCAG ratios. |
| `icons.mjs` | Emits the lucide icons inline for the prototypes. |
| `run-checks.mjs` | Builds, serves the build and the harness, runs every check below, prints one table. `PW_MODULE=... node design/harness/run-checks.mjs`. |
| `measure.mjs` (`TARGET=app`) | Contrast of the real screens at the shimmer's peak. Writes into `design/baseline/`; `run-checks.mjs` moves the output to `design/stage-results/` and restores the baseline. |
| `check-tier-bars.mjs`, `check-tier-focus.mjs` | Tier bars: tap target and focus rim on the real app / on a prototype copy. |
| `check-settings-dialog.mjs`, `keyboard-elimination.mjs`, `keyboard-real-app.mjs` | Dialog focus; keyboard-only passes. |
| `check-reduced-motion.mjs` | Every screen is still under reduced motion and matches the in-app switch. |
| `check-real-app.mjs`, `check-network-screens.mjs` | A 30-word game in the build (sound, speech, network); every screen's requests. |
| `unused-selectors.mjs`, `unused-tokens.mjs` | Dead CSS classes and custom properties. |
| `build-brand-assets.mjs` | Renders the favicon, icons and share card into `public/` from `src/lib/beeArt.ts`. |
| `shoot-readme.mjs`, `shoot-final.mjs`, `bundle-size.mjs` | README screenshots; side-by-sides with the prototype (`docs/review/`); bundle bytes against another build. |

## Re-running the screenshots

Playwright is deliberately NOT a repo dependency. Install it anywhere outside the
repo and point `PW_MODULE` at it:

```sh
npm i --prefix /some/tmp/pw playwright
npx vite --config design/harness/vite.config.ts          # harness on :5199
PW_MODULE=/some/tmp/pw/node_modules/playwright/index.mjs \
  node design/harness/shoot.mjs harness design/audit/screens
PW_MODULE=... node design/harness/shoot.mjs files design/prototypes/screens design/prototypes/*/*.html
node design/harness/contrast.mjs design/prototypes/palettes.json
```
