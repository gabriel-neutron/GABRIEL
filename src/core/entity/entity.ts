export type PositionMode = "own" | "parent" | "none"

/**
 * A sourced, source-rated, geolocated, hierarchable node — generalised from the
 * military-only `MapEntity` (ADR 0004). `kind` discriminates the Profile; only
 * `"unit"` (the military Unit Profile) exists today. Persisted in GeoPackage
 * `units` table; `kind` itself is not a persisted column (every stored row is a
 * unit) — it's injected at read time in `core/persistence/geopackage/units.table.ts`.
 */
export type Entity = {
  kind: "unit"
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
  /** ISO timestamp of the latest completed batch analysis for this entity. */
  analyzedAt?: string | null
  /** How the entity is positioned: own geometry, linked to parent, or unknown. Defaults to "own". */
  positionMode?: PositionMode
  /** Whether the entity position is considered exact. Defaults to false. */
  isExactPosition?: boolean
}
