import type { EntityKind } from "@/core/entity/entity"
import type { RelationshipMetadata, RelationshipType } from "./relationship"
import type { EdgeTypeDefinition, MetadataRule } from "./vocabulary"
import { EDGE_TYPES } from "./vocabulary"

/**
 * What a form over `EDGE_TYPES` needs, computed rather than hand-written.
 *
 * Every rule the editor enforces is already declared in the vocabulary, and this module is the
 * projection of those declarations into fields and orderings — never a second statement of them.
 * A hand-written form would be a copy of the spec that silently falls behind the day a type gains
 * a metadata key, and the test here holds the two together: every key every type declares must be
 * offered by exactly one field.
 *
 * It is React-free and lives in `core/` for the reason the house style says: there is no React
 * Testing Library in this repo, so logic that stays inside a component is logic no test can reach.
 */

export type MetadataFieldSpec =
  | { key: keyof RelationshipMetadata; kind: "enum"; options: readonly string[] }
  | { key: keyof RelationshipMetadata; kind: "number"; min: number; max: number }

export type TargetCandidate = { id: string; name: string; kind: EntityKind }

/**
 * The type as prose. Every type is named so that the edge reads "A *type* B", and the underscores
 * are the only thing standing between the identifier and that sentence — so the label is derived
 * from the identifier rather than kept as a second, driftable list of display names.
 */
export function edgeTypeLabel(type: RelationshipType): string {
  return humaniseToken(type)
}

/**
 * A metadata key or one of its declared values as prose. Splits both conventions the vocabulary
 * uses — `registered_agent` and `operatorRole` — and lower-cases only the letter it split at, so
 * an acronym the spec chose deliberately (`ISM`) survives being displayed.
 */
export function humaniseToken(token: string): string {
  return token
    .split("_")
    .join(" ")
    .replace(/([a-z])([A-Z])/g, (_match, before: string, after: string) => before + " " + after.toLowerCase())
}

function definitionFor(type: RelationshipType): EdgeTypeDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(EDGE_TYPES, type) ? EDGE_TYPES[type] : undefined
}

function fieldFor(key: keyof RelationshipMetadata, rule: MetadataRule): MetadataFieldSpec {
  if (Array.isArray(rule)) return { key, kind: "enum", options: rule }
  const range = rule as { min: number; max: number }
  return { key, kind: "number", min: range.min, max: range.max }
}

export function metadataFieldsFor(type: RelationshipType): MetadataFieldSpec[] {
  const definition = definitionFor(type)
  if (definition === undefined) return []
  const spec = definition.metadata as Record<string, MetadataRule | undefined>
  const fields: MetadataFieldSpec[] = []
  for (const [key, rule] of Object.entries(spec)) {
    if (rule === undefined) continue
    fields.push(fieldFor(key as keyof RelationshipMetadata, rule))
  }
  return fields
}

/**
 * The form's raw strings, as the metadata bag the type declares.
 *
 * Two deliberate asymmetries. A blank field is OMITTED — absent is the vocabulary's own way of
 * saying "not recorded", and an empty string would be a value outside every declared set. An
 * unparseable number is kept as `NaN` and NOT omitted: dropping it would commit an ownership edge
 * with no percentage while the analyst believed they had typed one, whereas NaN reaches
 * `validateRelationships` and comes back as a refusal they can see.
 *
 * Keys the type does not declare are dropped, because a metadata key is owned by exactly one
 * declaring type — the form keeps its draft across a type change, and carrying `role` into a
 * `supplies` edge would persist a key that type has never declared.
 */
export function buildMetadata(
  type: RelationshipType,
  raw: Partial<Record<string, string>>,
): RelationshipMetadata {
  const built: Record<string, unknown> = {}
  for (const field of metadataFieldsFor(type)) {
    const value = raw[field.key]
    if (value == null || value.trim() === "") continue
    built[field.key] = field.kind === "number" ? Number(value) : value
  }
  return built as RelationshipMetadata
}

/**
 * The refusal, as the analyst should read it: the validator's own sentences, each once.
 *
 * A corpus-wide rule reports once per offending edge, so appending a second hierarchy edge
 * produces two violations carrying the identical detail — correct in the ledger, where each hangs
 * on a different edge, and nonsense in a form that has no edge to hang either on. Deduplicating
 * the *string* is the one liberty taken with the validator's words; nothing is reworded, and a
 * genuinely different explanation is never merged away.
 */
export function refusalMessages(violations: { detail: string }[]): string[] {
  return [...new Set(violations.map((violation) => violation.detail))]
}

/**
 * The target picker's candidates, ordered by the kinds the type expects and filtered of nothing
 * but the source entity itself.
 *
 * `toKinds` is advisory by the vocabulary's own JSDoc — it orders and filters the picker and never
 * rejects — so an unexpected kind sinks to the bottom of the list rather than out of it. The one
 * exclusion is the source, which could only produce a self-loop that validation would refuse
 * anyway; offering it would be offering a mistake.
 *
 * Stable within each group, so the caller's ordering (currently by name) survives.
 */
export function orderTargets(
  type: RelationshipType,
  fromId: string,
  candidates: TargetCandidate[],
): TargetCandidate[] {
  const eligible = candidates.filter((candidate) => candidate.id !== fromId)
  const preferred = definitionFor(type)?.toKinds
  if (preferred === undefined || preferred.length === 0) return eligible
  const rank = new Set<EntityKind>(preferred)
  return [
    ...eligible.filter((candidate) => rank.has(candidate.kind)),
    ...eligible.filter((candidate) => !rank.has(candidate.kind)),
  ]
}
