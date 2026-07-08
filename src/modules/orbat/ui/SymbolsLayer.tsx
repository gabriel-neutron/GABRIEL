import { useMemo, useLayoutEffect, useState } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getRenderedSymbolForEntity } from "@/modules/orbat/services/symbol.service"
import { useProjectStore } from "@/store/useProjectStore"
import type { LatLng } from "@/core/coordinates"
import type { MapBounds } from "@/components/map/MapBoundsReporter"

const BOUNDS_BUFFER = 0.5

type Props = {
  positionMap: Map<string, LatLng>
  visibleLayerIds: Set<string>
  hiddenEntityIds?: Set<string>
  onSelectEntity: (id: string | null) => void
  mapBounds?: MapBounds | null
  interactive?: boolean
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
  interactive = true,
}: Props): React.ReactElement {
  const entities = useProjectStore((s) => s.entities)

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

  const markerItems = useMemo(
    () =>
      visibleInBounds.map(({ entity, position }) => {
        const mode = entity.positionMode ?? "own"
        const opacity = mode === "none" ? 0.75 : 1
        const cacheKey = `${entity.id}:${entity.natoSymbolCode ?? ""}:${entity.type ?? ""}:${entity.echelon ?? ""}:${entity.affiliation ?? ""}:${entity.domain ?? ""}:${entity.name}`
        return { entity, position, cacheKey, opacity }
      }),
    [visibleInBounds],
  )

  const [icons, setIcons] = useState<Map<string, L.Icon>>(() => new Map())

  useLayoutEffect(() => {
    setIcons((prev) => {
      const next = new Map<string, L.Icon>()
      for (const item of markerItems) {
        let icon = prev.get(item.cacheKey)
        if (!icon) {
          const { pngDataUri, anchor, width, height } = getRenderedSymbolForEntity(item.entity)
          icon = makeSymbolIcon(pngDataUri, anchor, width, height)
        }
        next.set(item.cacheKey, icon)
      }
      return next
    })
  }, [markerItems])

  return (
    <>
      {markerItems.map((item) => {
        const icon = icons.get(item.cacheKey)
        if (!icon) return null
        return (
          <Marker
            key={item.entity.id}
            position={item.position}
            icon={icon}
            opacity={item.opacity}
            interactive={interactive}
            eventHandlers={
              interactive
                ? {
                    click: () => onSelectEntity(item.entity.id),
                  }
                : undefined
            }
          >
            <Popup>{item.entity.name}</Popup>
          </Marker>
        )
      })}
    </>
  )
}
