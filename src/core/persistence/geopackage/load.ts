import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { readEntities, readLegacyUnitSourcesColumn } from "./units.table"
import { readOrganisations, organisationsToCorporateEntities, organisationSourcesMap } from "./organisations.table"
import { readLayers } from "./layers.table"
import { readGeometries } from "./geometries.table"
import { readSourceCache } from "./researchSources.table"
import { readProvenanceSources } from "./provenanceSources.table"
import { readProvenanceClaims } from "./provenanceClaims.table"
import { readRatingEvents } from "./ratingEvents.table"
import { deriveProvenanceFromEntities, type EntityLedgerInput } from "@/core/provenance/deriveFromEntities"
import type { GeoPackageLoadResult } from "./types"

export async function loadGeoPackage(buffer: ArrayBuffer): Promise<GeoPackageLoadResult> {
  let geoPackage: GeoPackage | null = null
  try {
    geoPackage = await GeoPackageAPI.open(new Uint8Array(buffer))

    const layers = readLayers(geoPackage)
    // Legacy organisations (pre-E1 files) fold into the same unified entities array,
    // tagged kind: "corporate" — see organisations.table.ts's migrateLegacyOrganisations.
    // Read once and reused for both the entity mapping and the legacy sources map below
    // (rather than calling migrateLegacyOrganisations + readLegacyOrganisationSources
    // separately, which would scan/decode the same table twice on every load).
    const unitEntities = readEntities(geoPackage)
    const legacyOrganisations = readOrganisations(geoPackage)
    const corporateEntities = organisationsToCorporateEntities(legacyOrganisations)
    const entities = [...unitEntities, ...corporateEntities]
    const geometries = await readGeometries(geoPackage)
    const sourceCache = readSourceCache(geoPackage)
    // ADR 0006, E2.6: entity.sources no longer exists — derive from the legacy raw
    // sources columns on both units and organisations (the only two places a
    // pre-cutover file could have stored citations), merged with whatever provenance
    // was already persisted from a prior save. Kept as two separate lookups rather
    // than one merged Map: units and legacy organisations are independent tables with
    // independently-assigned ids, and merging into one Map would silently drop one
    // table's citation string on an (unenforced, if unlikely) id collision.
    const unitLegacySources = readLegacyUnitSourcesColumn(geoPackage)
    const organisationLegacySources = organisationSourcesMap(legacyOrganisations)
    const ledgerInputs: EntityLedgerInput[] = [
      ...unitEntities.map((e) => ({ id: e.id, sources: unitLegacySources.get(e.id) ?? null })),
      ...corporateEntities.map((e) => ({ id: e.id, sources: organisationLegacySources.get(e.id) ?? null })),
    ]
    const { sources, claims } = deriveProvenanceFromEntities(
      ledgerInputs,
      readProvenanceSources(geoPackage),
      readProvenanceClaims(geoPackage),
    )

    const layerIds = new Set(layers.map((l) => l.id))
    const entityIds = new Set(entities.map((e) => e.id))
    // Units and corporate entities form separate hierarchies — a parentId is only
    // valid within its own kind, so validate against a same-kind id set, not the
    // pooled one (which would silently accept a cross-kind parent reference).
    const unitIds = new Set(entities.filter((e) => e.kind === "unit").map((e) => e.id))
    const corporateIds = new Set(entities.filter((e) => e.kind === "corporate").map((e) => e.id))
    for (const e of entities) {
      if (!layerIds.has(e.layerId)) {
        throw new Error("Unsupported schema: entity references missing layer.")
      }
      if (e.parentId != null) {
        const sameKindIds = e.kind === "corporate" ? corporateIds : unitIds
        if (!sameKindIds.has(e.parentId)) {
          throw new Error("Unsupported schema: entity references missing parent.")
        }
      }
    }
    for (const g of geometries) {
      if (!layerIds.has(g.layerId)) {
        throw new Error("Unsupported schema: geometry references missing layer.")
      }
      if (g.entityId != null && !entityIds.has(g.entityId)) {
        throw new Error("Unsupported schema: geometry references missing entity.")
      }
    }

    const ratingEvents = readRatingEvents(geoPackage)

    return { layers, entities, geometries, sourceCache, sources, claims, ratingEvents }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unsupported schema")) throw e
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("loadGeoPackage: parse error", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Corrupted GeoPackage or unsupported schema: ${errorMsg}`)
  } finally {
    if (geoPackage) geoPackage.close()
  }
}
