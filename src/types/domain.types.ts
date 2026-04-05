/**
 * Domain types for the application.
 * These types represent the core data structures used throughout the UI.
 *
 * Naming Conventions:
 * - Use "Entity" terminology in UI and user-facing code (not "Unit")
 * - "Unit" is used in GeoPackage schema for database compatibility
 * - MapEntity and GpkgEntity represent the same concept with different field naming:
 *   - MapEntity: camelCase fields for UI (layerId, parentId)
 *   - GpkgEntity: snake_case fields for database (layer_id, parent_id)
 */

export type Layer = {
  id: string
  name: string
  visible: boolean
  /** Echelon = automatic by echelon; custom = user-created; osm = OSM overlay with cached GeoJSON. */
  kind?: "echelon" | "custom" | "osm"
  /** When set, this layer is an OSM overlay (GeoJSON). */
  osmData?: GeoJSON.FeatureCollection
  /** Normalized query string for deduplication. */
  sourceQuery?: string
}

/** Unit/entity in the project; persisted in GeoPackage `units` table. */
export type MapEntity = {
  id: string
  name: string
  /** Required: every entity sits on a layer. New geometry uses `getDefaultEntityLayerId` when picking a layer. */
  layerId: string
  parentId: string | null
  /** Unit type for symbol derivation (e.g. infantry, armored, artillery). */
  type?: string
  /** Stored 20-digit SIDC when present; otherwise derived from type/echelon. */
  natoSymbolCode?: string | null
  /** Echelon for symbol amplifier (e.g. Division, Regiment). */
  echelon?: string
  /** Affiliation for frame (Friend, Hostile, etc.). */
  affiliation?: "Friend" | "Hostile" | "Neutral" | "Unknown" | "Assumed Friend" | "Suspect"
  /** Battle dimension (default Ground). */
  domain?: "Ground" | "Air" | "Sea" | "Subsurface" | "Space"
  /** OSM relation id (e.g. multipolygon for military base). */
  osmRelationId?: number | null
  /** Military unit identifier (MUN)*/
  militaryUnitId?: string | null
  /** Free-form notes. */
  notes?: string | null
  /** Sources for this entity as a newline-delimited list of URLs/citations. */
  sources?: string | null
  /** How the entity is positioned: own geometry, linked to parent, or unknown. Defaults to "own". */
  positionMode?: PositionMode
  /** Whether the entity position is considered exact. Defaults to false. */
  isExactPosition?: boolean
}

export type PositionMode = "own" | "parent" | "none"

/**
 * User-drawn map geometry stored in GeoPackage `geometries` (point, line, or polygon).
 * Linked to a layer; optionally linked to a unit entity via `entityId`.
 */
export type DrawnGeometry =
  | { id: string; layerId: string; entityId: string | null; type: "point"; lat: number; lng: number }
  | { id: string; layerId: string; entityId: string | null; type: "line"; positions: [number, number][] }
  | { id: string; layerId: string; entityId: string | null; type: "polygon"; rings: [number, number][][] }
