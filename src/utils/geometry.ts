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

const OFFSET_RADIUS = 0.001

/**
 * Resolves display position for an entity given its position mode:
 *  - "own": uses linked geometries (standard behavior)
 *  - "parent" / "none": offsets around the parent's position
 *
 * Returns null if the position cannot be resolved (no geometry, no parent, etc.).
 */
export function resolveEntityPosition(
  entity: MapEntity,
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  siblingIndex: number,
  siblingCount: number,
): [number, number] | null {
  const mode: PositionMode = entity.positionMode ?? "own"

  if (mode === "own") {
    return getEntityDisplayPosition(entity.id, drawnGeometries)
  }

  if (entity.parentId == null) return null
  const parent = entities.find((e) => e.id === entity.parentId)
  if (!parent) return null

  const parentPos = resolveParentPosition(parent, entities, drawnGeometries)
  if (!parentPos) return null

  const count = Math.max(siblingCount, 1)
  const angle = (2 * Math.PI * siblingIndex) / count
  return [
    parentPos[0] + OFFSET_RADIUS * Math.cos(angle),
    parentPos[1] + OFFSET_RADIUS * Math.sin(angle),
  ]
}

/**
 * Recursively resolves a parent's own position (stops at first entity with
 * positionMode "own" that has a geometry). Avoids infinite loops with a depth limit.
 */
function resolveParentPosition(
  entity: MapEntity,
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  depth = 0,
): [number, number] | null {
  if (depth > 10) return null
  const mode: PositionMode = entity.positionMode ?? "own"

  if (mode === "own") {
    return getEntityDisplayPosition(entity.id, drawnGeometries)
  }

  if (entity.parentId == null) return null
  const parent = entities.find((e) => e.id === entity.parentId)
  if (!parent) return null
  return resolveParentPosition(parent, entities, drawnGeometries, depth + 1)
}

export interface PositionedEntity {
  entity: MapEntity
  position: [number, number]
}

/**
 * Pre-computes display positions for all entities, handling sibling offsets
 * for "parent" and "none" modes.
 */
export function computeAllEntityPositions(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
): PositionedEntity[] {
  const siblingGroups = new Map<string, MapEntity[]>()
  for (const e of entities) {
    const mode: PositionMode = e.positionMode ?? "own"
    if (mode !== "own" && e.parentId != null) {
      const group = siblingGroups.get(e.parentId) ?? []
      group.push(e)
      siblingGroups.set(e.parentId, group)
    }
  }

  const result: PositionedEntity[] = []
  for (const entity of entities) {
    const mode: PositionMode = entity.positionMode ?? "own"

    if (mode === "own") {
      const pos = getEntityDisplayPosition(entity.id, drawnGeometries)
      if (pos) result.push({ entity, position: pos })
      continue
    }

    if (entity.parentId == null) continue
    const siblings = siblingGroups.get(entity.parentId)
    if (!siblings) continue
    const idx = siblings.indexOf(entity)
    const pos = resolveEntityPosition(entity, entities, drawnGeometries, idx, siblings.length)
    if (pos) result.push({ entity, position: pos })
  }

  return result
}
