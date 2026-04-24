import { useState, useCallback, useEffect, useRef } from "react"
import { MainLayout } from "@/components/shared/MainLayout"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
} from "@/services/geopackage.service"
import { loadProject, saveProject, clearProject } from "@/services/projectStorage.service"
import { useMapProjectState } from "@/hooks/useMapProjectState"
import { useEnrichment } from "@/hooks/useEnrichment"
import { useLayeredResearch } from "@/hooks/useLayeredResearch"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
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
  const p = useMapProjectState({ initialShowNetworks: true })
  const {
    layers,
    setLayers,
    entities,
    setEntities,
    drawnGeometries,
    setDrawnGeometries,
    selectedEntityId,
    setSelectedEntityId,
    selectedOsmObject,
    setSelectedOsmObject,
    showNetworks,
    setShowNetworks,
    baseMap,
    setBaseMap,
    entityOsmGeometries,
    setLayerVisible,
    handleCloseDetail: hookHandleCloseDetail,
  } = p

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  const [sourceCache, setSourceCache] = useState<Map<string, string>>(() => new Map())
  const enrichment = useEnrichment({
    entities,
    drawnGeometries,
    selectedEntityId,
    onApplyAccepted: handleUpdateEntity,
  })
  const layeredResearch = useLayeredResearch(entities, drawnGeometries)

  // When a batch run finishes, merge new URL→snippet pairs into sourceCache.
  useEffect(() => {
    if (layeredResearch.cacheAdditions.length === 0) return
    setSourceCache((prev) => {
      const next = new Map(prev)
      for (const { url, content } of layeredResearch.cacheAdditions) {
        next.set(url, content)
      }
      return next
    })
  }, [layeredResearch.cacheAdditions])

  // Tracks whether the enrichment drawer was opened via a batch result so we
  // can advance the review queue when it closes.
  const isBatchReviewRef = useRef(false)

  useEffect(function restoreSession() {
    let mounted = true
    loadProject().then((stored) => {
      if (!stored || !mounted) return
      loadGeoPackage(stored.buffer)
        .then((result) => {
          if (!mounted) return
          const next = applyGeoPackageResult(result, null)
          setLayers(next.layers)
          setEntities(next.entities)
          setDrawnGeometries(next.drawnGeometries)
          setSelectedEntityId(next.selectedEntityId)
          setSourceCache(result.sourceCache)
          setRestoredFromSession(true)
        })
        .catch(() => {})
    })
    return () => { mounted = false }
  }, [setLayers, setEntities, setDrawnGeometries, setSelectedEntityId])

  useEffect(
    function clearRestoredBanner() {
      if (!restoredFromSession) return
      const t = setTimeout(() => setRestoredFromSession(false), 4000)
      return () => clearTimeout(t)
    },
    [restoredFromSession],
  )

  function addLayer(layer: Layer): void {
    setLayers((prev) => [...prev, layer])
  }

  function addNewLayer(): void {
    const id = crypto.randomUUID()
    const names = layers.filter((l) => l.kind === "custom" || l.osmData != null).map((l) => l.name)
    let name = "New layer"
    for (let n = 1; names.includes(name); n++) name = `New layer ${n}`
    addLayer({ id, name, visible: true, kind: "custom" })
  }

  function renameLayer(layerId: string, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l)))
  }

  function removeLayer(id: string): void {
    const layer = layers.find((l) => l.id === id)
    if (layer?.kind === "echelon") return
    const isOsm = layer?.osmData != null
    if (!isOsm && !window.confirm("Remove this layer and all its entities and geometries?")) return
    setLayers((prev) => prev.filter((l) => l.id !== id))
    setEntities((prev) => prev.filter((e) => e.layerId !== id))
    setDrawnGeometries((prev) => prev.filter((g) => g.layerId !== id))
    const removedEntityIds = new Set(entities.filter((e) => e.layerId === id).map((e) => e.id))
    setSelectedEntityId((prev) => (prev && removedEntityIds.has(prev) ? null : prev))
  }

  function moveLayer(layerId: string, direction: "up" | "down"): void {
    setLayers((prev) => {
      const i = prev.findIndex((l) => l.id === layerId)
      if (i < 0) return prev
      if (direction === "up" && i === 0) return prev
      if (direction === "down" && i === prev.length - 1) return prev
      const next = [...prev]
      const j = direction === "up" ? i - 1 : i + 1
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const defaultLayerId = getDefaultEntityLayerId(layers)

  function handleCreateNewEntity(geom: DrawnGeometry): void {
    const entity = entityFromGeometry(geom, defaultLayerId, selectedEntityId)
    setEntities((prev) => [...prev, entity])
    setDrawnGeometries((prev) => [...prev, { ...geom, entityId: entity.id }])
    setSelectedOsmObject(null)
    setSelectedEntityId(entity.id)
  }

  function handleLinkGeometryToEntity(geom: DrawnGeometry, entityId: string): void {
    setDrawnGeometries((prev) => [...prev, { ...geom, entityId }])
    setSelectedOsmObject(null)
    setSelectedEntityId(entityId)
  }

  function handleDeleteEntity(entityId: string): void {
    if (!window.confirm("Delete this entity and all its linked geometries?")) return
    setEntities((prev) => prev.filter((e) => e.id !== entityId))
    setDrawnGeometries((prev) => prev.filter((g) => g.entityId !== entityId))
    setSelectedEntityId((prev) => (prev === entityId ? null : prev))
  }

  function handleDeleteGeometry(geometryId: string): void {
    setDrawnGeometries((prev) => prev.filter((g) => g.id !== geometryId))
  }

  function handleUpdateEntity(entityId: string, patch: Partial<MapEntity>): void {
    setEntities((prev) => prev.map((e) => (e.id === entityId ? { ...e, ...patch } : e)))
    if (patch.layerId !== undefined) {
      setDrawnGeometries((prev) =>
        prev.map((g) => (g.entityId === entityId ? { ...g, layerId: patch.layerId! } : g)),
      )
    }
  }

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
    setLayers(() => getDefaultEchelonLayers())
    setEntities(() => [])
    setDrawnGeometries(() => [])
    setSelectedEntityId(null)
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
  }, [setLayers, setEntities, setDrawnGeometries, setSelectedEntityId, writeGeoPackageToFile])

  const handleOpenProject = useCallback(async (file: File): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await loadGeoPackage(buffer)
      const next = applyGeoPackageResult(result, null)
      setLayers(next.layers)
      setEntities(next.entities)
      setDrawnGeometries(next.drawnGeometries)
      setSelectedEntityId(next.selectedEntityId)
      setSourceCache(result.sourceCache)
      await saveProject(buffer, { fileName: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
      console.error("loadGeoPackage failed", e)
    } finally {
      setBusy(false)
    }
  }, [setLayers, setEntities, setDrawnGeometries, setSelectedEntityId])

  const handleSaveProject = useCallback(async (): Promise<void> => {
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
  }, [layers, entities, drawnGeometries, writeGeoPackageToFile])

  // Opens the next entity in the batch review queue and loads its pre-computed
  // result into the enrichment drawer.
  const handleReviewNext = useCallback(() => {
    const entityId = layeredResearch.nextInQueue
    if (!entityId) return
    const result = layeredResearch.getResult(entityId)
    if (!result) return
    setSelectedEntityId(entityId)
    isBatchReviewRef.current = true
    enrichment.loadBatchResult(result)
  }, [layeredResearch, enrichment, setSelectedEntityId])

  // Wraps the normal closeDrawer so the review queue advances after the user
  // manually closes the drawer while in batch-review mode.
  const handleCloseEnrichmentDrawer = useCallback(() => {
    const outcome = enrichment.closeDrawer()
    if (outcome.closed && isBatchReviewRef.current) {
      isBatchReviewRef.current = false
      layeredResearch.advanceQueue()
    }
  }, [enrichment, layeredResearch])

  // Keep a stable ref to the latest enrichment object so the auto-advance
  // effect can read current methods without them being in the dep array
  // (which would cause the effect to re-fire on every state change).
  const enrichmentRef = useRef(enrichment)
  enrichmentRef.current = enrichment

  // Auto-advance: when every proposal for the current entity has been
  // accepted or rejected, immediately apply the accepted patches, pop the
  // queue, and load the next entity — without requiring the user to close
  // and reopen the drawer.
  useEffect(() => {
    if (!enrichment.allProposalsResolved || !isBatchReviewRef.current) return

    const enrich = enrichmentRef.current
    enrich.advanceBatchReview()

    // Peek at the entity that will become the new head after we advance
    const nextEntityId = layeredResearch.reviewQueue[1] ?? null
    layeredResearch.advanceQueue()

    if (nextEntityId) {
      const result = layeredResearch.getResult(nextEntityId)
      if (result) {
        setSelectedEntityId(nextEntityId)
        enrich.loadBatchResult(result)
      } else {
        // Result missing (shouldn't happen) — end batch review
        isBatchReviewRef.current = false
        enrich.forceCloseDrawer()
      }
    } else {
      // Queue exhausted — close the drawer and exit batch mode
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
      removeLayer={removeLayer}
      renameLayer={renameLayer}
      addNewLayer={addNewLayer}
      handleDeleteEntity={handleDeleteEntity}
      moveLayer={moveLayer}
      addLayer={addLayer}
      handleCreateNewEntity={handleCreateNewEntity}
      handleLinkGeometryToEntity={handleLinkGeometryToEntity}
      handleUpdateEntity={handleUpdateEntity}
      handleDeleteGeometry={handleDeleteGeometry}
      handleSelectOsmObject={handleSelectOsmObject}
      handleCloseDetail={hookHandleCloseDetail}
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
        hasProcessedEntities: layeredResearch.hasProcessedEntities,
        openDialog: layeredResearch.openDialog,
        closeDialog: layeredResearch.closeDialog,
        onRun: () => layeredResearch.run(sourceCache),
        onCancel: layeredResearch.cancel,
        onReviewNext: handleReviewNext,
      }}
    />
  )
}
