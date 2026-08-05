import type { EntityKind } from "@/core/entity/entity"
import { entityKindLabel } from "@/core/entity/entityKindLabels"
import { normalizeForMatch } from "@/core/identity/transliterate"
import { isIdentifierField, normalizeIdentifierForMatch } from "./identifierMatch"
import { stripUrlBoilerplate, type IndexedField, type SearchFieldKind, type SearchIndex } from "./searchIndex"

/**
 * Ranking over the instant index.
 *
 * The old search filtered names by substring and kept the first six in array order. The
 * limit was never the defect — throwing away better results it had already found was. So
 * everything here ranks first and truncates last, and every hit carries the reason it
 * matched, because a result an analyst cannot explain is a result they cannot trust.
 */

export type MatchStrength = "exact" | "prefix" | "word-prefix" | "substring"

export type SearchHit = {
  entityId: string
  entityName: string
  kind: EntityKind
  field: SearchFieldKind
  /** The scheme or Claim field the text belongs to, when the field kind alone does not say. */
  label: string | null
  text: string
  strength: MatchStrength
  score: number
}

export type SearchGroup = { kind: EntityKind; label: string; hits: SearchHit[] }

/**
 * One raw input, folded once per way the index builds terms. Prose, register strings and
 * URLs do not compare alike, and a form the index has that the query lacks is a field that
 * can only be missed. Every member here must correspond to a branch of `queryFormFor`.
 */
type NormalizedQuery = { text: string; identifier: string; source: string }

/**
 * Strength dominates field, and by a wide margin. An exact match on any field is a stronger
 * statement than a partial match on a better field: "9074729" appearing verbatim in a note
 * is more likely to be the identifier being hunted than "9074" sitting inside some other
 * entity's name. Field weight then separates hits of equal strength, where a name really is
 * worth more than a free-text note that happens to contain the same word.
 */
const STRENGTH_SCORE: Record<MatchStrength, number> = {
  "exact": 400,
  "prefix": 300,
  "word-prefix": 200,
  "substring": 100,
}

/**
 * External ids sit just under names because an exact identifier is the one thing an external
 * register and this project can agree on without agreeing on a spelling (story 32). Sources
 * sit last: a URL matching says the entity is *near* the evidence, not that it is the answer.
 */
const FIELD_SCORE: Record<SearchFieldKind, number> = {
  "name": 50,
  "external-id": 45,
  "alias": 40,
  "claim": 25,
  "notes": 15,
  "source": 10,
}

/**
 * A Source URL is indexed as one long term, which makes it a magnet for the top tiers on
 * queries that say nothing about the entity: "ru" prefix-matched `rusprofile.ru` at 210 and
 * beat an entity actually *named* something containing "ru" at 150. The field weight alone
 * could not fix that, because strength dominates field by design.
 *
 * Capping is the defensible fix rather than lowering `FIELD_SCORE.source`: the ceiling says
 * what is actually true — a URL containing the query never asserts more than "the query
 * appears somewhere in the evidence's address", which is what the substring tier means —
 * and it keeps a Source hit findable at all, which a weight small enough to fix the ordering
 * would not. Combined with stripping the URL's scheme and `www.` before indexing, a Ledger
 * URL can no longer outrank any match on the entity itself.
 *
 * The ceiling applies to the **score only**, never to `hit.strength`. It is a statement about
 * how much a Source hit is worth, not about what happened: pasting a Ledger URL verbatim is
 * an exact match by any reading, and reporting it as "substring" would make a field named
 * `strength` mean "capped strength" — a distinction no reader of the type could see, and the
 * kind a future consumer would be right to trust and wrong to believe.
 */
const STRENGTH_CEILING: Partial<Record<SearchFieldKind, MatchStrength>> = {
  source: "substring",
}

/** One dropdown row is one line. Long enough to recognise a note, short enough not to wrap. */
const SNIPPET_LENGTH = 80

function capped(field: SearchFieldKind, strength: MatchStrength): MatchStrength {
  const ceiling = STRENGTH_CEILING[field]
  if (ceiling === undefined) return strength
  return STRENGTH_SCORE[strength] > STRENGTH_SCORE[ceiling] ? ceiling : strength
}

function strengthOf(term: string, query: string): MatchStrength | null {
  if (term === query) return "exact"
  if (term.startsWith(query)) return "prefix"
  // Terms are whitespace-normalised by `normalizeForMatch`, so a leading space is exactly
  // "starts a word" — the tier that makes "group" find "Wagner Group" above "Fleetwood".
  if (term.includes(" " + query)) return "word-prefix"
  if (term.includes(query)) return "substring"
  return null
}

/**
 * A field is compared against the query normalised the way that field's own terms were.
 * Comparing a register string against the name fold is what let `1027-7001-32195` miss the
 * OGRN it names and let two different LEIs answer one exact paste; comparing a URL against
 * the plain name fold is the same defect one field over, and made a pasted Source URL — the
 * most natural way to search for one — fold to `https vvv rusprofile ru id 12345` against a
 * term the index had already stripped to `rusprofile ru id 12345`.
 */
function queryFormFor(field: SearchFieldKind, query: NormalizedQuery): string {
  if (isIdentifierField(field)) return query.identifier
  if (field === "source") return query.source
  return query.text
}

function bestStrength(field: IndexedField, query: NormalizedQuery): MatchStrength | null {
  const normalized = queryFormFor(field.field, query)
  // An empty query form is a prefix of every term, so a query with no content under *this*
  // field's fold must match nothing here rather than everything. Only a query that is empty
  // under every fold is rejected outright, so the other folds can still answer it.
  if (normalized === "") return null
  let best: MatchStrength | null = null
  for (const term of field.terms) {
    const strength = strengthOf(term, normalized)
    if (strength === null) continue
    if (best === null || STRENGTH_SCORE[strength] > STRENGTH_SCORE[best]) best = strength
  }
  return best
}

function toHit(field: IndexedField, strength: MatchStrength): SearchHit {
  return {
    entityId: field.entityId,
    entityName: field.entityName,
    kind: field.kind,
    field: field.field,
    label: field.label,
    text: field.text,
    strength,
    score: STRENGTH_SCORE[capped(field.field, strength)] + FIELD_SCORE[field.field],
  }
}

/**
 * One hit per entity, explained by its strongest matching field. Two rows for one entity
 * would be two chances to pick the same thing, and the weaker row would justify the match
 * with the weaker reason.
 *
 * Ties break on name, then id, so the list does not reshuffle between keystrokes that happen
 * to score the same — a list that reorders under the cursor gets the wrong entity clicked.
 */
export function searchEntities(
  index: SearchIndex,
  query: string,
  options: { limit?: number } = {},
): SearchHit[] {
  const normalized: NormalizedQuery = {
    text: normalizeForMatch(query),
    identifier: normalizeIdentifierForMatch(query.trim()),
    source: normalizeForMatch(stripUrlBoilerplate(query.trim())),
  }
  // The text fold removes strictly *more* than the identifier one — it collapses everything
  // outside [a-z0-9], where the identifier fold removes only [\s.-] — so a query can be empty
  // under the text fold and still name something: `株式会社12345` is a legal `registry` id,
  // and free-form schemes preserve arbitrary characters by design. Only a query with no
  // content under any fold has nothing to compare against anything.
  if (normalized.text === "" && normalized.identifier === "" && normalized.source === "") return []

  const bestByEntity = new Map<string, SearchHit>()
  for (const field of index.fields) {
    const strength = bestStrength(field, normalized)
    if (strength === null) continue
    const hit = toHit(field, strength)
    const incumbent = bestByEntity.get(hit.entityId)
    if (incumbent === undefined || hit.score > incumbent.score) bestByEntity.set(hit.entityId, hit)
  }

  const ranked = [...bestByEntity.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.entityName.localeCompare(b.entityName) ||
      a.entityId.localeCompare(b.entityId),
  )
  // On the entity path, truncation happens here and nowhere earlier: the defect this module
  // replaces was a `.slice(0, 6)` applied before anything had been ranked. The OSM path is
  // not yet converted — `searchLocalOsmFeatures` still stops collecting at its `limit` in
  // traversal order, with no ranking at all — so the claim holds for entities only.
  return options.limit == null ? ranked : ranked.slice(0, options.limit)
}

/**
 * Head truncation rather than a window around the match, because normalisation is not
 * offset-preserving — "щ" becomes four Latin characters and punctuation collapses — so an
 * offset found in the normalised term cannot be mapped back onto the text the analyst wrote.
 */
function snippet(text: string): string {
  return text.length <= SNIPPET_LENGTH ? text : text.slice(0, SNIPPET_LENGTH).trimEnd() + "…"
}

/** Why this entity is in the list, in the analyst's own words wherever possible. */
export function explainHit(hit: SearchHit): string {
  switch (hit.field) {
    case "name":
      return "Name"
    case "alias":
      return "Alias: " + snippet(hit.text)
    case "external-id":
      return (hit.label ?? "External id") + ": " + snippet(hit.text)
    case "claim":
      return "Claim " + (hit.label ?? "value") + ": " + snippet(hit.text)
    case "notes":
      return "Notes: " + snippet(hit.text)
    case "source":
      return "Source: " + snippet(hit.text)
  }
}

/**
 * Grouped by what the thing is (story 28), with the groups ordered by their best hit rather
 * than by a fixed kind order: a fixed order would push the strongest match in the corpus
 * below a fold behind two weaker groups that happen to sort earlier.
 *
 * Hits are assumed already ranked, so each group keeps the order it was given.
 */
export function groupHitsByKind(hits: readonly SearchHit[]): SearchGroup[] {
  const byKind = new Map<EntityKind, SearchHit[]>()
  for (const hit of hits) {
    const list = byKind.get(hit.kind)
    if (list) list.push(hit)
    else byKind.set(hit.kind, [hit])
  }
  return [...byKind]
    .map(([kind, list]) => ({ kind, label: entityKindLabel(kind), hits: list }))
    .sort((a, b) => (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0))
}
