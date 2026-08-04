import { useMemo } from "react"
import { hierarchyIndex, type HierarchyIndex, type IndexedEntity } from "@/core/relationship/hierarchyIndex"
import { useProjectStore } from "@/store/useProjectStore"

/**
 * The project's edge-backed hierarchy, memoised, for the React consumers that read it.
 *
 * One constructor rather than seven. Every consumer needs the index built the SAME way —
 * over the whole entity set, kinds included — and seven hand-written copies of that call
 * are seven chances for one surface to answer differently from its neighbours about who
 * sits under whom. That is the failure ADR 0011 exists to prevent, one storey up from the
 * derivation it prevents it in.
 *
 * `entities` is for the two hooks that take their entity array as a prop rather than from
 * the store; omit it everywhere else. It must be the WHOLE set even when the caller renders
 * a subset: an edge is not a unit's or a corporation's, and an index built over units alone
 * would answer "root" for a child whose only edge crosses kinds, which is exactly the pair
 * that must derive nothing.
 */
export function useHierarchyIndex(entities?: readonly IndexedEntity[]): HierarchyIndex {
  const storeEntities = useProjectStore((s) => s.entities)
  const relationships = useProjectStore((s) => s.relationships)
  const over = entities ?? storeEntities
  return useMemo(() => hierarchyIndex(relationships, { entities: over }), [relationships, over])
}
