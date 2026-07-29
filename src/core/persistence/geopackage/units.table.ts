import type { GeoPackage } from "@ngageoint/geopackage"
import { ENTITY_KINDS, type EntityKind } from "@/core/entity/entity"
import type { MapEntity } from "@/types/domain.types"
import {
  buildCreateTableColumnDefs,
  buildSelectClause,
  decodeRow,
  getTableColumnNames,
  insertRow,
  type ColumnDescriptor,
} from "./columnDescriptor"
import { decodeAliases, decodeExternalIds, decodeOrganisationType, decodePositionMode } from "./validation"

export const UNITS_TABLE = "units"

const VALID_ENTITY_KINDS = new Set<EntityKind>(ENTITY_KINDS)

/**
 * Allowlist rather than a two-branch ternary. A narrower return type is
 * assignable to the wider one, so a decoder that names only some of the kinds
 * keeps typechecking after the union widens while quietly rewriting every
 * unnamed kind on the way in — no compiler error, no failing test, wrong data.
 * Unknown and absent values still fall back to "unit": every row predating this
 * column was a unit (ADR 0004, E1).
 */
function decodeEntityKind(raw: unknown): EntityKind {
  return typeof raw === "string" && VALID_ENTITY_KINDS.has(raw as EntityKind) ? (raw as EntityKind) : "unit"
}

/**
 * `analyzed_at`, `position_mode`, `is_exact_position`, and `kind` are `optional`
 * because they were added after the table's initial release — older projects
 * may be missing them, so `readEntities` feature-detects and falls back
 * per-column. Every row predating `kind` was a unit (ADR 0004, E1) — the
 * `organisations` table was where non-unit rows used to live.
 *
 * `kind` must be decoded before `type`/`osmRelationId`: both those columns are
 * shared by `UnitProfile` and `CorporateProfile` with different validation
 * rules per profile, and `DecodeContext.decoded` only has earlier-in-array
 * props available.
 */
export const unitColumns: ColumnDescriptor<MapEntity>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "name", column: "name", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "layerId", column: "layer_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "parentId", column: "parent_id", sqlType: "TEXT", encode: (v) => (v != null ? String(v) : null), decode: (raw) => (raw != null ? String(raw) : null) },
  {
    prop: "aliases",
    column: "aliases",
    sqlType: "TEXT",
    optional: true,
    fallbackSql: "NULL",
    // ADR 0006 / E3: alternate names, JSON-encoded. `null` when absent/empty so an
    // un-merged row stays clean; a corrupt value decodes back to undefined, never throws.
    encode: (v) => (Array.isArray(v) && v.length ? JSON.stringify(v) : null),
    decode: (raw) => decodeAliases(raw),
  },
  {
    prop: "externalIds",
    column: "external_ids",
    sqlType: "TEXT",
    optional: true,
    fallbackSql: "NULL",
    // ADR 0010 / Slice 1, encoded exactly like aliases. Deliberately carries no
    // column-level SQL clause: ensureOptionalColumns splices one straight into
    // ALTER TABLE ADD COLUMN when a file predating this column is reopened, and SQLite
    // rejects NOT NULL there without a constant default.
    encode: (v) => (Array.isArray(v) && v.length ? JSON.stringify(v) : null),
    decode: (raw) => decodeExternalIds(raw),
  },
  {
    prop: "kind",
    column: "kind",
    sqlType: "TEXT",
    constraints: "NOT NULL DEFAULT 'unit'",
    optional: true,
    fallbackSql: "'unit'",
    encode: (v) => String(v ?? "unit"),
    decode: (raw) => decodeEntityKind(raw),
  },
  {
    prop: "type",
    column: "type",
    sqlType: "TEXT",
    encode: (v, row) => (row.kind === "corporate" ? String(v ?? "other") : (v != null ? String(v) : null)),
    decode: (raw, ctx) =>
      ctx.decoded.kind === "corporate"
        ? decodeOrganisationType(raw)
        : (raw != null ? String(raw) : undefined),
  },
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
  return rows.map((row) => decodeRow(unitColumns, row))
}

export function writeEntities(geoPackage: GeoPackage, entities: MapEntity[]): void {
  for (const entity of entities) {
    insertRow(geoPackage.connection, UNITS_TABLE, unitColumns, entity)
  }
}

/**
 * Raw read of the legacy string `sources` column, keyed by entity id (ADR 0006, E2).
 * Standalone rather than going through `unitColumns`/`readEntities`: this exists purely
 * to feed the Source/Claim derivation in `load.ts`, and must keep working once a later
 * item removes `sources` from `unitColumns` entirely (E2.6) — at that point the column
 * still physically exists on old files but is no longer part of the descriptor list.
 */
export function readLegacyUnitSourcesColumn(geoPackage: GeoPackage): Map<string, string> {
  if (!getTableColumnNames(geoPackage.connection, UNITS_TABLE).has("sources")) return new Map()
  const rows = geoPackage.connection.all(
    `SELECT id, sources FROM ${UNITS_TABLE} WHERE sources IS NOT NULL`,
  ) as Array<{ id: string; sources: string | null }>
  const result = new Map<string, string>()
  for (const row of rows) {
    if (row.sources) result.set(row.id, row.sources)
  }
  return result
}
