import type { Layer } from "@/types/domain.types"

const FALLBACK_ECHELON_LAYER_ID = "Team/Crew"

/**
 * Layer id for new drawn features: prefer a custom layer, else the Team/Crew echelon row,
 * else the first non-OSM layer. Avoids empty layerId on new geometry when echelon layers exist.
 */
export function getDefaultEntityLayerId(layers: Layer[]): string {
  const nonOsm = layers.filter((l) => l.osmData == null)
  const custom = nonOsm.find((l) => l.kind === "custom")
  if (custom) return custom.id
  const fallback = nonOsm.find((l) => l.id === FALLBACK_ECHELON_LAYER_ID)
  if (fallback) return fallback.id
  return nonOsm[0]?.id ?? ""
}
