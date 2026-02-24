import { useState, useMemo, useEffect, useRef } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, GeoJSON, useMap } from "react-leaflet"
import { MapToolSelector } from "./MapToolSelector"
import { MapSearch } from "./MapSearch"
import { DrawControls } from "./DrawControls"
import { GeometryActionMenu } from "./GeometryActionMenu"
import { SymbolsLayer } from "./SymbolsLayer"
import { NetworkLinksLayer } from "./NetworkLinksLayer"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { getEntityDisplayPosition } from "@/utils/geometry"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

const markerIcon = L.divIcon({
  className: "map-entity-marker",
  html: "<span></span>",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

type MapTool = "pan" | "point" | "line" | "polygon"

function CenterOnSelection({
  selectedEntityId,
  entities,
  getEntityPosition,
}: {
  selectedEntityId: string | null
  entities: MapEntity[]
  getEntityPosition: (entity: MapEntity) => [number, number] | null
}) {
  const map = useMap()
  const lastSelectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedEntityId) {
      lastSelectedIdRef.current = null
      return
    }
    const entity = entities.find((e) => e.id === selectedEntityId)
    if (!entity) return

    const position = getEntityPosition(entity)
    if (!position) return

    const [lat, lng] = position
    const selectionChanged = lastSelectedIdRef.current !== selectedEntityId
    lastSelectedIdRef.current = selectedEntityId

    if (selectionChanged) {
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.3 })
      const timeoutId = setTimeout(() => {
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const marker = layer as L.Marker
            const pos = marker.getLatLng()
            if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
              marker.openPopup()
            }
          }
        })
      }, 350)
      return () => clearTimeout(timeoutId)
    }
  }, [selectedEntityId, entities, getEntityPosition, map])
  return null
}

type Bounds = { south: number; west: number; north: number; east: number }

const BASE_MAP_TILE_CONFIG: Record<
  BaseMapId,
  { url: string; attribution: string; overlay?: { url: string; attribution: string; subdomains?: string } }
> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    overlay: {
      url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
    },
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
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
  onMapBoundsChange?: (bounds: Bounds) => void
  showNetworks?: boolean
  baseMap?: BaseMapId
  onSelectOsmObject?: (
    type: "node" | "way" | "relation",
    id: number,
    cachedFeature?: GeoJSON.Feature & { id?: string }
  ) => void
}

function MapBoundsReporter({ onBoundsChange }: { onBoundsChange: (b: Bounds) => void }) {
  const map = useMap()
  useEffect(() => {
    const update = () => {
      const b = map.getBounds()
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      })
    }
    update()
    map.on("moveend", update)
    map.on("zoomend", update)
    return () => {
      map.off("moveend", update)
      map.off("zoomend", update)
    }
  }, [map, onBoundsChange])
  return null
}

const linkedOsmStyle = { color: "#2563eb", weight: 2, opacity: 0.8 }

/** OSM point features as small dots instead of default pin markers. */
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
  const [mapView] = useState({ center: { lat: 55.751244, lng: 37.618423 }, zoom: 5 })
  const [mapTool, setMapTool] = useState<MapTool>("pan")
  const [pendingGeometry, setPendingGeometry] = useState<DrawnGeometry | null>(null)

  // Deselect entity when entering edit mode
  useEffect(() => {
    if (mapTool !== "pan" && selectedEntityId !== null) {
      onSelectEntity(null)
    }
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

  const isDrawing = mapTool !== "pan"

  function handleGeometryCreated(geom: DrawnGeometry) {
    setPendingGeometry(geom)
    setMapTool("pan")
  }

  function handleCreateNew() {
    if (pendingGeometry) {
      onCreateNewEntity(pendingGeometry)
      setPendingGeometry(null)
    }
  }

  function handleLinkToExisting(entityId: string) {
    if (pendingGeometry) {
      onLinkGeometryToEntity(pendingGeometry, entityId)
      setPendingGeometry(null)
    }
  }

  function handleCancelGeometry() {
    setPendingGeometry(null)
  }

  const onSelectOsmObjectRef = useRef(onSelectOsmObject)
  const mapToolRef = useRef(mapTool)
  onSelectOsmObjectRef.current = onSelectOsmObject
  mapToolRef.current = mapTool

  /** Extract OSM type and id from a GeoJSON feature (osmtogeojson uses feature.id "way/123" or properties.id + type). */
  function getOsmTypeAndId(
    feature: GeoJSON.Feature & { id?: string }
  ): { type: "node" | "way" | "relation"; id: number } | null {
    const props = feature.properties as Record<string, unknown> | undefined

    // osmtogeojson puts "type/id" on the feature root (e.g. "way/1", "relation/3564026")
    const fid = feature.id
    if (typeof fid === "string") {
      const match = /^(node|way|relation)\/(\d+)$/.exec(fid)
      if (match) {
        const id = parseInt(match[2], 10)
        if (Number.isInteger(id)) return { type: match[1] as "node" | "way" | "relation", id }
      }
    }

    // Fallback: properties.id and type (or @id / @type)
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

  function onEachOsmFeature(feature: GeoJSON.Feature & { id?: string }, layer: L.Layer) {
    layer.on("click", () => {
      if (mapToolRef.current !== "pan" || !onSelectOsmObjectRef.current) return
      const parsed = getOsmTypeAndId(feature)
      if (parsed) onSelectOsmObjectRef.current(parsed.type, parsed.id, feature)
    })
  }

  return (
    <div className="relative h-full w-full">
      {!readOnly && pendingGeometry && (
        <GeometryActionMenu
          entities={entities}
          onCreateNew={handleCreateNew}
          onLinkToExisting={handleLinkToExisting}
          onCancel={handleCancelGeometry}
        />
      )}
      <MapContainer
        className="h-full w-full"
        center={[mapView.center.lat, mapView.center.lng]}
        zoom={mapView.zoom}
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
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />
        {tileConfig.overlay && (
          <TileLayer
            attribution={tileConfig.overlay.attribution}
            url={tileConfig.overlay.url}
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
              onEachFeature={onSelectOsmObject ? onEachOsmFeature : undefined}
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
              onEachFeature={onSelectOsmObject ? onEachOsmFeature : undefined}
            />
          ) : null
        )}
        {visibleLayersInOrder.flatMap((layer) => {
          if (layer.osmData) return []
          const geoms = drawnByLayerId.get(layer.id) ?? []
          return geoms.map((g) => {
            if (g.type === "point") {
              if (g.entityId != null) return null
              return (
                <Marker key={g.id} position={[g.lat, g.lng]} icon={markerIcon}>
                  <Popup>Unlinked point</Popup>
                </Marker>
              )
            }
            if (g.type === "line") {
              const positions = g.positions.map(([lat, lng]) => [lat, lng] as [number, number])
              return <Polyline key={g.id} positions={positions} />
            }
            if (g.type === "polygon") {
              const positions = g.rings[0]?.map(([lat, lng]) => [lat, lng] as [number, number]) ?? []
              return <Polygon key={g.id} positions={positions} />
            }
            return null
          })
        })}
        {!readOnly && isDrawing && defaultLayerId ? (
          <DrawControls
            enabled
            geometryType={mapTool}
            defaultLayerId={defaultLayerId}
            onCreated={handleGeometryCreated}
          />
        ) : null}
      </MapContainer>
    </div>
  )
}
