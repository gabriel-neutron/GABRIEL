import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { UNITS_TABLE, createUnitsTable, writeEntities, unitColumns } from "./units.table"
import { LAYERS_TABLE, createLayersTable, writeLayers } from "./layers.table"
import { GEOMETRIES_TABLE, createGeometriesTable, writeGeometries } from "./geometries.table"
import { RESEARCH_SOURCES_TABLE, createResearchSourcesTable, writeSourceCache } from "./researchSources.table"
import {
  createProvenanceSourcesTable,
  provenanceSourceColumns,
  writeProvenanceSources,
  PROVENANCE_SOURCES_TABLE,
} from "./provenanceSources.table"
import {
  createProvenanceClaimsTable,
  provenanceClaimColumns,
  writeProvenanceClaims,
  PROVENANCE_CLAIMS_TABLE,
} from "./provenanceClaims.table"
import { createRatingEventsTable, writeRatingEvents } from "./ratingEvents.table"
import { clearLegacyOrganisationsTable } from "./organisations.table"
import { createGeoPackageWithRetry } from "./browserSaveFile"
import { ensureOptionalColumns } from "./columnDescriptor"
import type { GpkgLayer, GpkgEntity, GpkgGeometry, GpkgSource, GpkgClaim, GpkgRatingEvent } from "./types"

/**
 * A legacy `organisations` table (pre-E1, ADR 0004) is folded into `units` (via its
 * `kind` column) on every save, then emptied with `clearLegacyOrganisationsTable` so a
 * later `loadGeoPackage` doesn't re-migrate its now-duplicated rows.
 */
export async function saveGeoPackage(
  layers: GpkgLayer[],
  entities: GpkgEntity[],
  geometries: GpkgGeometry[],
  researchSources?: Map<string, string>,
  baseBuffer?: ArrayBuffer,
  // ADR 0006, E2 Slice A: additive trailing params, not yet threaded through from the
  // store/useProjectIO (E2.4) — every existing call site keeps working unchanged.
  sources?: GpkgSource[],
  claims?: GpkgClaim[],
  // Phase 4 (v1.5): same additive-trailing-param pattern as sources/claims above.
  ratingEvents?: GpkgRatingEvent[],
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
    createGeometriesTable(geoPackage)
    createResearchSourcesTable(geoPackage)
    createProvenanceSourcesTable(geoPackage)
    createProvenanceClaimsTable(geoPackage)
    createRatingEventsTable(geoPackage)

    // A reopened pre-migration `units`/provenance table (baseBuffer path) may still be
    // missing columns added since its physical creation — add them before any INSERT runs.
    ensureOptionalColumns(geoPackage.connection, UNITS_TABLE, unitColumns)
    ensureOptionalColumns(geoPackage.connection, PROVENANCE_SOURCES_TABLE, provenanceSourceColumns)
    ensureOptionalColumns(geoPackage.connection, PROVENANCE_CLAIMS_TABLE, provenanceClaimColumns)

    // Replace persisted app data with the current in-memory project snapshot.
    geoPackage.connection.run(`DELETE FROM ${LAYERS_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${UNITS_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${GEOMETRIES_TABLE}`)
    geoPackage.connection.run(`DELETE FROM ${RESEARCH_SOURCES_TABLE}`)
    clearLegacyOrganisationsTable(geoPackage)

    writeSourceCache(geoPackage, researchSources)

    writeLayers(geoPackage, layers)

    writeEntities(geoPackage, entities)

    writeGeometries(geoPackage, geometries)

    // writeProvenanceSources/writeProvenanceClaims/writeRatingEvents each self-clear
    // (DELETE FROM their own table) before inserting, so calling them unconditionally
    // with `?? []` reproduces "wipe on omit" (e.g. a New Project save that passes no
    // sources/claims/ratingEvents while reusing a baseBuffer) without a second,
    // redundant DELETE here duplicating that behavior.
    writeProvenanceSources(geoPackage, sources ?? [])
    writeProvenanceClaims(geoPackage, claims ?? [])
    writeRatingEvents(geoPackage, ratingEvents ?? [])

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
