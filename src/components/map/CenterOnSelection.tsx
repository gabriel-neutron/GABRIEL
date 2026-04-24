import { useEffect, useRef } from "react"
import L from "leaflet"
import { useMap } from "react-leaflet"
import type { MapEntity } from "@/types/domain.types"

type Props = {
  selectedEntityId: string | null
  entities: MapEntity[]
  getEntityPosition: (entity: MapEntity) => [number, number] | null
}

export function CenterOnSelection({ selectedEntityId, entities, getEntityPosition }: Props) {
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

    if (!selectionChanged) return

    map.flyTo([lat, lng], map.getZoom(), { duration: 0.3 })
    const id = setTimeout(() => {
      map.eachLayer((layer) => {
        if (!(layer instanceof L.Marker)) return
        const pos = layer.getLatLng()
        if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
          layer.openPopup()
        }
      })
    }, 350)
    return () => clearTimeout(id)
  }, [selectedEntityId, entities, getEntityPosition, map])

  return null
}