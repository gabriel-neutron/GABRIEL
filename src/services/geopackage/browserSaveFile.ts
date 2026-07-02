import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"

const BROWSER_SAVE_FILE_POOL_SIZE = 8
let browserSaveFileIndex = 0

export function nextSavePackageFileName(): string {
  if (typeof window === "undefined") {
    return `gabriel-${crypto.randomUUID()}.gpkg`
  }
  // In browser/sql.js runtimes, unbounded filenames can leak virtual DB files across saves.
  const index = browserSaveFileIndex++ % BROWSER_SAVE_FILE_POOL_SIZE
  return `gabriel-browser-save-${index}.gpkg`
}

export async function createGeoPackageWithRetry(maxAttempts = 6): Promise<GeoPackage> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const packageFileName =
      attempt < BROWSER_SAVE_FILE_POOL_SIZE
        ? nextSavePackageFileName()
        : `gabriel-browser-save-fallback-${crypto.randomUUID()}.gpkg`
    try {
      const gpkg = await GeoPackageAPI.create(packageFileName)
      gpkg.createRequiredTables()
      return gpkg
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Unable to create GeoPackage."))
}
