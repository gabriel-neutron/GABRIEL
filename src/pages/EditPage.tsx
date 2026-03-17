import { useState, useCallback, useEffect } from "react"
import { MainLayout } from "@/components/shared/MainLayout"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
} from "@/services/geopackage.service"
import { loadProject, saveProject, clearProject } from "@/services/projectStorage.service"
import { fetchRelationGeometry } from "@/services/overpass.service"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

type SelectedOsmObject = {
  type: "node" | "way" | "relation"
  id: number
  cachedFeature?: GeoJSON.Feature & { id?: string }
} | null

export type EditPageProps = {
  onViewMode?: () => void
  onOpenAbout?: () => void
}

const EMPTY_ENTITIES: MapEntity[] = []
const EMPTY_GEOMETRIES: DrawnGeometry[] = []

function entityFromGeometry(geom: DrawnGeometry, defaultLayerId: string, parentId: string | null): MapEntity {
  const id = crypto.randomUUID()
  const layerId = geom.layerId ?? defaultLayerId
  return {
    id,
    name: "New entity",
    layerId,
    parentId,
    affiliation: "Hostile",
  }
}

export function EditPage({ onViewMode, onOpenAbout }: EditPageProps): React.ReactElement {
  const [layers, setLayers] = useState<Layer[]>(() => getDefaultEchelonLayers())
  const [entities, setEntities] = useState<MapEntity[]>(EMPTY_ENTITIES)
  const [drawnGeometries, setDrawnGeometries] = useState<DrawnGeometry[]>(EMPTY_GEOMETRIES)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedOsmObject, setSelectedOsmObject] = useState<SelectedOsmObject>(null)
  const [showNetworks, setShowNetworks] = useState(true)
  const [baseMap, setBaseMap] = useState<BaseMapId>("osm")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entityOsmGeometries, setEntityOsmGeometries] = useState<Record<string, GeoJSON.FeatureCollection>>({})
  const [restoredFromSession, setRestoredFromSession] = useState(false)

  useEffect(function restoreSession() {
    loadProject().then((stored) => {
      if (!stored) return
      loadGeoPackage(stored.buffer)
        .then((result) => {
          const next = applyGeoPackageResult(result, null)
          setLayers(next.layers)
          setEntities(next.entities)
          setDrawnGeometries(next.drawnGeometries)
          setSelectedEntityId(next.selectedEntityId)
          setRestoredFromSession(true)
        })
        .catch(() => {})
    })
  }, [])

  useEffect(
    function clearRestoredBanner() {
      if (!restoredFromSession) return
      const t = setTimeout(() => setRestoredFromSession(false), 4000)
      return () => clearTimeout(t)
    },
    [restoredFromSession],
  )

  useEffect(
    function fetchOsmRelationGeometries() {
      const entityIdsWithRelation = new Set(
        entities.filter((e) => e.osmRelationId != null).map((e) => e.id),
      )
      setEntityOsmGeometries((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if (!entityIdsWithRelation.has(id)) delete next[id]
        }
        return next
      })
      for (const e of entities) {
        if (e.osmRelationId == null) continue
        const relationId = e.osmRelationId
        const entityId = e.id
        fetchRelationGeometry(relationId).then(
          (fc) => setEntityOsmGeometries((prev) => ({ ...prev, [entityId]: fc })),
          () => {},
        )
      }
    },
    [entities],
  )

  function setLayerVisible(id: string, visible: boolean): void {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible } : l)))
  }

  function setLayerExpanded(id: string, expanded: boolean): void {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, expanded } : l)))
  }

  function addLayer(layer: Layer): void {
    setLayers((prev) => [...prev, layer])
  }

  function addNewLayer(): void {
    const id = crypto.randomUUID()
    const names = layers.filter((l) => l.kind === "custom" || l.osmData != null).map((l) => l.name)
    let name = "New layer"
    for (let n = 1; names.includes(name); n++) name = `New layer ${n}`
    addLayer({ id, name, visible: true, expanded: true, kind: "custom" })
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

  const defaultLayerId = layers.filter((l) => l.osmData == null)[0]?.id ?? ""

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

  function handleCloseDetail(): void {
    setSelectedEntityId(null)
    setSelectedOsmObject(null)
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
        expanded: l.expanded,
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
  }, [writeGeoPackageToFile])

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
      await saveProject(buffer, { fileName: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
      console.error("loadGeoPackage failed", e)
    } finally {
      setBusy(false)
    }
  }, [])

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
      expanded: l.expanded,
      kind: l.kind ?? (l.osmData != null ? ("osm" as const) : undefined),
      sourceQuery: l.sourceQuery,
      osmData: l.osmData,
    }))
    setBusy(true)
    setError(null)
    try {
      const bytes = await saveGeoPackage(gpkgLayers, persistedEntities, persistedGeometries)
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
      setLayerExpanded={setLayerExpanded}
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
      handleCloseDetail={handleCloseDetail}
      busy={busy}
      error={error}
      onNewProject={handleNewProject}
      onOpenProject={handleOpenProject}
      onSaveProject={handleSaveProject}
    />
  )
}
