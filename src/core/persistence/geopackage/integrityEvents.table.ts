import type { GeoPackage } from "@ngageoint/geopackage"
import { decodeIntegrityEvent, type IntegrityEvent } from "@/core/integrity/integrityEvent"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

/**
 * Slice 2B: a durable, append-and-acknowledge record of integrity problems — see
 * `integrityEvent.ts`.
 *
 * Adding a column here later is not a one-line edit. Every descriptor below is
 * unconditional, which is only safe because this table is always created whole. A
 * column introduced by a later slice must be declared with `columnDescriptor.ts`'s
 * missing-column flags, `readIntegrityEvents` must switch to the `getTableColumnNames`
 * + two-argument `buildSelectClause` form (`provenanceSources.table.ts:53-60`), and
 * `save.ts` must back-fill the column on files reopened from a `baseBuffer`. Copying
 * `readRatingEvents`'s single-argument `buildSelectClause` at that point throws on
 * every read, and `load.ts` re-wraps it as a total load failure.
 */
export const INTEGRITY_EVENTS_TABLE = "integrity_events"

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/**
 * `IntegrityEvent.detail` is required (`integrityEvent.ts:35`, no `?`), so a missing or
 * corrupt column decodes to `{}` and never to `undefined` — a value the type says
 * cannot exist. The precedent is `decodeAssessor` (`ratingEvents.table.ts:20-29`), not
 * `decodeAliases`. Kept local rather than shared with `integrityEvent.ts`'s own
 * `decodeDetail`, which is private to that module's whole-record decoder.
 */
function decodeDetail(raw: unknown): Record<string, unknown> {
  const candidate = typeof raw === "string" && raw.length > 0 ? tryParse(raw) : raw
  if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>
  }
  return {}
}

/**
 * Emits `null` for a payload with no own enumerable keys, which is the common case.
 * `encodeRatingMeta` is the wrong thing to copy here: it does not test emptiness, so it
 * would persist the literal string `"{}"` on every event that carries no payload.
 */
function encodeDetail(detail: Record<string, unknown>): string | null {
  if (detail == null || Object.keys(detail).length === 0) return null
  return JSON.stringify(detail)
}

export const integrityEventColumns: ColumnDescriptor<IntegrityEvent>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "kind", column: "kind", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") as IntegrityEvent["kind"] },
  { prop: "createdAt", column: "created_at", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "summary", column: "summary", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "detail", column: "detail", sqlType: "TEXT", encode: (v) => encodeDetail(v as Record<string, unknown>), decode: (raw) => decodeDetail(raw) },
  { prop: "acknowledgedBy", column: "acknowledged_by", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  { prop: "acknowledgedAt", column: "acknowledged_at", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  { prop: "acknowledgedNote", column: "acknowledged_note", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
]

export function createIntegrityEventsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${INTEGRITY_EVENTS_TABLE} (\n  ${buildCreateTableColumnDefs(integrityEventColumns).join(",\n  ")}\n)`,
  )
}

/**
 * Whole-table-missing check for a pre-2B file: returns `[]`, the ordinary house
 * pattern. The asymmetry with `readRelationships` — which returns `null` for an absent
 * table — is deliberate, not an oversight: the hierarchy migration gates on the
 * relationships table being absent, and nothing gates on this one. An unrecorded
 * integrity event is a gap in an audit trail; a re-run migration would resurrect edges
 * an analyst deleted.
 *
 * Ordered by `ORDER BY rowid ASC` — append order is the log's own chronology.
 *
 * Every row goes through `decodeIntegrityEvent` after the per-column decode, and a row it
 * rejects is DROPPED rather than returned: the column decoders coerce, so without the check a
 * row carrying `kind = "whatever"` would be handed to the store typed as an `IntegrityEventKind`
 * and re-written verbatim on the next save, laundering a corrupt row into the record. Dropping
 * rather than throwing is the same fail-closed rule the decoder itself documents — a corrupt
 * integrity row must never make a project unopenable. The drop is surfaced (never silent),
 * because a discarded durable record is exactly the kind of loss this table exists to log.
 */
export function readIntegrityEvents(geoPackage: GeoPackage): IntegrityEvent[] {
  if (!tableExists(geoPackage.connection, INTEGRITY_EVENTS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(integrityEventColumns)} FROM ${INTEGRITY_EVENTS_TABLE} ORDER BY rowid ASC`,
  ) as Record<string, unknown>[]
  const events: IntegrityEvent[] = []
  const rejected: Record<string, unknown>[] = []
  for (const row of rows) {
    const event = decodeIntegrityEvent(decodeRow(integrityEventColumns, row))
    if (event == null) rejected.push(row)
    else events.push(event)
  }
  if (rejected.length !== 0) {
    console.warn(
      "readIntegrityEvents: dropped " + String(rejected.length) + " structurally invalid row(s):",
      rejected,
    )
  }
  return events
}

/**
 * Clears the table before inserting so this function is safe to call more than once on
 * the same connection without risking a PRIMARY KEY violation (mirrors
 * `writeProvenanceSources`). Event ids are deterministic, so re-detection updates one
 * row rather than accumulating duplicates.
 */
export function writeIntegrityEvents(geoPackage: GeoPackage, events: IntegrityEvent[]): void {
  geoPackage.connection.run(`DELETE FROM ${INTEGRITY_EVENTS_TABLE}`)
  for (const event of events) {
    insertRow(geoPackage.connection, INTEGRITY_EVENTS_TABLE, integrityEventColumns, event)
  }
}
