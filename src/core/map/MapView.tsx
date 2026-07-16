import { useMemo, useEffect, useRef, useCallback, type ReactNode } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, GeoJSON, useMap } from "react-leaflet"
import { MapToolSelector } from "./MapToolSelector"
import { DrawControls } from "./DrawControls"
import { GeometryActionMenu } from "./GeometryActionMenu"
import { CenterOnSelection } from "./CenterOnSelection"
import { useMapDrawing } from "./useMapDrawing"
import { BASE_MAP_TILE_CONFIG, BASE_TILE_OPTIONS } from "./mapTileConfig"
import type { DrawnGeometry } from "@/types/domain.types"
import { MapBoundsReporter } from "./MapBoundsReporter"
import { useMapViewStore } from "./useMapViewStore"
import { usePositionMap } from "./usePositionMap"
import { selectEntity, selectPeripheral } from "./selection"
import { useProjectStore } from "@/store/useProjectStore"
import { useMapPrefsStore } from "@/store/useMapPrefsStore"
import { useOsmViewStore } from "@/store/useOsmViewStore"
import { useOsmRelationGeometries } from "@/modules/osm/hooks/useOsmRelationGeometries"

type FlyToFn = (lat: number, lng: number, zoom?: number) => void

function selectOsmObject(feature: GeoJSON.Feature & { id?: string }) {
  const parsed = getOsmTypeAndId(feature)
  if (!parsed) return
  selectPeripheral({
    kind: "osm",
    id: `${parsed.type}:${parsed.id}`,
    meta: { ...parsed, cachedFeature: feature },
  })
}

function MapInstanceBridge({ flyToRef }: { flyToRef: React.RefObject<FlyToFn | null> }) {
  const map = useMap()
  useEffect(() => {
    flyToRef.current = (lat, lng, zoom = 14) => map.flyTo([lat, lng], zoom, { duration: 0.4 })
    return () => { flyToRef.current = null }
  }, [map, flyToRef])
  return null
}

function MapSizeSync() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    let resizeTimer: number | null = null
    const RESIZE_SETTLE_MS = 140
    const flushResize = () => {
      resizeTimer = null
      map.invalidateSize({ animate: false })
    }
    const observer = new ResizeObserver(() => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(flushResize, RESIZE_SETTLE_MS)
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
    }
  }, [map])
  return null
}

function BottomLeftZoomControl() {
  const map = useMap()
  useEffect(() => {
    const zoom = L.control.zoom({ position: "bottomleft" }).addTo(map)
    return () => {
      zoom.remove()
    }
  }, [map])
  return null
}

/** Deselects the current entity when entering a draw tool. Subscribes to selection locally so MapView itself doesn't re-render on selection changes. */
function DeselectOnDrawMode({ mapTool }: { mapTool: string }) {
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  useEffect(() => {
    if (mapTool !== "pan" && selectedEntityId !== null) selectEntity(null)
  }, [mapTool, selectedEntityId])
  return null
}

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
  onCreateNewEntity: (geom: DrawnGeometry) => void
  onCreateNewOrganisation?: (geom: DrawnGeometry) => void
  onLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
  defaultLayerId: string
  onOverpassUnavailable?: () => void
  flyToRef?: React.RefObject<FlyToFn | null>
  /** Composed by `shell/moduleRegistry.ts` (ADR 0007) — replaces named orbat layer imports. */
  mapLayers?: ReactNode[]
}

export function MapView({
  readOnly = false,
  onCreateNewEntity,
  onCreateNewOrganisation,
  onLinkGeometryToEntity,
  defaultLayerId,
  onOverpassUnavailable,
  flyToRef,
  mapLayers = [],
}: Props): React.ReactElement {
  const layers = useProjectStore((s) => s.layers)
  const entities = useProjectStore((s) => s.entities)
  const unitEntities = useMemo(() => entities.filter((e) => e.kind === "unit"), [entities])
  const organisations = useMemo(() => entities.filter((e) => e.kind === "corporate"), [entities])
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)
  const entityOsmGeometries = useOsmViewStore((s) => s.entityOsmGeometries)
  const baseMap = useMapPrefsStore((s) => s.baseMap)

  useOsmRelationGeometries({ onOverpassUnavailable })

  const tileConfig = BASE_MAP_TILE_CONFIG[baseMap]

  const {
    mapTool,
    setMapTool,
    pendingGeometry,
    isDrawing,
    handleGeometryCreated,
    handleCreateNew,
    handleCreateNewOrganisation,
    handleLinkToExisting,
    handleCancel,
  } = useMapDrawing({ onCreateNewEntity, onCreateNewOrganisation, onLinkGeometryToEntity })

  const setMapBounds = useMapViewStore((s) => s.setMapBounds)

  const visibleLayersInOrder = useMemo(() => layers.filter((l) => l.visible), [layers])

  const drawnByLayerId = useMemo(() => {
    const m = new Map<string, DrawnGeometry[]>()
    const entityById = new Map(entities.map((e) => [e.id, e]))
    for (const g of drawnGeometries) {
      const linked = g.entityId != null ? entityById.get(g.entityId) : undefined
      const layerKey = linked != null ? linked.layerId : g.layerId
      const list = m.get(layerKey) ?? []
      list.push(g)
      m.set(layerKey, list)
    }
    return m
  }, [drawnGeometries, entities])

  const positionMap = usePositionMap()

  const getEntityPosition = useCallback(
    (entity: (typeof entities)[number]) => positionMap.get(entity.id) ?? null,
    [positionMap],
  )

  const mapToolRef = useRef(mapTool)

  useEffect(() => {
    mapToolRef.current = mapTool
  }, [mapTool])

  const onEachOsmFeature = useCallback(
    function onEachOsmFeature(feature: GeoJSON.Feature & { id?: string }, layer: L.Layer) {
      layer.on("click", () => {
        if (mapToolRef.current !== "pan") return
        selectOsmObject(feature)
      })
    },
    [],
  )

  const renderDrawnGeometry = useCallback((g: DrawnGeometry) => {
    switch (g.type) {
      case "point":
        if (g.entityId != null) return null
        return (
          <Marker key={g.id} position={[g.lat, g.lng]} icon={markerIcon} interactive={!isDrawing}>
            <Popup>Unlinked point</Popup>
          </Marker>
        )
      case "line":
        return <Polyline key={g.id} positions={g.positions} pathOptions={{ interactive: !isDrawing }} />
      case "polygon":
        return <Polygon key={g.id} positions={g.rings[0] ?? []} pathOptions={{ interactive: !isDrawing }} />
      default:
        return null
    }
  }, [isDrawing])

  return (
    <div className="relative h-full w-full">
      {!readOnly && pendingGeometry && (
        <GeometryActionMenu
          entities={unitEntities}
          organisations={organisations}
          onCreateNew={handleCreateNew}
          onCreateNewOrganisation={handleCreateNewOrganisation}
          onLinkToExisting={handleLinkToExisting}
          onCancel={handleCancel}
        />
      )}
      <MapContainer
        className="h-full w-full"
        center={[55.751244, 37.618423]}
        zoom={5}
        zoomControl={false}
      >
        <BottomLeftZoomControl />
        <MapSizeSync />
        <MapBoundsReporter onBoundsChange={setMapBounds} />
        <CenterOnSelection entities={entities} getEntityPosition={getEntityPosition} />
        <DeselectOnDrawMode mapTool={mapTool} />
        {flyToRef && <MapInstanceBridge flyToRef={flyToRef} />}
        {!readOnly && <MapToolSelector mapTool={mapTool} onMapToolChange={setMapTool} />}

        {/* key by url: remount on base-map switch so maxNativeZoom/subdomains re-apply
            (updateGridLayer only re-applies opacity/zIndex, not grid options). */}
        <TileLayer
          key={tileConfig.url}
          {...BASE_TILE_OPTIONS}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxNativeZoom={tileConfig.maxNativeZoom}
        />
        {tileConfig.overlay && (
          <TileLayer
            key={tileConfig.overlay.url}
            {...BASE_TILE_OPTIONS}
            url={tileConfig.overlay.url}
            attribution={tileConfig.overlay.attribution}
            subdomains={tileConfig.overlay.subdomains}
            maxNativeZoom={tileConfig.overlay.maxNativeZoom}
          />
        )}

        {mapLayers}

        {visibleLayersInOrder.map((layer) =>
          layer.osmData ? (
            <GeoJSON
              key={layer.id}
              data={layer.osmData}
              interactive={!isDrawing}
              pointToLayer={osmPointToLayer}
              onEachFeature={onEachOsmFeature}
            />
          ) : null
        )}

        {Object.entries(entityOsmGeometries).map(([entityId, fc]) =>
          fc.features.length > 0 ? (
            <GeoJSON
              key={`osm-${entityId}`}
              data={fc}
              interactive={!isDrawing}
              pathOptions={linkedOsmStyle}
              pointToLayer={osmPointToLayer}
              onEachFeature={onEachOsmFeature}
            />
          ) : null
        )}

        {visibleLayersInOrder.flatMap((layer) => {
          if (layer.osmData) return []
          return (drawnByLayerId.get(layer.id) ?? []).map(renderDrawnGeometry)
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
