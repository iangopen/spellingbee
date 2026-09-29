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
// texts (src/assets/fonts/OFL-*.txt) and SCOWL's notice for the word list
// (licenses/SCOWL-Copyright.txt, verbatim from wordlist-english@1.2.1).

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

function packageRoot(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/')
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
      for (const f of readdirSync(fontsDir).filter((f) => /^OFL-.*\.txt$/.test(f)).sort()) {
        sections.push(`Font: ${f.slice(4, -4)} (SIL Open Font License 1.1)\n\n${readFileSync(join(fontsDir, f), 'utf8').trim()}`)
      }

      const scowl = join(root, 'licenses', 'SCOWL-Copyright.txt')
      if (!existsSync(scowl)) this.error('licenses/SCOWL-Copyright.txt is missing')
      sections.push(`Word list: SCOWL, via wordlist-english 1.2.1\n\n${readFileSync(scowl, 'utf8').trim()}`)

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
