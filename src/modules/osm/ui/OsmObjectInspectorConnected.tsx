import { useSelectionStore } from "@/store/useSelectionStore"
import { OsmObjectInspector } from "./OsmObjectInspector"

export type OsmSelectionMeta = {
  type: "node" | "way" | "relation"
  id: number
  cachedFeature?: GeoJSON.Feature & { id?: string }
}

/**
 * Manifest `detailRenderer`s only receive `selectedRef.id` (ADR 0007) — this reads
 * the full osm object (including the perf-shortcut `cachedFeature`) straight off
 * `useSelectionStore` instead, so the shell never has to thread it through.
 */
export function OsmObjectInspectorConnected() {
  const selectedRef = useSelectionStore((s) => s.selectedRef)
  if (selectedRef?.kind !== "osm") return null
  const meta = selectedRef.meta as OsmSelectionMeta | undefined
  if (!meta) return null
  return <OsmObjectInspector type={meta.type} id={meta.id} cachedFeature={meta.cachedFeature} />
}
