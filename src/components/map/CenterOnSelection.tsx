import { useEffect, useRef } from "react"
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
  const centerTargetRef = useRef<[number, number] | null>(null)
  const selectionTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!selectedEntityId) {
      lastSelectedIdRef.current = null
      centerTargetRef.current = null
      return
    }
    if (lastSelectedIdRef.current === selectedEntityId) return
    const entity = entities.find((e) => e.id === selectedEntityId)
    if (!entity) return
    const position = getEntityPosition(entity)
    if (!position) return
    lastSelectedIdRef.current = selectedEntityId
    centerTargetRef.current = position
    selectionTimeRef.current = Date.now()
    map.setView(position, map.getZoom(), { animate: false })
  }, [selectedEntityId, entities, getEntityPosition, map])

  useEffect(() => {
    function handleResize() {
      const pos = centerTargetRef.current
      if (!pos) return
      if (Date.now() - selectionTimeRef.current > 300) return
      map.setView(pos, map.getZoom(), { animate: false })
    }
    map.on("resize", handleResize)
    return () => { map.off("resize", handleResize) }
  }, [map])

  return null
}
