import type { ProposalDecision } from "@/store/enrichment.store"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal } from "@/types/enrichment.types"
import { parse } from "@/core/provenance/ledger"
import { dedupeSources, type Source } from "@/core/provenance/source"
import { GENERAL_CITATION_FIELD, type Claim } from "@/core/provenance/claim"
import { projectEntityLedger } from "@/core/provenance/ledgerProjection"
import { selectTopCitations } from "@/modules/enrichment/services/citation-rating"

export type AcceptedPatchResult = {
  patch: Partial<MapEntity> | null
  newSources: Source[]
  newClaims: Claim[]
}

/**
 * Builds the accepted-proposal patch (ADR 0006: the accept->merge logic "must be
 * reachable by every producer of claims"). Non-`sources` fields still land directly
 * in `patch`; citation URLs (from an accepted `sources` proposal and/or evidence URLs
 * on any other accepted proposal) become `Claim`s instead of a mutated string.
 *
 * Two distinct dedup layers, preserved from the pre-E2.6 `merge()`-based version:
 * (1) within-batch: `candidateUrls` collapses duplicates via `Set`, same as before.
 * (2) already-known-to-this-entity: compared against `projectEntityLedger`'s
 * reconstruction of this entity's current deduped citation list (what `entity.sources`
 * used to mean) rather than raw claim membership, so a claim to a *different* Source
 * record for the same URL still counts as "already known".
 * A third, separate identity layer — global `Source` reuse across entities — is
 * `dedupeSources`' job, applied only to genuinely-new URLs.
 */
export function buildAcceptedPatch(args: {
  decisions: Record<string, ProposalDecision>
  overlay: Record<string, unknown>
  proposals: EnrichmentProposal[]
  entity: MapEntity | null
  existingClaims: Claim[]
  existingSources: Source[]
}): AcceptedPatchResult | null {
  const { decisions, overlay, proposals, entity, existingClaims, existingSources } = args
  const hasAccepted = Object.values(decisions).some((d) => d === "accepted")
  if (!hasAccepted || !entity) return null

  const patch: Record<string, unknown> = {}

  for (const [field, decision] of Object.entries(decisions)) {
    if (decision === "accepted" && field !== "sources" && field in overlay) {
      patch[field] = overlay[field]
    }
  }

  const proposedUrls =
    decisions["sources"] === "accepted" && "sources" in overlay
      ? parse(String(overlay["sources"] ?? ""))
      : []

  const evidenceUrls = proposals
    .filter((p) => p.field !== "sources" && decisions[p.field] === "accepted")
    .flatMap((p) => selectTopCitations(p.citations).map((c) => c.url).filter(Boolean))

  const candidateUrls = [...new Set([...proposedUrls, ...evidenceUrls].map((u) => u.trim()).filter(Boolean))]
  const entityExistingUrls = new Set(projectEntityLedger(entity.id, existingClaims, existingSources))
  const trulyNewUrls = candidateUrls.filter((u) => !entityExistingUrls.has(u))

  const newSources: Source[] = []
  const newClaims: Claim[] = []
  if (trulyNewUrls.length > 0) {
    const merged = dedupeSources(trulyNewUrls, existingSources)
    newSources.push(...merged.slice(existingSources.length))
    const sourceByUrl = new Map(merged.map((s) => [s.url, s]))
    for (const url of trulyNewUrls) {
      const source = sourceByUrl.get(url)
      if (!source) continue
      newClaims.push({
        id: crypto.randomUUID(),
        entityId: entity.id,
        field: GENERAL_CITATION_FIELD,
        value: null,
        sourceId: source.id,
        credibility: null,
        timestamp: null,
      })
    }
  }

  if (Object.keys(patch).length === 0 && newClaims.length === 0) return null
  return { patch: Object.keys(patch).length > 0 ? (patch as Partial<MapEntity>) : null, newSources, newClaims }
}
