import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentContext, EnrichmentProposal } from "@/types/enrichment.types"
import type { EntityResearchStatus } from "@/hooks/useLayeredResearch"
import type { LayeredResearchResult } from "@/services/research/layered-research.service"

export type EnrichmentControls = {
  isDrawerOpen: boolean
  selectedEntity: MapEntity | null
  context: EnrichmentContext | null
  overlay: Record<string, unknown>
  prompt: string
  status: "idle" | "running" | "success" | "partial" | "failed"
  queryTrace: string[]
  depthUsed: number
  unresolvedFields: string[]
  notes: string
  proposals: EnrichmentProposal[]
  decisions: Record<string, "accepted" | "rejected" | "pending">
  errorMessage: string | null
  closeNotice: string | null
  setPrompt: (value: string) => void
  openDrawer: () => void
  closeDrawer: () => void
  run: () => void
  accept: (proposal: EnrichmentProposal) => void
  reject: (proposal: EnrichmentProposal) => void
  ignore: (proposal: EnrichmentProposal) => void
  clearOverlayForSelected: () => void
}

export type LayeredResearchControls = {
  status: "idle" | "running" | "done" | "failed"
  progress: { entityId: string; name: string; layer: number; done: number; total: number } | null
  reviewQueueLength: number
  hasNextInQueue: boolean
  entityStatuses: Record<string, EntityResearchStatus>
  totalUsage: { inputTokens: number; outputTokens: number }
  cacheAdditions: Array<{ url: string; content: string }>
  lastStats: LayeredResearchResult["stats"] | null
  dialogOpen: boolean
  batchSize: number
  setBatchSize: (n: number) => void
  richnessThreshold: number
  setRichnessThreshold: (n: number) => void
  skipAnalyzedWithinDays: number
  setSkipAnalyzedWithinDays: (n: number) => void
  hasProcessedEntities: boolean
  openDialog: () => void
  closeDialog: () => void
  onRun: () => void
  onCancel: () => void
  onReviewNext: () => void
}
