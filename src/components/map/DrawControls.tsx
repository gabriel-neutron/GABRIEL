import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet-draw"
import type { Geometry } from "geojson"
import { useMap } from "react-leaflet"
import type { DrawnGeometry } from "@/types/domain.types"
import { toLeafletCoord } from "@/types/coordinates"

type DrawGeometryType = "point" | "line" | "polygon"

type Props = {
  enabled: boolean
  geometryType: DrawGeometryType
  defaultLayerId: string
  onCreated: (geom: DrawnGeometry) => void
}

const POINT_DRAW_ICON = L.divIcon({
  className: "",
  html: "",
  iconSize: [0, 0],
})

function getGeometryLabel(geometryType: DrawGeometryType): string {
  if (geometryType === "point") return "Point"
  if (geometryType === "line") return "Line"
  return "Polygon"
}

function useDrawOnCreatedHandler(onCreated: (geom: DrawnGeometry) => void) {
  const onCreatedRef = useRef(onCreated)

  useEffect(() => {
    onCreatedRef.current = onCreated
  }, [onCreated])

  return onCreatedRef
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
    const positions = geometry.coordinates.map(([lng, lat]) => toLeafletCoord(lng, lat))
    return { id, layerId, entityId: null, type: "line", positions }
  }
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates.map((ring) =>
      ring.map(([lng, lat]) => toLeafletCoord(lng, lat)),
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
  const onCreatedRef = useDrawOnCreatedHandler(onCreated)

  useEffect(() => {
    if (!enabled) return

    const drawingControl = new L.Control({ position: "topright" })
    drawingControl.onAdd = () => {
      const container = L.DomUtil.create("div")
      container.className =
        "rounded-md border border-border/80 bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm"
      container.innerHTML = `<p class="font-medium">Drawing: ${getGeometryLabel(geometryType)}</p><p class="mt-1 text-muted-foreground">Finish shape to save</p>`
      L.DomEvent.disableClickPropagation(container)
      return container
    }
    drawingControl.addTo(map)

    return () => {
      drawingControl.remove()
    }
  }, [enabled, geometryType, map])

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

    const drawMap = map as L.DrawMap

    let handler: L.Draw.Marker | L.Draw.Polyline | L.Draw.Polygon
    if (geometryType === "point") {
      handler = new L.Draw.Marker(drawMap, { icon: POINT_DRAW_ICON })
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
  }, [enabled, geometryType, map, defaultLayerId, onCreatedRef])

  return null
}
