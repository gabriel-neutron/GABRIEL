import type { GeoPackage } from "@ngageoint/geopackage"
import type { Claim } from "@/core/provenance/claim"
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
  { prop: "credibility", column: "credibility", sqlType: "INTEGER", encode: (v) => (v != null ? Number(v) : null), decode: (raw) => (raw != null ? (Number(raw) as Claim["credibility"]) : null) },
  { prop: "timestamp", column: "timestamp", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
]

export function createProvenanceClaimsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${PROVENANCE_CLAIMS_TABLE} (\n  ${buildCreateTableColumnDefs(provenanceClaimColumns).join(",\n  ")}\n)`,
  )
}

/**
 * Whole-table-missing check for a pre-E2 file. Ordered by `rowid` (insertion order),
 * not part of the generic column-descriptor SELECT — `ledgerProjection.ts`'s first-seen
 * ordering depends on it matching the order claims were originally written.
 */
export function readProvenanceClaims(geoPackage: GeoPackage): Claim[] {
  if (!tableExists(geoPackage.connection, PROVENANCE_CLAIMS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT *, rowid FROM ${PROVENANCE_CLAIMS_TABLE} ORDER BY rowid ASC`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(provenanceClaimColumns, row))
}

export function writeProvenanceClaims(geoPackage: GeoPackage, claims: Claim[]): void {
  for (const claim of claims) {
    insertRow(geoPackage.connection, PROVENANCE_CLAIMS_TABLE, provenanceClaimColumns, claim)
  }
}
