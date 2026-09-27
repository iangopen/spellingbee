// hash_name_terms.mjs — turn display-name blocklist terms into SQL rows for a
// migration, so the terms themselves never appear in the repo or the database.
//
//   node supabase/scripts/hash_name_terms.mjs < terms.txt
//
// Input: one term per line, prefixed by its match class:
//   substring <term>   matched anywhere in the name (long, unambiguous terms)
//   token <term>       matched against whole words, and against the whole name
//                      with separators removed ("f.o.o" -> "foo"), so short
//                      terms don't reject innocent names that merely contain them
// Blank lines and lines starting with # are ignored.
//
// Output: `(sha256, len, kind)` VALUES rows for private.blocked_name_terms
// (migration 0018). Write a NEW migration that inserts them; never edit 0018.
//
// Keep the term file OUT of the repo. The hashes are not secret — a short term
// can be brute-forced from its hash — they exist so the list isn't greppable
// plain text in a public repository. The real protection is that no client role
// can read the table at all.
//
// normalizeTerm MUST agree with private.name_filter_flat() in 0018 for plain
// ASCII input, which is all a term should ever be. test:db asserts it.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Same folding the SQL applies to a name, restricted to what a term can contain. */
export function normalizeTerm(term) {
  return term
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[013457@$!|8]/g, (c) => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i", "|": "i", 8: "b" })[c])
    .replace(/[^a-z]/g, "");
}

export function termRow(kind, term) {
  if (kind !== "substring" && kind !== "token") throw new Error(`bad kind: ${kind}`);
  const norm = normalizeTerm(term);
  if (norm.length < 3) throw new Error(`term too short after normalizing: ${JSON.stringify(term)}`);
  const hex = createHash("sha256").update(norm, "utf8").digest("hex");
  return `  ('\\x${hex}'::bytea, ${norm.length}, '${kind}')`;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("hash_name_terms.mjs")) {
  const rows = readFileSync(0, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [kind, ...rest] = l.split(/\s+/);
      return termRow(kind, rest.join(""));
    });
  console.log([...new Set(rows)].join(",\n"));
}
