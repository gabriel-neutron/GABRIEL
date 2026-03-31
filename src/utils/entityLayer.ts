import type { Layer } from "@/types/domain.types"

const FALLBACK_ECHELON_LAYER_ID = "Team/Crew"

/** Default layer for new drawn entities: prefer custom layer, else Team/Crew. */
export function getDefaultEntityLayerId(layers: Layer[]): string {
  const nonOsm = layers.filter((l) => l.osmData == null)
  const custom = nonOsm.find((l) => l.kind === "custom")
  if (custom) return custom.id
  const fallback = nonOsm.find((l) => l.id === FALLBACK_ECHELON_LAYER_ID)
  if (fallback) return fallback.id
  return nonOsm[0]?.id ?? ""
}
