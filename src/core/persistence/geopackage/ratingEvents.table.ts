import type { GeoPackage } from "@ngageoint/geopackage"
import type { RatingEvent } from "@/core/provenance/ratingEvent"
import type { RatingAssessor } from "@/core/provenance/ratingMeta"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

/** Phase 4 (v1.5): append-only audit trail — see `ratingEvent.ts`. */
export const RATING_EVENTS_TABLE = "rating_events"

function encodeAssessor(assessor: RatingAssessor): string {
  return JSON.stringify(assessor)
}

function decodeAssessor(raw: unknown): RatingAssessor {
  if (typeof raw === "string" && raw.length > 0) {
    try {
      return JSON.parse(raw) as RatingAssessor
    } catch {
      // fall through to the neutral default below
    }
  }
  return { kind: "type-table" }
}

export const ratingEventColumns: ColumnDescriptor<RatingEvent>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "targetType", column: "target_type", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") as RatingEvent["targetType"] },
  { prop: "targetId", column: "target_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "kind", column: "kind", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") as RatingEvent["kind"] },
  { prop: "value", column: "value", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "assessor", column: "assessor", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => encodeAssessor(v as RatingAssessor), decode: (raw) => decodeAssessor(raw) },
  { prop: "timestamp", column: "timestamp", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
]

export function createRatingEventsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${RATING_EVENTS_TABLE} (\n  ${buildCreateTableColumnDefs(ratingEventColumns).join(",\n  ")}\n)`,
  )
}

/** Whole-table-missing check for a pre-Phase-4 file. Ordered by `rowid` — append order is the history's own chronology. */
export function readRatingEvents(geoPackage: GeoPackage): RatingEvent[] {
  if (!tableExists(geoPackage.connection, RATING_EVENTS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(ratingEventColumns)} FROM ${RATING_EVENTS_TABLE} ORDER BY rowid ASC`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(ratingEventColumns, row))
}

/**
 * Clears the table before inserting so this function is safe to call more than once on
 * the same connection (mirrors `writeProvenanceSources`) — the caller always passes the
 * full in-session event log (append-only in memory), so this re-writes the same
 * snapshot rather than truncating real history.
 */
export function writeRatingEvents(geoPackage: GeoPackage, events: RatingEvent[]): void {
  geoPackage.connection.run(`DELETE FROM ${RATING_EVENTS_TABLE}`)
  for (const event of events) {
    insertRow(geoPackage.connection, RATING_EVENTS_TABLE, ratingEventColumns, event)
  }
}
