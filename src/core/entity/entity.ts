export type PositionMode = "own" | "parent" | "none"

/**
 * Fields every Entity carries regardless of Profile (ADR 0004): identity,
 * hierarchy placement, Provenance Ledger, and position. Profile-specific
 * fields live in a `Profile` member (e.g. `UnitProfile`), never here —
 * `core/entity` must not import any one profile's field set.
 */
export type EntityCore = {
  id: string
  name: string
  /** Required: every entity sits on a layer. New geometry uses `getDefaultEntityLayerId` when picking a layer. */
  layerId: string
  parentId: string | null
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

/**
 * The military Unit Profile — the only Profile populated today (ADR 0004).
 * `kind` is a runtime-only discriminant, not a persisted GeoPackage column
 * (every stored `units` row is a unit) — it's injected at read time in
 * `core/persistence/geopackage/units.table.ts`.
 */
export type UnitProfile = {
  kind: "unit"
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
}

/**
 * Flat tagged union of every Entity profile, discriminated by `kind` (ADR 0004
 * — flat, never nested: `entity.echelon`, not `entity.profile.echelon`). Only
 * `UnitProfile` exists today; future profiles (vessel, company, person) are a
 * modelling exercise deferred to the investigation that needs them.
 */
export type Profile = UnitProfile

/** A sourced, source-rated, geolocated, hierarchable node — core + a flat Profile (ADR 0004). */
export type Entity = EntityCore & Profile
