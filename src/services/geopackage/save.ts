import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { UNITS_TABLE, createUnitsTable, writeEntities } from "./units.table"
import { ORGANISATIONS_TABLE, createOrganisationsTable, writeOrganisations } from "./organisations.table"
import { LAYERS_TABLE, createLayersTable, writeLayers } from "./layers.table"
import { GEOMETRIES_TABLE, createGeometriesTable, writeGeometries } from "./geometries.table"
import { RESEARCH_SOURCES_TABLE, createResearchSourcesTable, writeSourceCache } from "./researchSources.table"
import { createGeoPackageWithRetry } from "./browserSaveFile"
import type { GpkgLayer, GpkgEntity, GpkgOrganisation, GpkgGeometry } from "./types"

export async function saveGeoPackage(
  layers: GpkgLayer[],
  entities: GpkgEntity[],
  organisations: GpkgOrganisation[],
  geometries: GpkgGeometry[],
  researchSources?: Map<string, string>,
  baseBuffer?: ArrayBuffer,
): Promise<Uint8Array> {
  let geoPackage: GeoPackage | null = null
  try {
    if (baseBuffer != null && baseBuffer.byteLength > 0) {
      geoPackage = await GeoPackageAPI.open(new Uint8Array(baseBuffer))
    } else {
      geoPackage = await createGeoPackageWithRetry()
    }

    createLayersTable(geoPackage)
    createUnitsTable(geoPackage)
    createOrganisationsTable(geoPackage)
    createGeometriesTable(geoPackage)
    createResearchSourcesTable(geoPackage)

    // Replace persisted app data with the current in-memory project snapshot.
    geoPackage.connection.run(`DELETE FROM ${LAYERS_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${UNITS_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${ORGANISATIONS_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${GEOMETRIES_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${RESEARCH_SOURCES_TABLE}`)

    writeSourceCache(geoPackage, researchSources)

    writeLayers(geoPackage, layers)

    writeEntities(geoPackage, entities)

    writeOrganisations(geoPackage, organisations)

    writeGeometries(geoPackage, geometries)

    const exported = await geoPackage.export()
    if (!(exported instanceof Uint8Array)) {
      throw new Error("Export did not return Uint8Array")
    }

    return exported
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("saveGeoPackage failed", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Failed to save GeoPackage: ${errorMsg}`)
  } finally {
    if (geoPackage) geoPackage.close()
  }
}
