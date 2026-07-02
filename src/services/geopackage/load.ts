import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { readEntities } from "./units.table"
import { readOrganisations } from "./organisations.table"
import { readLayers } from "./layers.table"
import { readGeometries } from "./geometries.table"
import { readSourceCache } from "./researchSources.table"
import type { GeoPackageLoadResult } from "./types"

export async function loadGeoPackage(buffer: ArrayBuffer): Promise<GeoPackageLoadResult> {
  let geoPackage: GeoPackage | null = null
  try {
    geoPackage = await GeoPackageAPI.open(new Uint8Array(buffer))

    const layers = readLayers(geoPackage)
    const entities = readEntities(geoPackage)
    const organisations = readOrganisations(geoPackage)
    const geometries = await readGeometries(geoPackage)
    const sourceCache = readSourceCache(geoPackage)

    const layerIds = new Set(layers.map((l) => l.id))
    const entityIds = new Set(entities.map((e) => e.id))
    const organisationIds = new Set(organisations.map((o) => o.id))
    const allEntityIds = new Set([...entityIds, ...organisationIds])
    for (const e of entities) {
      if (!layerIds.has(e.layerId)) {
        throw new Error("Unsupported schema: entity references missing layer.")
      }
      if (e.parentId != null && !entityIds.has(e.parentId)) {
        throw new Error("Unsupported schema: entity references missing parent.")
      }
    }
    for (const o of organisations) {
      if (o.parentId != null && !organisationIds.has(o.parentId)) {
        throw new Error("Unsupported schema: organisation references missing parent.")
      }
    }
    for (const g of geometries) {
      if (!layerIds.has(g.layerId)) {
        throw new Error("Unsupported schema: geometry references missing layer.")
      }
      if (g.entityId != null && !allEntityIds.has(g.entityId)) {
        throw new Error("Unsupported schema: geometry references missing entity.")
      }
    }

    return { layers, entities, organisations, geometries, sourceCache }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unsupported schema")) throw e
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("loadGeoPackage: parse error", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Corrupted GeoPackage or unsupported schema: ${errorMsg}`)
  } finally {
    if (geoPackage) geoPackage.close()
  }
}
