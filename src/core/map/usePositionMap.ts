import { useMemo } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { LatLng } from "@/core/coordinates"

/** Shared by any self-contained map layer that needs every entity's computed position.
 *
 *  The layout walks the edge set rather than the derived `parentId` field, so a contested
 *  child is a contest here and not a root that happens to have no position. The two agree
 *  on every placement — the field is a projection of the same edges — which is what the
 *  two-way fingerprint over the real project asserts. */
export function usePositionMap(): Map<string, LatLng> {
  const entities = useProjectStore((s) => s.entities)
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)
  const relationships = useProjectStore((s) => s.relationships)
  return useMemo(() => {
    const index = hierarchyIndex(relationships, {
      entityIds: new Set(entities.map((e) => e.id)),
    })
    const { positioned } = computeAllEntityPositions(entities, drawnGeometries, index)
    return new Map(positioned.map(({ entity, position }) => [entity.id, position]))
  }, [entities, drawnGeometries, relationships])
}
