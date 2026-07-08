import type { MapEntity } from "@/types/domain.types"
import type { Claim } from "@/core/provenance/claim"
import { GENERAL_CITATION_FIELD } from "@/core/provenance/claim"

/**
 * Default richness threshold. An entity scoring >= this value is considered
 * well-sourced and will be skipped during a layered research run.
 * Score breakdown: each source URL = 2 pts, notes/militaryUnitId/osmRelationId = 1 pt each.
 * Default of 6 means "skip if 3+ source URLs already present".
 */
export const DEFAULT_RICHNESS_THRESHOLD = 6

/**
 * Computes a richness score for a MapEntity based on how much information it
 * already carries. Higher = more information already present. Source count is
 * a raw claim count, not deduplicated by URL — preserves the pre-E2.6 behavior
 * where a raw-string split counted duplicate lines too.
 */
export function computeEntityRichness(entity: MapEntity, claims: Claim[]): number {
  const sourceCount = claims.filter(
    (c) => c.entityId === entity.id && c.field === GENERAL_CITATION_FIELD,
  ).length
  let score = sourceCount * 2
  if (entity.notes?.trim()) score += 1
  if (entity.militaryUnitId?.trim()) score += 1
  if (entity.osmRelationId != null) score += 1
  return score
}

/** Returns true if the entity should be skipped based on the richness threshold. */
export function shouldSkipEntity(
  entity: MapEntity,
  claims: Claim[],
  threshold = DEFAULT_RICHNESS_THRESHOLD,
): boolean {
  if (threshold <= 0) return false
  return computeEntityRichness(entity, claims) >= threshold
}
