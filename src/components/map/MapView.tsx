import { useMemo, useEffect, useRef } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, GeoJSON } from "react-leaflet"
import { MapToolSelector } from "./MapToolSelector"
import { MapSearch } from "./MapSearch"
import { DrawControls } from "./DrawControls"
import { GeometryActionMenu } from "./GeometryActionMenu"
import { SymbolsLayer } from "./SymbolsLayer"
import { NetworkLinksLayer } from "./NetworkLinksLayer"
import { CenterOnSelection } from "./CenterOnSelection"
import { MapBoundsReporter, type MapBounds } from "./MapBoundsReporter"
import { useMapDrawing } from "./useMapDrawing"
import { BASE_MAP_TILE_CONFIG } from "./mapTileConfig"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { getEntityDisplayPosition } from "@/utils/geometry"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

const markerIcon = L.divIcon({
  className: "map-entity-marker",
  html: "<span></span>",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

const linkedOsmStyle = { color: "#2563eb", weight: 2, opacity: 0.8 }

function osmPointToLayer(_feature: GeoJSON.Feature, latlng: L.LatLngExpression): L.CircleMarker {
  return L.circleMarker(latlng, {
    radius: 4,
    fillColor: "#3388ff",
    color: "#2266cc",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.9,
  })
}

function getOsmTypeAndId(
  feature: GeoJSON.Feature & { id?: string }
): { type: "node" | "way" | "relation"; id: number } | null {
  const props = feature.properties as Record<string, unknown> | undefined

  const fid = feature.id
  if (typeof fid === "string") {
    const match = /^(node|way|relation)\/(\d+)$/.exec(fid)
    if (match) {
      const id = parseInt(match[2], 10)
      if (Number.isInteger(id)) return { type: match[1] as "node" | "way" | "relation", id }
    }
  }

  const id = (props?.["@id"] ?? props?.id) as number | undefined
  const type = (props?.["@type"] ?? props?.type) as string | undefined
  if (
    (type === "node" || type === "way" || type === "relation") &&
    typeof id === "number" &&
    Number.isInteger(id)
  ) {
    return { type, id }
  }
  return null
}

type Props = {
  readOnly?: boolean
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  entityOsmGeometries?: Record<string, GeoJSON.FeatureCollection>
  onCreateNewEntity: (geom: DrawnGeometry) => void
  onLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
  defaultLayerId: string
  selectedEntityId: string | null
  onSelectEntity: (id: string | null) => void
  onMapBoundsChange?: (bounds: MapBounds) => void
  showNetworks?: boolean
  baseMap?: BaseMapId
  onSelectOsmObject?: (
    type: "node" | "way" | "relation",
    id: number,
    cachedFeature?: GeoJSON.Feature & { id?: string }
  ) => void
}

export function MapView({
  readOnly = false,
  layers,
  entities,
  drawnGeometries,
  entityOsmGeometries = {},
  onCreateNewEntity,
  onLinkGeometryToEntity,
  defaultLayerId,
  selectedEntityId,
  onSelectEntity,
  onMapBoundsChange,
  showNetworks = false,
  baseMap = "osm",
  onSelectOsmObject,
}: Props) {
  const tileConfig = BASE_MAP_TILE_CONFIG[baseMap]

  const {
    mapTool,
    setMapTool,
    pendingGeometry,
    isDrawing,
    handleGeometryCreated,
    handleCreateNew,
    handleLinkToExisting,
    handleCancel,
  } = useMapDrawing({ onCreateNewEntity, onLinkGeometryToEntity })

  // Deselect entity when entering draw mode
  useEffect(() => {
    if (mapTool !== "pan" && selectedEntityId !== null) onSelectEntity(null)
  }, [mapTool, selectedEntityId, onSelectEntity])

  const visibleLayersInOrder = layers.filter((l) => l.visible)

  const drawnByLayerId = useMemo(() => {
    const m = new Map<string, DrawnGeometry[]>()
    for (const g of drawnGeometries) {
      const list = m.get(g.layerId) ?? []
      list.push(g)
      m.set(g.layerId, list)
    }
    return m
  }, [drawnGeometries])

  const visibleLayerIds = useMemo(
    () => new Set(visibleLayersInOrder.map((l) => l.id)),
    [visibleLayersInOrder],
  )

  const getEntityPosition = useMemo(
    () => (entity: MapEntity) => getEntityDisplayPosition(entity.id, drawnGeometries),
    [drawnGeometries],
  )

  // Stable refs so GeoJSON callbacks never capture stale closures
  const onSelectOsmObjectRef = useRef(onSelectOsmObject)
  const mapToolRef = useRef(mapTool)
  onSelectOsmObjectRef.current = onSelectOsmObject
  mapToolRef.current = mapTool

  function onEachOsmFeature(feature: GeoJSON.Feature & { id?: string }, layer: L.Layer) {
    layer.on("click", () => {
      if (mapToolRef.current !== "pan" || !onSelectOsmObjectRef.current) return
      const parsed = getOsmTypeAndId(feature)
      if (parsed) onSelectOsmObjectRef.current(parsed.type, parsed.id, feature)
    })
  }

  const osmFeatureHandlers = onSelectOsmObject ? onEachOsmFeature : undefined

  return (
    <div className="relative h-full w-full">
      {!readOnly && pendingGeometry && (
        <GeometryActionMenu
          entities={entities}
          onCreateNew={handleCreateNew}
          onLinkToExisting={handleLinkToExisting}
          onCancel={handleCancel}
        />
      )}
      <MapContainer
        className="h-full w-full"
        center={[55.751244, 37.618423]}
        zoom={5}
        zoomControl
      >
        <CenterOnSelection
          selectedEntityId={selectedEntityId}
          entities={entities}
          getEntityPosition={getEntityPosition}
        />
        {onMapBoundsChange && <MapBoundsReporter onBoundsChange={onMapBoundsChange} />}
        {!readOnly && <MapToolSelector mapTool={mapTool} onMapToolChange={setMapTool} />}
        <MapSearch />

        <TileLayer url={tileConfig.url} attribution={tileConfig.attribution} />
        {tileConfig.overlay && (
          <TileLayer
            url={tileConfig.overlay.url}
            attribution={tileConfig.overlay.attribution}
            subdomains={tileConfig.overlay.subdomains}
          />
        )}

        <SymbolsLayer
          entities={entities}
          drawnGeometries={drawnGeometries}
          visibleLayerIds={visibleLayerIds}
          onSelectEntity={onSelectEntity}
        />
        <NetworkLinksLayer
          entities={entities}
          drawnGeometries={drawnGeometries}
          selectedEntityId={selectedEntityId}
          visible={showNetworks}
        />

        {visibleLayersInOrder.map((layer) =>
          layer.osmData ? (
            <GeoJSON
              key={layer.id}
              data={layer.osmData}
              pointToLayer={osmPointToLayer}
              onEachFeature={osmFeatureHandlers}
            />
          ) : null
        )}

        {Object.entries(entityOsmGeometries).map(([entityId, fc]) =>
          fc.features.length > 0 ? (
            <GeoJSON
              key={`osm-${entityId}`}
              data={fc}
              pathOptions={linkedOsmStyle}
              pointToLayer={osmPointToLayer}
              onEachFeature={osmFeatureHandlers}
            />
          ) : null
        )}

        {visibleLayersInOrder.flatMap((layer) => {
          if (layer.osmData) return []
          return (drawnByLayerId.get(layer.id) ?? []).map((g) => {
            if (g.type === "point") {
              if (g.entityId != null) return null
              return (
                <Marker key={g.id} position={[g.lat, g.lng]} icon={markerIcon}>
                  <Popup>Unlinked point</Popup>
                </Marker>
              )
            }
            if (g.type === "line") {
              return (
                <Polyline
                  key={g.id}
                  positions={g.positions.map(([lat, lng]) => [lat, lng] as [number, number])}
                />
              )
            }
            if (g.type === "polygon") {
              return (
                <Polygon
                  key={g.id}
                  positions={g.rings[0]?.map(([lat, lng]) => [lat, lng] as [number, number]) ?? []}
                />
              )
            }
            return null
          })
        })}

        {!readOnly && isDrawing && defaultLayerId && (
          <DrawControls
            enabled
            geometryType={mapTool as "point" | "line" | "polygon"}
            defaultLayerId={defaultLayerId}
            onCreated={handleGeometryCreated}
          />
        )}
      </MapContainer>
    </div>
  )
}