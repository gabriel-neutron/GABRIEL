import type { LatLng } from "@/core/coordinates"
import type { Entity } from "@/core/entity/entity"

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
  /** Echelon = automatic by echelon; custom = user-created; osm = OSM overlay with cached GeoJSON; organisation = fixed Industry layer. */
  kind?: "echelon" | "custom" | "osm" | "organisation"
  /** When set, this layer is an OSM overlay (GeoJSON). */
  osmData?: GeoJSON.FeatureCollection
  /** Normalized query string for deduplication. */
  sourceQuery?: string
}

export type { Entity } from "@/core/entity/entity"

/**
 * @deprecated Use `Entity` (ADR 0004). Kept as an alias so existing call sites
 * stay green — the runtime type is identical, just under its pre-generalisation name.
 */
export type MapEntity = Entity

export type { PositionMode } from "@/core/entity/entity"

/** An OSM node, way, or relation selected on the map for inspection. */
export type SelectedOsmObject =
  | { type: "node" | "way" | "relation"; id: number; cachedFeature?: GeoJSON.Feature & { id?: string } }
  | null

/**
 * User-drawn map geometry stored in GeoPackage `geometries` (point, line, or polygon).
 * Linked to a layer; optionally linked to a unit entity via `entityId`.
 */
export type DrawnGeometry =
  | { id: string; layerId: string; entityId: string | null; type: "point"; lat: number; lng: number }
  | { id: string; layerId: string; entityId: string | null; type: "line"; positions: LatLng[] }
  | { id: string; layerId: string; entityId: string | null; type: "polygon"; rings: LatLng[][] }
