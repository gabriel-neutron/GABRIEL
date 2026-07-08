import { ECHELON_OPTIONS } from "@/types/symbol.types"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Organisation } from "@/types/organisation.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { ApplyGeoPackageResultState, GeoPackageLoadResult } from "./types"

export function getDefaultEchelonLayers(): Layer[] {
  return ECHELON_OPTIONS.map((opt) => ({
    id: opt.value,
    name: opt.label,
    visible: true,
    kind: "echelon" as const,
  }))
}

export function applyGeoPackageResult(
  result: GeoPackageLoadResult,
  currentSelectedEntityId: string | null,
  currentSelectedOrganisationId: string | null = null,
): ApplyGeoPackageResultState {
  const loaded = result.layers
  const echelonById = new Map(loaded.filter((l) => l.kind === "echelon").map((l) => [l.id, l]))
  const echelonLayers: Layer[] = getDefaultEchelonLayers().map((d) => {
    const fromFile = echelonById.get(d.id)
    return fromFile ? { ...d, visible: fromFile.visible } : d
  })
  const customLayers: Layer[] = loaded
    .filter((l) => l.kind === "custom")
    .map((l) => ({ id: l.id, name: l.name, visible: l.visible, kind: "custom" as const }))
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
  const industryFromFile = loaded.find((l) => l.id === INDUSTRY_LAYER_ID && l.kind === "organisation")
  const industryLayer: Layer = industryFromFile
    ? { id: INDUSTRY_LAYER_ID, name: industryFromFile.name, visible: industryFromFile.visible, kind: "organisation" }
    : { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" }
  const selectedEntityId =
    currentSelectedEntityId != null && result.entities.some((e) => e.id === currentSelectedEntityId)
      ? currentSelectedEntityId
      : null
  const selectedOrganisationId =
    currentSelectedOrganisationId != null &&
    result.organisations.some((o) => o.id === currentSelectedOrganisationId)
      ? currentSelectedOrganisationId
      : null
  const layers: Layer[] = [...echelonLayers, ...customLayers, ...osmLayers, industryLayer]
  return {
    layers,
    entities: result.entities as MapEntity[],
    organisations: result.organisations as Organisation[],
    drawnGeometries: result.geometries as DrawnGeometry[],
    selectedEntityId,
    selectedOrganisationId,
  }
}
