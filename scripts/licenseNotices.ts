// Build plugin: write dist/third-party-licenses.txt.
//
// The minifier strips every @license comment, so without this the deployed
// bundle carries React, supabase-js, lucide-react and the rest with none of the
// copyright notices their MIT/ISC licences require in copies. The list is
// derived from the modules that actually landed in the bundle, so it can't
// drift from package.json, and a bundled package with no licence file FAILS the
// build rather than shipping silently.
//
// Non-npm material that ships is listed explicitly: the self-hosted fonts' OFL
// texts (src/assets/fonts/OFL-*.txt), SCOWL's notice for the word list
// (licenses/SCOWL-Copyright.txt, verbatim from wordlist-english@1.2.1), the
// project's own artwork, and CREDITS.md.
//
// Fonts are CHECKED, not just listed: every font-family that src/fonts.css declares
// must have an OFL-<Family>.txt that contains a copyright line and the licence name,
// and a row in CREDITS.md, or the build fails. Adding a font without its notice is
// the same mistake as bundling an npm package without its licence file, and the
// licences require the notice, so it is the same kind of failure.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

/** "Atkinson Hyperlegible" and "OFL-AtkinsonHyperlegible.txt" are the same name. */
const squash = (name: string) => name.replace(/[^a-z0-9]/gi, '').toLowerCase()

/**
 * What is wrong with the fonts' notices, as human-readable lines (empty if nothing).
 * Pure, so it is unit-tested against fixtures (scripts/tests/licenses.test.mjs).
 */
export function fontLicenceProblems(fontsCss: string, oflFiles: Record<string, string>, creditsMd: string): string[] {
  const problems: string[] = []
  const families = [...new Set([...fontsCss.matchAll(/font-family:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))]
  if (families.length === 0) problems.push('src/fonts.css declares no font-family (nothing to check, which is itself wrong)')
  const byName = new Map(Object.entries(oflFiles).map(([file, text]) => [squash(file.replace(/^OFL-/, '').replace(/\.txt$/, '')), { file, text }]))
  for (const family of families) {
    const hit = byName.get(squash(family))
    if (!hit) {
      problems.push(`font "${family}" has no src/assets/fonts/OFL-${family.replace(/\s+/g, '')}.txt`)
      continue
    }
    if (!/copyright/i.test(hit.text)) problems.push(`${hit.file} has no copyright line`)
    if (!/open font license/i.test(hit.text)) problems.push(`${hit.file} does not contain the SIL Open Font License`)
    if (!creditsMd.includes(family)) problems.push(`CREDITS.md has no row for font "${family}"`)
  }
  return problems
}

function packageRoot(moduleId: string): string | null {
  // Rollup marks virtual modules with a leading NUL.
  const raw = moduleId.startsWith('\0') ? moduleId.slice(1) : moduleId
  const id = raw.split('?')[0].replace(/\\/g, '/')
  const at = id.lastIndexOf('/node_modules/')
  if (at === -1) return null
  const rest = id.slice(at + '/node_modules/'.length).split('/')
  const depth = rest[0].startsWith('@') ? 2 : 1
  return id.slice(0, at) + '/node_modules/' + rest.slice(0, depth).join('/')
}

export function licenseNotices(root: string): Plugin {
  return {
    name: 'spellingbee:license-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const roots = new Set<string>()
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk') continue
        for (const id of out.moduleIds) {
          const r = packageRoot(id)
          if (r) roots.add(r)
        }
      }

      const sections: string[] = []
      const missing: string[] = []
      const packages = [...roots]
        .map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
        .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
      for (const { dir, pkg } of packages) {
        const file = readdirSync(dir).find((f) => LICENCE_FILE.test(f))
        if (!file) {
          missing.push(`${pkg.name}@${pkg.version}`)
          continue
        }
        sections.push(
          `${pkg.name} ${pkg.version} (${pkg.license})\n\n${readFileSync(join(dir, file), 'utf8').trim()}`
        )
      }
      if (missing.length) {
        this.error(`bundled package(s) without a licence file: ${missing.join(', ')}`)
      }

      const fontsDir = join(root, 'src', 'assets', 'fonts')
      const oflFiles: Record<string, string> = {}
      for (const f of readdirSync(fontsDir).filter((f) => /^OFL-.*\.txt$/.test(f)).sort()) {
        oflFiles[f] = readFileSync(join(fontsDir, f), 'utf8')
      }
      const creditsPath = join(root, 'CREDITS.md')
      if (!existsSync(creditsPath)) this.error('CREDITS.md is missing')
      const creditsMd = readFileSync(creditsPath, 'utf8')
      const fontProblems = fontLicenceProblems(readFileSync(join(root, 'src', 'fonts.css'), 'utf8'), oflFiles, creditsMd)
      if (fontProblems.length) {
        this.error(`font licence notices are incomplete:\n  - ${fontProblems.join('\n  - ')}`)
      }
      for (const [f, text] of Object.entries(oflFiles)) {
        sections.push(`Font: ${f.slice(4, -4)} (SIL Open Font License 1.1)\n\n${text.trim()}`)
      }

      const scowl = join(root, 'licenses', 'SCOWL-Copyright.txt')
      if (!existsSync(scowl)) this.error('licenses/SCOWL-Copyright.txt is missing')
      sections.push(`Word list: SCOWL, via wordlist-english 1.2.1\n\n${readFileSync(scowl, 'utf8').trim()}`)

      sections.push(
        'Artwork: the bee, avatars, rosette, icons, favicon and share card\n\n' +
          'Original to this project: drawn for it (src/lib/beeArt.ts) and rendered into public/ by\n' +
          'design/harness/build-brand-assets.mjs. Released under the same MIT licence as the code (LICENSE).'
      )
      sections.push(`Credits (CREDITS.md)\n\n${creditsMd.trim()}`)

      const rule = '\n\n' + '='.repeat(78) + '\n\n'
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source:
          'This site ships the third-party material below. Each entry is followed by\n' +
          'its licence and copyright notice, as that licence requires.' +
          rule +
          sections.join(rule) +
          '\n',
      })
    },
  }
}
