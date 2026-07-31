import { setSqljsWasmLocateFile } from "@ngageoint/geopackage"

setSqljsWasmLocateFile(
  (file) => `https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/${file}`,
)

export { loadGeoPackage } from "./load"
export { saveGeoPackage } from "./save"
export type { SaveGeoPackageOptions } from "./save"
export { getDefaultEchelonLayers, applyGeoPackageResult } from "./applyResult"
export type {
  GpkgLayer,
  GpkgEntity,
  GpkgGeometry,
  GpkgSource,
  GpkgClaim,
  GpkgRatingEvent,
  GeoPackageLoadResult,
  ApplyGeoPackageResultState,
} from "./types"
