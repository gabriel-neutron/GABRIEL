import type { Orbat, OrbatNode } from "@/core/entity/hierarchy"
import type { MapEntity } from "@/types/domain.types"

/** Root ancestor path for a top-level node; never mutated, only copied. */
export const EMPTY_PATH: ReadonlySet<string> = new Set()

export function compareByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

/** Collapsible items first, each group alphabetical — the reading order HierarchyPanel has
 *  always used, kept here rather than in the component so the panel and its node share one
 *  copy without a component file exporting non-components. */
export function getOrderedEntities(items: MapEntity[], orbat: Orbat<MapEntity>): MapEntity[] {
  const sortedItems = [...items].sort(compareByName)
  const collapsibleItems = sortedItems.filter((item) => orbat.childrenOf(item.id).length > 0)
  const nonCollapsibleItems = sortedItems.filter((item) => orbat.childrenOf(item.id).length === 0)
  return [...collapsibleItems, ...nonCollapsibleItems]
}

/**
 * A disconnected cycle's synthetic root (see `buildOrbat`'s cycle policy) still has its own
 * dangling `parentId` pointing back into the cycle — that id never resolves to a real node, so
 * `orbat.ancestors()` can't see it. Check it directly so a hidden-then-orphaned parent still
 * hides its child, matching pre-refactor behaviour.
 */
export function isAncestorHidden<T extends OrbatNode>(
  item: T,
  orbat: Orbat<T>,
  hiddenEntityIds: Set<string>,
): boolean {
  if (item.parentId != null && hiddenEntityIds.has(item.parentId)) return true
  return orbat.ancestors(item.id).some((ancestor) => hiddenEntityIds.has(ancestor.id))
}
