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
 * Legacy: pre-E1 (ADR 0004) files stored corporate entities in a separate
 * `organisations` table. New saves fold every corporate entity into `units`
 * (see `units.table.ts`'s persisted `kind` column) and, once migrated, clear
 * this table (see `clearLegacyOrganisationsTable`) so it never resurrects
 * stale rows on a later load. This module only exists for that one-time
 * migrate-then-clear path.
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
    osmRelationId: o.osmRelationId,
    positionMode: o.positionMode,
    isExactPosition: o.isExactPosition,
  }))
}

/**
 * Raw read of the legacy `organisations` table's `sources` string column, keyed by
 * entity id (ADR 0006, E2.6) — the corporate-entity sibling of `units.table.ts`'s
 * `readLegacyUnitSourcesColumn`. `migrateLegacyOrganisations` no longer copies `sources`
 * onto the returned `Entity` (the field was removed from `EntityCore`), so this is the
 * only remaining way to feed a legacy organisation's citations into Source/Claim
 * derivation in `load.ts`.
 */
export function readLegacyOrganisationSources(geoPackage: GeoPackage): Map<string, string> {
  const result = new Map<string, string>()
  for (const o of readOrganisations(geoPackage)) {
    if (o.sources) result.set(o.id, o.sources)
  }
  return result
}

/**
 * Every migrated corporate entity is written back through `units` on save (see
 * `writeEntities`), so a legacy `organisations` table's rows are now duplicated data,
 * not a separate source of truth. Leaving the table's rows in place would make the
 * next `loadGeoPackage` call `migrateLegacyOrganisations` again and resurrect them
 * as duplicate entities. Empty (not drop) the table once its content has migrated,
 * so no destructive schema change is needed and re-running this is always safe.
 */
export function clearLegacyOrganisationsTable(geoPackage: GeoPackage): void {
  if (!tableExists(geoPackage.connection, ORGANISATIONS_TABLE)) return
  geoPackage.connection.run(`DELETE FROM ${ORGANISATIONS_TABLE}`)
}
