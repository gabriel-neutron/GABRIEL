import { useMemo, useRef } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getRenderedSymbolForEntity } from "@/services/symbol.service"
import type { MapEntity } from "@/types/domain.types"

type Props = {
  entities: MapEntity[]
  positionMap: Map<string, [number, number]>
  visibleLayerIds: Set<string>
  hiddenEntityIds?: Set<string>
  onSelectEntity: (id: string | null) => void
}

function makeSymbolIcon(
  svg: string,
  anchor: { x: number; y: number },
  width: number,
  height: number,
  opacity: number,
): L.DivIcon {
  const opacityStyle = opacity < 1 ? `opacity:${opacity};` : ""
  return L.divIcon({
    className: "nato-symbol-marker",
    html: `<div class="nato-symbol-wrap" style="width:${width}px;height:${height}px;position:relative;${opacityStyle}">${svg}</div>`,
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
    popupAnchor: [0, -anchor.y],
  })
}

export function SymbolsLayer({
  entities,
  positionMap,
  visibleLayerIds,
  hiddenEntityIds,
  onSelectEntity,
}: Props) {
  const iconCache = useRef(new Map<string, L.DivIcon>())

  const visible = useMemo(() => {
    return entities.flatMap((entity) => {
      if (!visibleLayerIds.has(entity.layerId) || hiddenEntityIds?.has(entity.id)) return []
      const position = positionMap.get(entity.id)
      return position ? [{ entity, position }] : []
    })
  }, [entities, positionMap, visibleLayerIds, hiddenEntityIds])

  return (
    <>
      {(() => {
        const usedKeys = new Set<string>()
        const markers = visible.map(({ entity, position }) => {
          const mode = entity.positionMode ?? "own"
          const opacity = mode === "none" ? 0.75 : 1
          const cacheKey = `${entity.id}:${entity.natoSymbolCode ?? ""}:${entity.type ?? ""}:${entity.echelon ?? ""}:${entity.affiliation ?? ""}:${entity.domain ?? ""}:${entity.name}:${mode}`
          usedKeys.add(cacheKey)

          let icon = iconCache.current.get(cacheKey)
          if (!icon) {
            const { svg, anchor, width, height } = getRenderedSymbolForEntity(entity)
            icon = makeSymbolIcon(svg, anchor, width, height, opacity)
            iconCache.current.set(cacheKey, icon)
          }

          return (
            <Marker
              key={entity.id}
              position={position}
              icon={icon}
              eventHandlers={{
                click: () => onSelectEntity(entity.id),
              }}
            >
              <Popup>{entity.name}</Popup>
            </Marker>
          )
        })

        for (const key of iconCache.current.keys()) {
          if (!usedKeys.has(key)) iconCache.current.delete(key)
        }

        return markers
      })()}
    </>
  )
}
