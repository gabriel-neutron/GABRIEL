import type { Relationship } from "./relationship"

/**
 * No date: active means the edge has not ended. With a date: the half-open
 * interval, so an edge ended on D is absent on D and present the day before.
 * Both comparisons are string compares, which is only sound on well-formed
 * YYYY-MM-DD input — malformed dates are caught separately as invalid-date.
 *
 * It lives beside `isHierarchyBearing` rather than in `validate.ts` because that
 * predicate is its only reader in `src/`: "active" is one half of what makes an
 * edge place a child under a parent, and separating them would put the interval
 * rule one import away from the only rule that consults it.
 */
export function isActive(rel: Relationship, onDate?: string): boolean {
  if (onDate === undefined) return rel.endDate == null
  const startedBy = rel.startDate == null || rel.startDate <= onDate
  const notYetEnded = rel.endDate == null || rel.endDate > onDate
  return startedBy && notYetEnded
}

/**
 * The single definition of "this edge places a child under a parent".
 * Consumed by `hierarchyIndex` AND by `countActiveOrganicParents`
 * (`validate.ts`), so the derivation and the control cannot disagree.
 *
 * - `subordinate_to`, unless `metadata.attachment` is `"attached"`. Absent
 *   attachment counts as organic (owner Ruling 2, 2026-07-29).
 * - `corporate_parent`, always — those 13 edges ARE the industry hierarchy
 *   (GABRIEL_V2_SLICE_0_1_BUILD.md:521-525).
 * - Active in both cases: `isActive(rel, onDate)`, which with no `onDate` is
 *   `endDate == null`.
 *
 * Organic-by-default is load-bearing, not a convenience. Requiring an explicit
 * "organic" would make the dual-subordination gate inert on exactly the
 * population it guards: attachment is optional everywhere, and the 999
 * subordinate_to edges minted from the legacy parent_id column carry none. The
 * spec asks this control to hold a real finding open — dual subordination "may
 * be true: block until a human records which it is, never until someone deletes
 * one, or the control destroys the finding"
 * (GABRIEL_V2_SLICE_0_1_BUILD.md:575-576) — and a control that is off by default
 * blocks nothing. Fail closed is the safety property.
 *
 * `onDate` is plumbing for an as-at hierarchy view and is threaded no further
 * than `hierarchyIndex`'s option of the same name. It is deliberately not
 * reachable from any UI: all 1,012 edges in the real project carry
 * `startDate: null, endDate: null`, so a date control would render the identical
 * tree for every date in history, which is a worse answer than no control at all.
 */
export function isHierarchyBearing(rel: Relationship, onDate?: string): boolean {
  if (rel.type === "corporate_parent") return isActive(rel, onDate)
  if (rel.type !== "subordinate_to") return false
  // Written `!==` so that no attachment, a null one and an undefined one all
  // read as organic; only the marked exception opts out (Trap T6, and the
  // ruling above).
  return rel.metadata?.attachment !== "attached" && isActive(rel, onDate)
}
