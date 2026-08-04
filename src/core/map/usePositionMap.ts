import { useEntityPositions } from "@/hooks/useEntityPositions"
import type { LatLng } from "@/core/coordinates"

/** Shared by any self-contained map layer that needs every entity's computed position.
 *
 *  The layout walks the edge set rather than the derived `parentId` field, so a contested
 *  child is a contest here and not a root that happens to have no position. The two agree
 *  on every placement — the field is a projection of the same edges, derived with the same
 *  entity set — which is what the fingerprints over the real project assert.
 *
 *  A thin projection of `useEntityPositions` since the integrity slice, kept as its own
 *  export so its four map-layer call sites do not have to care that the same derivation
 *  also reports who was left OFF the map. A layer wanting that reads the notice through
 *  `useEntityPositions`; there is one `computeAllEntityPositions` call behind both. */
export function usePositionMap(): Map<string, LatLng> {
  return useEntityPositions().positionMap
}
