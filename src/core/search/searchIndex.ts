import type { EntityKind } from "@/core/entity/entity"
import { EXTERNAL_ID_LABELS, normalizeExternalId, type ExternalId } from "@/core/entity/externalId"
import { normalizeForMatch } from "@/core/identity/transliterate"
import { normalizeIdentifierForMatch } from "./identifierMatch"

/**
 * Everything the project already knows, flattened into one searchable form.
 *
 * The PRD's complaint is that search "matches Entity names by substring and returns six
 * results", leaving notes, aliases, Claim values and Ledger URLs invisible — so the fix is
 * not a better filter over names but a corpus that contains the other fields at all.
 *
 * The index is a precomputed array of normalised fields, not a token postings map. The
 * expensive part is normalisation — transliterating and folding some thousands of strings —
 * and doing it once per corpus rather than once per keystroke is the whole win. A postings
 * map was not added because the substring tier has to scan every field regardless, so it
 * would buy no work back at 1,027 entities; if the corpus grows an order of magnitude, that
 * is the change to make and this is where it goes.
 *
 * Pure and React-free, in `core/` for the house reason: there is no React Testing Library in
 * this repo, so logic left inside a component is logic no test can reach.
 */

/** What matched, so a hit can say *why* it matched rather than only that it did. */
export type SearchFieldKind = "name" | "alias" | "external-id" | "notes" | "claim" | "source"

export type IndexedField = {
  entityId: string
  entityName: string
  kind: EntityKind
  field: SearchFieldKind
  /** The text as the analyst entered it, for display. Never the normalised form. */
  text: string
  /** What the text is when the field kind alone does not say: an id scheme, a Claim's field. */
  label: string | null
  /** Comparable forms. More than one only where a single value is legitimately written
   *  several ways, which today is external identifiers. */
  terms: readonly string[]
}

export type SearchIndex = { fields: readonly IndexedField[] }

/**
 * Deliberately narrower than `Entity`: the index needs identity, the alternate spellings and
 * the free text, and nothing a Profile adds. A narrow input is also what lets the tests build
 * a corpus without minting whole entities.
 */
export type SearchableEntity = {
  id: string
  name: string
  kind: EntityKind
  aliases?: string[]
  externalIds?: ExternalId[]
  notes?: string | null
}

export type SearchableClaim = {
  entityId: string
  field: string
  value: string | null
  sourceId: string
}

export type SearchableSource = { id: string; url: string }

export type SearchIndexInput = {
  entities: readonly SearchableEntity[]
  claims?: readonly SearchableClaim[]
  sources?: readonly SearchableSource[]
}

/**
 * The forms one identifier is legitimately written in. A register prints "9074729", a
 * sanctions notice prints "IMO 9074729", and an analyst pastes whichever they were given —
 * `normalizeExternalId` already knows the two are the same identifier, so the index carries
 * both readings rather than making the query guess which one was stored.
 *
 * Normalised by the identifier fold, never the name fold: separators are removed here and
 * must be removed on the query side too, and a register's characters are literal, so no
 * transliteration or phonetic collapse may touch them.
 */
function externalIdTerms(id: ExternalId): string[] {
  const normalized = normalizeExternalId(id.scheme, id.value)
  const bare = normalizeIdentifierForMatch(normalized)
  if (bare === "") return []
  return [...new Set([bare, normalizeIdentifierForMatch(id.scheme) + bare])]
}

function push(
  fields: IndexedField[],
  entity: SearchableEntity,
  field: SearchFieldKind,
  text: string | null | undefined,
  label: string | null,
  terms?: string[],
): void {
  if (text == null) return
  const computed = terms ?? [normalizeForMatch(text)]
  const usable = computed.filter((term) => term !== "")
  // An empty normalised term is a substring of every query, so a field with no matchable
  // content would otherwise match everything typed.
  if (usable.length === 0) return
  fields.push({
    entityId: entity.id,
    entityName: entity.name,
    kind: entity.kind,
    field,
    text: text.trim(),
    label,
    terms: usable,
  })
}

/**
 * Every URL in the Ledger begins the same way, so indexing that prefix makes "http", "https"
 * and "www" match every entity that carries any source at all — the strongest tier, on the
 * weakest field, for a query that distinguishes nothing. Only the display text keeps the
 * full URL; what is matched is the part an analyst could plausibly be looking for.
 *
 * The two halves are independently optional: a URL recorded as `www.example.com/x`, with no
 * scheme, is still a URL whose `www` says nothing, and requiring `://` before stripping it
 * left that host prefixed by the one token every such host shares.
 *
 * Exported because the query side must strip the same way — a Source term is compared against
 * the query, so anything removed here and not there makes the whole URL, the form an analyst
 * copies out of the Ledger or the address bar, match nothing.
 */
const URL_BOILERPLATE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?/i

export function stripUrlBoilerplate(url: string): string {
  return url.replace(URL_BOILERPLATE, "")
}

/**
 * `Source` records are not entity-keyed — they live in the peripheral provenance store — so
 * a Claim is the only thing that says which entity a URL is evidence for. Joining through it
 * is what makes a Ledger hit selectable; an unclaimed Source stays unreachable, and that is
 * accepted rather than papered over, because a result that resolves to no entity is a row
 * the analyst can only click in vain.
 *
 * The PRD asks for "Source titles". The `Source` shape carries a URL and no title, so the URL
 * is what is indexed; the day a title lands, it becomes a second field on the same record.
 */
function indexSources(
  fields: IndexedField[],
  entity: SearchableEntity,
  claims: readonly SearchableClaim[],
  sourceUrlById: Map<string, string>,
): void {
  const seen = new Set<string>()
  for (const claim of claims) {
    if (seen.has(claim.sourceId)) continue
    const url = sourceUrlById.get(claim.sourceId)
    if (url === undefined) continue
    seen.add(claim.sourceId)
    push(fields, entity, "source", url, null, [normalizeForMatch(stripUrlBoilerplate(url))])
  }
}

export function buildSearchIndex(input: SearchIndexInput): SearchIndex {
  const claimsByEntityId = new Map<string, SearchableClaim[]>()
  for (const claim of input.claims ?? []) {
    const list = claimsByEntityId.get(claim.entityId)
    if (list) list.push(claim)
    else claimsByEntityId.set(claim.entityId, [claim])
  }
  const sourceUrlById = new Map((input.sources ?? []).map((source) => [source.id, source.url]))

  const fields: IndexedField[] = []
  for (const entity of input.entities) {
    push(fields, entity, "name", entity.name, null)
    for (const alias of entity.aliases ?? []) push(fields, entity, "alias", alias, null)
    for (const id of entity.externalIds ?? []) {
      push(fields, entity, "external-id", id.value, EXTERNAL_ID_LABELS[id.scheme] ?? null, externalIdTerms(id))
    }
    push(fields, entity, "notes", entity.notes, null)

    const claims = claimsByEntityId.get(entity.id) ?? []
    // A null value is the general-citation sentinel (ADR 0006): it asserts a source, not a
    // fact, so there is no text on it to match.
    for (const claim of claims) push(fields, entity, "claim", claim.value, claim.field)
    indexSources(fields, entity, claims, sourceUrlById)
  }
  return { fields }
}
