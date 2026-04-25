import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProjectStore } from "@/store/useProjectStore"

export const BASE_MAP_IDS = ["osm", "satellite", "hybrid", "topo"] as const
export type BaseMapId = (typeof BASE_MAP_IDS)[number]

const LABELS: Record<BaseMapId, string> = {
  osm: "OpenStreetMap",
  satellite: "Satellite",
  hybrid: "Satellite + labels",
  topo: "Topographic",
}

export function BaseMapSwitcher() {
  const baseMap = useProjectStore((s) => s.baseMap)
  const setBaseMap = useProjectStore((s) => s.setBaseMap)
  return (
    <Select value={baseMap} onValueChange={(v) => setBaseMap(v as BaseMapId)}>
      <SelectTrigger size="sm" className="w-[160px]" title="Map background">
        <SelectValue placeholder="Map" />
      </SelectTrigger>
      <SelectContent className="max-h-none overflow-y-visible [&_[data-slot=select-scroll-up-button]]:hidden [&_[data-slot=select-scroll-down-button]]:hidden">
        {BASE_MAP_IDS.map((id) => (
          <SelectItem key={id} value={id}>
            {LABELS[id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
