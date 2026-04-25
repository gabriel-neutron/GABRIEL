import { useState, useCallback, useEffect, useRef } from "react"
import { MainLayout } from "@/components/shared/MainLayout"
import { ToastStack, type ToastItem } from "@/components/shared/ToastStack"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
} from "@/services/geopackage.service"
import { loadProject, saveProject, clearProject } from "@/services/projectStorage.service"
import { useProjectStore } from "@/store/useProjectStore"
import { useOsmRelationGeometries } from "@/hooks/useOsmRelationGeometries"
import { useEnrichment } from "@/hooks/useEnrichment"
import { useLayeredResearch } from "@/hooks/useLayeredResearch"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { getDefaultEntityLayerId } from "@/utils/entityLayer"

export type EditPageProps = {
  onViewMode?: () => void
  onOpenAbout?: () => void
}

function entityFromGeometry(geom: DrawnGeometry, defaultLayerId: string, parentId: string | null): MapEntity {
  const id = crypto.randomUUID()
  const layerId = geom.layerId ?? defaultLayerId
  return {
    id,
    name: "New entity",
    layerId,
    parentId,
    affiliation: "Hostile",
    isExactPosition: false,
  }
}

export function EditPage({ onViewMode, onOpenAbout }: EditPageProps): React.ReactElement {
  const {
    layers,
    entities,
    drawnGeometries,
    selectedEntityId,
    selectedOsmObject,
    showNetworks,
    baseMap,
    entityOsmGeometries,
    sourceCache,
    setSelectedEntityId,
    setSelectedOsmObject,
    closeDetail,
    setShowNetworks,
    setBaseMap,
    setLayerVisible,
    addLayer,
    addNewLayer,
    renameLayer,
    removeLayer,
    moveLayer,
    updateEntity,
    deleteEntity,
    deleteGeometry,
    mergeSourceCache,
    setProject,
    resetProject,
  } = useProjectStore()

  useOsmRelationGeometries()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoredFromSession, setRestoredFromSession] = useState(false)
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

  useEffect(function restoreSession() {
    let mounted = true
    loadProject().then((stored) => {
      if (!stored || !mounted) return
      loadGeoPackage(stored.buffer)
        .then((result) => {
          if (!mounted) return
          const next = applyGeoPackageResult(result, null)
          setProject({
            layers: next.layers,
            entities: next.entities,
            drawnGeometries: next.drawnGeometries,
            selectedEntityId: next.selectedEntityId,
            sourceCache: result.sourceCache,
          })
          setRestoredFromSession(true)
        })
        .catch(() => {})
    })
    return () => { mounted = false }
  }, [setProject])

  useEffect(
    function clearRestoredBanner() {
      if (!restoredFromSession) return
      const t = setTimeout(() => setRestoredFromSession(false), 4000)
      return () => clearTimeout(t)
    },
    [restoredFromSession],
  )

  function handleDeleteEntity(entityId: string): void {
    if (!window.confirm("Delete this entity and all its linked geometries?")) return
    deleteEntity(entityId)
  }

  function handleRemoveLayer(id: string): void {
    const layer = layers.find((l) => l.id === id)
    if (layer?.kind === "echelon") return
    const isOsm = layer?.osmData != null
    if (!isOsm && !window.confirm("Remove this layer and all its entities and geometries?")) return
    removeLayer(id)
  }

  const handleCreateNewEntity = useCallback((geom: DrawnGeometry): void => {
    const s = useProjectStore.getState()
    const defaultLayerId = getDefaultEntityLayerId(s.layers)
    const entity = entityFromGeometry(geom, defaultLayerId, s.selectedEntityId)
    s.addEntity(entity)
    s.addGeometry({ ...geom, entityId: entity.id })
    s.setSelectedOsmObject(null)
    s.setSelectedEntityId(entity.id)
  }, [])

  const handleLinkGeometryToEntity = useCallback((geom: DrawnGeometry, entityId: string): void => {
    const s = useProjectStore.getState()
    s.addGeometry({ ...geom, entityId })
    s.setSelectedOsmObject(null)
    s.setSelectedEntityId(entityId)
  }, [])

  function handleSelectOsmObject(
    type: "node" | "way" | "relation",
    id: number,
    cachedFeature?: GeoJSON.Feature & { id?: string },
  ): void {
    setSelectedOsmObject({ type, id, cachedFeature })
    setSelectedEntityId(null)
  }

  const writeGeoPackageToFile = useCallback(async (bytes: Uint8Array): Promise<void> => {
    const showSave = (window as Window & { showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle> })
      .showSaveFilePicker
    if (typeof showSave === "function") {
      const handle = await showSave.call(window, {
        suggestedName: "project.gpkg",
        types: [{ description: "GeoPackage", accept: { "application/octet-stream": [".gpkg"] } }],
      })
      const writable = await handle.createWritable()
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      await writable.write(new Uint8Array(buffer))
      await writable.close()
    } else {
      const blob = new Blob([bytes.slice()], { type: "application/octet-stream" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `gabriel-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.gpkg`
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }, [])

  const handleNewProject = useCallback(async (): Promise<void> => {
    resetProject()
    setError(null)
    setRestoredFromSession(false)
    clearProject().catch(() => {})
    setBusy(true)
    try {
      const defaultLayers = getDefaultEchelonLayers()
      const gpkgLayers: GpkgLayer[] = defaultLayers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        kind: l.kind,
      }))
      const bytes = await saveGeoPackage(gpkgLayers, [], [])
      await writeGeoPackageToFile(bytes)
      window.alert("New project created.")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "Failed to create project")
      console.error("handleNewProject failed", e)
    } finally {
      setBusy(false)
    }
  }, [resetProject, writeGeoPackageToFile])

  const handleOpenProject = useCallback(async (file: File): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await loadGeoPackage(buffer)
      const next = applyGeoPackageResult(result, null)
      useProjectStore.getState().setProject({
        layers: next.layers,
        entities: next.entities,
        drawnGeometries: next.drawnGeometries,
        selectedEntityId: next.selectedEntityId,
        sourceCache: result.sourceCache,
      })
      await saveProject(buffer, { fileName: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
      console.error("loadGeoPackage failed", e)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSaveProject = useCallback(async (): Promise<void> => {
    const { layers, entities, drawnGeometries, sourceCache } = useProjectStore.getState()
    const nonOsmLayerIds = new Set(layers.filter((l) => l.osmData == null).map((l) => l.id))
    const persistedEntities = entities
      .filter((e) => nonOsmLayerIds.has(e.layerId))
      .map((e) => {
        const trimmedName = e.name.trim()
        return { ...e, name: trimmedName === "" ? "Untitled" : trimmedName }
      })
    const persistedGeometries = drawnGeometries.filter((g) => nonOsmLayerIds.has(g.layerId))
    const gpkgLayers: GpkgLayer[] = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      kind: l.kind ?? (l.osmData != null ? ("osm" as const) : undefined),
      sourceQuery: l.sourceQuery,
      osmData: l.osmData,
    }))
    setBusy(true)
    setError(null)
    try {
      const bytes = await saveGeoPackage(gpkgLayers, persistedEntities, persistedGeometries, sourceCache)
      await writeGeoPackageToFile(bytes)
      const buffer = new ArrayBuffer(bytes.length)
      new Uint8Array(buffer).set(bytes)
      await saveProject(buffer)
      window.alert("Saved successfully")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "Save failed")
      console.error("saveGeoPackage failed", e)
    } finally {
      setBusy(false)
    }
  }, [writeGeoPackageToFile])

  const handleReviewNext = useCallback(() => {
    const entityId = layeredResearch.nextInQueue
    if (!entityId) return
    const result = layeredResearch.getResult(entityId)
    if (!result) return
    setSelectedEntityId(entityId)
    isBatchReviewRef.current = true
    enrichment.loadBatchResult(result)
  }, [layeredResearch, enrichment, setSelectedEntityId])

  const handleCloseEnrichmentDrawer = useCallback(() => {
    const outcome = enrichment.closeDrawer()
    if (outcome.closed && isBatchReviewRef.current) {
      isBatchReviewRef.current = false
      layeredResearch.advanceQueue()
    }
  }, [enrichment, layeredResearch])

  const enrichmentRef = useRef(enrichment)
  enrichmentRef.current = enrichment

  useEffect(() => {
    if (!enrichment.allProposalsResolved || !isBatchReviewRef.current) return

    const enrich = enrichmentRef.current
    enrich.advanceBatchReview()

    const nextEntityId = layeredResearch.reviewQueue[1] ?? null
    layeredResearch.advanceQueue()

    if (nextEntityId) {
      const result = layeredResearch.getResult(nextEntityId)
      if (result) {
        setSelectedEntityId(nextEntityId)
        enrich.loadBatchResult(result)
      } else {
        isBatchReviewRef.current = false
        enrich.forceCloseDrawer()
      }
    } else {
      isBatchReviewRef.current = false
      enrich.forceCloseDrawer()
    }
  }, [
    enrichment.allProposalsResolved,
    layeredResearch.reviewQueue,
    layeredResearch.advanceQueue,
    layeredResearch.getResult,
    setSelectedEntityId,
  ])

  const projectFileActions = {
    onNewProject: handleNewProject,
    onOpenProject: handleOpenProject,
    onSaveProject: handleSaveProject,
  }

  return (
    <>
      <MainLayout
        readOnly={false}
        onOpenAbout={onOpenAbout}
        onSwitchToView={onViewMode}
        layers={layers}
        entities={entities}
        drawnGeometries={drawnGeometries}
        selectedEntityId={selectedEntityId}
        setSelectedEntityId={setSelectedEntityId}
        selectedOsmObject={selectedOsmObject}
        setSelectedOsmObject={setSelectedOsmObject}
        showNetworks={showNetworks}
        setShowNetworks={setShowNetworks}
        baseMap={baseMap}
        setBaseMap={setBaseMap}
        entityOsmGeometries={entityOsmGeometries}
        restoredFromSession={restoredFromSession}
        setLayerVisible={setLayerVisible}
        removeLayer={handleRemoveLayer}
        renameLayer={renameLayer}
        addNewLayer={addNewLayer}
        handleDeleteEntity={handleDeleteEntity}
        moveLayer={moveLayer}
        addLayer={addLayer}
        handleCreateNewEntity={handleCreateNewEntity}
        handleLinkGeometryToEntity={handleLinkGeometryToEntity}
        handleUpdateEntity={updateEntity}
        handleDeleteGeometry={deleteGeometry}
        handleSelectOsmObject={handleSelectOsmObject}
        handleCloseDetail={closeDetail}
        busy={busy}
        error={error}
        projectFileActions={projectFileActions}
        enrichment={{
          isDrawerOpen: enrichment.isDrawerOpen,
          selectedEntity: enrichment.selectedEntity,
          context: enrichment.context,
          overlay: enrichment.overlay,
          prompt: enrichment.draftPrompt,
          status: enrichment.state.run.status,
          queryTrace: enrichment.state.run.queryTrace,
          depthUsed: enrichment.state.run.depthUsed,
          unresolvedFields: enrichment.state.run.unresolvedFields,
          notes: enrichment.state.run.notes,
          proposals: enrichment.state.run.proposals,
          decisions:
            enrichment.selectedEntityId == null
              ? {}
              : enrichment.state.decisions[enrichment.selectedEntityId] ?? {},
          errorMessage: enrichment.state.run.error?.details ?? null,
          closeNotice: enrichment.closeNotice,
          setPrompt: enrichment.setDraftPrompt,
          openDrawer: enrichment.openDrawer,
          closeDrawer: handleCloseEnrichmentDrawer,
          run: enrichment.run,
          accept: enrichment.accept,
          reject: enrichment.reject,
          ignore: enrichment.ignore,
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
      <ToastStack
        items={toasts}
        onDismiss={handleDismissToast}
      />
    </>
  )
}
