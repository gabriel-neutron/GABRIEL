import type { GeoPackage } from "@ngageoint/geopackage"
import type { Relationship, RelationshipMetadata } from "@/core/relationship/relationship"
import { decodeExportOverride } from "@/core/relationship/relationship"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

/**
 * Slice 2B: relationships become first-class persisted rows instead of a `parentId`
 * column on the entity — see `relationship.ts`.
 *
 * Adding a column here later is not a one-line edit. Every descriptor below is
 * unconditional, which is only safe because this table is always created whole. A
 * column introduced by a later slice must be declared with `columnDescriptor.ts`'s
 * missing-column flags, `readRelationships` must switch to the `getTableColumnNames`
 * + two-argument `buildSelectClause` form (`provenanceSources.table.ts:53-60`), and
 * `save.ts` must back-fill the column on files reopened from a `baseBuffer`. Copying
 * `readRatingEvents`'s single-argument `buildSelectClause` at that point throws on
 * every read, and `load.ts` re-wraps it as a total load failure.
 */
export const RELATIONSHIPS_TABLE = "relationships"

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/**
 * `Relationship.metadata` is required (`relationship.ts:49`, no `?`), so a missing or
 * corrupt column decodes to `{}` and never to `undefined` — a value the type says
 * cannot exist. The precedent is `decodeAssessor` (`ratingEvents.table.ts:20-29`), a
 * neutral non-undefined default for a NOT NULL column behind a required field, and
 * emphatically not `decodeAliases` (`validation.ts:30,33`), which decodes to
 * `undefined`.
 */
function decodeMetadata(raw: unknown): RelationshipMetadata {
  const candidate = typeof raw === "string" && raw.length > 0 ? tryParse(raw) : raw
  if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
    return candidate as RelationshipMetadata
  }
  return {}
}

/**
 * Emits `null` for a metadata bag with no own enumerable keys, which is most edges.
 * `encodeRatingMeta` is the wrong thing to copy here: it does not test emptiness, so
 * it would persist the literal string `"{}"` on every edge that carries no metadata.
 */
function encodeMetadata(metadata: RelationshipMetadata): string | null {
  if (metadata == null || Object.keys(metadata).length === 0) return null
  return JSON.stringify(metadata)
}

export const relationshipColumns: ColumnDescriptor<Relationship>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "fromId", column: "from_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "toId", column: "to_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "type", column: "type", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") as Relationship["type"] },
  { prop: "startDate", column: "start_date", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "endDate", column: "end_date", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  // Nullable, deliberately, against §4.4's own column list — owner ruling 2026-07-31, Q2B-19.
  // §4.4 asks for both `NOT NULL` and an encoder emitting `null` for the empty bag, and SQLite
  // cannot hold both: 1010 of the 1012 minted edges carry `{}`, so every save of a project with a
  // hierarchy failed the constraint. The decode side settles which half was wrong — `decode(null)`
  // is required to yield `{}`, which only means anything if `null` is storable.
  { prop: "metadata", column: "metadata", sqlType: "TEXT", encode: (v) => encodeMetadata(v as RelationshipMetadata), decode: (raw) => decodeMetadata(raw) },
  { prop: "exportOverride", column: "export_override", sqlType: "TEXT", encode: (v) => (v != null ? JSON.stringify(v) : null), decode: decodeExportOverride },
]

export function createRelationshipsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${RELATIONSHIPS_TABLE} (\n  ${buildCreateTableColumnDefs(relationshipColumns).join(",\n  ")}\n)`,
  )
}

/**
 * DEVIATION FROM THE HOUSE PATTERN, AND IT IS LOAD-BEARING. Returns `null` when the
 * table does not exist and `[]` when it exists and is empty. Every other `read<X>` in
 * this directory returns `[]` for both.
 *
 * The hierarchy migration gates on *table absent*, never on *no rows* (trap T11).
 * Deterministic `hier:` ids stop duplication, not resurrection: after the first save
 * an entity's `parentId` holds the derivation's output rather than original data, so a
 * second run that re-minted edges from that column would resurrect an edge an analyst
 * had deleted, and recreate the dual subordination they deleted it to resolve. That
 * failure is far harder to see, and far harder to undo, than a duplicate row.
 *
 * Ordered by `ORDER BY rowid ASC` — insertion order, as every sibling table does.
 */
export function readRelationships(geoPackage: GeoPackage): Relationship[] | null {
  if (!tableExists(geoPackage.connection, RELATIONSHIPS_TABLE)) return null
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(relationshipColumns)} FROM ${RELATIONSHIPS_TABLE} ORDER BY rowid ASC`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(relationshipColumns, row))
}

/**
 * Clears the table before inserting so this function is safe to call more than once on
 * the same connection without risking a PRIMARY KEY violation (mirrors
 * `writeProvenanceSources`). The caller always passes the full in-session edge set, so
 * this re-writes the same snapshot rather than truncating real data.
 */
export function writeRelationships(geoPackage: GeoPackage, rels: Relationship[]): void {
  geoPackage.connection.run(`DELETE FROM ${RELATIONSHIPS_TABLE}`)
  for (const rel of rels) {
    insertRow(geoPackage.connection, RELATIONSHIPS_TABLE, relationshipColumns, rel)
  }
}
