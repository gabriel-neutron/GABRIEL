import { Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" variant="outline" title={`Map style: ${LABELS[baseMap]}`}>
          <Map className="h-4 w-4" />
          <span className="sr-only">Choose map style</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[10000] min-w-[220px]">
        {BASE_MAP_IDS.map((id) => (
          <DropdownMenuItem
            key={id}
            onClick={() => setBaseMap(id)}
            className="flex items-center justify-between"
          >
            {LABELS[id]}
            {baseMap === id ? <span className="text-xs text-muted-foreground">Active</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
