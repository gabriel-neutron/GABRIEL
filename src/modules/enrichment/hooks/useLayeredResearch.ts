import { useCallback, useRef, useState } from "react"
import {
  runLayeredResearch,
  buildBfsLayers,
  type LayeredResearchResult,
} from "@/modules/enrichment/services/research/layered-research.service"
import { DEFAULT_RICHNESS_THRESHOLD } from "@/modules/enrichment/services/research/entity-richness"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentResponse } from "@/types/enrichment.types"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import {
  advanceReviewQueue,
  applyBatchOutcome,
  hasProcessedEntities as computeHasProcessedEntities,
  INITIAL_RESEARCH_PROGRESS_STATE,
  markEntityCompleted,
  markEntityRunning,
  startResearchBatch,
  type EntityResearchStatus,
  type ResearchProgressState,
} from "@/store/researchProgress.store"

export type { EntityResearchStatus }

type LayeredResearchStatus = "idle" | "running" | "done" | "failed"

type ProgressState = {
  entityId: string
  name: string
  layer: number
  done: number
  total: number
}

export type LayeredResearchWarning = LayeredResearchResult["warnings"][number]

type UseLayeredResearchOptions = {
  onEntityAnalyzed?: (entityId: string, analyzedAt: string) => void
}

export function useLayeredResearch(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  options: UseLayeredResearchOptions = {},
) {
  const { onEntityAnalyzed } = options
  const claims = useProjectStore((s) => s.claims)
  const provenanceSources = useProvenanceStore((s) => s.sources)
  const [status, setStatus] = useState<LayeredResearchStatus>("idle")
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [batchResults, setBatchResults] = useState<Record<string, EnrichmentResponse>>({})
  const [cacheAdditions, setCacheAdditions] = useState<Array<{ url: string; content: string }>>([])
  const [lastStats, setLastStats] = useState<LayeredResearchResult["stats"] | null>(null)
  const [researchProgress, setResearchProgress] = useState<ResearchProgressState>(
    INITIAL_RESEARCH_PROGRESS_STATE,
  )
  const [lastWarnings, setLastWarnings] = useState<LayeredResearchWarning[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchSize, setBatchSize] = useState(20)
  const [richnessThreshold, setRichnessThreshold] = useState(DEFAULT_RICHNESS_THRESHOLD)
  const [skipAnalyzedWithinDays, setSkipAnalyzedWithinDays] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const buildRecentAnalyzedEntityIds = useCallback((): Set<string> => {
    if (skipAnalyzedWithinDays <= 0) return new Set()
    const nowMs = Date.now()
    const windowMs = skipAnalyzedWithinDays * 24 * 60 * 60 * 1000
    return new Set(
      entities
        .filter((entity) => {
          if (!entity.analyzedAt) return false
          const analyzedMs = Date.parse(entity.analyzedAt)
          return Number.isFinite(analyzedMs) && nowMs - analyzedMs <= windowMs
        })
        .map((entity) => entity.id),
    )
  }, [entities, skipAnalyzedWithinDays])

  const run = useCallback(
    async (sourceCache: Map<string, string>) => {
      const controller = new AbortController()
      abortRef.current = controller

      // Build the BFS order upfront so the dialog can show the full entity list
      const bfsLayers = buildBfsLayers(entities)
      const orderedIds = bfsLayers.flat().map((e) => e.id)
      const recentAnalyzedEntityIds = buildRecentAnalyzedEntityIds()
      const combinedSkipEntityIds = new Set<string>([
        ...Object.keys(researchProgress.processedEntityIds),
        ...recentAnalyzedEntityIds,
      ])

      // Initialise statuses: already-processed keep their status, rest become pending
      setResearchProgress((current) =>
        startResearchBatch(current, { orderedIds, recentAnalyzedEntityIds }),
      )

      setStatus("running")
      setProgress(null)
      setCacheAdditions([])
      setLastStats(null)
      setLastWarnings([])
      // Preserve batchResults and reviewQueue from previous batches

      try {
        const result = await runLayeredResearch(entities, drawnGeometries, {
          sourceCache,
          claims,
          sources: provenanceSources,
          maxEntities: batchSize,
          skipEntityIds: combinedSkipEntityIds,
          richnessThreshold,
          signal: controller.signal,

          onProgress: ({ entityId, name, layer, done, total }) => {
            setProgress({ entityId, name, layer, done, total })
            setResearchProgress((current) => markEntityRunning(current, entityId))
          },

          onEntityComplete: (entityId, response, usage) => {
            const analyzedAt = new Date().toISOString()
            // Update incrementally so UI reflects results without waiting for full run
            setBatchResults((prev) => ({ ...prev, [entityId]: response }))
            const proposalsCount = response.proposals?.length ?? 0
            setResearchProgress((current) =>
              markEntityCompleted(current, { entityId, proposalsCount, usage }),
            )
            onEntityAnalyzed?.(entityId, analyzedAt)
          },
        })

        // Merge cache additions from the final result (authoritative, de-duped by service)
        setCacheAdditions(result.cacheAdditions)

        // Apply final statuses for entities the service marked as skipped/failed
        setResearchProgress((current) => applyBatchOutcome(current, result))

        setLastStats(result.stats)
        setLastWarnings(result.warnings)
        setStatus("done")
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError")
        setStatus(isAbort ? "idle" : "failed")
      } finally {
        abortRef.current = null
        setProgress(null)
      }
    },
    [
      entities,
      drawnGeometries,
      claims,
      provenanceSources,
      batchSize,
      richnessThreshold,
      onEntityAnalyzed,
      buildRecentAnalyzedEntityIds,
      researchProgress,
    ],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const getResult = useCallback(
    (entityId: string): EnrichmentResponse | null => batchResults[entityId] ?? null,
    [batchResults],
  )

  const nextInQueue = researchProgress.reviewQueue[0] ?? null

  const advanceQueue = useCallback(() => {
    setResearchProgress((current) => advanceReviewQueue(current))
  }, [])

  return {
    // Run state
    status,
    progress,
    reviewQueue: researchProgress.reviewQueue,
    nextInQueue,
    getResult,
    advanceQueue,
    run,
    cancel,
    cacheAdditions,
    lastStats,
    lastWarnings,
    // Live per-entity status map (for the dialog)
    entityStatuses: researchProgress.entityStatuses,
    // Aggregated token totals across all batches
    totalUsage: researchProgress.totalUsage,
    // Dialog open/close
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    // Batch controls
    batchSize,
    setBatchSize,
    richnessThreshold,
    setRichnessThreshold,
    skipAnalyzedWithinDays,
    setSkipAnalyzedWithinDays,
    // True when a previous batch has run (changes "Start" label to "Continue")
    hasProcessedEntities: computeHasProcessedEntities(researchProgress),
  }
}
