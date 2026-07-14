import type { GeoPackage } from "@ngageoint/geopackage"
import type { Claim } from "@/core/provenance/claim"
import { decodeAdmiraltyCredibility } from "@/core/provenance/admiralty"
import { decodeRatingMeta, encodeRatingMeta } from "@/core/provenance/ratingMeta"
import {
  buildCreateTableColumnDefs,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

export const PROVENANCE_CLAIMS_TABLE = "provenance_claims"

export const provenanceClaimColumns: ColumnDescriptor<Claim>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "entityId", column: "entity_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "field", column: "field", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "value", column: "value", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "sourceId", column: "source_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "credibility", column: "credibility", sqlType: "INTEGER", encode: (v) => (v != null ? Number(v) : null), decode: (raw) => decodeAdmiraltyCredibility(raw) },
  { prop: "timestamp", column: "timestamp", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  {
    prop: "credibilityMeta",
    column: "credibility_meta",
    sqlType: "TEXT",
    optional: true,
    fallbackSql: "NULL",
    encode: (v) => encodeRatingMeta(v as Claim["credibilityMeta"]),
    decode: (raw) => decodeRatingMeta(raw) as Claim["credibilityMeta"],
  },
]

export function createProvenanceClaimsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${PROVENANCE_CLAIMS_TABLE} (\n  ${buildCreateTableColumnDefs(provenanceClaimColumns).join(",\n  ")}\n)`,
  )
}

/**
 * Whole-table-missing check for a pre-E2 file. Ordered by explicit `timestamp` first
 * (ascending — an out-of-order re-assessment can't scramble first-seen logic), falling
 * back to `rowid` (insertion order) only for the untimestamped claims most rows still
 * carry today. `ledgerProjection.ts`'s first-seen URL projection depends on this order.
 */
export function readProvenanceClaims(geoPackage: GeoPackage): Claim[] {
  if (!tableExists(geoPackage.connection, PROVENANCE_CLAIMS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT *, rowid FROM ${PROVENANCE_CLAIMS_TABLE} ORDER BY (timestamp IS NULL) ASC, timestamp ASC, rowid ASC`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(provenanceClaimColumns, row))
}

/**
 * Clears the table before inserting so this function is safe to call more than once on
 * the same connection without risking a PRIMARY KEY violation (mirrors
 * `writeProvenanceSources`).
 */
export function writeProvenanceClaims(geoPackage: GeoPackage, claims: Claim[]): void {
  geoPackage.connection.run(`DELETE FROM ${PROVENANCE_CLAIMS_TABLE}`)
  for (const claim of claims) {
    insertRow(geoPackage.connection, PROVENANCE_CLAIMS_TABLE, provenanceClaimColumns, claim)
  }
}
