import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import { type LatLng, asLatLng } from "@/core/coordinates"
import { buildOrbat, type Orbat } from "@/core/entity/hierarchy"
import type { ParentLinkSource } from "@/core/relationship/hierarchyIndex"

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

export interface EntityPositions {
  positioned: PositionedEntity[]
  /**
   * The ids this layout could not place because a contest sits on their chain — their
   * own, or an ancestor's.
   *
   * Returned rather than swallowed. A contested child derives no parent, so the wave loop
   * below never reaches it, and every entity underneath it goes off the map too: one
   * contest can silently remove an arbitrarily large branch, and 741 of the 1010 units in
   * the real project take their position from the parent chain. No position is invented
   * for them. Electing a winner is forbidden (ADR 0011) and a midpoint between two
   * competing parents is fabricated data in a published dataset, so the honest rendering
   * is nothing drawn and the absence stated here.
   *
   * Empty when no index is supplied: without the edge set a contest is indistinguishable
   * from a root, which is the whole defect.
   */
  unplacedByContest: string[]
}

type Positionable = { id: string; parentId: string | null; positionMode?: PositionMode }

/** Ids with no position whose chain reaches a contest. Walks up rather than down so an
 *  entity several levels below the contest is named too — it is just as absent, and a
 *  reader told only about the contested entity would look for its children on the map. */
function contestedAndUnplaced<T extends Positionable>(
  items: T[],
  orbat: Orbat<T>,
  positionById: Map<string, LatLng>,
): string[] {
  const ids: string[] = []
  for (const item of items) {
    if (positionById.has(item.id)) continue
    const chain = [item, ...orbat.ancestors(item.id)]
    if (chain.some((node) => orbat.parentOf(node.id).state === "contested")) ids.push(item.id)
  }
  return ids
}

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
 *
 * Parents come from `index` when it is supplied and from the derived `parentId` field
 * otherwise; the two agree, because the field is a projection of the same edges.
 */
function computePositions<T extends Positionable>(
  items: T[],
  drawnGeometries: DrawnGeometry[],
  index?: ParentLinkSource,
): { positionById: Map<string, LatLng>; unplacedByContest: string[] } {
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

  const orbat = buildOrbat(items, index)
  const parentIdOf = (item: T): string | null => {
    const link = orbat.parentOf(item.id)
    return link.state === "parent" ? link.parentId : null
  }

  const siblingGroups = new Map<string, T[]>()
  for (const item of items) {
    const parentId = parentIdOf(item)
    if (parentId == null || siblingGroups.has(parentId)) continue
    siblingGroups.set(
      parentId,
      orbat.childrenOf(parentId).filter((child) => (child.positionMode ?? "own") !== "own"),
    )
  }

  let remaining = items.filter(
    (item) => (item.positionMode ?? "own") !== "own" && parentIdOf(item) != null,
  )

  while (remaining.length > 0) {
    const nextRemaining: T[] = []
    let progress = false

    for (const item of remaining) {
      const parentId = parentIdOf(item)!
      const parentPos = positionById.get(parentId)
      if (parentPos == null) {
        nextRemaining.push(item)
        continue
      }
      progress = true

      const parentDepth = depthById.get(parentId) ?? 0
      const myDepth = parentDepth + 1
      depthById.set(item.id, myDepth)

      const siblings = siblingGroups.get(parentId) ?? [item]
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

  return {
    positionById,
    unplacedByContest: index == null ? [] : contestedAndUnplaced(items, orbat, positionById),
  }
}

export function computeAllEntityPositions(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  index?: ParentLinkSource,
): EntityPositions {
  const { positionById, unplacedByContest } = computePositions(entities, drawnGeometries, index)
  return {
    positioned: entities
      .filter((e) => positionById.has(e.id))
      .map((e) => ({ entity: e, position: positionById.get(e.id)! })),
    unplacedByContest,
  }
}
