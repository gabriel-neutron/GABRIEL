import { useMemo } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { computeAllEntityPositions } from "@/core/map/geometry"
import type { LatLng } from "@/core/coordinates"

/** Shared by any self-contained map layer that needs every entity's computed position. */
export function usePositionMap(): Map<string, LatLng> {
  const entities = useProjectStore((s) => s.entities)
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)
  return useMemo(() => {
    const all = computeAllEntityPositions(entities, drawnGeometries)
    return new Map(all.map(({ entity, position }) => [entity.id, position]))
  }, [entities, drawnGeometries])
}
