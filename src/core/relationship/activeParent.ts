import type { EntityKind } from "@/core/entity/entity"
import type { Relationship, RelationshipType } from "./relationship"
import { isHierarchyBearing } from "./validate"

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
 * Derives the single parent of each child from the edge set.
 *
 * Hierarchy-bearing-ness is decided ONLY by `isHierarchyBearing`, never by a
 * local type test: a second predicate here could drift from the control in
 * `validate.ts`, and the derivation and the control disagreeing is precisely the
 * failure mode that would let a blocked conflict still reshape the tree.
 *
 * The edge reads "A <type> B" with `fromId` always A, so the CHILD is `fromId`
 * and the PARENT is `toId` — the same keying `countActiveOrganicParents` uses.
 *
 * Two or more competing edges do not elect a winner (Q40). Picking one would
 * silently resolve a finding a human is supposed to adjudicate, so the child is
 * left unmapped and every competing edge id is handed back for the integrity
 * event. Two edges from the same child to the same parent are still two
 * competing edges: they are two separate assertions, and collapsing them would
 * be the derivation deciding they say the same thing.
 */
export function activeParentMap(rels: Relationship[]): ActiveParentMap {
  const edgesByChild = new Map<string, Relationship[]>()
  for (const rel of rels) {
    if (!isHierarchyBearing(rel)) continue
    const existing = edgesByChild.get(rel.fromId)
    if (existing == null) edgesByChild.set(rel.fromId, [rel])
    else existing.push(rel)
  }

  const parentById = new Map<string, string>()
  const contested = new Map<string, string[]>()
  for (const [childId, edges] of edgesByChild) {
    const only = edges.length === 1 ? edges[0] : undefined
    if (only != null) parentById.set(childId, only.toId)
    else contested.set(childId, edges.map((edge) => edge.id))
  }

  return { parentById, contested }
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
 * The id-set check is Trap T15, not defensiveness. `buildOrbat` (hierarchy.ts:77)
 * treats an unresolvable parent as a root while `load.ts:60-63` THROWS on one, and
 * this derivation sits between the two opposite policies. `activeParentMap` sees
 * only edges, so this is the first point that knows the entity set; reproducing
 * the orphan policy here by OMISSION is what keeps a dangling parent from ever
 * being written and re-read as a corrupt-file diagnosis on the next load.
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
