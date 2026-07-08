import type { GeoPackage } from "@ngageoint/geopackage"
import type { Organisation } from "@/types/organisation.types"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"
import { decodeOrganisationType, decodePositionMode } from "./validation"

export const ORGANISATIONS_TABLE = "organisations"

export const organisationColumns: ColumnDescriptor<Organisation>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "name", column: "name", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  {
    prop: "type",
    column: "type",
    sqlType: "TEXT",
    constraints: "NOT NULL",
    encode: (v) => String(v ?? "other"),
    decode: (raw) => decodeOrganisationType(raw),
  },
  { prop: "parentId", column: "parent_id", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "notes", column: "notes", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "sources", column: "sources", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "osmRelationId", column: "osm_relation_id", sqlType: "INTEGER", encode: (v) => (v != null ? Number(v) : null), decode: (raw) => (raw != null ? Number(raw) : null) },
  {
    prop: "positionMode",
    column: "position_mode",
    sqlType: "TEXT",
    constraints: "DEFAULT 'own'",
    encode: (v) => String(v ?? "own"),
    decode: (raw) => decodePositionMode(raw),
  },
  {
    prop: "isExactPosition",
    column: "is_exact_position",
    sqlType: "INTEGER",
    constraints: "NOT NULL DEFAULT 0",
    encode: (v) => (v ? 1 : 0),
    decode: (raw) => Number(raw ?? 0) === 1,
  },
]

export function createOrganisationsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${ORGANISATIONS_TABLE} (\n  ${buildCreateTableColumnDefs(organisationColumns).join(",\n  ")}\n)`,
  )
}

/** Older projects predate the organisations table entirely — a whole-table-missing
 *  check, not a per-column one, so it's a plain guard rather than descriptor metadata. */
export function readOrganisations(geoPackage: GeoPackage): Organisation[] {
  if (!tableExists(geoPackage.connection, ORGANISATIONS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(organisationColumns)} FROM ${ORGANISATIONS_TABLE}`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(organisationColumns, row))
}

export function writeOrganisations(geoPackage: GeoPackage, organisations: Organisation[]): void {
  for (const organisation of organisations) {
    insertRow(geoPackage.connection, ORGANISATIONS_TABLE, organisationColumns, organisation)
  }
}
