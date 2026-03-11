import { useMemo } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getSymbolForUnit, mapEntityToSymbolInput, renderSymbol } from "@/services/symbol.service"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { getEntityDisplayPosition } from "@/utils/geometry"

type Props = {
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  visibleLayerIds: Set<string>
  hiddenEntityIds?: Set<string>
  onSelectEntity: (id: string | null) => void
}

function makeSymbolIcon(svg: string, anchor: { x: number; y: number }, width: number, height: number): L.DivIcon {
  return L.divIcon({
    className: "nato-symbol-marker",
    html: `<div class="nato-symbol-wrap" style="width:${width}px;height:${height}px;position:relative;">${svg}</div>`,
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
  })
}

export function SymbolsLayer({ entities, drawnGeometries, visibleLayerIds, hiddenEntityIds, onSelectEntity }: Props) {
  const entitiesOnVisibleLayers = useMemo(
    () => entities.filter((e) => visibleLayerIds.has(e.layerId) && !hiddenEntityIds?.has(e.id)),
    [entities, visibleLayerIds, hiddenEntityIds],
  )

  return (
    <>
      {entitiesOnVisibleLayers.map((entity) => {
        const position = getEntityDisplayPosition(entity.id, drawnGeometries)
        if (!position) return null

        const input = mapEntityToSymbolInput(entity)
        const { sidc, options } = getSymbolForUnit(input)
        const { svg, anchor, width, height } = renderSymbol(sidc, options)
        const icon = makeSymbolIcon(svg, anchor, width, height)

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
      })}
    </>
  )
}
