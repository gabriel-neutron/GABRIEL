import type { Relationship } from "./relationship"
import { isHierarchyBearing } from "./isHierarchyBearing"

/**
 * Where one entity sits in the hierarchy, as a value that can say every answer the
 * edge set can give.
 *
 * This type is the whole point of the index. `Entity.parentId` is one nullable string,
 * so it collapses four different findings into `null`: no hierarchy-bearing edge, two
 * competing edges, an edge naming a parent that is not in the entity set, and an id the
 * index has never heard of. ADR 0011 rejected mapping a contest to `null` precisely
 * because `null` is what a legitimate root looks like — and then the retained `parentId`
 * field went on doing it anyway, which is how a contested child rendered as a top-level
 * formation and took its whole subtree off the map with it.
 *
 * `via` carries the edges that decided the link, so a caller can name them without a
 * second pass. It is EMPTY only on the one path that has no edges to show: an `Orbat`
 * built without an index, answering from the `parentId` field. `contested` always
 * carries at least two.
 */
export type ParentLink =
  | { state: "root" }
  | { state: "parent"; parentId: string; via: readonly Relationship[] }
  | { state: "contested"; via: readonly Relationship[] }
  | { state: "unresolvable"; parentId: string; via: readonly Relationship[] }
  | { state: "unknown" }

/** The one method `buildOrbat` needs, so a test can hand it a two-line stand-in. */
export type ParentLinkSource = {
  linkFor(id: string): ParentLink
}

export type HierarchyIndex = ParentLinkSource & {
  /** child id -> parent id, for children whose single bearing edge names a parent
   *  this index can place. Fresh map; callers may mutate it. */
  parents(): Map<string, string>
  /** child id -> the ids of every competing bearing edge. Fresh map. */
  contested(): Map<string, string[]>
}

export type HierarchyIndexOptions = {
  /**
   * The entity set the hierarchy is being read over. Supplying it is what lets the
   * index tell `"unresolvable"` from `"root"` and `"unknown"` from `"root"` — three
   * answers `withDerivedParents` structurally cannot distinguish, because it sees the
   * entity set and the derived map but never the edge that produced the value.
   */
  entityIds?: ReadonlySet<string>
  /**
   * Read the hierarchy as at this date rather than as at now. Plumbing only: no UI
   * reaches it. See `isHierarchyBearing`'s note on why a date control would be a
   * worse answer than none over the real project.
   */
  onDate?: string
  /**
   * Overrides which edges place a child under a parent. Defaults to
   * `isHierarchyBearing`, which is also what `validateRelationships` counts, so the
   * derivation and the control cannot come to different conclusions about one pair of
   * edges. Injected for tests and for a future task-organisation view; production code
   * passes `onDate` at most.
   */
  bearing?: (rel: Relationship) => boolean
}

const ROOT: ParentLink = { state: "root" }
const UNKNOWN: ParentLink = { state: "unknown" }

/**
 * The edge-backed answer to "who is this entity under", for every entity at once.
 *
 * Two or more competing edges do not elect a winner (Q40). Picking one would silently
 * resolve a finding a human is supposed to adjudicate, so the child gets `contested`
 * and every competing edge travels with it. Two edges from the same child to the same
 * parent are still two competing edges: they are two separate assertions, and
 * collapsing them would be the derivation deciding they say the same thing.
 *
 * The edge reads "A <type> B" with `fromId` always A, so the CHILD is `fromId` and the
 * PARENT is `toId` — the same keying `countActiveOrganicParents` uses.
 *
 * With `entityIds` supplied, an edge whose CHILD is outside the set contributes
 * nothing and that id reads `unknown`. Such an edge is a `dangling-endpoint`, which
 * `validateRelationships` reports and `load.ts` treats as making the file unopenable,
 * so a second policy for it here would be a second answer to a settled question.
 *
 * `unresolvable` is Trap T15: a single bearing edge naming a parent that is not in the
 * entity set. Deriving it would write a `parent_id` that makes the NEXT load throw. The
 * neighbouring case — a parent that exists but is of the other kind — is decided by
 * `crossKindParentEvents`, which needs the kinds that neither the edge set nor this
 * index carries.
 */
export function hierarchyIndex(
  rels: readonly Relationship[],
  options?: HierarchyIndexOptions,
): HierarchyIndex {
  const entityIds = options?.entityIds
  const onDate = options?.onDate
  const bearing = options?.bearing ?? ((rel: Relationship) => isHierarchyBearing(rel, onDate))

  const edgesByChild = new Map<string, Relationship[]>()
  for (const rel of rels) {
    if (!bearing(rel)) continue
    if (entityIds != null && !entityIds.has(rel.fromId)) continue
    const existing = edgesByChild.get(rel.fromId)
    if (existing == null) edgesByChild.set(rel.fromId, [rel])
    else existing.push(rel)
  }

  // Built in edge-scan order and read back in it, so the ledger rows a load mints from
  // `contested()` land in the file in the order the edges sit in the table rather than
  // in whatever order a rebuilt map happens to produce.
  const linkByChild = new Map<string, ParentLink>()
  for (const [childId, edges] of edgesByChild) {
    const only = edges.length === 1 ? edges[0] : undefined
    if (only == null) {
      linkByChild.set(childId, { state: "contested", via: edges })
    } else if (entityIds != null && !entityIds.has(only.toId)) {
      linkByChild.set(childId, { state: "unresolvable", parentId: only.toId, via: edges })
    } else {
      linkByChild.set(childId, { state: "parent", parentId: only.toId, via: edges })
    }
  }

  function linkFor(id: string): ParentLink {
    if (entityIds != null && !entityIds.has(id)) return UNKNOWN
    return linkByChild.get(id) ?? ROOT
  }

  function parents(): Map<string, string> {
    const map = new Map<string, string>()
    for (const [childId, link] of linkByChild) {
      if (link.state === "parent") map.set(childId, link.parentId)
    }
    return map
  }

  function contested(): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const [childId, link] of linkByChild) {
      if (link.state === "contested") map.set(childId, link.via.map((edge) => edge.id))
    }
    return map
  }

  return { linkFor, parents, contested }
}
