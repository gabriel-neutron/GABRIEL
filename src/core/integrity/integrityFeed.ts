import type { IntegrityEvent, IntegrityEventKind } from "./integrityEvent"

/**
 * The React-free half of the integrity reader: what order the events are read in, what each
 * kind is called in a sentence, and how a structured `detail` becomes printable rows. It
 * lives here rather than inside the panel because this repo has no React Testing Library --
 * logic that stays in a component is logic no test can reach.
 *
 * Naming is deliberately about what Gabriel DID, never about who was at fault. These strings
 * are read by an analyst deciding whether the dataset is publishable, and every one of these
 * conditions is a thing the tool declined to guess at, not a thing anyone got wrong.
 */
export const INTEGRITY_KIND_LABELS = {
  "hierarchy-migrated": "Hierarchy migrated",
  "multiple-active-hierarchy": "Contested parent",
  "cross-kind-parent": "Parent crosses kinds",
  "merge-dropped-edge": "Edge dropped in a merge",
  "invalid-entry": "Kept but not validated",
} as const satisfies Record<IntegrityEventKind, string>

/**
 * Unacknowledged first, then newest first, ties broken on the id.
 *
 * The tiebreak is not decoration: `commitRelationships` stamps every contest it mints in one
 * derivation with a single `now`, so same-millisecond timestamps are the common case here
 * rather than a corner one. Without it the order of a published audit trail would depend on
 * the input order, and two readers could legitimately print the same ledger differently.
 */
export function orderIntegrityFeed(events: readonly IntegrityEvent[]): IntegrityEvent[] {
  return [...events].sort((a, b) => {
    const acknowledged = Number(a.acknowledgedAt != null) - Number(b.acknowledgedAt != null)
    if (acknowledged !== 0) return acknowledged
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export type DetailRow = { key: string; value: string }

function renderValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (Array.isArray(value)) return value.map((item) => renderValue(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/**
 * `detail` holds entity and relationship IDS while `summary` holds names, so this is the
 * technical half of an event and is rendered under the sentence, not instead of it. Keys are
 * sorted so two readings of one event agree; `detail` is `Record<string, unknown>` by type
 * and its shape differs per kind, so nothing here may assume a key exists.
 */
export function summariseDetail(detail: Record<string, unknown>): DetailRow[] {
  return Object.keys(detail)
    .sort()
    .map((key) => ({ key, value: renderValue(detail[key]) }))
}
