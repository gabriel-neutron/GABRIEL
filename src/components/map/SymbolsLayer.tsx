import { useMemo } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { getRenderedSymbolForEntity } from "@/services/symbol.service"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { computeAllEntityPositions } from "@/utils/geometry"

type Props = {
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
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
  })
}

export function SymbolsLayer({
  entities,
  drawnGeometries,
  visibleLayerIds,
  hiddenEntityIds,
  onSelectEntity,
}: Props) {
  const positioned = useMemo(
    () => computeAllEntityPositions(entities, drawnGeometries),
    [entities, drawnGeometries],
  )

  const visible = useMemo(
    () =>
      positioned.filter(
        ({ entity }) =>
          visibleLayerIds.has(entity.layerId) && !hiddenEntityIds?.has(entity.id),
      ),
    [positioned, visibleLayerIds, hiddenEntityIds],
  )

  return (
    <>
      {visible.map(({ entity, position }) => {
        const mode = entity.positionMode ?? "own"
        const opacity = mode === "none" ? 0.75 : 1

        const { svg, anchor, width, height } = getRenderedSymbolForEntity(entity)
        const icon = makeSymbolIcon(svg, anchor, width, height, opacity)

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
