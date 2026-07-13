/**
 * Name normalization for cross-module entity resolution (ADR 0006, E3). The same
 * machinery as `Source` dedup, one level up: reduce two spellings of one real-world
 * name to a comparable key so "Вагнер" and "Wagner" can be *proposed* as the same
 * entity (final merge is always human-confirmed — see `proposeMatches`).
 */

/**
 * Cyrillic (Russian + Ukrainian) → Latin transliteration for matching only. This is a
 * lossy, one-directional fold tuned for *comparison*, not for display or reversible
 * romanization: several Cyrillic letters collapse onto the same Latin form on purpose.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", ё: "e", є: "ie",
  ж: "zh", з: "z", и: "i", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "iu", я: "ia",
}

/**
 * Phonetic equivalences applied *after* transliteration so spellings that sound alike
 * but map to different Latin letters still collapse together — most importantly the
 * Cyrillic-В-vs-German-W case ("Вагнер" → `vagner`, "Wagner" → `wagner`). Kept tiny and
 * conservative on purpose: aggressive folding would create false-positive candidates.
 */
const PHONETIC_FOLDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/w/g, "v"],
  [/y/g, "i"],
  [/ck/g, "k"],
]

/** Transliterate any Cyrillic characters in `value` to their Latin matching form (case-preserving). */
export function transliterateCyrillic(value: string): string {
  let out = ""
  for (const ch of value) {
    const lower = ch.toLowerCase()
    if (!(lower in CYRILLIC_TO_LATIN)) {
      out += ch
      continue
    }
    const mapped = CYRILLIC_TO_LATIN[lower]
    // Restore a leading capital when the source letter was uppercase (e.g. Х → "Kh").
    out += ch !== lower && mapped ? mapped[0].toUpperCase() + mapped.slice(1) : mapped
  }
  return out
}

/**
 * Reduces a display name to a comparison key: lowercased, Cyrillic transliterated,
 * diacritics stripped, phonetically folded, punctuation removed, whitespace collapsed.
 * Two names with the same key are strong duplicate candidates. Returns `""` for a name
 * with no alphanumeric content (callers must treat `""` as "no key", never a match).
 */
export function normalizeForMatch(name: string): string {
  let s = transliterateCyrillic(name.toLowerCase())
  // Strip combining diacritical marks (é → e) via canonical decomposition.
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  for (const [pattern, replacement] of PHONETIC_FOLDS) s = s.replace(pattern, replacement)
  // Collapse everything that isn't a latin letter or digit into single spaces.
  s = s.replace(/[^a-z0-9]+/g, " ").trim()
  return s
}
