# Credits

Third-party material that ships with Spelling Bee, and the licence each is used
under. Everything else (code, the rosette and bee artwork, the honeycomb
background) is original to this project.

## Fonts

All are self-hosted from `src/assets/fonts/` (woff2, Latin and Latin Extended
subsets; Caveat Brush is a letters-only subset), under the SIL Open Font License 1.1. The full licence texts sit next
to the files.

| Font | Copyright | Licence file | Used by |
|---|---|---|---|
| Bricolage Grotesque | 2022 The Bricolage Grotesque Project Authors | `OFL-BricolageGrotesque.txt` | redesign: display type and numbers |
| Atkinson Hyperlegible | 2020 Braille Institute of America, Inc. | `OFL-AtkinsonHyperlegible.txt` | redesign: body text and the typed answer |
| Caveat Brush | 2015 Google Inc. | `OFL-CaveatBrush.txt` | redesign: hand lettering on the title, headings and badges only (subset, no digits) |
| Space Grotesk | 2020 The Space Grotesk Project Authors | `OFL-SpaceGrotesk.txt` | current UI (retired in redesign stage 7) |
| Inter | 2020 The Inter Project Authors | `OFL-Inter.txt` | current UI (retired in redesign stage 7) |

## Icons

UI icons come from [Lucide](https://lucide.dev) via the `lucide-react`
package, under the ISC License (Copyright (c) Lucide Icons and Contributors).
The licence ships inside the package.

## Words and definitions

The word list comes from SCOWL via the MIT-licensed `wordlist-english`
package. Sourcing, licences and the definition rule are documented in
`supabase/WORDLIST_SOURCES.md`.

## In the built site

The build writes `third-party-licenses.txt` next to `index.html` (served at
`/spellingbee/third-party-licenses.txt`): every npm package that lands in the
bundle with its licence text, the fonts' OFL texts, and SCOWL's notice
(`licenses/SCOWL-Copyright.txt`). See `scripts/licenseNotices.ts`; a bundled
package without a licence file fails the build.
