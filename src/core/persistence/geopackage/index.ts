import { setSqljsWasmLocateFile } from "@ngageoint/geopackage"

setSqljsWasmLocateFile(
  (file) => `https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/${file}`,
)

export { loadGeoPackage } from "./load"
export { saveGeoPackage } from "./save"
export type { SaveGeoPackageOptions } from "./save"
export { getDefaultEchelonLayers, applyGeoPackageResult, projectStateFromLoadResult } from "./applyResult"
export type { ProjectStateFromLoadResult } from "./applyResult"
export { createRelationshipsTable, readRelationships, writeRelationships } from "./relationships.table"
export { createIntegrityEventsTable, readIntegrityEvents, writeIntegrityEvents } from "./integrityEvents.table"
export { migrateHierarchyToRelationships, LEGACY_CORPORATE_LINKS } from "./migrateHierarchy"
export type { HierarchyMigrationResult } from "./migrateHierarchy"
export type {
  GpkgLayer,
  GpkgEntity,
  GpkgGeometry,
  GpkgSource,
  GpkgClaim,
  GpkgRatingEvent,
  GpkgRelationship,
  GpkgIntegrityEvent,
  GeoPackageLoadResult,
  ApplyGeoPackageResultState,
} from "./types"
