/**
 * GeoPackage read/write via @ngageoint/geopackage library.
 * Uses standard OGC GeoPackage format.
 * No React imports. Throws on validation failure.
 */

import {
  GeoPackageAPI,
  GeoPackage,
  FeatureColumn,
  GeometryType,
  GeoPackageDataType,
  setSqljsWasmLocateFile,
} from "@ngageoint/geopackage"
import { ECHELON_OPTIONS } from "@/components/inspector/entityInspector.options"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"

// Configure WASM location - use CDN (acceptable per user preference)
setSqljsWasmLocateFile(
  (file) => `https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/${file}`,
)

const LAYERS_TABLE = "layers"
const UNITS_TABLE = "units"
const GEOMETRIES_TABLE = "geometries"

export interface GpkgLayer {
  id: string
  name: string
  visible: boolean
  expanded: boolean
  /** 'echelon' | 'custom' | 'osm'. OSM layers persist sourceQuery + cached GeoJSON. */
  kind?: "echelon" | "custom" | "osm"
  /** Normalized Overpass QL (for kind === 'osm'). */
  sourceQuery?: string
  /** Cached GeoJSON (for kind === 'osm'). Set on load when geojson column present; set by caller on save. */
  osmData?: GeoJSON.FeatureCollection
}

export interface GpkgEntity {
  id: string
  name: string
  layerId: string
  parentId: string | null
  type?: string
  natoSymbolCode?: string | null
  echelon?: string
  affiliation?: string
  domain?: string
  osmRelationId?: number | null
  militaryUnitId?: string | null
  notes?: string | null
}

export type GpkgGeometry =
  | { id: string; layerId: string; entityId: string | null; type: "point"; lat: number; lng: number }
  | { id: string; layerId: string; entityId: string | null; type: "line"; positions: [number, number][] }
  | { id: string; layerId: string; entityId: string | null; type: "polygon"; rings: [number, number][][] }

export interface GeoPackageLoadResult {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
}

/**
 * Load and parse a GeoPackage from buffer. Throws on invalid file, corrupted DB, or unsupported schema.
 */
export async function loadGeoPackage(buffer: ArrayBuffer): Promise<GeoPackageLoadResult> {
  let geoPackage: GeoPackage | null = null
  try {
    geoPackage = await GeoPackageAPI.open(new Uint8Array(buffer))

    // Read user tables via raw SQL
    const layers = readLayers(geoPackage)
    const entities = readEntities(geoPackage)

    // Read feature table as GeoJSON and map to our format
    const geometries = await readGeometries(geoPackage)

    // Validate referential integrity
    const layerIds = new Set(layers.map((l) => l.id))
    const entityIds = new Set(entities.map((e) => e.id))
    for (const e of entities) {
      if (!layerIds.has(e.layerId)) {
        throw new Error("Unsupported schema: entity references missing layer.")
      }
      if (e.parentId != null && !entityIds.has(e.parentId)) {
        throw new Error("Unsupported schema: entity references missing parent.")
      }
    }
    for (const g of geometries) {
      if (!layerIds.has(g.layerId)) {
        throw new Error("Unsupported schema: geometry references missing layer.")
      }
      if (g.entityId != null && !entityIds.has(g.entityId)) {
        throw new Error("Unsupported schema: geometry references missing entity.")
      }
    }

    return { layers, entities, geometries }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unsupported schema")) throw e
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("loadGeoPackage: parse error", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Corrupted GeoPackage or unsupported schema: ${errorMsg}`)
  } finally {
    if (geoPackage) {
      geoPackage.close()
    }
  }
}

function readLayers(geoPackage: GeoPackage): GpkgLayer[] {
  const hasKind = hasColumn(geoPackage, LAYERS_TABLE, "kind")
  const hasSourceQuery = hasColumn(geoPackage, LAYERS_TABLE, "source_query")
  const hasGeojson = hasColumn(geoPackage, LAYERS_TABLE, "geojson")

  try {
    const cols = ["id", "name", "visible", "expanded"]
    if (hasKind) cols.push("kind")
    if (hasSourceQuery) cols.push("source_query")
    if (hasGeojson) cols.push("geojson")
    const result = geoPackage.connection.all(
      `SELECT ${cols.join(", ")} FROM ${LAYERS_TABLE}`,
    ) as Array<{
      id: string
      name: string
      visible: number
      expanded: number
      kind?: string
      source_query?: string | null
      geojson?: string | null
    }>
    return result.map((row) => {
      const kind =
        hasKind && row.kind != null && (row.kind === "echelon" || row.kind === "custom" || row.kind === "osm")
          ? (row.kind as GpkgLayer["kind"])
          : undefined
      const layer: GpkgLayer = {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        visible: Number(row.visible) === 1,
        expanded: Number(row.expanded) === 1,
        kind,
      }
      if (kind === "osm" && hasSourceQuery && row.source_query != null) {
        layer.sourceQuery = String(row.source_query)
      }
      if (kind === "osm" && hasGeojson && row.geojson != null && row.geojson !== "") {
        try {
          layer.osmData = JSON.parse(row.geojson) as GeoJSON.FeatureCollection
        } catch {
          // Invalid JSON: leave osmData unset
        }
      }
      return layer
    })
  } catch {
    // Try minimal columns for backward compatibility
    const result = geoPackage.connection.all(
      `SELECT id, name, visible, expanded FROM ${LAYERS_TABLE}`,
    ) as Array<{
      id: string
      name: string
      visible: number
      expanded: number
    }>
    return result.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      visible: Number(row.visible) === 1,
      expanded: Number(row.expanded) === 1,
    }))
  }
}

function hasColumn(geoPackage: GeoPackage, table: string, column: string): boolean {
  const rows = geoPackage.connection.all(
    `PRAGMA table_info(${table})`,
  ) as Array<{ name: string }>
  return rows.some((r) => r.name === column)
}

function readEntities(geoPackage: GeoPackage): GpkgEntity[] {
  const hasOsmRelationId = hasColumn(geoPackage, UNITS_TABLE, "osm_relation_id")
  const hasMilitaryUnitId = hasColumn(geoPackage, UNITS_TABLE, "military_unit_id")
  const hasNotes = hasColumn(geoPackage, UNITS_TABLE, "notes")
  const columns = [
    "id", "name", "layer_id", "parent_id", "type", "nato_symbol_code",
    "echelon", "affiliation", "domain",
    ...(hasOsmRelationId ? ["osm_relation_id"] : []),
    ...(hasMilitaryUnitId ? ["military_unit_id"] : []),
    ...(hasNotes ? ["notes"] : []),
  ].join(", ")
  const result = geoPackage.connection.all(
    `SELECT ${columns} FROM ${UNITS_TABLE}`,
  ) as Array<{
    id: string
    name: string
    layer_id: string
    parent_id: string | null
    type?: string
    nato_symbol_code?: string | null
    echelon?: string
    affiliation?: string
    domain?: string
    osm_relation_id?: number | null
    military_unit_id?: string | null
    notes?: string | null
  }>

  return result.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    layerId: String(row.layer_id ?? ""),
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    type: row.type != null ? String(row.type) : undefined,
    natoSymbolCode: row.nato_symbol_code != null ? String(row.nato_symbol_code) : null,
    echelon: row.echelon != null ? String(row.echelon) : undefined,
    affiliation: row.affiliation != null ? (row.affiliation as GpkgEntity["affiliation"]) : undefined,
    domain: row.domain != null ? String(row.domain) : undefined,
    osmRelationId: hasOsmRelationId && row.osm_relation_id != null ? Number(row.osm_relation_id) : undefined,
    militaryUnitId: hasMilitaryUnitId && row.military_unit_id != null ? String(row.military_unit_id) : undefined,
    notes: hasNotes && row.notes != null ? String(row.notes) : undefined,
  }))
}

async function readGeometries(geoPackage: GeoPackage): Promise<GpkgGeometry[]> {
  // Check if geometries table exists as a feature table
  const featureTables = geoPackage.getFeatureTables()
  if (!featureTables.includes(GEOMETRIES_TABLE)) {
    throw new Error(`Missing feature table '${GEOMETRIES_TABLE}'`)
  }

  const out: GpkgGeometry[] = []
  const geoJSONResultSet = geoPackage.iterateGeoJSONFeatures(GEOMETRIES_TABLE)

  for (const feature of geoJSONResultSet) {
    const props = feature.properties || {}
    const id = String(props.id ?? feature.id ?? "")
    const layerId = String(props.layer_id ?? "")
    const entityIdVal = props.entity_id
    const entityId = entityIdVal != null && entityIdVal !== "" ? String(entityIdVal) : null
    const type = String(props.type ?? "point") as "point" | "line" | "polygon"

    if (!feature.geometry) continue

    if (type === "point" && feature.geometry.type === "Point") {
      const coords = feature.geometry.coordinates as [number, number]
      out.push({
        id,
        layerId,
        entityId,
        type: "point",
        lat: coords[1],
        lng: coords[0],
      })
    } else if (type === "line" && feature.geometry.type === "LineString") {
      const coords = feature.geometry.coordinates as [number, number][]
      out.push({
        id,
        layerId,
        entityId,
        type: "line",
        positions: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
      })
    } else if (type === "polygon" && feature.geometry.type === "Polygon") {
      const rings = feature.geometry.coordinates as [number, number][][]
      out.push({
        id,
        layerId,
        entityId,
        type: "polygon",
        rings: rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
      })
    }
  }

    return out
}

/**
 * Build a new GeoPackage from the given data and return its bytes.
 * Pass all layers (including OSM); entities/geometries must reference non-OSM layer IDs only.
 */
export async function saveGeoPackage(
  layers: GpkgLayer[],
  entities: GpkgEntity[],
  geometries: GpkgGeometry[],
): Promise<Uint8Array> {
  let geoPackage: GeoPackage | null = null
  try {
    // Create new GeoPackage in memory
    geoPackage = await GeoPackageAPI.create()

    // Create required GeoPackage tables
    geoPackage.createRequiredTables()

    // Create user tables (source_query + geojson for OSM layers)
    geoPackage.connection.run(`CREATE TABLE ${LAYERS_TABLE} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  expanded INTEGER NOT NULL DEFAULT 1,
  kind TEXT,
  source_query TEXT,
  geojson TEXT
)`)

    geoPackage.connection.run(`CREATE TABLE ${UNITS_TABLE} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layer_id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT,
  nato_symbol_code TEXT,
  echelon TEXT,
  affiliation TEXT,
  domain TEXT,
  osm_relation_id INTEGER,
  military_unit_id TEXT,
  notes TEXT
)`)

    // Create feature table with geometry column.
    // Use TEXT primary key for id (UUIDs); createPrimaryKeyColumn uses INTEGER AUTOINCREMENT which causes "datatype mismatch".
    const geometryColumn = FeatureColumn.createGeometryColumn(
      0,
      "geometry",
      GeometryType.GEOMETRY,
      false,
    )
    const idColumn = new FeatureColumn(
      1,
      "id",
      GeoPackageDataType.TEXT,
      undefined,
      true,
      undefined,
      true, // primaryKey
      undefined,
      false, // no autoincrement
    )
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

    // Insert layers (include source_query and geojson for OSM)
    for (const l of layers) {
      const isOsm = l.kind === "osm" && l.osmData != null
      geoPackage.connection.run(
        `INSERT INTO ${LAYERS_TABLE} (id, name, visible, expanded, kind, source_query, geojson) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(l.id ?? ""),
          String(l.name ?? ""),
          l.visible ? 1 : 0,
          l.expanded ? 1 : 0,
          l.kind != null ? String(l.kind) : null,
          isOsm && l.sourceQuery != null ? String(l.sourceQuery) : null,
          isOsm ? JSON.stringify(l.osmData) : null,
        ],
      )
    }

    // Insert units
    for (const e of entities) {
      geoPackage.connection.run(
        `INSERT INTO ${UNITS_TABLE} (id, name, layer_id, parent_id, type, nato_symbol_code, echelon, affiliation, domain, osm_relation_id, military_unit_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(e.id ?? ""),
          String(e.name ?? ""),
          String(e.layerId ?? ""),
          e.parentId != null ? String(e.parentId) : null,
          e.type != null ? String(e.type) : null,
          e.natoSymbolCode != null ? String(e.natoSymbolCode) : null,
          e.echelon != null ? String(e.echelon) : null,
          e.affiliation != null ? String(e.affiliation) : null,
          e.domain != null ? String(e.domain) : null,
          e.osmRelationId != null ? e.osmRelationId : null,
          e.militaryUnitId != null ? String(e.militaryUnitId) : null,
          e.notes != null ? String(e.notes) : null,
        ],
      )
    }

    // Insert geometries as GeoJSON features
    for (const g of geometries) {
      let geoJSONGeometry: GeoJSON.Geometry
      if (g.type === "point") {
        geoJSONGeometry = {
          type: "Point",
          coordinates: [g.lng, g.lat],
        }
      } else if (g.type === "line") {
        geoJSONGeometry = {
          type: "LineString",
          coordinates: g.positions.map(([lat, lng]) => [lng, lat]),
        }
      } else {
        geoJSONGeometry = {
          type: "Polygon",
          coordinates: g.rings.map((ring) => ring.map(([lat, lng]) => [lng, lat])),
        }
      }

      const feature: GeoJSON.Feature = {
        type: "Feature",
        id: g.id,
        geometry: geoJSONGeometry,
        properties: {
          id: g.id,
          layer_id: g.layerId,
          entity_id: g.entityId,
          type: g.type,
        },
      }

      geoPackage.addGeoJSONFeatureToGeoPackage(feature, GEOMETRIES_TABLE, false)
    }

    // Export to Uint8Array
    const exported = await geoPackage.export()
    if (!(exported instanceof Uint8Array)) {
      throw new Error("Export did not return Uint8Array")
    }

    return exported
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("saveGeoPackage failed", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Failed to save GeoPackage: ${errorMsg}`)
  } finally {
    if (geoPackage) {
      geoPackage.close()
    }
  }
}

/** Default echelon layers for UI (Team/Crew through Theater). */
export function getDefaultEchelonLayers(): Layer[] {
  return ECHELON_OPTIONS.map((opt) => ({
    id: opt.value,
    name: opt.label,
    visible: true,
    expanded: true,
    kind: "echelon" as const,
  }))
}

/** Apply load result to React state setters. Shared by view and edit modes. */
export function applyGeoPackageResult(
  result: GeoPackageLoadResult,
  setLayers: (v: Layer[] | ((prev: Layer[]) => Layer[])) => void,
  setEntities: (v: MapEntity[] | ((prev: MapEntity[]) => MapEntity[])) => void,
  setDrawnGeometries: (v: DrawnGeometry[] | ((prev: DrawnGeometry[]) => DrawnGeometry[])) => void,
  setSelectedEntityId: (v: string | null | ((prev: string | null) => string | null)) => void,
): void {
  const loaded = result.layers
  const echelonById = new Map(loaded.filter((l) => l.kind === "echelon").map((l) => [l.id, l]))
  const echelonLayers: Layer[] = getDefaultEchelonLayers().map((d) => {
    const fromFile = echelonById.get(d.id)
    return fromFile ? { ...d, visible: fromFile.visible, expanded: fromFile.expanded } : d
  })
  const customLayers: Layer[] = loaded
    .filter((l) => l.kind === "custom" || l.kind === undefined)
    .map((l) => ({ id: l.id, name: l.name, visible: l.visible, expanded: l.expanded, kind: "custom" as const }))
  const osmLayers: Layer[] = loaded
    .filter((l) => l.kind === "osm" && l.osmData != null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      expanded: l.expanded,
      kind: "osm" as const,
      osmData: l.osmData,
      sourceQuery: l.sourceQuery,
    }))
  setLayers([...echelonLayers, ...customLayers, ...osmLayers])
  setEntities(result.entities as MapEntity[])
  setDrawnGeometries(result.geometries as DrawnGeometry[])
  setSelectedEntityId((prev) =>
    prev && result.entities.some((e) => e.id === prev) ? prev : null,
  )
}
