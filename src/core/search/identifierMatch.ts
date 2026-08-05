import type { SearchFieldKind } from "./searchIndex"

/**
 * The comparison form for identifier text, kept separate from `normalizeForMatch`.
 *
 * `normalizeForMatch` exists to make two *spellings of a name* comparable, so it
 * transliterates Cyrillic and folds phonetically (`w→v`, `y→i`, `ck→k`). Neither is true of
 * a registry string: `529900W3MOO00A18X956` and `529900V3MOO00A18X956` are two different,
 * structurally valid LEIs, and folding them together made one exact paste return both rows,
 * scored identically and both labelled an exact match. It also turns `[\s.-]` into spaces
 * where `normalizeExternalId` removes them, so the documented paste form `1027-7001-32195`
 * missed the entity carrying OGRN `1027700132195` outright.
 *
 * This lives in `core/search` rather than `core/identity` on purpose: the folds there are
 * load-bearing for candidate matching (`proposeMatches`), where collapsing "Wagner" and
 * "Вагнер" is the point. Search must not reach in and change that.
 */

/** The separators these identifiers are printed with — the same set `normalizeExternalId` removes. */
const SEPARATORS = /[\s.-]+/g

/**
 * Case is folded, which is deliberately weaker than the identity-dedup rule
 * (`externalId.ts`, owner ruling Q31): that rule keeps `NK-a7bC` and `nk-a7bc` as two
 * distinct register rows, and must, because merging them would merge two real entities.
 * Here the cost does not arise — each hit renders `hit.text`, the value exactly as recorded
 * (`explainHit` → the dropdown's detail line), so two register rows stay two visibly
 * distinct rows and the analyst reads the capitalisation off the row. What case-folding buys
 * is that an analyst typing a LEI in lower case still finds the upper-case one on file.
 */
export function normalizeIdentifierForMatch(value: string): string {
  return value.toLowerCase().replace(SEPARATORS, "")
}

/** Whether a field's text is a register string rather than prose someone chose the spelling of. */
export function isIdentifierField(field: SearchFieldKind): boolean {
  return field === "external-id"
}
