import type { Relationship } from "@/core/relationship/relationship"
import type { IntegrityEvent } from "./integrityEvent"

/** Deterministic, and byte-identical to the id `load.ts` mints for this finding, so a contest
 *  recorded while an analyst edits and the same contest re-detected by the next load are ONE
 *  row rather than two. The first-colon namespacing matches the `hier:` edge ids. */
const MULTIPLE_ACTIVE_PREFIX = "integrity:multiple-active-hierarchy:"

/** Only the label is read, so entities and any other named record share the shape. */
type NamedRecord = { id: string; name: string }

function quoted(value: string): string {
  return "\"" + value + "\""
}

/**
 * The durable rows for the contests `activeParentMap` has just decided, minted from its
 * `contested` map — at the point the conflict is decided, so a caller records the finding
 * without a second validation pass (ADR 0011; the build spec's §4.3 is why `contested` is
 * returned at all).
 *
 * One event per contested CHILD, not per offending edge: the finding is "this entity has two
 * parents", which the competing edges assert jointly. Id, `kind`, `summary` and `detail` keys
 * match `load.ts`'s `multipleActiveHierarchyEvents` exactly, so a row minted in-session and a
 * row minted by a later load of the same file are indistinguishable — the alternative is a
 * ledger where the same finding reads two ways depending on which path noticed it.
 *
 * An id already on the ledger is left exactly as it stands rather than re-minted: the existing
 * row may carry an acknowledgement someone typed, which a fresh copy cannot, and two rows
 * sharing an id would abort the save on the table's PRIMARY KEY (Q2B-8b). A row whose child is
 * no longer contested is KEPT, for the same reason a load keeps it: a finding is retired by
 * being acknowledged, never by the condition quietly going away (Q2B-23).
 *
 * `now` is injected so this stays pure and reproducible; the clock lives at the store boundary.
 */
export function withContestedParentEvents(
  ledger: IntegrityEvent[],
  contested: Map<string, string[]>,
  rels: readonly Relationship[],
  entities: readonly NamedRecord[],
  now: string,
): IntegrityEvent[] {
  if (contested.size === 0) return ledger
  const known = new Set(ledger.map((event) => event.id))
  const parentByRelId = new Map(rels.map((rel) => [rel.id, rel.toId]))
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]))
  const label = (id: string): string => quoted(nameById.get(id) ?? id)

  const minted: IntegrityEvent[] = []
  for (const [childId, relationshipIds] of contested) {
    const id = MULTIPLE_ACTIVE_PREFIX + childId
    if (known.has(id)) continue
    // Every id in `contested` came from `rels`, so nothing is dropped here in practice; the
    // filter is what keeps a `detail` payload free of an id the edge set cannot explain.
    const parentIds = relationshipIds
      .map((relationshipId) => parentByRelId.get(relationshipId))
      .filter((parentId): parentId is string => parentId != null)
    minted.push({
      id,
      kind: "multiple-active-hierarchy",
      createdAt: now,
      summary: label(childId) + " is placed under " + String(relationshipIds.length) +
        " parents at once (" + parentIds.map(label).join(", ") +
        "), so it is left without a derived parent until a person records which is correct.",
      detail: { childId, relationshipIds, parentIds },
    })
  }
  return minted.length === 0 ? ledger : [...ledger, ...minted]
}
