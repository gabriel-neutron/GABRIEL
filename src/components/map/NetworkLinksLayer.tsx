import { useMemo } from "react"
import { Polyline } from "react-leaflet"
import { useProjectStore } from "@/store/useProjectStore"
import type { MapEntity } from "@/types/domain.types"
import type { LatLng } from "@/types/coordinates"
import { buildOrbat } from "@/core/entity/hierarchy"

const NETWORK_LINE_OPTIONS = {
  color: "#a855f7",
  weight: 5,
  opacity: 0.85,
  dashArray: "6, 6",
}

type Props = {
  positionMap: Map<string, LatLng>
  interactive?: boolean
}

const MAX_DEGREE = 3

function visibleNetworkIds(
  selectedId: string,
  entities: MapEntity[]
): Set<string> {
  const orbat = buildOrbat(entities)
  const visible = new Set<string>([selectedId])
  for (const ancestor of orbat.ancestors(selectedId, MAX_DEGREE)) visible.add(ancestor.id)
  for (const descendant of orbat.descendants(selectedId, MAX_DEGREE)) visible.add(descendant.id)
  return visible
}

export function NetworkLinksLayer({
  positionMap,
  interactive = true,
}: Props): React.ReactElement | null {
  const entities = useProjectStore((s) => s.entities)
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  const showNetworks = useProjectStore((s) => s.showNetworks)

  const links = useMemo(() => {
    if (!showNetworks || !selectedEntityId) return []

    const selected = entities.find((e) => e.id === selectedEntityId)
    if (!selected) return []

    const visibleIds = visibleNetworkIds(selectedEntityId, entities)
    const result: Array<{ key: string; positions: LatLng[] }> = []

    for (const entity of entities) {
      if (!entity.parentId || !visibleIds.has(entity.parentId) || !visibleIds.has(entity.id)) continue
      const fromPos = positionMap.get(entity.id)
      const toPos = positionMap.get(entity.parentId)
      if (!fromPos || !toPos) continue
      result.push({
        key: `edge-${entity.parentId}-${entity.id}`,
        positions: [fromPos, toPos],
      })
    }

    return result
  }, [showNetworks, selectedEntityId, entities, positionMap])

  if (links.length === 0) return null

  return (
    <>
      {links.map(({ key, positions }) => (
        <Polyline
          key={key}
          positions={positions}
          pathOptions={{ ...NETWORK_LINE_OPTIONS, interactive }}
        />
      ))}
    </>
  )
}
