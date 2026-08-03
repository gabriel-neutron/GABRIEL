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
import { createRelationshipsTable, writeRelationships } from "./relationships.table"
import { createIntegrityEventsTable, writeIntegrityEvents } from "./integrityEvents.table"
import { clearLegacyOrganisationsTable } from "./organisations.table"
import { createGeoPackageWithRetry } from "./browserSaveFile"
import { ensureOptionalColumns } from "./columnDescriptor"
import type { GpkgLayer, GpkgEntity, GpkgGeometry, GpkgSource, GpkgClaim, GpkgRatingEvent } from "./types"
// Slice 2B's two tables type themselves against the domain types directly, as their own
// descriptor lists do (`relationships.table.ts:2`); `types.ts` mints no Gpkg* alias for them.
import type { Relationship } from "@/core/relationship/relationship"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"

/**
 * Every member is required, including the five that accept `undefined`: a save replaces
 * each table it owns, so a call site that *forgets* a key silently wipes that table. The
 * `T | undefined` union keeps "deliberately nothing here" expressible and visible in a
 * diff while making omission a compile error.
 */
export type SaveGeoPackageOptions = {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
  researchSources: Map<string, string> | undefined
  baseBuffer: ArrayBuffer | undefined
  // ADR 0006, E2 Slice A: additive fields, not yet threaded through from the
  // store/useProjectIO (E2.4).
  sources: GpkgSource[] | undefined
  claims: GpkgClaim[] | undefined
  // Phase 4 (v1.5): same additive pattern as sources/claims above.
  ratingEvents: GpkgRatingEvent[] | undefined
  /**
   * Slice 2B. Plain arrays rather than `T | undefined`: the union above marks fields whose
   * absence is a distinct state from emptiness (no base file, no cache) or that are not yet
   * threaded through the store. Neither holds here — both are threaded in this slice and
   * "deliberately nothing here" is `[]`, which the required member already makes visible in a
   * diff. Both write functions self-clear (see below), so `[]` wipes the table, exactly as a
   * New Project save intends.
   */
  relationships: Relationship[]
  integrityEvents: IntegrityEvent[]
}

/**
 * A legacy `organisations` table (pre-E1, ADR 0004) is folded into `units` (via its
 * `kind` column) on every save, then emptied with `clearLegacyOrganisationsTable` so a
 * later `loadGeoPackage` doesn't re-migrate its now-duplicated rows.
 */
export async function saveGeoPackage(options: SaveGeoPackageOptions): Promise<Uint8Array> {
  const { layers, entities, geometries, researchSources, baseBuffer, sources, claims, ratingEvents } = options
  const { relationships, integrityEvents } = options
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
    // Slice 2B. No `ensureOptionalColumns` call joins the three below for these two: both are
    // created whole, with no `optional` descriptor, so their `NOT NULL` constraints live in
    // CREATE TABLE. `ensureOptionalColumns` splices `constraints` into ALTER TABLE ADD COLUMN
    // (`columnDescriptor.ts:118`), which SQLite rejects for NOT NULL without a constant
    // default — adding the call would break every file reopened from a baseBuffer.
    createRelationshipsTable(geoPackage)
    createIntegrityEventsTable(geoPackage)

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

    // Slice 2B's two tables self-clear the same way (`relationships.table.ts:108`,
    // `integrityEvents.table.ts:102`), so they need no DELETE above either. Their members are
    // required and non-`undefined`, so there is nothing to default: an omitted key is a compile
    // error and `[]` is the explicit, diff-visible way to wipe the table.
    writeRelationships(geoPackage, relationships)
    writeIntegrityEvents(geoPackage, integrityEvents)

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
