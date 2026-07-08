import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Source } from "@/core/provenance/source"
import type { Claim } from "@/core/provenance/claim"

/**
 * Thin aliases, not separate shapes: the SQL column-descriptor lists (units.table.ts,
 * layers.table.ts) type themselves directly against the domain types, so these exist
 * only to keep the documented MapEntity/GpkgEntity naming boundary intact at the
 * GeoPackage I/O surface — not to duplicate field lists.
 */
export type GpkgLayer = Layer
export type GpkgEntity = MapEntity
export type GpkgGeometry = DrawnGeometry
export type GpkgSource = Source
export type GpkgClaim = Claim

export interface GeoPackageLoadResult {
  layers: GpkgLayer[]
  /** Both military units and corporate entities (kind-discriminated, ADR 0004 / E1). */
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
  /** URL → cached snippet map loaded from the `research_sources` table. Empty map for older projects. */
  sourceCache: Map<string, string>
  /**
   * First-class provenance records (ADR 0006). `entity.sources` no longer exists (removed
   * in Slice B, E2.6) — these are the sole source of truth for every consumer, derived on
   * every load from the legacy raw `sources` columns (units/organisations) if not already
   * persisted, merged idempotently with whatever was already persisted from a prior save.
   */
  sources: GpkgSource[]
  claims: GpkgClaim[]
}

export interface ApplyGeoPackageResultState {
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  selectedEntityId: string | null
}
