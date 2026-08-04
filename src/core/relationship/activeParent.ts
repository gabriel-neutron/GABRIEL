import type { EntityKind } from "@/core/entity/entity"
import type { Relationship, RelationshipType } from "./relationship"
import { hierarchyIndex, type HierarchyIndexOptions } from "./hierarchyIndex"
import { isHierarchyBearing } from "./isHierarchyBearing"

export type ActiveParentMap = {
  /** child id -> parent id. A CONTESTED child is ABSENT from this map. It is not
   *  mapped to null, and no arbitrary winner is picked (Q40). */
  parentById: Map<string, string>
  /** child id -> the ids of every competing active hierarchy-bearing edge.
   *  Returned here, at the point the conflict is decided, so the caller mints the
   *  integrity event without a second validation pass. */
  contested: Map<string, string[]>
}

/**
 * The two halves of a `ParentLink` that a `Map<string, string>` can carry, projected
 * out of `hierarchyIndex`.
 *
 * This is a projection and no longer a second derivation. `contested` exists here
 * only because the caller needs the half of a tri-state that `parentById` cannot
 * express; `ParentLink` is that tri-state made a type, and anything that needs to
 * tell a contest from a root at the point of reading should take the index instead.
 *
 * The signature is unchanged, so `load.ts` and `useProjectStore` keep their shape.
 * Called with no options it is exactly what it was before Slice 3: no `entityIds`
 * means no link can be `unresolvable`, so every single-edge child lands in
 * `parentById` and Trap T15 stays where it was, in `withDerivedParents`.
 */
export function activeParentMap(
  rels: Relationship[],
  options?: HierarchyIndexOptions,
): ActiveParentMap {
  const index = hierarchyIndex(rels, options)
  return { parentById: index.parents(), contested: index.contested() }
}

/**
 * The edge set with `child`'s parent set to `parentId`, or with it removed when `parentId`
 * is null. Pure; returns a fresh array.
 *
 * REPLACES, never adds. A second active hierarchy-bearing edge would leave the child
 * CONTESTED, and a contested child derives NO parent at all — so "add" would show the
 * analyst their pick disappearing at the next load, which is the data-loss direction. A
 * conflict between two records IS a finding worth blocking on (Q40); one manufactured by a
 * parent picker is not a finding, it is this function failing to replace.
 *
 * Which edges compete is decided by `isHierarchyBearing` and nowhere else, so the write and
 * the derivation above cannot disagree about what they are.
 *
 * The child's kind picks the type, by the same two rules the one-shot migration uses
 * (`migrateHierarchy.ts`): a corporate record takes `corporate_parent`, everything else
 * `subordinate_to`. Written as a literal pair rather than a lookup so no assessment-tier
 * type is reachable from an analyst's parent picker (Trap T12).
 *
 * `edgeId` is injected for the same reason `now` is elsewhere: `core/` mints no ids of its
 * own, so the result stays reproducible.
 */
export function withActiveParent(
  rels: Relationship[],
  child: { id: string; kind: EntityKind },
  parentId: string | null,
  edgeId: string,
): Relationship[] {
  const kept = rels.filter((rel) => !(rel.fromId === child.id && isHierarchyBearing(rel)))
  if (parentId == null) return kept
  const type: RelationshipType = child.kind === "corporate" ? "corporate_parent" : "subordinate_to"
  return [
    ...kept,
    { id: edgeId, fromId: child.id, toId: parentId, type, startDate: null, endDate: null, metadata: {} },
  ]
}

/**
 * Pure. Returns fresh items with `parentId` replaced by the derivation; never
 * mutates. Generic on the minimal shape, mirroring `OrbatNode` (hierarchy.ts:1-4)
 * and `Positionable` (geometry.ts:40) — the house style for React-free derivations.
 *
 * The incoming `parentId` is never read as an input: an item absent from
 * `parentById` comes back `null` whatever it carried, because the edge set is
 * the sole authority for the field once it is derived.
 *
 * The id-set check is Trap T15, not defensiveness. `buildOrbat` treats an
 * unresolvable parent as a root while `load.ts` records one against the entity
 * set, and this derivation sits between the two policies. Reproducing the orphan
 * policy here by OMISSION is what keeps a dangling parent from ever being written
 * and re-read as a corrupt-file diagnosis on the next load.
 *
 * `hierarchyIndex` can now reach the same conclusion, and better — it answers
 * `"unresolvable"` where this can only answer `null`. The check stays because the
 * two agree by construction: both OMIT, so an index built with `entityIds` makes
 * this a no-op and an index built without it leaves this the only guard. What must
 * never appear is a third policy that maps the case to a value.
 */
export function withDerivedParents<T extends { id: string; parentId: string | null }>(
  items: T[],
  map: ActiveParentMap,
): T[] {
  const presentIds = new Set<string>()
  for (const item of items) presentIds.add(item.id)

  return items.map((item) => {
    const derived = map.parentById.get(item.id)
    const resolved = derived != null && presentIds.has(derived) ? derived : null
    return { ...item, parentId: resolved }
  })
}
