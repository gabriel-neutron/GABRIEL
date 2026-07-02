export interface OrbatNode {
  id: string
  parentId: string | null
}

export interface Orbat<T extends OrbatNode> {
  /** Direct children of `id`, in source-array order. Empty for leaves or unknown ids. */
  childrenOf(id: string): T[]
  /** Nearest-first ancestor chain, stopping at a missing parent or a cycle. Bounded by `maxUp` steps. */
  ancestors(id: string, maxUp?: number): T[]
  /** All descendants in BFS order, bounded by `maxDown` levels. Cycle-safe. */
  descendants(id: string, maxDown?: number): T[]
  /** Top-level items: `parentId` null, orphaned (parent absent), or the entry point of a disconnected cycle. */
  roots(): T[]
  /** BFS waves from `roots()`. Disconnected cycles are appended as trailing waves after all reachable items. */
  layers(maxLayers?: number): T[][]
  /** 0 for roots, incrementing down the tree. -1 for an unknown id. */
  depthOf(id: string): number
  isRoot(id: string): boolean
}

/**
 * Orphan policy: an item whose `parentId` points to a missing id is treated as a root — visible
 * in trees/hierarchy panels and eligible for enrichment, matching the one call site
 * (layered-research) that already had this behaviour and tests.
 *
 * Map exception: this policy does not extend to map positioning. An orphan without its own
 * geometry (`positionMode` other than "own") has no anchored ancestor to orbit, so
 * `computePositions` (geometry.ts) still leaves it off the map. Pin it with its own geometry
 * or restore its parent to place it.
 *
 * Cycle policy: a fully disconnected cyclic component (every member's `parentId` resolves to
 * another member of the same component) gets a synthetic root at its lexicographically smallest
 * id, so it renders instead of vanishing and so ancestor/depth walks can't infinite-loop.
 */
export function buildOrbat<T extends OrbatNode>(items: T[]): Orbat<T> {
  const byId = new Map<string, T>()
  for (const item of items) byId.set(item.id, item)

  const childrenByParent = new Map<string, T[]>()
  for (const item of items) {
    if (item.parentId == null) continue
    const siblings = childrenByParent.get(item.parentId)
    if (siblings) siblings.push(item)
    else childrenByParent.set(item.parentId, [item])
  }

  function childrenOf(id: string): T[] {
    return childrenByParent.get(id) ?? []
  }

  const visited = new Set<string>()
  const depthById = new Map<string, number>()
  const layers: T[][] = []

  function bfsFrom(seedRoots: T[]): void {
    let frontier = seedRoots.filter((item) => !visited.has(item.id))
    let depth = 0
    while (frontier.length > 0) {
      layers.push(frontier)
      for (const item of frontier) {
        visited.add(item.id)
        depthById.set(item.id, depth)
      }
      const next: T[] = []
      for (const item of frontier) {
        for (const child of childrenOf(item.id)) {
          if (!visited.has(child.id)) next.push(child)
        }
      }
      frontier = next
      depth += 1
    }
  }

  const structuralRoots = items.filter(
    (item) => item.parentId == null || !byId.has(item.parentId),
  )
  bfsFrom(structuralRoots)

  const remaining = items.filter((item) => !visited.has(item.id))
  remaining.sort((a, b) => a.id.localeCompare(b.id))
  for (const item of remaining) {
    if (!visited.has(item.id)) bfsFrom([item])
  }

  const rootIds = new Set(
    items.filter((item) => depthById.get(item.id) === 0).map((item) => item.id),
  )

  function ancestors(id: string, maxUp = Infinity): T[] {
    const result: T[] = []
    const seen = new Set<string>([id])
    let currentId = byId.get(id)?.parentId ?? null
    while (currentId != null && result.length < maxUp) {
      if (seen.has(currentId)) break
      const node = byId.get(currentId)
      if (!node) break
      result.push(node)
      seen.add(currentId)
      currentId = node.parentId
    }
    return result
  }

  function descendants(id: string, maxDown = Infinity): T[] {
    const result: T[] = []
    const seen = new Set<string>([id])
    let frontier = childrenOf(id)
    let depth = 0
    while (frontier.length > 0 && depth < maxDown) {
      const next: T[] = []
      for (const node of frontier) {
        if (seen.has(node.id)) continue
        seen.add(node.id)
        result.push(node)
        for (const child of childrenOf(node.id)) {
          if (!seen.has(child.id)) next.push(child)
        }
      }
      frontier = next
      depth += 1
    }
    return result
  }

  function roots(): T[] {
    return items.filter((item) => rootIds.has(item.id))
  }

  function depthOf(id: string): number {
    return depthById.get(id) ?? -1
  }

  function isRoot(id: string): boolean {
    return rootIds.has(id)
  }

  function layersFn(maxLayers?: number): T[][] {
    return maxLayers == null ? layers : layers.slice(0, maxLayers)
  }

  return { childrenOf, ancestors, descendants, roots, layers: layersFn, depthOf, isRoot }
}
