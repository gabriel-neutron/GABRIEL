import { useMemo } from "react"
import { Polyline } from "react-leaflet"
import { useProjectStore } from "@/store/useProjectStore"
import { useMapPrefsStore } from "@/store/useMapPrefsStore"
import { useMapInteractive } from "@/core/map/useMapViewStore"
import { usePositionMap } from "@/core/map/usePositionMap"
import type { MapEntity } from "@/types/domain.types"
import type { LatLng } from "@/core/coordinates"
import { buildOrbat } from "@/core/entity/hierarchy"

const NETWORK_LINE_OPTIONS = {
  color: "#a855f7",
  weight: 5,
  opacity: 0.85,
  dashArray: "6, 6",
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

/** Self-contained map layer (ADR 0007) — reads its own position/viewport inputs. */
export function NetworkLinksLayer(): React.ReactElement | null {
  const entities = useProjectStore((s) => s.entities)
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  const showNetworks = useMapPrefsStore((s) => s.showNetworks)
  const interactive = useMapInteractive()
  const positionMap = usePositionMap()

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
