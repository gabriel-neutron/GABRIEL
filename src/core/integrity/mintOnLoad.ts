import type { Relationship } from "@/core/relationship/relationship"
import type { RelationshipViolation, RelationshipViolationCode } from "@/core/relationship/validate"
import type { IntegrityEvent } from "./integrityEvent"

/**
 * Every integrity event a load mints once the edge set has been validated.
 *
 * They live here rather than in `load.ts` because none of them takes a `GeoPackage`: what
 * to record about a flawed edge set is integrity policy, and it was sitting inside a
 * persistence adapter. `load.ts` keeps only the two conditions that make a file unopenable.
 *
 * Ids are deterministic and shaped `integrity:<kind>:<discriminator>`, so a re-detected
 * condition updates one row instead of accumulating rows — the same first-colon namespacing
 * `contestedParentEvents.ts` and the `hier:` edge ids use.
 */
const MULTIPLE_ACTIVE_PREFIX = "integrity:multiple-active-hierarchy:"
const CROSS_KIND_PREFIX = "integrity:cross-kind-parent:"
const INVALID_ENTRY_PREFIX = "integrity:invalid-entry:"

/** Only the name and the kind are read, so entities and any other named record share the shape. */
type KindedRecord = { id: string; name: string; kind: string }

function quoted(value: string): string {
  return "\"" + value + "\""
}

function labeller(entities: readonly KindedRecord[]): (id: string) => string {
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]))
  return (id: string): string => quoted(nameById.get(id) ?? id)
}

/**
 * One event per contested CHILD, not per offending edge: the finding is "this entity has two
 * parents", which two edges assert jointly. The load's derivation decides the same condition
 * from the same predicate (`activeParent.ts`), so the row and the derivation cannot disagree —
 * a contested child is absent from `parentById` (Q40) and named here.
 */
export function multipleActiveHierarchyEvents(
  violations: readonly RelationshipViolation[],
  rels: readonly Relationship[],
  entities: readonly KindedRecord[],
  now: string,
): IntegrityEvent[] {
  const relById = new Map(rels.map((rel) => [rel.id, rel]))
  const competingByChild = new Map<string, Relationship[]>()
  for (const violation of violations) {
    if (violation.code !== "multiple-active-hierarchy") continue
    const rel = relById.get(violation.relationshipId)
    if (rel == null) continue
    const competing = competingByChild.get(rel.fromId)
    if (competing == null) competingByChild.set(rel.fromId, [rel])
    else competing.push(rel)
  }

  const label = labeller(entities)
  const events: IntegrityEvent[] = []
  for (const [childId, competing] of competingByChild) {
    events.push({
      id: MULTIPLE_ACTIVE_PREFIX + childId,
      kind: "multiple-active-hierarchy",
      createdAt: now,
      summary: label(childId) + " is placed under " + String(competing.length) +
        " parents at once (" + competing.map((rel) => label(rel.toId)).join(", ") +
        "), so it is left without a derived parent until a person records which is correct.",
      detail: { childId, relationshipIds: competing.map((rel) => rel.id), parentIds: competing.map((rel) => rel.toId) },
    })
  }
  return events
}

/**
 * T10. `Relationship` places no restriction on the kinds of its endpoints, but the loader's
 * entity validation throws when a `parentId` does not resolve within its own kind — so a
 * cross-kind hierarchy-bearing edge would derive a parent that makes the NEXT load throw.
 * The pair leaves the derivation by OMISSION (T15: a dangling parent is never written) and is
 * recorded instead. Nothing throws: the edge itself is a legitimate record, and throwing would
 * make a legitimate record unopenable.
 *
 * Mutates the map it is handed — the one the derivation built moments ago for this load, that
 * nobody else holds. Deleting during iteration is safe: each entry is examined once, and one
 * removed before it is reached is simply never visited.
 */
export function crossKindParentEvents(
  parentById: Map<string, string>,
  entities: readonly KindedRecord[],
  now: string,
): IntegrityEvent[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  const events: IntegrityEvent[] = []
  for (const [childId, parentId] of parentById) {
    const child = byId.get(childId)
    const parent = byId.get(parentId)
    // A parent outside the entity set is T15's case and not this one: the derivation already
    // omits it by the same rule, and there is no second kind to compare against.
    if (child == null || parent == null) continue
    if (child.kind === parent.kind) continue
    parentById.delete(childId)
    events.push({
      id: CROSS_KIND_PREFIX + childId,
      kind: "cross-kind-parent",
      createdAt: now,
      summary: quoted(child.name) + " (" + child.kind + ") is recorded under " +
        quoted(parent.name) + " (" + parent.kind + "), which crosses entity kinds, so no " +
        "parent is derived for it and the relationship is kept exactly as recorded.",
      detail: { childId, childKind: child.kind, parentId, parentKind: parent.kind },
    })
  }
  return events
}

/**
 * The six violation codes that are neither fatal nor a kind of their own. Typed against
 * `RelationshipViolationCode`, so renaming a code fails to compile here instead of quietly
 * dropping its record; a code absent from this table is a code recorded elsewhere
 * (`dangling-endpoint` and `self-loop` throw, `multiple-active-hierarchy` has its own kind).
 *
 * The clauses avoid the machine name of the code and of the type: the diagnostic wording the
 * validator produced belongs in `detail`, and this sentence is read by a person.
 */
const VIOLATION_CLAUSE: Partial<Record<RelationshipViolationCode, string>> = {
  "unknown-type": "is recorded under a relationship type this vocabulary does not define",
  "date-order": "is recorded as having started after it ended",
  "invalid-date": "carries a date that is not a calendar date",
  "missing-required-date": "is missing the start date its type requires",
  "invalid-metadata": "carries a qualifier its type does not declare, or a value outside the set that type allows",
  "invalid-export-override": "carries an export authorisation that does not hold",
}

/**
 * §7 step 4: every violation that is not fatal becomes an `integrity_events` row (owner ruling,
 * 2026-08-03 — this was a `console.warn`, which is a log and not a record). Nothing throws:
 * none of these six contradicts the entity set, and every edge is returned exactly as recorded.
 *
 * The discriminator is code-then-edge, so two different violations on the same edge are two
 * rows rather than one overwriting the other, and re-detecting either updates its own row.
 */
export function relationshipViolationEvents(
  violations: readonly RelationshipViolation[],
  rels: readonly Relationship[],
  entities: readonly KindedRecord[],
  now: string,
): IntegrityEvent[] {
  const relById = new Map(rels.map((rel) => [rel.id, rel]))
  const label = labeller(entities)
  const events: IntegrityEvent[] = []
  for (const violation of violations) {
    const clause = VIOLATION_CLAUSE[violation.code]
    if (clause == null) continue
    const rel = relById.get(violation.relationshipId)
    // Named endpoints where the edge is in hand; an edge the set cannot explain is still
    // recorded, under the only name it has.
    const subject = rel == null
      ? "A relationship recorded as " + quoted(violation.relationshipId)
      : "The relationship recorded from " + label(rel.fromId) + " to " + label(rel.toId)
    events.push({
      id: INVALID_ENTRY_PREFIX + violation.code + ":" + violation.relationshipId,
      kind: "invalid-entry",
      createdAt: now,
      summary: subject + " " + clause +
        ", so it is kept exactly as recorded and left for a person to correct.",
      detail: { code: violation.code, relationshipId: violation.relationshipId, detail: violation.detail },
    })
  }
  return events
}
