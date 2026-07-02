import { FeatureColumn, GeometryType, GeoPackageDataType, type GeoPackage } from "@ngageoint/geopackage"
import type { DrawnGeometry } from "@/types/domain.types"
import { toGeoJsonCoord, toLeafletCoord } from "@/types/coordinates"
import { buildInsertColumns, buildInsertValues, decodeRow, type ColumnDescriptor } from "./columnDescriptor"

export const GEOMETRIES_TABLE = "geometries"

/**
 * Geometries live in a GeoPackage *feature* table (geometry + properties), not a plain
 * SQL table, so only the 4 non-coordinate property fields go through the descriptor
 * pattern here — CREATE uses the FeatureColumn API directly, and point/line/polygon
 * coordinate encode/decode (including the existing point-vs-line/polygon
 * toLeafletCoord/toGeoJsonCoord asymmetry) is untouched, kept as separate logic below.
 */
interface GeometryProperties {
  id: string
  layerId: string
  entityId: string | null
  type: DrawnGeometry["type"]
}

const geometryPropertyColumns: ColumnDescriptor<GeometryProperties>[] = [
  { prop: "id", column: "id", sqlType: "TEXT", encode: (v) => v, decode: (raw) => String(raw ?? "") },
  { prop: "layerId", column: "layer_id", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => v, decode: (raw) => String(raw ?? "") },
  { prop: "entityId", column: "entity_id", sqlType: "TEXT", encode: (v) => v, decode: (raw) => (raw != null && raw !== "" ? String(raw) : null) },
  { prop: "type", column: "type", sqlType: "TEXT", constraints: "NOT NULL", encode: (v) => v, decode: (raw) => String(raw ?? "point") as DrawnGeometry["type"] },
]

export function createGeometriesTable(geoPackage: GeoPackage): void {
  if (geoPackage.getFeatureTables().includes(GEOMETRIES_TABLE)) return

  const geometryColumn = FeatureColumn.createGeometryColumn(0, "geometry", GeometryType.GEOMETRY, false)
  const idColumn = new FeatureColumn(1, "id", GeoPackageDataType.TEXT, undefined, true, undefined, true, undefined, false)
  const layerIdColumn = FeatureColumn.createColumn(2, "layer_id", GeoPackageDataType.TEXT, true)
  const entityIdColumn = FeatureColumn.createColumn(3, "entity_id", GeoPackageDataType.TEXT, false)
  const typeColumn = FeatureColumn.createColumn(4, "type", GeoPackageDataType.TEXT, true)

  geoPackage.createFeatureTable(
    GEOMETRIES_TABLE,
    undefined,
    [geometryColumn, idColumn, layerIdColumn, entityIdColumn, typeColumn],
    undefined,
    4326,
  )
}

export async function readGeometries(geoPackage: GeoPackage): Promise<DrawnGeometry[]> {
  const featureTables = geoPackage.getFeatureTables()
  if (!featureTables.includes(GEOMETRIES_TABLE)) {
    throw new Error(`Missing feature table '${GEOMETRIES_TABLE}'`)
  }

  const out: DrawnGeometry[] = []
  const geoJSONResultSet = geoPackage.iterateGeoJSONFeatures(GEOMETRIES_TABLE)

  for (const feature of geoJSONResultSet) {
    const props = feature.properties || {}
    const { id, layerId, entityId, type } = decodeRow(geometryPropertyColumns, { ...props, id: props.id ?? feature.id })

    if (!feature.geometry) continue

    if (type === "point" && feature.geometry.type === "Point") {
      const coords = feature.geometry.coordinates as [number, number]
      out.push({ id, layerId, entityId, type: "point", lat: coords[1], lng: coords[0] })
    } else if (type === "line" && feature.geometry.type === "LineString") {
      const coords = feature.geometry.coordinates as [number, number][]
      out.push({ id, layerId, entityId, type: "line", positions: coords.map(([lng, lat]) => toLeafletCoord(lng, lat)) })
    } else if (type === "polygon" && feature.geometry.type === "Polygon") {
      const rings = feature.geometry.coordinates as [number, number][][]
      out.push({
        id,
        layerId,
        entityId,
        type: "polygon",
        rings: rings.map((ring) => ring.map(([lng, lat]) => toLeafletCoord(lng, lat))),
      })
    }
  }

  return out
}

export function writeGeometries(geoPackage: GeoPackage, geometries: DrawnGeometry[]): void {
  for (const g of geometries) {
    let geoJSONGeometry: GeoJSON.Geometry
    if (g.type === "point") {
      geoJSONGeometry = { type: "Point", coordinates: [g.lng, g.lat] }
    } else if (g.type === "line") {
      geoJSONGeometry = { type: "LineString", coordinates: g.positions.map(toGeoJsonCoord) }
    } else {
      geoJSONGeometry = { type: "Polygon", coordinates: g.rings.map((ring) => ring.map(toGeoJsonCoord)) }
    }

    const propsValue: GeometryProperties = { id: g.id, layerId: g.layerId, entityId: g.entityId, type: g.type }
    const columns = buildInsertColumns(geometryPropertyColumns)
    const values = buildInsertValues(geometryPropertyColumns, propsValue)
    const properties = Object.fromEntries(columns.map((column, i) => [column, values[i]]))

    const feature: GeoJSON.Feature = {
      type: "Feature",
      id: g.id,
      geometry: geoJSONGeometry,
      properties,
    }

    geoPackage.addGeoJSONFeatureToGeoPackage(feature, GEOMETRIES_TABLE, false)
  }
}
