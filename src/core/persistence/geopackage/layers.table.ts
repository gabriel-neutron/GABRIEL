import type { GeoPackage } from "@ngageoint/geopackage"
import type { Layer } from "@/types/domain.types"
import {
  buildCreateTableColumnDefs,
  buildInsertColumns,
  buildInsertValues,
  buildSelectClause,
  decodeRow,
  type ColumnDescriptor,
} from "./columnDescriptor"
import { decodeLayerKind } from "./validation"

export const LAYERS_TABLE = "layers"

/**
 * `sourceQuery`/`osmData` decode only applies when the layer is an OSM overlay, which
 * depends on `kind` already being decoded — `kind` MUST stay ahead of them in this array.
 *
 * `expanded` has no `Layer` field (write-only legacy column, its read value is discarded)
 * so it isn't a descriptor entry — it's spliced in raw at the CREATE/INSERT call sites.
 */
export const layerColumns: ColumnDescriptor<Layer>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  { prop: "name", column: "name", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => String(v ?? ""), decode: (raw) => String(raw ?? "") },
  {
    prop: "visible",
    column: "visible",
    sqlType: "INTEGER",
    constraints: "NOT NULL DEFAULT 1",
    encode: (v) => (v ? 1 : 0),
    decode: (raw) => Number(raw) === 1,
  },
  {
    prop: "kind",
    column: "kind",
    sqlType: "TEXT",
    encode: (v) => (v != null ? String(v) : null),
    decode: (raw) => decodeLayerKind(raw),
  },
  {
    prop: "sourceQuery",
    column: "source_query",
    sqlType: "TEXT",
    encode: (v, row) => (row.kind === "osm" && row.osmData != null && v != null ? String(v) : null),
    decode: (raw, ctx) => (ctx.decoded.kind === "osm" && raw != null ? String(raw) : undefined),
  },
  {
    prop: "osmData",
    column: "geojson",
    sqlType: "TEXT",
    encode: (v, row) => (row.kind === "osm" && row.osmData != null ? JSON.stringify(v) : null),
    decode: (raw, ctx) => {
      if (ctx.decoded.kind !== "osm" || raw == null || raw === "") return undefined
      try {
        return JSON.parse(raw as string) as GeoJSON.FeatureCollection
      } catch {
        throw new Error("Unsupported schema: layer geojson payload is invalid.")
      }
    },
  },
]

export function createLayersTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS ${LAYERS_TABLE} (\n  ${buildCreateTableColumnDefs(layerColumns).join(",\n  ")},\n  expanded INTEGER NOT NULL DEFAULT 1\n)`,
  )
}

export function readLayers(geoPackage: GeoPackage): Layer[] {
  const rows = geoPackage.connection.all(
    `SELECT ${buildSelectClause(layerColumns)} FROM ${LAYERS_TABLE}`,
  ) as Record<string, unknown>[]
  return rows.map((row) => decodeRow(layerColumns, row))
}

export function writeLayers(geoPackage: GeoPackage, layers: Layer[]): void {
  const columns = [...buildInsertColumns(layerColumns), "expanded"]
  const placeholders = columns.map(() => "?").join(", ")
  for (const layer of layers) {
    geoPackage.connection.run(
      `INSERT INTO ${LAYERS_TABLE} (${columns.join(", ")}) VALUES (${placeholders})`,
      [...buildInsertValues(layerColumns, layer), 1],
    )
  }
}
