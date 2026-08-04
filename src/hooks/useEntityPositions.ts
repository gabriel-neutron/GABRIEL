import { useMemo } from "react"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { useHierarchyIndex } from "@/hooks/useHierarchyIndex"
import { useProjectStore } from "@/store/useProjectStore"
import type { LatLng } from "@/core/coordinates"

export type EntityPositions = {
  positionMap: Map<string, LatLng>
  /** Ids of entities left off the map because their parent chain reaches a contest. */
  unplacedByContest: string[]
}

/**
 * The one place `computeAllEntityPositions` is called from React, so both halves of its
 * result reach a reader from the same derivation. `usePositionMap` used to destructure
 * `positioned` and drop `unplacedByContest` on the floor, which made the absence of an
 * entity from the map indistinguishable from it having no position at all -- the exact
 * "a value nothing reads" defect the 2B Spec review caught.
 *
 * Placed in `hooks/` rather than beside `usePositionMap` in `core/map/` because `core/`
 * is meant to stay React-free (`CLAUDE.md`); `usePositionMap` is a pre-existing divergence
 * and this does not deepen it.
 */
export function useEntityPositions(): EntityPositions {
  const entities = useProjectStore((s) => s.entities)
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)
  const index = useHierarchyIndex()
  return useMemo(() => {
    const { positioned, unplacedByContest } = computeAllEntityPositions(entities, drawnGeometries, index)
    return {
      positionMap: new Map(positioned.map(({ entity, position }) => [entity.id, position])),
      unplacedByContest,
    }
  }, [entities, drawnGeometries, index])
}
