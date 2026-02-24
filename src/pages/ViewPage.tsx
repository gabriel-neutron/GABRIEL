import { useState, useEffect } from "react"
import { MainLayout } from "@/components/shared/MainLayout"
import { loadGeoPackage, applyGeoPackageResult, getDefaultEchelonLayers } from "@/services/geopackage.service"
import { fetchRelationGeometry } from "@/services/overpass.service"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

export type ViewPageProps = {
  onEditMode?: () => void
  onOpenAbout?: () => void
}

type SelectedOsmObject = {
  type: "node" | "way" | "relation"
  id: number
  cachedFeature?: GeoJSON.Feature & { id?: string }
} | null

const EMPTY_ENTITIES: MapEntity[] = []
const EMPTY_GEOMETRIES: DrawnGeometry[] = []

const READ_ONLY_HANDLERS = {
  removeLayer: (_id: string) => {},
  renameLayer: (_layerId: string, _name: string) => {},
  addNewLayer: () => {},
  handleDeleteEntity: (_entityId: string) => {},
  moveLayer: (_layerId: string, _dir: "up" | "down") => {},
  addLayer: (_layer: Layer) => {},
  handleCreateNewEntity: (_geom: DrawnGeometry) => {},
  handleLinkGeometryToEntity: (_geom: DrawnGeometry, _entityId: string) => {},
  handleUpdateEntity: (_entityId: string, _patch: Partial<MapEntity>) => {},
  handleDeleteGeometry: (_geometryId: string) => {},
  handleSelectOsmObject: (_type: "node" | "way" | "relation", _id: number, _f?: GeoJSON.Feature & { id?: string }) => {},
  handleCloseDetail: () => {},
  onNewProject: () => {},
  onOpenProject: (_file: File) => {},
  onSaveProject: () => {},
} as const

export function ViewPage({ onEditMode, onOpenAbout }: ViewPageProps): React.ReactElement {
  const [layers, setLayers] = useState<Layer[]>(() => getDefaultEchelonLayers())
  const [entities, setEntities] = useState<MapEntity[]>(EMPTY_ENTITIES)
  const [drawnGeometries, setDrawnGeometries] = useState<DrawnGeometry[]>(EMPTY_GEOMETRIES)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedOsmObject, setSelectedOsmObject] = useState<SelectedOsmObject>(null)
  const [showNetworks, setShowNetworks] = useState(false)
  const [baseMap, setBaseMap] = useState<BaseMapId>("osm")
  const [entityOsmGeometries, setEntityOsmGeometries] = useState<Record<string, GeoJSON.FeatureCollection>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(function loadDemoProject() {
    fetch("/demo.gpkg")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load demo project")
        return res.arrayBuffer()
      })
      .then((buffer) => loadGeoPackage(buffer))
      .then((result) => {
        const next = applyGeoPackageResult(result, null)
        setLayers(next.layers)
        setEntities(next.entities)
        setDrawnGeometries(next.drawnGeometries)
        setSelectedEntityId(next.selectedEntityId)
        setLoadError(null)
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : "Failed to load demo")
        console.error("ViewPage load demo.gpkg failed", e)
      })
  }, [])

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
        fetchRelationGeometry(e.osmRelationId).then(
          (fc) => setEntityOsmGeometries((prev) => ({ ...prev, [e.id]: fc })),
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

  if (loadError !== null) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-background p-4 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    )
  }

  return (
    <MainLayout
      readOnly
      onOpenAbout={onOpenAbout}
      onSwitchToEdit={onEditMode}
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
      setLayerVisible={setLayerVisible}
      setLayerExpanded={setLayerExpanded}
      removeLayer={READ_ONLY_HANDLERS.removeLayer}
      renameLayer={READ_ONLY_HANDLERS.renameLayer}
      addNewLayer={READ_ONLY_HANDLERS.addNewLayer}
      handleDeleteEntity={READ_ONLY_HANDLERS.handleDeleteEntity}
      moveLayer={READ_ONLY_HANDLERS.moveLayer}
      addLayer={READ_ONLY_HANDLERS.addLayer}
      handleCreateNewEntity={READ_ONLY_HANDLERS.handleCreateNewEntity}
      handleLinkGeometryToEntity={READ_ONLY_HANDLERS.handleLinkGeometryToEntity}
      handleUpdateEntity={READ_ONLY_HANDLERS.handleUpdateEntity}
      handleDeleteGeometry={READ_ONLY_HANDLERS.handleDeleteGeometry}
      handleSelectOsmObject={READ_ONLY_HANDLERS.handleSelectOsmObject}
      handleCloseDetail={READ_ONLY_HANDLERS.handleCloseDetail}
      busy={false}
      error={null}
      onNewProject={READ_ONLY_HANDLERS.onNewProject}
      onOpenProject={READ_ONLY_HANDLERS.onOpenProject}
      onSaveProject={READ_ONLY_HANDLERS.onSaveProject}
    />
  )
}
