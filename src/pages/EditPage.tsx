import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { MainLayout } from "@/shell/MainLayout"
import { ToastStack, type ToastItem } from "@/components/shared/ToastStack"
import { useProjectStore } from "@/store/useProjectStore"
import { useSourceCacheStore } from "@/store/useSourceCacheStore"
import { useEnrichment } from "@/modules/enrichment/hooks/useEnrichment"
import { useLayeredResearch } from "@/modules/enrichment/hooks/useLayeredResearch"
import { useProjectIO } from "@/hooks/useProjectIO"

export type EditPageProps = {
  onViewMode?: () => void
  onOpenAbout?: () => void
}

export function EditPage({ onViewMode, onOpenAbout }: EditPageProps): React.ReactElement {
  const { entities, drawnGeometries, selectedEntityId, updateEntity, addEntity, addGeometry, setSelectedEntityId } =
    useProjectStore()
  const { sourceCache, mergeSourceCache } = useSourceCacheStore()

  const { busy, error, restoredFromSession, handleNew, handleOpen, handleSave } = useProjectIO()

  const handleCreateNewOrganisation = useCallback((geom: DrawnGeometry) => {
    const org: MapEntity = {
      kind: "corporate",
      id: crypto.randomUUID(),
      name: "New organisation",
      type: "company",
      layerId: INDUSTRY_LAYER_ID,
      parentId: null,
      notes: null,
      sources: null,
      osmRelationId: null,
      positionMode: "own",
      isExactPosition: false,
    }
    addEntity(org)
    addGeometry({ ...geom, layerId: INDUSTRY_LAYER_ID, entityId: org.id })
    setSelectedEntityId(org.id)
  }, [addEntity, addGeometry, setSelectedEntityId])

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const enrichment = useEnrichment({
    entities,
    drawnGeometries,
    selectedEntityId,
    onApplyAccepted: updateEntity,
  })

  const layeredResearch = useLayeredResearch(entities, drawnGeometries, {
    onEntityAnalyzed: (entityId, analyzedAt) => {
      updateEntity(entityId, { analyzedAt })
    },
  })

  useEffect(() => {
    if (layeredResearch.cacheAdditions.length === 0) return
    mergeSourceCache(layeredResearch.cacheAdditions)
  }, [layeredResearch.cacheAdditions, mergeSourceCache])

  useEffect(() => {
    if (layeredResearch.lastWarnings.length === 0) return
    setToasts((prev) => {
      const seen = new Set(prev.map((item) => item.id))
      const additions: ToastItem[] = []
      for (const warning of layeredResearch.lastWarnings) {
        const id = `${warning.source}:${warning.entityId}:${warning.message}`
        if (seen.has(id)) continue
        additions.push({
          id,
          title:
            warning.source === "overpass"
              ? `OSM endpoint issue (${warning.name})`
              : `Research failed (${warning.name})`,
          description: warning.message,
        })
      }
      if (additions.length === 0) return prev
      return [...prev, ...additions].slice(-4)
    })
  }, [layeredResearch.lastWarnings])

  const isBatchReviewRef = useRef(false)

  const handleReviewNext = useCallback(() => {
    const entityId = layeredResearch.nextInQueue
    if (!entityId) return
    const result = layeredResearch.getResult(entityId)
    if (!result) return
    useProjectStore.getState().setSelectedEntityId(entityId)
    isBatchReviewRef.current = true
    enrichment.loadBatchResult(result)
  }, [layeredResearch, enrichment])

  const handleCloseEnrichmentDrawer = useCallback(() => {
    const outcome = enrichment.closeDrawer()
    if (outcome.closed && isBatchReviewRef.current) {
      isBatchReviewRef.current = false
      layeredResearch.advanceQueue()
    }
  }, [enrichment, layeredResearch])

  const enrichmentRef = useRef(enrichment)
  useLayoutEffect(() => {
    enrichmentRef.current = enrichment
  })

  useEffect(() => {
    if (!enrichment.allProposalsResolved || !isBatchReviewRef.current) return

    const enrich = enrichmentRef.current
    const finishBatch = (): void => {
      isBatchReviewRef.current = false
      enrich.forceCloseDrawer()
    }

    enrich.advanceBatchReview()
    const nextEntityId = layeredResearch.reviewQueue[1] ?? null
    layeredResearch.advanceQueue()

    if (!nextEntityId) {
      finishBatch()
      return
    }
    const result = layeredResearch.getResult(nextEntityId)
    if (!result) {
      finishBatch()
      return
    }
    useProjectStore.getState().setSelectedEntityId(nextEntityId)
    enrich.loadBatchResult(result)
  }, [
    enrichment.allProposalsResolved,
    layeredResearch,
    layeredResearch.reviewQueue,
    layeredResearch.advanceQueue,
    layeredResearch.getResult,
  ])

  return (
    <>
      <MainLayout
        readOnly={false}
        onOpenAbout={onOpenAbout}
        onSwitchToView={onViewMode}
        restoredFromSession={restoredFromSession}
        busy={busy}
        error={error}
        projectFileActions={{
          onNewProject: handleNew,
          onOpenProject: handleOpen,
          onSaveProject: handleSave,
        }}
        onCreateNewOrganisation={handleCreateNewOrganisation}
        onOverpassUnavailable={() =>
          setToasts((prev) =>
            [
              ...prev,
              {
                id: `overpass-unavailable-${Date.now()}`,
                title: "OSM endpoint unavailable",
                description: "Overpass API could not be reached. OSM relation boundaries are unavailable.",
              },
            ].slice(-4),
          )
        }
        enrichment={{
          isDrawerOpen: enrichment.isDrawerOpen,
          selectedEntity: enrichment.selectedEntity,
          context: enrichment.context,
          overlay: enrichment.overlay,
          prompt: enrichment.draftPrompt,
          status: enrichment.runStatus,
          queryTrace: enrichment.queryTrace,
          depthUsed: enrichment.depthUsed,
          unresolvedFields: enrichment.unresolvedFields,
          unresolvedReasons: enrichment.unresolvedReasons,
          conflicts: enrichment.conflicts,
          notes: enrichment.notes,
          proposals: enrichment.proposals,
          decisions: enrichment.decisions,
          errorMessage: enrichment.runError,
          closeNotice: enrichment.closeNotice,
          setPrompt: enrichment.setDraftPrompt,
          openDrawer: enrichment.openDrawer,
          closeDrawer: handleCloseEnrichmentDrawer,
          run: enrichment.run,
          accept: enrichment.accept,
          reject: enrichment.reject,
          clearOverlayForSelected: enrichment.clearOverlayForSelected,
        }}
        layeredResearch={{
          status: layeredResearch.status,
          progress: layeredResearch.progress,
          reviewQueueLength: layeredResearch.reviewQueue.length,
          hasNextInQueue: layeredResearch.nextInQueue !== null,
          entityStatuses: layeredResearch.entityStatuses,
          totalUsage: layeredResearch.totalUsage,
          cacheAdditions: layeredResearch.cacheAdditions,
          lastStats: layeredResearch.lastStats,
          dialogOpen: layeredResearch.dialogOpen,
          batchSize: layeredResearch.batchSize,
          setBatchSize: layeredResearch.setBatchSize,
          richnessThreshold: layeredResearch.richnessThreshold,
          setRichnessThreshold: layeredResearch.setRichnessThreshold,
          skipAnalyzedWithinDays: layeredResearch.skipAnalyzedWithinDays,
          setSkipAnalyzedWithinDays: layeredResearch.setSkipAnalyzedWithinDays,
          hasProcessedEntities: layeredResearch.hasProcessedEntities,
          openDialog: layeredResearch.openDialog,
          closeDialog: layeredResearch.closeDialog,
          onRun: () => layeredResearch.run(sourceCache),
          onCancel: layeredResearch.cancel,
          onReviewNext: handleReviewNext,
        }}
      />
      <ToastStack items={toasts} onDismiss={handleDismissToast} />
    </>
  )
}
