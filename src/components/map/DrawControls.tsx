import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet-draw"
import type { Geometry } from "geojson"
import { useMap } from "react-leaflet"
import type { DrawnGeometry } from "@/types/domain.types"

type DrawGeometryType = "point" | "line" | "polygon"

type Props = {
  enabled: boolean
  geometryType: DrawGeometryType
  defaultLayerId: string
  onCreated: (geom: DrawnGeometry) => void
}

function geoJsonToDrawnGeometry(
  geometry: Geometry,
  layerId: string,
): DrawnGeometry {
  const id = crypto.randomUUID()
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates
    return { id, layerId, entityId: null, type: "point", lat, lng }
  }
  if (geometry.type === "LineString") {
    const positions = geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    )
    return { id, layerId, entityId: null, type: "line", positions }
  }
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    )
    return { id, layerId, entityId: null, type: "polygon", rings }
  }
  throw new Error("Unsupported geometry type")
}

export function DrawControls({
  enabled,
  geometryType,
  defaultLayerId,
  onCreated,
}: Props) {
  const map = useMap()
  const drawHandlerRef = useRef<L.Draw.Marker | L.Draw.Polyline | L.Draw.Polygon | null>(null)
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated

  useEffect(() => {
    if (!enabled) {
      if (drawHandlerRef.current) {
        drawHandlerRef.current.disable()
        drawHandlerRef.current = null
      }
      return
    }

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    // @types/leaflet-draw expects DrawMap; react-leaflet's L.Map works at runtime
    const drawMap = map as any

    let handler: L.Draw.Marker | L.Draw.Polyline | L.Draw.Polygon
    if (geometryType === "point") {
      handler = new L.Draw.Marker(drawMap, { icon: new L.Icon.Default() })
    } else if (geometryType === "line") {
      handler = new L.Draw.Polyline(drawMap, {
        allowIntersection: false,
        showLength: true,
        metric: true,
      })
    } else {
      handler = new L.Draw.Polygon(drawMap, {
        allowIntersection: false,
        showArea: true,
        metric: true,
      })
    }

    drawHandlerRef.current = handler

    const handleCreated = (evt: L.LeafletEvent) => {
      const e = evt as L.DrawEvents.Created
      const layer = e.layer
      drawnItems.addLayer(layer)
      const geojson = (layer as unknown as { toGeoJSON: () => GeoJSON.Feature }).toGeoJSON()
      const geometry = geojson.geometry as Geometry
      handler.disable()
      const drawn = geoJsonToDrawnGeometry(geometry, defaultLayerId)
      onCreatedRef.current(drawn)
    }

    map.on(L.Draw.Event.CREATED, handleCreated)
    handler.enable()

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated)
      if (handler) handler.disable()
      map.removeLayer(drawnItems)
      drawHandlerRef.current = null
    }
  }, [enabled, geometryType, map, defaultLayerId])

  return null
}
