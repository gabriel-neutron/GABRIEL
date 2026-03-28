import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"

/**
 * When an entity sits on an echelon layer (not custom), `layer_id` in storage should match `echelon`.
 * Legacy data often had `layer_id` = first echelon ("Army") while `echelon` was set correctly — use echelon for grouping and visibility.
 */
export function getEffectiveEntityLayerId(entity: MapEntity, layers: Layer[]): string {
  const assigned = layers.find((l) => l.id === entity.layerId)
  if (assigned?.kind === "custom") {
    return entity.layerId
  }
  if (entity.echelon != null && entity.echelon !== "") {
    const echelonLayer = layers.find((l) => l.kind === "echelon" && l.id === entity.echelon)
    if (echelonLayer) {
      return entity.echelon
    }
  }
  return entity.layerId
}

/** Default layer for new drawn entities: prefer custom layer, else Team/Crew (not first echelon = Army). */
const FALLBACK_ECHELON_LAYER_ID = "Team/Crew"

export function getDefaultEntityLayerId(layers: Layer[]): string {
  const nonOsm = layers.filter((l) => l.osmData == null)
  const custom = nonOsm.find((l) => l.kind === "custom")
  if (custom) return custom.id
  const fallback = nonOsm.find((l) => l.id === FALLBACK_ECHELON_LAYER_ID)
  if (fallback) return fallback.id
  return nonOsm[0]?.id ?? ""
}

/**
 * Align `layer_id` with `echelon` for non–custom-layer entities; sync linked geometry layer ids.
 * Call when loading GeoPackage so saved files self-heal in memory and on next save.
 */
export function reconcileEntitiesAndGeometriesWithEchelon(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  layers: Layer[],
): { entities: MapEntity[]; drawnGeometries: DrawnGeometry[] } {
  const reconciledEntities = entities.map((e) => {
    const assigned = layers.find((l) => l.id === e.layerId)
    if (assigned?.kind === "custom") return e
    if (e.echelon != null && e.echelon !== "") {
      const hasEchelonLayer = layers.some((l) => l.kind === "echelon" && l.id === e.echelon)
      if (hasEchelonLayer && e.layerId !== e.echelon) {
        return { ...e, layerId: e.echelon }
      }
    }
    return e
  })
  const byId = new Map(reconciledEntities.map((e) => [e.id, e]))
  const reconciledGeometries = drawnGeometries.map((g) => {
    if (g.entityId == null) return g
    const e = byId.get(g.entityId)
    if (!e) return g
    return e.layerId !== g.layerId ? { ...g, layerId: e.layerId } : g
  })
  return { entities: reconciledEntities, drawnGeometries: reconciledGeometries }
}
