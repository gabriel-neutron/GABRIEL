import type { ProposalDecision } from "@/store/enrichment.store"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal } from "@/types/enrichment.types"
import * as provenanceLedger from "@/services/enrichment/provenance-ledger"

export function buildAcceptedPatch(args: {
  decisions: Record<string, ProposalDecision>
  overlay: Record<string, unknown>
  proposals: EnrichmentProposal[]
  entity: MapEntity | null
}): Partial<MapEntity> | null {
  const { decisions, overlay, proposals, entity } = args
  const hasAccepted = Object.values(decisions).some((d) => d === "accepted")
  if (!hasAccepted) return null

  const patch: Record<string, unknown> = {}

  for (const [field, decision] of Object.entries(decisions)) {
    if (decision === "accepted" && field !== "sources" && field in overlay) {
      patch[field] = overlay[field]
    }
  }

  const proposedUrls =
    decisions["sources"] === "accepted" && "sources" in overlay
      ? provenanceLedger.parse(String(overlay["sources"] ?? ""))
      : []

  const evidenceUrls = proposals
    .filter((p) => p.field !== "sources" && decisions[p.field] === "accepted")
    .flatMap((p) => provenanceLedger.selectTopCitations(p.citations).map((c) => c.url).filter(Boolean))

  const merged = provenanceLedger.merge(entity?.sources, [...proposedUrls, ...evidenceUrls])
  const existingNormalized = provenanceLedger.serialize(provenanceLedger.parse(entity?.sources))

  if (merged !== existingNormalized) {
    patch.sources = merged
  }

  if (Object.keys(patch).length === 0) return null
  return patch as Partial<MapEntity>
}
