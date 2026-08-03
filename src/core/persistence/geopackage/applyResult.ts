import { ECHELON_OPTIONS } from "@/types/symbol.types"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { ApplyGeoPackageResultState, GeoPackageLoadResult, GpkgClaim } from "./types"

export function getDefaultEchelonLayers(): Layer[] {
  return ECHELON_OPTIONS.map((opt) => ({
    id: opt.value,
    name: opt.label,
    visible: true,
    kind: "echelon" as const,
  }))
}

/**
 * ADR 0012. `custom` is the residual kind: every layer a project file carries that this function
 * does not otherwise place comes back as `custom`, keeping its id, name and visibility.
 *
 * The alternative was dropping it, and the loss was never confined to the layer.
 * `selectPersistableSnapshot` filters entities by *membership* in the set of loaded layer ids
 * (`useProjectStore.ts`), not by an OSM test, so a dropped layer took its entities with it, and
 * with them their geometries and their claims — all deleted at the next save, silently, on a file
 * that is not corrupt. `decodeLayerKind` returns `undefined` for any `kind` outside the four,
 * NULL included, which is exactly what a GeoPackage authored by QGIS carries.
 *
 * No integrity event is minted, because there is no longer a loss to record.
 */
export function applyGeoPackageResult(
  result: GeoPackageLoadResult,
  currentSelectedEntityId: string | null,
): ApplyGeoPackageResultState {
  const loaded = result.layers
  const defaultEchelonLayers = getDefaultEchelonLayers()
  const echelonById = new Map(loaded.filter((l) => l.kind === "echelon").map((l) => [l.id, l]))
  const echelonLayers: Layer[] = defaultEchelonLayers.map((d) => {
    const fromFile = echelonById.get(d.id)
    return fromFile ? { ...d, visible: fromFile.visible } : d
  })
  const osmLayers: Layer[] = loaded
    .filter((l) => l.kind === "osm" && l.osmData != null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      kind: "osm" as const,
      osmData: l.osmData,
      sourceQuery: l.sourceQuery,
    }))
  // Every id this function places elsewhere. What is left over is rehabilitated below rather than
  // dropped, so this set is what keeps rehabilitation from duplicating a layer.
  const placedIds = new Set<string>([
    ...defaultEchelonLayers.map((d) => d.id),
    ...osmLayers.map((l) => l.id),
    INDUSTRY_LAYER_ID,
  ])
  // Declared `custom` layers and rehabilitated ones in a single pass, so the file's own order
  // survives among them. The four branches this replaces each dropped a layer: an unrecognised or
  // NULL `kind`, an `osm` layer whose payload is gone, an `organisation` layer that is not
  // Industry, and an `echelon` layer whose id is not one of the vocabulary values.
  const customLayers: Layer[] = []
  const takenIds = new Set<string>(placedIds)
  for (const l of loaded) {
    if (takenIds.has(l.id)) continue
    takenIds.add(l.id)
    customLayers.push({ id: l.id, name: l.name, visible: l.visible, kind: "custom" })
  }
  const industryFromFile = loaded.find((l) => l.id === INDUSTRY_LAYER_ID && l.kind === "organisation")
  const industryLayer: Layer = industryFromFile
    ? { id: INDUSTRY_LAYER_ID, name: industryFromFile.name, visible: industryFromFile.visible, kind: "organisation" }
    : { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" }
  const selectedEntityId =
    currentSelectedEntityId != null && result.entities.some((e) => e.id === currentSelectedEntityId)
      ? currentSelectedEntityId
      : null
  const layers: Layer[] = [...echelonLayers, ...customLayers, ...osmLayers, industryLayer]
  return {
    layers,
    entities: result.entities as MapEntity[],
    drawnGeometries: result.geometries as DrawnGeometry[],
    // Pass-through, both of them. `entities` already carry the parent derived in `load.ts`
    // from exactly these edges, so re-deriving here would be a second answer to one question.
    relationships: result.relationships,
    integrityEvents: result.integrityEvents,
    selectedEntityId,
  }
}

/**
 * The one project state every load path hands to setProject. Named rather than inferred so that
 * "no eighth field" is a compile-time property: the literal below is excess-property-checked.
 * (Six became seven when §7 step 6 added `relationships` and `integrityEvents`.)
 */
export type ProjectStateFromLoadResult = ApplyGeoPackageResultState & { claims: GpkgClaim[] }

/**
 * claims comes from the load result, not from applyGeoPackageResult, which does not carry
 * provenance claims: taking them from there would silently drop every claim on load.
 */
export function projectStateFromLoadResult(result: GeoPackageLoadResult): ProjectStateFromLoadResult {
  const applied = applyGeoPackageResult(result, null)
  return {
    layers: applied.layers,
    entities: applied.entities,
    drawnGeometries: applied.drawnGeometries,
    claims: result.claims,
    relationships: applied.relationships,
    integrityEvents: applied.integrityEvents,
    selectedEntityId: applied.selectedEntityId,
  }
}
