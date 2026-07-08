import type { GeoPackage } from "@ngageoint/geopackage"
import type { MapEntity } from "@/types/domain.types"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  getTableColumnNames,
  insertRow,
  type ColumnDescriptor,
} from "./columnDescriptor"
import { decodePositionMode } from "./validation"

export const UNITS_TABLE = "units"

/**
 * `analyzed_at`, `position_mode`, and `is_exact_position` are `optional` because
 * they were added after the table's initial release — older projects may be
 * missing them, so `readEntities` feature-detects and falls back per-column.
 */
export const unitColumns: ColumnDescriptor<MapEntity>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "name", column: "name", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "layerId", column: "layer_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "parentId", column: "parent_id", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "type", column: "type", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  { prop: "natoSymbolCode", column: "nato_symbol_code", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  { prop: "echelon", column: "echelon", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  {
    prop: "affiliation",
    column: "affiliation",
    sqlType: "TEXT",
    encode: (v) => (v != null ? String(v) : null),
    decode: (raw) => (raw != null ? (String(raw) as MapEntity["affiliation"]) : undefined),
  },
  {
    prop: "domain",
    column: "domain",
    sqlType: "TEXT",
    encode: (v) => (v != null ? String(v) : null),
    decode: (raw) => (raw != null ? (String(raw) as MapEntity["domain"]) : undefined),
  },
  { prop: "osmRelationId", column: "osm_relation_id", sqlType: "INTEGER", encode: (v) => (v != null ? Number(v) : null), decode: (raw) => (raw != null ? Number(raw) : undefined) },
  { prop: "militaryUnitId", column: "military_unit_id", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  { prop: "notes", column: "notes", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  { prop: "sources", column: "sources", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : undefined) },
  {
    prop: "analyzedAt",
    column: "analyzed_at",
    sqlType: "TEXT",
    optional: true,
    fallbackSql: "NULL",
    encode: (v) => (v != null ? String(v) : null),
    decode: (raw) => (raw != null ? String(raw) : undefined),
  },
  {
    prop: "positionMode",
    column: "position_mode",
    sqlType: "TEXT",
    constraints: "DEFAULT 'own'",
    optional: true,
    fallbackSql: "'own'",
    encode: (v) => String(v ?? "own"),
    decode: (raw) => decodePositionMode(raw),
  },
  {
    prop: "isExactPosition",
    column: "is_exact_position",
    sqlType: "INTEGER",
    constraints: "NOT NULL DEFAULT 0",
    optional: true,
    fallbackSql: "0",
    encode: (v) => (v ? 1 : 0),
    decode: (raw) => Number(raw ?? 0) === 1,
  },
]

export function createUnitsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${UNITS_TABLE} (\n  ${buildCreateTableColumnDefs(unitColumns).join(",\n  ")}\n)`,
  )
}

export function readEntities(geoPackage: GeoPackage): MapEntity[] {
  const availableColumns = getTableColumnNames(geoPackage.connection, UNITS_TABLE)
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(unitColumns, availableColumns)} FROM ${UNITS_TABLE}`,
  ) as Record<string, unknown>[]
  // `kind` is a runtime discriminant (ADR 0004), not a persisted column — every row in this
  // table is a unit, so it's injected here rather than round-tripped through decodeRow.
  return rows.map((row) => ({ ...decodeRow(unitColumns, row), kind: "unit" as const }))
}

export function writeEntities(geoPackage: GeoPackage, entities: MapEntity[]): void {
  for (const entity of entities) {
    insertRow(geoPackage.connection, UNITS_TABLE, unitColumns, entity)
  }
}
