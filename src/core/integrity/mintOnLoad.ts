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
const CROSS_KIND_PREFIX = "integrity:cross-kind-parent:"
const INVALID_ENTRY_PREFIX = "integrity:invalid-entry:"
const STALE_PARENT_PREFIX = "integrity:invalid-entry:stale-parent:"

/** Only the name and the kind are read, so entities and any other named record share the shape. */
type KindedRecord = { id: string; name: string; kind: string }

type ParentedRecord = KindedRecord & { parentId: string | null }

function quoted(value: string): string {
  return "\"" + value + "\""
}

function labeller(entities: readonly KindedRecord[]): (id: string) => string {
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]))
  return (id: string): string => quoted(nameById.get(id) ?? id)
}

// There is no `multipleActiveHierarchyEvents` here. It lived in this file until Slice 3 and
// was a SECOND detection of a condition the derivation had already decided: it re-read
// `validateRelationships`' output to rediscover which children had two parents, while
// `hierarchyIndex` was handing the same answer back with the competing edges attached. ADR
// 0011 ruled the competing ids are returned "at the point the conflict is decided, so the
// caller mints the integrity event without running a second validation pass" — this was that
// pass. `contestedParentEvents.ts` is now the only minter, on the load path and the edit path
// alike, so a contest recorded while an analyst works and the same contest re-detected by the
// next load cannot come out worded two ways.
//
// The `multiple-active-hierarchy` VIOLATION code stays in `validateRelationships`: that
// function is documented as callable without an entity set, and deleting the code would
// silence dual subordination for every caller that is not the loader.

/**
 * T14/Slice 3. The persisted `parent_id` on a migrated file is a DERIVATION, rewritten from
 * the edge set on every save — so a value that no longer resolves is a stale copy, not a
 * record, and `withDerivedParents` is about to overwrite it. Its only surviving effect was
 * the ability to make the project unopenable, which is a control destroying the work it
 * exists to protect. It is recorded and left unread instead.
 *
 * `invalid-entry` rather than a kind of its own, on that kind's own terms: something the
 * project carries could not be validated, and is kept exactly as it stands rather than
 * discarded. Which condition produced it is in `detail`, never guessed from the kind.
 */
export function stalePersistedParentEvents(
  stale: readonly ParentedRecord[],
  entities: readonly KindedRecord[],
  now: string,
): IntegrityEvent[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  const label = labeller(entities)
  const events: IntegrityEvent[] = []
  for (const child of stale) {
    const parentId = child.parentId
    if (parentId == null) continue
    // Two causes reach this function and a reader needs to know which: a parent that is gone,
    // and one that is there but of the other kind.
    const parent = byId.get(parentId)
    const clause = parent == null
      ? "under a parent this project does not contain"
      : "under " + label(parentId) + ", which crosses entity kinds"
    events.push({
      id: STALE_PARENT_PREFIX + child.id,
      kind: "invalid-entry",
      createdAt: now,
      summary: label(child.id) + " (" + child.kind + ") is stored " + clause +
        ", so the stored value is left unread and the relationships are taken as the record " +
        "of who sits under whom.",
      detail: {
        code: "stale-parent",
        entityId: child.id,
        entityKind: child.kind,
        parentId,
        parentKind: parent?.kind ?? null,
      },
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
 * It reads `unresolvable` rather than deleting from `parentById`, which is what it used to do.
 * Deleting made this function part of the derivation while looking like a reporter, and it
 * corrected only the map: the index went on answering `"parent"` for the same pair, so once
 * the six consumers began reading the index they saw a hierarchy the field denied. The
 * derivation now refuses the pair itself and hands the refusals over to be named.
 *
 * A parent outside the entity set arrives here too, and is skipped: that is T15's case, with
 * no second kind to compare against.
 */
export function crossKindParentEvents(
  unresolvable: ReadonlyMap<string, string>,
  entities: readonly KindedRecord[],
  now: string,
): IntegrityEvent[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  const events: IntegrityEvent[] = []
  for (const [childId, parentId] of unresolvable) {
    const child = byId.get(childId)
    const parent = byId.get(parentId)
    if (child == null || parent == null) continue
    if (child.kind === parent.kind) continue
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
  "unknown-type": "uses a relationship type this vocabulary does not define",
  "date-order": "is dated as having started after it ended",
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
    // One "recorded" per sentence, and it is the one in the tail that carries the meaning:
    // the edge is kept as it stands. Repeating it in the subject and the clause made the
    // sentence read as a template rather than as something written (criterion 82).
    const subject = rel == null
      ? "A relationship known only as " + quoted(violation.relationshipId)
      : "The relationship from " + label(rel.fromId) + " to " + label(rel.toId)
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
