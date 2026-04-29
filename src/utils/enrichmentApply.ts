import type { ProposalDecision } from "@/store/enrichment.store"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal } from "@/types/enrichment.types"

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

  const existingUrls =
    typeof entity?.sources === "string"
      ? entity.sources.split("\n").map((s) => s.trim()).filter(Boolean)
      : []

  const proposedUrls =
    decisions["sources"] === "accepted" && "sources" in overlay
      ? String(overlay["sources"] ?? "").split("\n").map((s) => s.trim()).filter(Boolean)
      : []

  const evidenceUrls = proposals
    .filter((p) => p.field !== "sources" && decisions[p.field] === "accepted")
    .flatMap((p) => p.sources.map((s) => s.url).filter(Boolean))

  const mergedUrls = [...new Set([...existingUrls, ...proposedUrls, ...evidenceUrls])]
  const mergedSources = mergedUrls.join("\n")

  if (mergedSources !== (entity?.sources ?? "")) {
    patch.sources = mergedSources || null
  }

  if (Object.keys(patch).length === 0) return null
  return patch as Partial<MapEntity>
}
