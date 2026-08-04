import { decodeExportOverride } from "@/core/relationship/relationship"
import { EDGE_TYPES } from "@/core/relationship/vocabulary"
import type { Claim } from "@/core/provenance/claim"
import type { Relationship } from "@/core/relationship/relationship"
import type { MapEntity } from "@/types/domain.types"

/**
 * The export gate: the single pure predicate between the working project and a CC-BY 4.0
 * release that can never be recalled (`GABRIEL_V2_PRD.md`, story 79-82).
 *
 * It is one function rather than one per format because the PRD's rule is explicitly "a
 * single pure predicate, applied to every format" -- a CSV gate and a GeoJSON gate that
 * drift apart would publish, under one licence and one attribution, two different claims
 * about what was withheld.
 *
 * ## What this gate does NOT do
 *
 * `sourceCache` is absent from the input on purpose. The research cache is verbatim
 * third-party text held to avoid re-fetching, it is the one place this project was ever
 * found to name natural persons, and no release has any use for it. It is not filtered
 * here; it is simply never a thing that reaches an export.
 */

export type ExportGateInput = {
  entities: readonly MapEntity[]
  relationships: readonly Relationship[]
  claims: readonly Claim[]
}

export type ExclusionReason =
  | "natural-person"
  | "names-excluded-entity"
  | "dangling-endpoint"
  | "unsourced"
  | "assessment-tier"

export type Exclusion = { id: string; reason: ExclusionReason }

export type ExportGateResult = {
  entities: MapEntity[]
  relationships: Relationship[]
  claims: Claim[]
  excluded: {
    entities: Exclusion[]
    relationships: Exclusion[]
  }
}

/**
 * Published alongside the data. A reuser who cannot read what was withheld cannot tell the
 * absence of a row from an absence of evidence, which for a hierarchy dataset is the
 * difference between "not subordinate" and "we did not publish the subordination".
 */
export const EXPORT_GATE_RULES: readonly { reason: ExclusionReason; statement: string }[] = [
  {
    reason: "natural-person",
    statement:
      "Natural persons are not published. Entities of kind `person` are excluded from every release, " +
      "however well sourced they are.",
  },
  {
    reason: "names-excluded-entity",
    statement:
      "A relationship with an excluded entity at either end is excluded too, so a name cannot survive " +
      "in the edge table after its entity row has been removed.",
  },
  {
    reason: "dangling-endpoint",
    statement:
      "A relationship pointing at an entity that is not in the dataset is excluded, because a reuser " +
      "cannot resolve it and cannot tell what it asserted.",
  },
  {
    reason: "unsourced",
    statement:
      "A relationship ships only when BOTH endpoint entities carry at least one citation. Gabriel's " +
      "model attaches sources to entities, not to edges, so this is a proxy for edge-level sourcing " +
      "and not a claim that the subordination itself was cited.",
  },
  {
    reason: "assessment-tier",
    statement:
      "Assessment-tier relationships are analyst judgement, not record, and are excluded unless the " +
      "edge carries a two-person export override naming a proposer and a different confirmer.",
  },
]

/**
 * Assessment-tier edges are excluded unless authorised. `decodeExportOverride` is the one
 * place the two-person rule lives -- a self-confirmed or malformed override decodes to
 * `undefined`, i.e. no authorisation -- and this must not re-decide it, or "valid override"
 * would mean two things.
 */
function isPublishableTier(rel: Relationship): boolean {
  if (EDGE_TYPES[rel.type]?.tier !== "assessment") return true
  return decodeExportOverride(rel.exportOverride) !== undefined
}

/**
 * Order is load-bearing and is asserted by the tests. Person-naming is checked before
 * sourcing, and sourcing before tier, so that an export override -- which authorises
 * publication of an ASSESSMENT -- can never be read as manufacturing a source or as
 * consent to publish a person.
 */
function relationshipExclusion(
  rel: Relationship,
  publishableEntityIds: ReadonlySet<string>,
  knownEntityIds: ReadonlySet<string>,
  claimedEntityIds: ReadonlySet<string>,
): ExclusionReason | null {
  if (!knownEntityIds.has(rel.fromId) || !knownEntityIds.has(rel.toId)) return "dangling-endpoint"
  if (!publishableEntityIds.has(rel.fromId) || !publishableEntityIds.has(rel.toId)) return "names-excluded-entity"
  if (!claimedEntityIds.has(rel.fromId) || !claimedEntityIds.has(rel.toId)) return "unsourced"
  if (!isPublishableTier(rel)) return "assessment-tier"
  return null
}

export function applyExportGate(input: ExportGateInput): ExportGateResult {
  const excludedEntities: Exclusion[] = []
  const entities: MapEntity[] = []
  for (const entity of input.entities) {
    if (entity.kind === "person") {
      excludedEntities.push({ id: entity.id, reason: "natural-person" })
      continue
    }
    entities.push(entity)
  }

  const knownEntityIds = new Set(input.entities.map((e) => e.id))
  const publishableEntityIds = new Set(entities.map((e) => e.id))
  // Any field, not just the general-citation sentinel: the question is whether the entity is
  // cited at all, and a per-field claim is still a citation attached to it.
  const claimedEntityIds = new Set(input.claims.map((c) => c.entityId))

  const excludedRelationships: Exclusion[] = []
  const relationships: Relationship[] = []
  for (const rel of input.relationships) {
    const reason = relationshipExclusion(rel, publishableEntityIds, knownEntityIds, claimedEntityIds)
    if (reason != null) {
      excludedRelationships.push({ id: rel.id, reason })
      continue
    }
    relationships.push(rel)
  }

  return {
    entities,
    relationships,
    // A claim on an excluded entity would republish the name this gate just removed, in the
    // provenance table. Same reasoning as `selectPersistableSnapshot`'s dangling-claim filter.
    claims: input.claims.filter((c) => publishableEntityIds.has(c.entityId)),
    excluded: { entities: excludedEntities, relationships: excludedRelationships },
  }
}
