import type { Orbat, OrbatNode } from "@/core/entity/hierarchy"

/**
 * Horizontal position for each item in a top-down tree layout: leaves get sequential
 * x-indexes; a parent is centered over the span of its own children. Shared by
 * TreeView and OrganisationTreeView so the two hierarchies lay out identically.
 *
 * Recursion guards against re-entering an already-visited id so a cyclic Orbat root
 * (see `buildOrbat`'s cycle policy) can't recurse forever.
 */
export function computeTreeXIndex<T extends OrbatNode>(orbat: Orbat<T>): Map<string, number> {
  const xIndexById = new Map<string, number>()
  const visited = new Set<string>()
  let currentXIndex = 0

  function layout(item: T): number {
    visited.add(item.id)
    const children = orbat.childrenOf(item.id).filter((child) => !visited.has(child.id))
    const childXIndexes = children.map((child) => layout(child))

    const xIndex =
      childXIndexes.length === 0
        ? currentXIndex++
        : (childXIndexes[0] + childXIndexes[childXIndexes.length - 1]) / 2

    xIndexById.set(item.id, xIndex)
    return xIndex
  }

  for (const root of orbat.roots()) layout(root)

  return xIndexById
}
