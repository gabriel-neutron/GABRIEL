import { useMemo } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getSymbolForUnit, renderSymbol } from "@/services/symbol.service"
import type { SymbolDomain, SymbolEchelon } from "@/types/symbol.types"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { getEntityDisplayPosition } from "@/utils/geometry"

type Props = {
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  visibleLayerIds: Set<string>
  onSelectEntity: (id: string | null) => void
}

function entityToSymbolInput(entity: MapEntity): Parameters<typeof getSymbolForUnit>[0] {
  return {
    unit: {
      id: entity.id,
      name: entity.name,
      type: entity.type ?? "unknown",
      parent_id: entity.parentId,
      nato_symbol_code: entity.natoSymbolCode ?? undefined,
    },
    affiliation: entity.affiliation ?? "Friend",
    echelon: (entity.echelon as SymbolEchelon) ?? undefined,
    domain: (entity.domain as SymbolDomain) ?? "Ground",
  }
}

function makeSymbolIcon(svg: string, anchor: { x: number; y: number }, width: number, height: number): L.DivIcon {
  return L.divIcon({
    className: "nato-symbol-marker",
    html: `<div class="nato-symbol-wrap" style="width:${width}px;height:${height}px;position:relative;">${svg}</div>`,
    iconSize: [width, height],
    iconAnchor: [anchor.x, anchor.y],
  })
}

export function SymbolsLayer({ entities, drawnGeometries, visibleLayerIds, onSelectEntity }: Props) {
  const entitiesOnVisibleLayers = useMemo(
    () => entities.filter((e) => visibleLayerIds.has(e.layerId)),
    [entities, visibleLayerIds],
  )

  return (
    <>
      {entitiesOnVisibleLayers.map((entity) => {
        const position = getEntityDisplayPosition(entity.id, drawnGeometries)
        if (!position) return null

        const input = entityToSymbolInput(entity)
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
