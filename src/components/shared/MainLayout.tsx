import { MapView } from "@/components/map/MapView"
import { EntityInspector } from "@/components/inspector/EntityInspector"
import { OsmObjectInspector } from "@/components/inspector/OsmObjectInspector"
import { AppShell } from "@/components/shared/AppShell"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"
import { TreeView } from "@/components/tree/TreeView"
import { OsmQueryMenu } from "@/components/shared/OsmQueryMenu"
import { BaseMapSwitcher, type BaseMapId } from "@/components/shared/BaseMapSwitcher"
import { ModeToggle } from "@/components/shared/ModeToggle"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"

type SelectedOsmObject = {
  type: "node" | "way" | "relation"
  id: number
  cachedFeature?: GeoJSON.Feature & { id?: string }
} | null

export type MainLayoutProps = {
  readOnly: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  selectedEntityId: string | null
  setSelectedEntityId: (id: string | null) => void
  selectedOsmObject: SelectedOsmObject
  setSelectedOsmObject: (v: SelectedOsmObject) => void
  showNetworks: boolean
  setShowNetworks: (v: boolean) => void
  baseMap: BaseMapId
  setBaseMap: (v: BaseMapId) => void
  entityOsmGeometries: Record<string, GeoJSON.FeatureCollection>
  restoredFromSession?: boolean
  setLayerVisible: (id: string, visible: boolean) => void
  setLayerExpanded: (id: string, expanded: boolean) => void
  removeLayer: (id: string) => void
  renameLayer: (layerId: string, name: string) => void
  addNewLayer: () => void
  handleDeleteEntity: (entityId: string) => void
  moveLayer: (layerId: string, direction: "up" | "down") => void
  addLayer: (layer: Layer) => void
  handleCreateNewEntity: (geom: DrawnGeometry) => void
  handleLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
  handleUpdateEntity: (entityId: string, patch: Partial<MapEntity>) => void
  handleDeleteGeometry: (geometryId: string) => void
  handleSelectOsmObject: (type: "node" | "way" | "relation", id: number, cachedFeature?: GeoJSON.Feature & { id?: string }) => void
  handleCloseDetail: () => void
  busy: boolean
  error: string | null
  onNewProject: () => void
  onOpenProject: (file: File) => void
  onSaveProject: () => void
}

const noop = () => {}

export function MainLayout({
  readOnly,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
  layers,
  entities,
  drawnGeometries,
  selectedEntityId,
  setSelectedEntityId,
  selectedOsmObject,
  setSelectedOsmObject,
  showNetworks,
  setShowNetworks,
  baseMap,
  setBaseMap,
  entityOsmGeometries,
  restoredFromSession = false,
  setLayerVisible,
  setLayerExpanded,
  removeLayer,
  renameLayer,
  addNewLayer,
  handleDeleteEntity,
  moveLayer,
  addLayer,
  handleCreateNewEntity,
  handleLinkGeometryToEntity,
  handleUpdateEntity,
  handleDeleteGeometry,
  handleSelectOsmObject,
  handleCloseDetail,
  busy,
  error,
  onNewProject,
  onOpenProject,
  onSaveProject,
}: MainLayoutProps) {
  const defaultLayerId = layers.filter((l) => l.osmData == null)[0]?.id ?? ""
  const assignableLayers = layers.filter((l) => l.osmData == null)

  return (
    <AppShell
      readOnly={readOnly}
      onOpenAbout={onOpenAbout}
      onSwitchToEdit={onSwitchToEdit}
      onSwitchToView={onSwitchToView}
      mapSlot={
        <MapView
          readOnly={readOnly}
          layers={layers}
          entities={entities}
          drawnGeometries={drawnGeometries}
          entityOsmGeometries={entityOsmGeometries}
          onCreateNewEntity={handleCreateNewEntity}
          onLinkGeometryToEntity={handleLinkGeometryToEntity}
          defaultLayerId={defaultLayerId}
          selectedEntityId={selectedEntityId}
          onSelectEntity={(id) => {
            setSelectedEntityId(id)
            setSelectedOsmObject(null)
          }}
          onSelectOsmObject={handleSelectOsmObject}
          showNetworks={showNetworks}
          baseMap={baseMap}
        />
      }
      treeSlot={
        <TreeView
          entities={entities}
          selectedEntityId={selectedEntityId}
          onSelectEntity={setSelectedEntityId}
        />
      }
      leftSlot={
        <LayersPanel
          readOnly={readOnly}
          layers={layers}
          entities={entities}
          selectedEntityId={selectedEntityId}
          onSelectEntity={setSelectedEntityId}
          onToggleVisible={setLayerVisible}
          onToggleExpanded={setLayerExpanded}
          onRemoveLayer={removeLayer}
          onRenameLayer={renameLayer}
          onAddLayer={addNewLayer}
          onRemoveEntity={handleDeleteEntity}
          onMoveLayer={moveLayer}
        />
      }
      headerSlot={
        <>
          {!readOnly && restoredFromSession && (
            <span className="text-muted-foreground text-xs">Project restored from last session</span>
          )}
          <ShowNetworksToggle checked={showNetworks} onCheckedChange={setShowNetworks} />
          <BaseMapSwitcher value={baseMap} onValueChange={setBaseMap} />
          {!readOnly && <OsmQueryMenu layers={layers} onAddLayer={addLayer} />}
          <ModeToggle />
        </>
      }
      selectedEntityId={selectedEntityId}
      selectedOsmObject={selectedOsmObject}
      onCloseDetail={handleCloseDetail}
      rightSlot={
        selectedOsmObject ? (
          <OsmObjectInspector
            type={selectedOsmObject.type}
            id={selectedOsmObject.id}
            cachedFeature={selectedOsmObject.cachedFeature}
          />
        ) : (
          <EntityInspector
            readOnly={readOnly}
            selectedEntityId={selectedEntityId}
            entities={entities}
            layers={assignableLayers}
            drawnGeometries={drawnGeometries}
            onUpdateEntity={handleUpdateEntity}
            onDeleteEntity={handleDeleteEntity}
            onDeleteGeometry={handleDeleteGeometry}
          />
        )
      }
      busy={busy}
      error={error}
      onNewProject={onNewProject}
      onOpenProject={onOpenProject}
      onSaveProject={onSaveProject}
      canUndo={false}
      canRedo={false}
      onUndo={noop}
      onRedo={noop}
      historyBusy={false}
      historyError={null}
    />
  )
}
