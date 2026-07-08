import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Organisation } from "@/types/organisation.types"

/**
 * Thin aliases, not separate shapes: the SQL column-descriptor lists (units.table.ts,
 * organisations.table.ts, layers.table.ts) type themselves directly against the domain
 * types, so these exist only to keep the documented MapEntity/GpkgEntity naming
 * boundary intact at the GeoPackage I/O surface — not to duplicate field lists.
 */
export type GpkgLayer = Layer
export type GpkgEntity = MapEntity
export type GpkgGeometry = DrawnGeometry
export type GpkgOrganisation = Organisation

export interface GeoPackageLoadResult {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  organisations: GpkgOrganisation[]
  geometries: GpkgGeometry[]
  /** URL → cached snippet map loaded from the `research_sources` table. Empty map for older projects. */
  sourceCache: Map<string, string>
}

export interface ApplyGeoPackageResultState {
  layers: Layer[]
  entities: MapEntity[]
  organisations: Organisation[]
  drawnGeometries: DrawnGeometry[]
  selectedEntityId: string | null
  selectedOrganisationId: string | null
}
