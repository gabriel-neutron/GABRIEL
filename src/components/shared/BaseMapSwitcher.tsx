import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const BASE_MAP_IDS = ["osm", "satellite", "hybrid", "topo"] as const
export type BaseMapId = (typeof BASE_MAP_IDS)[number]

const LABELS: Record<BaseMapId, string> = {
  osm: "OpenStreetMap",
  satellite: "Satellite",
  hybrid: "Satellite + labels",
  topo: "Topographic",
}

type Props = {
  value: BaseMapId
  onValueChange: (value: BaseMapId) => void
}

export function BaseMapSwitcher({ value, onValueChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as BaseMapId)}>
      <SelectTrigger size="sm" className="w-[160px]" title="Map background">
        <SelectValue placeholder="Map" />
      </SelectTrigger>
      <SelectContent>
        {BASE_MAP_IDS.map((id) => (
          <SelectItem key={id} value={id}>
            {LABELS[id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
