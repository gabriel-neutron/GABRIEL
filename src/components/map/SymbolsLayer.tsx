import { useMemo, useRef } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getRenderedSymbolForEntity } from "@/services/symbol.service"
import { useProjectStore } from "@/store/useProjectStore"
import type { LatLng } from "@/types/coordinates"
import type { MapBounds } from "./MapBoundsReporter"

// Extend viewport by this fraction on each side to prevent symbol pop-in during panning
const BOUNDS_BUFFER = 0.5

type Props = {
  positionMap: Map<string, LatLng>
  visibleLayerIds: Set<string>
  hiddenEntityIds?: Set<string>
  onSelectEntity: (id: string | null) => void
  mapBounds?: MapBounds | null
}

function makeSymbolIcon(
  pngDataUri: string,
  anchor: { x: number; y: number },
  width: number,
  height: number,
): L.Icon {
  return L.icon({
    iconUrl: pngDataUri,
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
    popupAnchor: [0, -anchor.y],
  })
}

export function SymbolsLayer({
  positionMap,
  visibleLayerIds,
  hiddenEntityIds,
  onSelectEntity,
  mapBounds,
}: Props): React.ReactElement {
  const entities = useProjectStore((s) => s.entities)
  const iconCache = useRef(new Map<string, L.Icon>())

  const visible = useMemo(() => {
    return entities.flatMap((entity) => {
      if (!visibleLayerIds.has(entity.layerId) || hiddenEntityIds?.has(entity.id)) return []
      const position = positionMap.get(entity.id)
      return position ? [{ entity, position }] : []
    })
  }, [entities, positionMap, visibleLayerIds, hiddenEntityIds])

  const visibleInBounds = useMemo(() => {
    if (!mapBounds) return visible
    const latPad = (mapBounds.north - mapBounds.south) * BOUNDS_BUFFER
    const lngPad = (mapBounds.east - mapBounds.west) * BOUNDS_BUFFER
    return visible.filter(({ position }) => {
      const [lat, lng] = position
      return (
        lat >= mapBounds.south - latPad &&
        lat <= mapBounds.north + latPad &&
        lng >= mapBounds.west - lngPad &&
        lng <= mapBounds.east + lngPad
      )
    })
  }, [visible, mapBounds])

  return (
    <>
      {(() => {
        const usedKeys = new Set<string>()
        const markers = visibleInBounds.map(({ entity, position }) => {
          const mode = entity.positionMode ?? "own"
          const opacity = mode === "none" ? 0.75 : 1
          const cacheKey = `${entity.id}:${entity.natoSymbolCode ?? ""}:${entity.type ?? ""}:${entity.echelon ?? ""}:${entity.affiliation ?? ""}:${entity.domain ?? ""}:${entity.name}`
          usedKeys.add(cacheKey)

          let icon = iconCache.current.get(cacheKey)
          if (!icon) {
            const { pngDataUri, anchor, width, height } = getRenderedSymbolForEntity(entity)
            icon = makeSymbolIcon(pngDataUri, anchor, width, height)
            iconCache.current.set(cacheKey, icon)
          }

          return (
            <Marker
              key={entity.id}
              position={position}
              icon={icon}
              opacity={opacity}
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
