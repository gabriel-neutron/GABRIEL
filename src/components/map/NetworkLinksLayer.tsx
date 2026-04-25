import { useMemo } from "react"
import { Polyline } from "react-leaflet"
import { useProjectStore } from "@/store/useProjectStore"
import type { MapEntity } from "@/types/domain.types"
import type { LatLng } from "@/types/coordinates"

const NETWORK_LINE_OPTIONS = {
  color: "#a855f7",
  weight: 5,
  opacity: 0.85,
  dashArray: "6, 6",
}

type Props = {
  positionMap: Map<string, LatLng>
}

const MAX_DEGREE = 3

function visibleNetworkIds(
  selectedId: string,
  entities: MapEntity[]
): Set<string> {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const visible = new Set<string>([selectedId])

  let current: MapEntity | undefined = byId.get(selectedId)
  for (let up = 0; up < MAX_DEGREE && current?.parentId; up++) {
    visible.add(current.parentId)
    current = byId.get(current.parentId)
  }

  let frontier: string[] = [selectedId]
  for (let depth = 0; depth < MAX_DEGREE && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of entities) {
        if (e.parentId === id) {
          visible.add(e.id)
          next.push(e.id)
        }
      }
    }
    frontier = next
  }

  return visible
}

export function NetworkLinksLayer({ positionMap }: Props): React.ReactElement | null {
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
          pathOptions={NETWORK_LINE_OPTIONS}
        />
      ))}
    </>
  )
}
