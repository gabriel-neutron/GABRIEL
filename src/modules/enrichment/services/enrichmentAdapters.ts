import type { ParentLink } from "@/core/relationship/hierarchyIndex"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentContext, EnrichmentContextChild, EnrichmentFeature } from "@/types/enrichment.types"

export function toEnrichmentFeature(entity: MapEntity, geometries: DrawnGeometry[]): EnrichmentFeature {
  const point = geometries.find((g) => g.entityId === entity.id && g.type === "point")
  const lng = point?.type === "point" ? point.lng : 0
  const lat = point?.type === "point" ? point.lat : 0
  return {
    type: "Feature",
    id: entity.id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: entity.id,
      name: entity.name,
      echelon: entity.echelon ?? null,
      country: "RU",
      parentId: entity.parentId,
      natoSymbolCode: entity.natoSymbolCode ?? null,
      status: "active",
    },
  }
}

function toContextChild(entity: MapEntity): EnrichmentContextChild {
  return { id: entity.id, name: entity.name, echelon: entity.echelon ?? "unknown" }
}

/**
 * `parentLink` is the edge set's answer, and it is what separates "no parent is recorded"
 * from "two are". Omit it and a contested entity is described to the model as independent,
 * which is a factual misstatement in a prompt whose output becomes sourced claims — the one
 * consumer downstream of `buildOrbat` where a silent contest does not merely fail to render
 * but publishes.
 */
export function toEnrichmentContext(
  entity: MapEntity,
  entities: MapEntity[],
  parentLink?: ParentLink,
): EnrichmentContext {
  const children = entities.filter((e) => e.parentId === entity.id).map(toContextChild)

  if (parentLink?.state === "contested") {
    const competing = parentLink.via
      .map((edge) => entities.find((e) => e.id === edge.toId))
      .filter((e): e is MapEntity => e != null)
      .map(toContextChild)
    return { parent: null, children, contestedParents: competing }
  }

  const parent = entity.parentId
    ? (entities.find((e) => e.id === entity.parentId) ?? null)
    : null
  return {
    parent: parent
      ? { id: parent.id, name: parent.name, echelon: parent.echelon ?? "unknown", hq_location: undefined }
      : null,
    children,
  }
}
