import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import type { Organisation } from "@/types/organisation.types"
import { type LatLng, asLatLng } from "@/types/coordinates"
import { buildOrbat } from "@/utils/orbat"

/**
 * Returns a representative point for symbol placement from the first geometry
 * linked to the entity. Point -> coords; line -> first vertex; polygon -> first ring first point.
 */
export function getEntityDisplayPosition(
  entityId: string,
  drawnGeometries: DrawnGeometry[],
): LatLng | null {
  const linked = drawnGeometries.filter((g) => g.entityId === entityId)
  const first = linked[0]
  if (!first) return null
  if (first.type === "point") return asLatLng(first.lat, first.lng)
  if (first.type === "line" && first.positions[0]) return first.positions[0]
  if (first.type === "polygon" && first.rings[0]?.[0]) return first.rings[0][0]
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
  position: LatLng
}

export interface PositionedOrganisation {
  organisation: Organisation
  position: LatLng
}

type Positionable = { id: string; parentId: string | null; positionMode?: PositionMode }

/**
 * Generic BFS position resolver shared by military entities and organisations.
 *
 * Algorithm:
 * 1. Seed the position map with all "own"-mode items that have a geometry.
 * 2. Wave-by-wave, resolve non-own items whose parent position is already known.
 * 3. Orbit radius = BASE_RADIUS * CHILD_SCALE^(depth-1).
 *
 * The lng offset is divided by cos(lat) to produce circular rings in geographic
 * space (corrects the elliptical distortion caused by equal lat/lng increments).
 */
function computePositions<T extends Positionable>(
  items: T[],
  drawnGeometries: DrawnGeometry[],
): Map<string, LatLng> {
  const positionById = new Map<string, LatLng>()
  const depthById = new Map<string, number>()

  for (const item of items) {
    if ((item.positionMode ?? "own") === "own") {
      const pos = getEntityDisplayPosition(item.id, drawnGeometries)
      if (pos) {
        positionById.set(item.id, pos)
        depthById.set(item.id, 0)
      }
    }
  }

  const orbat = buildOrbat(items)
  const siblingGroups = new Map<string, T[]>()
  for (const item of items) {
    if (item.parentId == null || siblingGroups.has(item.parentId)) continue
    siblingGroups.set(
      item.parentId,
      orbat.childrenOf(item.parentId).filter((child) => (child.positionMode ?? "own") !== "own"),
    )
  }

  let remaining = items.filter((item) => (item.positionMode ?? "own") !== "own" && item.parentId != null)

  while (remaining.length > 0) {
    const nextRemaining: T[] = []
    let progress = false

    for (const item of remaining) {
      const parentPos = positionById.get(item.parentId!)
      if (parentPos == null) {
        nextRemaining.push(item)
        continue
      }
      progress = true

      const parentDepth = depthById.get(item.parentId!) ?? 0
      const myDepth = parentDepth + 1
      depthById.set(item.id, myDepth)

      const siblings = siblingGroups.get(item.parentId!) ?? [item]
      const idx = siblings.indexOf(item)
      const count = Math.max(siblings.length, 1)
      const angle = (2 * Math.PI * idx) / count

      const radius = BASE_RADIUS * Math.pow(CHILD_SCALE, myDepth - 1)
      const cosLat = Math.cos((parentPos[0] * Math.PI) / 180)
      positionById.set(
        item.id,
        asLatLng(
          parentPos[0] + radius * Math.cos(angle),
          parentPos[1] + (radius / cosLat) * Math.sin(angle),
        ),
      )
    }

    if (!progress) break
    remaining = nextRemaining
  }

  return positionById
}

export function computeAllEntityPositions(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
): PositionedEntity[] {
  const positionById = computePositions(entities, drawnGeometries)
  return entities
    .filter((e) => positionById.has(e.id))
    .map((e) => ({ entity: e, position: positionById.get(e.id)! }))
}

export function computeAllOrganisationPositions(
  organisations: Organisation[],
  drawnGeometries: DrawnGeometry[],
): PositionedOrganisation[] {
  const positionById = computePositions(organisations, drawnGeometries)
  return organisations
    .filter((o) => positionById.has(o.id))
    .map((o) => ({ organisation: o, position: positionById.get(o.id)! }))
}
