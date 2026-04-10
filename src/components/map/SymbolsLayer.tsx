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

  // #region agent log - Hypotheses A, D
  const visibleRecomputeRef = useRef(0)
  const visible = useMemo(() => {
    visibleRecomputeRef.current += 1
    fetch('http://127.0.0.1:7621/ingest/5d09de12-2036-4626-a2d7-a250cef5312b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d20a2f'},body:JSON.stringify({sessionId:'d20a2f',location:'SymbolsLayer.tsx:visible',message:'visible recomputed',data:{recomputeCount:visibleRecomputeRef.current,entityCount:entities.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{})
    return entities.flatMap((entity) => {
      if (!visibleLayerIds.has(entity.layerId) || hiddenEntityIds?.has(entity.id)) return []
      const position = positionMap.get(entity.id)
      return position ? [{ entity, position }] : []
    })
  }, [entities, positionMap, visibleLayerIds, hiddenEntityIds])
  // #endregion

  return (
    <>
      {(() => {
        // #region agent log - Hypothesis D: IIFE render timing
        const iifeStart = performance.now()
        // #endregion
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

        // #region agent log - Hypothesis D: IIFE render timing
        const iifeMs = performance.now() - iifeStart
        if (iifeMs > 2) fetch('http://127.0.0.1:7621/ingest/5d09de12-2036-4626-a2d7-a250cef5312b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d20a2f'},body:JSON.stringify({sessionId:'d20a2f',location:'SymbolsLayer.tsx:iife',message:'IIFE render time',data:{iifeMs:Math.round(iifeMs),visibleCount:visible.length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{})
        // #endregion

        return markers
      })()}
    </>
  )
}
