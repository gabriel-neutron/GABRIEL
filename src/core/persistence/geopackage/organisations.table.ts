import type { GeoPackage } from "@ngageoint/geopackage"
import type { Organisation } from "@/types/organisation.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { MapEntity } from "@/types/domain.types"
import {
  buildSelectClause,
  decodeRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"
import { decodeOrganisationType, decodePositionMode } from "./validation"

/**
 * Legacy, read-only: pre-E1 (ADR 0004) files stored corporate entities in a
 * separate `organisations` table. Nothing writes to this table anymore — new
 * saves fold every corporate entity into `units` (see `units.table.ts`'s
 * persisted `kind` column). This module only exists so `migrateLegacyOrganisations`
 * can upgrade an old file's rows in place, once, on load.
 */
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

/** Older projects predate the organisations table entirely — a whole-table-missing
 *  check, not a per-column one, so it's a plain guard rather than descriptor metadata. */
export function readOrganisations(geoPackage: GeoPackage): Organisation[] {
  if (!tableExists(geoPackage.connection, ORGANISATIONS_TABLE)) return []
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(organisationColumns)} FROM ${ORGANISATIONS_TABLE}`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(organisationColumns, row))
}

/**
 * Migration-on-read (E1, ADR 0004): folds a legacy `organisations` table's rows into the
 * unified `Entity` shape, tagged `kind: "corporate"` and pinned to the fixed synthetic
 * `INDUSTRY_LAYER_ID` layer (organisations never had their own `layerId`). Returns `[]`
 * for any file that already migrated (no `organisations` table) or never had one.
 */
export function migrateLegacyOrganisations(geoPackage: GeoPackage): MapEntity[] {
  return readOrganisations(geoPackage).map((o): MapEntity => ({
    kind: "corporate",
    id: o.id,
    name: o.name,
    type: o.type,
    layerId: INDUSTRY_LAYER_ID,
    parentId: o.parentId,
    notes: o.notes,
    sources: o.sources,
    osmRelationId: o.osmRelationId,
    positionMode: o.positionMode,
    isExactPosition: o.isExactPosition,
  }))
}
