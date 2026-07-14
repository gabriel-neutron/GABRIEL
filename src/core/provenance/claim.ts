import type { AdmiraltyCredibility } from "./admiralty"
import type { CredibilityMeta } from "./ratingMeta"

/**
 * ADR 0006: a specific asserted fact linked to the specific `Source` that asserts it.
 * `field: "sources"` with `value: null` is the sentinel used for a general citation not
 * tied to any one field (the shape every existing citation currently has — E2 does not
 * invent per-field attribution that isn't already in the data, see ROADMAP.md's E2 note).
 */
export type Claim = {
  id: string
  entityId: string
  field: string
  value: string | null
  sourceId: string
  credibility: AdmiraltyCredibility | null
  timestamp: string | null
  /** Provenance for `credibility` (assessor, evidence, corroboration clusters). Opt-in, like `Source.reliabilityMeta` — absent until Phase 3's AI pass or a human override sets it. */
  credibilityMeta?: CredibilityMeta
}

export const GENERAL_CITATION_FIELD = "sources"

/** This entity's general-citation claims — the predicate every citation-count/richness/gating call site needs. */
export function filterCitationClaims(claims: Claim[], entityId: string): Claim[] {
  return claims.filter((c) => c.entityId === entityId && c.field === GENERAL_CITATION_FIELD)
}

/**
 * Groups every general-citation claim by entityId, once, instead of each caller re-filtering
 * the full `claims` array per entity — the difference between O(claims) and O(entities x claims)
 * for a caller that needs per-entity claims across many entities (e.g. a research batch or a
 * dialog rendering one row per entity).
 */
export function groupCitationClaimsByEntityId(claims: Claim[]): Map<string, Claim[]> {
  const byEntityId = new Map<string, Claim[]>()
  for (const c of claims) {
    if (c.field !== GENERAL_CITATION_FIELD) continue
    const list = byEntityId.get(c.entityId)
    if (list) list.push(c)
    else byEntityId.set(c.entityId, [c])
  }
  return byEntityId
}

/**
 * Phase 6 (v2, exploratory): a claim about one specific reported item — `field`/`value`
 * were always part of the shape (ADR 0006), this just gives per-field attribution a
 * named constructor instead of only the general-citation sentinel. `filterCitationClaims`
 * / `groupCitationClaimsByEntityId` only ever select `field === GENERAL_CITATION_FIELD`,
 * so a per-field claim is invisible to the general-citation path by construction — it
 * can carry its own `credibility` via the same `assessEntityCredibility` pass (which
 * already takes `field`/`value` as plain parameters, not hardcoded to "sources")
 * without that path needing to change at all.
 */
export function createFieldClaim(entityId: string, sourceId: string, field: string, value: string | null): Claim {
  return {
    id: crypto.randomUUID(),
    entityId,
    field,
    value,
    sourceId,
    credibility: null,
    timestamp: null,
  }
}

/** A general-citation claim linking `entityId` to `sourceId` — the shape every producer of citation claims needs. */
export function createCitationClaim(entityId: string, sourceId: string): Claim {
  return createFieldClaim(entityId, sourceId, GENERAL_CITATION_FIELD, null)
}
