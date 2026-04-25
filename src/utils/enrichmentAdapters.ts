import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentContext, EnrichmentFeature } from "@/types/enrichment.types"

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

export function toEnrichmentContext(entity: MapEntity, entities: MapEntity[]): EnrichmentContext {
  const parent = entity.parentId
    ? (entities.find((e) => e.id === entity.parentId) ?? null)
    : null
  const children = entities.filter((e) => e.parentId === entity.id)
  return {
    parent: parent
      ? { id: parent.id, name: parent.name, echelon: parent.echelon ?? "unknown", hq_location: undefined }
      : null,
    children: children.map((c) => ({ id: c.id, name: c.name, echelon: c.echelon ?? "unknown" })),
  }
}
