import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"

/**
 * Returns a representative point for symbol placement from the first geometry
 * linked to the entity. Point -> coords; line -> first vertex; polygon -> first ring first point.
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

/**
 * Orbit radius for depth-1 entities (degrees of lat, ~111m per 0.001°).
 * Each additional depth level is multiplied by CHILD_SCALE, shrinking the
 * orbit so sibling subtrees don't overlap.
 *
 * With CHILD_SCALE = 0.35:
 *   depth 1 radius = 0.001   (the main ring around an own-positioned entity)
 *   depth 2 radius = 0.00035 (compact sub-ring, diameter < min spacing of 8 depth-1 siblings)
 *   depth 3 radius = 0.000123 (tightly nested)
 */
const BASE_RADIUS = 0.001
const CHILD_SCALE = 0.35

export interface PositionedEntity {
  entity: MapEntity
  position: [number, number]
}

/**
 * Computes display positions for all entities, handling nested parent-linked
 * hierarchies without inter-circle overlap.
 *
 * Algorithm (BFS from entities with own geometry):
 * 1. Seed the position map with all "own"-mode entities that have a geometry.
 * 2. Wave-by-wave, resolve non-own entities whose parent position is already known.
 *    Track each entity's BFS depth (distance from the nearest "own" ancestor).
 * 3. Orbit radius = BASE_RADIUS * CHILD_SCALE^(depth-1).
 *    This shrinks each nested ring so sibling subtrees remain separate.
 *
 * The lng offset is divided by cos(lat) to produce circular rings in geographic
 * space (corrects the elliptical distortion caused by equal lat/lng increments).
 */
export function computeAllEntityPositions(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
): PositionedEntity[] {
  const positionById = new Map<string, [number, number]>()
  const depthById = new Map<string, number>()

  // Step 1: seed with entities that have their own geometry (depth 0)
  for (const entity of entities) {
    if ((entity.positionMode ?? "own") === "own") {
      const pos = getEntityDisplayPosition(entity.id, drawnGeometries)
      if (pos) {
        positionById.set(entity.id, pos)
        depthById.set(entity.id, 0)
      }
    }
  }

  // Step 2: sibling groups — for each parent ID, which non-own entities orbit it
  const siblingGroups = new Map<string, MapEntity[]>()
  for (const e of entities) {
    if ((e.positionMode ?? "own") !== "own" && e.parentId != null) {
      const group = siblingGroups.get(e.parentId) ?? []
      group.push(e)
      siblingGroups.set(e.parentId, group)
    }
  }

  // Step 3: BFS — each wave resolves entities whose immediate parent is now known
  let remaining = entities.filter(
    (e) => (e.positionMode ?? "own") !== "own" && e.parentId != null,
  )

  while (remaining.length > 0) {
    const nextRemaining: MapEntity[] = []
    let progress = false

    for (const entity of remaining) {
      const parentPos = positionById.get(entity.parentId!)
      if (parentPos == null) {
        nextRemaining.push(entity)
        continue
      }
      progress = true

      const parentDepth = depthById.get(entity.parentId!) ?? 0
      const myDepth = parentDepth + 1
      depthById.set(entity.id, myDepth)

      const siblings = siblingGroups.get(entity.parentId!) ?? [entity]
      const idx = siblings.indexOf(entity)
      const count = Math.max(siblings.length, 1)
      const angle = (2 * Math.PI * idx) / count

      // Shrink orbit radius per depth so nested circles don't overlap siblings
      const radius = BASE_RADIUS * Math.pow(CHILD_SCALE, myDepth - 1)

      // Divide lng offset by cos(lat) for a circular ring, not an ellipse
      const cosLat = Math.cos((parentPos[0] * Math.PI) / 180)
      positionById.set(entity.id, [
        parentPos[0] + radius * Math.cos(angle),
        parentPos[1] + (radius / cosLat) * Math.sin(angle),
      ])
    }

    if (!progress) break // remaining entities have no resolvable parent
    remaining = nextRemaining
  }

  return entities
    .filter((e) => positionById.has(e.id))
    .map((e) => ({ entity: e, position: positionById.get(e.id)! }))
}
