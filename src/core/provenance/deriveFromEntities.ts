import { parse } from "./ledger"
import { dedupeSources, type Source } from "./source"
import { GENERAL_CITATION_FIELD, createCitationClaim, type Claim } from "./claim"

export interface EntityLedgerInput {
  id: string
  sources?: string | null
}

/**
 * Derives `Source`/`Claim` records from every entity's legacy string ledger, merging
 * with whatever was already persisted (ADR 0006). `entity.sources` no longer exists as
 * of Slice B (E2.6) — callers pass the legacy raw column value(s) explicitly via
 * `EntityLedgerInput.sources` instead (see `load.ts`), which is why this function takes
 * a standalone input shape rather than `Entity` itself. Idempotent by construction:
 * calling this again with its own prior output as `existingSources`/`existingClaims`
 * adds nothing new — this is the invariant that prevents the load-twice/save-twice
 * duplication bug class the legacy `organisations` table hit before it was fixed (see
 * ROADMAP.md's E1.7).
 */
export function deriveProvenanceFromEntities(
  entities: EntityLedgerInput[],
  existingSources: Source[],
  existingClaims: Claim[],
): { sources: Source[]; claims: Claim[] } {
  const allUrls = entities.flatMap((e) => parse(e.sources))
  const sources = dedupeSources(allUrls, existingSources)
  const sourceByUrl = new Map(sources.map((s) => [s.url, s]))

  const claimKey = (entityId: string, sourceId: string): string => `${entityId} ${sourceId}`
  const seenClaimKeys = new Set(
    existingClaims
      .filter((c) => c.field === GENERAL_CITATION_FIELD)
      .map((c) => claimKey(c.entityId, c.sourceId)),
  )

  const newClaims: Claim[] = []
  for (const entity of entities) {
    for (const url of parse(entity.sources)) {
      const source = sourceByUrl.get(url)
      if (!source) continue
      const key = claimKey(entity.id, source.id)
      if (seenClaimKeys.has(key)) continue
      seenClaimKeys.add(key)
      newClaims.push(createCitationClaim(entity.id, source.id))
    }
  }

  return { sources, claims: [...existingClaims, ...newClaims] }
}
