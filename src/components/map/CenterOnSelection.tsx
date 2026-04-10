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

  // #region agent log - Hypothesis C: CenterOnSelection effect re-runs
  const effectCountRef = useRef(0)
  // #endregion
  useEffect(() => {
    // #region agent log - Hypothesis C
    effectCountRef.current += 1
    fetch('http://127.0.0.1:7621/ingest/5d09de12-2036-4626-a2d7-a250cef5312b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d20a2f'},body:JSON.stringify({sessionId:'d20a2f',location:'CenterOnSelection.tsx:effect',message:'CenterOnSelection effect run',data:{runCount:effectCountRef.current,selectedEntityId},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{})
    // #endregion
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