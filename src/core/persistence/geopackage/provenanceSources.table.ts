import type { GeoPackage } from "@ngageoint/geopackage"
import type { Source } from "@/core/provenance/source"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

/**
 * Named `provenance_sources`, not bare `sources`: distinct from the legacy `units.sources`
 * string column and the unrelated `research_sources` fetch cache (researchSources.table.ts).
 */
export const PROVENANCE_SOURCES_TABLE = "provenance_sources"

export const provenanceSourceColumns: ColumnDescriptor<Source>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "url", column: "url", sqlType: "TEXT", constraints: "NOT NULL UNIQUE", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "domainType", column: "domain_type", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? (String(raw) as Source["domainType"]) : null) },
  { prop: "reliability", column: "reliability", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? (String(raw) as Source["reliability"]) : null) },
]

export function createProvenanceSourcesTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${PROVENANCE_SOURCES_TABLE} (\n  ${buildCreateTableColumnDefs(provenanceSourceColumns).join(",\n  ")}\n)`,
  )
}

/** Whole-table-missing check for a pre-E2 file that predates this table entirely. */
export function readProvenanceSources(geoPackage: GeoPackage): Source[] {
  if (!tableExists(geoPackage.connection, PROVENANCE_SOURCES_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(provenanceSourceColumns)} FROM ${PROVENANCE_SOURCES_TABLE}`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(provenanceSourceColumns, row))
}

export function writeProvenanceSources(geoPackage: GeoPackage, sources: Source[]): void {
  for (const source of sources) {
    insertRow(geoPackage.connection, PROVENANCE_SOURCES_TABLE, provenanceSourceColumns, source)
  }
}
