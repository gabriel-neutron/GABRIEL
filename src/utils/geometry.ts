import type { DrawnGeometry } from "@/types/domain.types"

/**
 * Returns a representative point for symbol placement from the first geometry
 * linked to the entity. Point → coords; line → first vertex; polygon → first ring first point.
 */
export function getEntityDisplayPosition(
  entityId: string,
  drawnGeometries: DrawnGeometry[],
): [number, number] | null {
  const linked = drawnGeometries.filter((g) => g.entityId === entityId)
  const first = linked[0]
  if (!first) return null
  if (first.type === "point") return [first.lat, first.lng]
  if (first.type === "line" && first.positions[0]) {
    const [lat, lng] = first.positions[0]
    return [lat, lng]
  }
  if (first.type === "polygon" && first.rings[0]?.[0]) {
    const [lat, lng] = first.rings[0][0]
    return [lat, lng]
  }
  return null
}
