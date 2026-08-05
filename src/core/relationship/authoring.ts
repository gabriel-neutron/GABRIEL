import type { Relationship, RelationshipDraft } from "./relationship"
import type { RelationshipViolation } from "./validate"
import { validateRelationships } from "./validate"

/**
 * Authoring a typed edge, as three pure edits of the edge set.
 *
 * Every relationship write in Gabriel used to go through `withActiveParent`, the parent picker,
 * so eleven of the twelve record-tier types were modelled, validated, persisted and exported
 * while being unreachable. These functions are the general form: any type, any pair, from a
 * draft the analyst filled in.
 *
 * They are deliberately not `withActiveParent`. That writer REPLACES the child's hierarchy edge,
 * because a parent picker that appended would manufacture a contest out of an interface gesture.
 * Authoring appends, because an analyst adding a second `corporate_parent` is making a claim
 * about the world, and a real conflict between two records is a finding worth blocking on
 * (ADR 0011 / Q40). The refusal below is how they are told; end-dating one of the two is how
 * they resolve it.
 *
 * No provenance parameter, and no source field on the result. A `Relationship` carries no
 * provenance at all until Slice 6 (Claims on Relationships); attaching one here would be a model
 * change wearing a form's clothes. Publication safety meanwhile rests where it already does — the
 * export gate's endpoint proxy, which publishes an edge only when both its endpoints carry a
 * claim.
 */

export type EdgeAuthoringOutcome =
  | { ok: true; relationships: Relationship[]; edge: Relationship }
  | { ok: false; violations: RelationshipViolation[] }

export type EdgeEditOutcome =
  | { ok: true; relationships: Relationship[] }
  | { ok: false; violations: RelationshipViolation[] }

function fingerprint(violation: RelationshipViolation): string {
  return JSON.stringify([violation.code, violation.relationshipId, violation.detail])
}

/**
 * The violations `next` has that `before` did not — by identity, not by count.
 *
 * The distinction is the whole control. `validateRelationships` reports on a corpus, and the
 * analyst's corpus is 1,012 edges nobody has proved clean; refusing a write because the total is
 * non-empty would let one pre-existing fault make authoring impossible everywhere, and refusing
 * on a rising count would let a write that fixes one fault and introduces another pass silently.
 * Comparing the sets answers the only question the editor is entitled to ask: did THIS edit break
 * something?
 *
 * A corpus-wide rule reports once per offending edge, so an appended hierarchy edge surfaces the
 * incumbent alongside the newcomer — which is what the analyst needs in order to decide which of
 * the two to end-date.
 */
function introducedViolations(before: Relationship[], next: Relationship[], entityIds?: Set<string>): RelationshipViolation[] {
  const known = new Set(validateRelationships(before, entityIds).map(fingerprint))
  return validateRelationships(next, entityIds).filter((v) => !known.has(fingerprint(v)))
}

/**
 * `edgeId` is injected for the same reason `core/` takes it injected everywhere else: this
 * module mints no ids and reads no clock, so its result is reproducible under test.
 *
 * `entityIds` is optional and its absence only skips the dangling-endpoint check, mirroring
 * `validateRelationships`. Callers with the entity set should pass it — an edge to an id that
 * is not there is exactly the mistake a picker cannot prevent when the target list is stale.
 */
export function withAuthoredEdge(
  rels: Relationship[],
  draft: RelationshipDraft,
  edgeId: string,
  entityIds?: Set<string>,
): EdgeAuthoringOutcome {
  const edge: Relationship = { ...draft, id: edgeId }
  const next = [...rels, edge]
  const violations = introducedViolations(rels, next, entityIds)
  if (violations.length > 0) return { ok: false, violations }
  return { ok: true, relationships: next, edge }
}

/**
 * Ends an edge, or reopens it with `null`.
 *
 * End-dating is what makes a change over time expressible — "ownership transferred three weeks
 * after designation" is two edges, one of them ended — and it is the only way to retire a record
 * without deleting it, which for a documentary record is the difference between "this stopped"
 * and "this was never said".
 *
 * An id the set does not hold returns the set unchanged rather than failing: the caller renders
 * from the same array it passes in, so a miss means the row is already gone.
 */
export function withEndDatedEdge(
  rels: Relationship[],
  edgeId: string,
  endDate: string | null,
  entityIds?: Set<string>,
): EdgeEditOutcome {
  const next = rels.map((rel) => (rel.id === edgeId ? { ...rel, endDate } : rel))
  const violations = introducedViolations(rels, next, entityIds)
  if (violations.length > 0) return { ok: false, violations }
  return { ok: true, relationships: next }
}

/**
 * Unvalidated on purpose, and the only one of the three that is: removing an edge can resolve a
 * violation but never introduce one — every rule in `validateRelationships` is either per-edge or
 * counts competitors, so a smaller set can only score the same or better.
 */
export function withoutEdge(rels: Relationship[], edgeId: string): Relationship[] {
  return rels.filter((rel) => rel.id !== edgeId)
}
