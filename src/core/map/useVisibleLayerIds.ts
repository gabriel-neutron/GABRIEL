import { useMemo } from "react"
import { useProjectStore } from "@/store/useProjectStore"

/** Shared by any self-contained map layer that needs the set of currently-visible layer ids. */
export function useVisibleLayerIds(): Set<string> {
  const layers = useProjectStore((s) => s.layers)
  return useMemo(() => new Set(layers.filter((l) => l.visible).map((l) => l.id)), [layers])
}
