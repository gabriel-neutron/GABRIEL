import { useCallback, useRef, useState } from "react"
import {
  runLayeredResearch,
  buildBfsLayers,
  type LayeredResearchResult,
} from "@/services/research/layered-research.service"
import { DEFAULT_RICHNESS_THRESHOLD } from "@/services/research/entity-richness"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentResponse } from "@/types/enrichment.types"

export type EntityResearchStatus =
  | "pending"       // in BFS queue, not yet started
  | "running"       // currently being enriched
  | "done"          // completed with actionable proposals
  | "done-empty"    // completed, no proposals found
  | "failed"        // attempted but failed
  | "skipped-rich"  // skipped — entity already has enough information
  | "skipped-abort" // skipped — run was stopped before this entity

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
  const [status, setStatus] = useState<LayeredResearchStatus>("idle")
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [batchResults, setBatchResults] = useState<Record<string, EnrichmentResponse>>({})
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [cacheAdditions, setCacheAdditions] = useState<Array<{ url: string; content: string }>>([])
  const [lastStats, setLastStats] = useState<LayeredResearchResult["stats"] | null>(null)
  const [entityStatuses, setEntityStatuses] = useState<Record<string, EntityResearchStatus>>({})
  const [totalUsage, setTotalUsage] = useState({ inputTokens: 0, outputTokens: 0 })
  const [lastWarnings, setLastWarnings] = useState<LayeredResearchWarning[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchSize, setBatchSize] = useState(20)
  const [richnessThreshold, setRichnessThreshold] = useState(DEFAULT_RICHNESS_THRESHOLD)

  const abortRef = useRef<AbortController | null>(null)
  /**
   * Persists across multiple batch runs so "Continue" skips already-processed
   * entities without re-running them.
   */
  const processedEntityIdsRef = useRef<Set<string>>(new Set())

  const run = useCallback(
    async (sourceCache: Map<string, string>) => {
      const controller = new AbortController()
      abortRef.current = controller

      // Build the BFS order upfront so the dialog can show the full entity list
      const bfsLayers = buildBfsLayers(entities)
      const orderedIds = bfsLayers.flat().map((e) => e.id)

      // Initialise statuses: already-processed keep their status, rest become pending
      setEntityStatuses((prev) => {
        const next: Record<string, EntityResearchStatus> = {}
        for (const id of orderedIds) {
          next[id] = processedEntityIdsRef.current.has(id) ? (prev[id] ?? "done-empty") : "pending"
        }
        return next
      })

      setStatus("running")
      setProgress(null)
      setCacheAdditions([])
      setLastStats(null)
      setLastWarnings([])
      // Preserve batchResults and reviewQueue from previous batches

      try {
        const result = await runLayeredResearch(entities, drawnGeometries, {
          sourceCache,
          maxEntities: batchSize,
          skipEntityIds: processedEntityIdsRef.current,
          richnessThreshold,
          signal: controller.signal,

          onProgress: ({ entityId, name, layer, done, total }) => {
            setProgress({ entityId, name, layer, done, total })
            setEntityStatuses((prev) => ({ ...prev, [entityId]: "running" }))
          },

          onEntityComplete: (entityId, response, usage) => {
            const analyzedAt = new Date().toISOString()
            // Update incrementally so UI reflects results without waiting for full run
            setBatchResults((prev) => ({ ...prev, [entityId]: response }))
            if ((response.proposals?.length ?? 0) > 0) {
              setReviewQueue((prev) =>
                prev.includes(entityId) ? prev : [...prev, entityId],
              )
            }
            setEntityStatuses((prev) => ({
              ...prev,
              [entityId]: response.proposals.length > 0 ? "done" : "done-empty",
            }))
            setTotalUsage((prev) => ({
              inputTokens: prev.inputTokens + usage.estimatedInputTokens,
              outputTokens: prev.outputTokens + usage.estimatedOutputTokens,
            }))
            processedEntityIdsRef.current.add(entityId)
            onEntityAnalyzed?.(entityId, analyzedAt)
          },
        })

        // Merge cache additions from the final result (authoritative, de-duped by service)
        setCacheAdditions(result.cacheAdditions)

        // Apply final statuses for entities the service marked as skipped
        setEntityStatuses((prev) => {
          const next = { ...prev }
          for (const id of result.failedEntityIds) {
            next[id] = "failed"
            processedEntityIdsRef.current.add(id)
          }
          for (const id of result.skippedRichEntityIds) {
            next[id] = "skipped-rich"
          }
          for (const id of result.skippedEntityIds) {
            if (!processedEntityIdsRef.current.has(id)) {
              next[id] = "skipped-abort"
            }
          }
          return next
        })

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
    [entities, drawnGeometries, batchSize, richnessThreshold, onEntityAnalyzed],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const getResult = useCallback(
    (entityId: string): EnrichmentResponse | null => batchResults[entityId] ?? null,
    [batchResults],
  )

  const nextInQueue = reviewQueue[0] ?? null

  const advanceQueue = useCallback(() => {
    setReviewQueue((q) => q.slice(1))
  }, [])

  return {
    // Run state
    status,
    progress,
    reviewQueue,
    nextInQueue,
    getResult,
    advanceQueue,
    run,
    cancel,
    cacheAdditions,
    lastStats,
    lastWarnings,
    // Live per-entity status map (for the dialog)
    entityStatuses,
    // Aggregated token totals across all batches
    totalUsage,
    // Dialog open/close
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    // Batch controls
    batchSize,
    setBatchSize,
    richnessThreshold,
    setRichnessThreshold,
    // True when a previous batch has run (changes "Start" label to "Continue")
    hasProcessedEntities: processedEntityIdsRef.current.size > 0,
  }
}
