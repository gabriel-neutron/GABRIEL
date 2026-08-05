import { memo, useMemo, useLayoutEffect, useState } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { entityIconKey, makeEntityIcon } from "@/modules/orbat/services/entity-icons"
import { useProjectStore } from "@/store/useProjectStore"
import { useMapViewStore, useMapInteractive } from "@/core/map/useMapViewStore"
import { usePositionMap } from "@/core/map/usePositionMap"
import { useVisibleLayerIds } from "@/core/map/useVisibleLayerIds"
import { selectEntity } from "@/core/map/selection"
import type { LatLng } from "@/core/coordinates"

const BOUNDS_BUFFER = 0.5

/**
 * Self-contained map layer (ADR 0007) — reads its own selection/viewport inputs.
 *
 * Every kind that is not a `unit`, because a unit renders as a NATO symbol in
 * `SymbolsLayer` and nothing else does. It was corporate-only while corporate was the
 * only non-unit kind anything could create; a person or vessel drawn on the map would
 * otherwise have been an entity in the store that appeared on no layer at all.
 */
export const NonUnitEntitiesLayer = memo(function NonUnitEntitiesLayer(): React.ReactElement {
  const allEntities = useProjectStore((s) => s.entities)
  const nonUnits = useMemo(() => allEntities.filter((e) => e.kind !== "unit"), [allEntities])
  const mapBounds = useMapViewStore((s) => s.mapBounds)
  const interactive = useMapInteractive()
  const visibleLayerIds = useVisibleLayerIds()

  // Same-kind-only parenting (enforced at load time, ADR 0004/E1) means an entity's
  // ancestor chain never crosses into units — computing positions over every entity and
  // filtering here yields identical results to computing over the subset, so this reuses
  // the shared hook instead of a second computeAllEntityPositions call.
  const allPositions = usePositionMap()

  const visible = useMemo(() => {
    // Each entity's OWN layer, not the fixed INDUSTRY_LAYER_ID this used to test. That
    // constant is where a corporate entity always sits, but a person or vessel sits on
    // whichever layer it was drawn on, and hiding those with the Industry layer would
    // have been a control over a layer they are not on.
    return nonUnits.flatMap((entity) => {
      if (!visibleLayerIds.has(entity.layerId)) return []
      const position = allPositions.get(entity.id)
      return position ? [{ entity, position }] : []
    })
  }, [nonUnits, allPositions, visibleLayerIds])

  const visibleInBounds = useMemo(() => {
    if (!mapBounds) return visible
    const latPad = (mapBounds.north - mapBounds.south) * BOUNDS_BUFFER
    const lngPad = (mapBounds.east - mapBounds.west) * BOUNDS_BUFFER
    return visible.filter(({ position }) => {
      const [lat, lng] = position as [number, number]
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
      visibleInBounds.map(({ entity, position }) => ({
        entity,
        position,
        cacheKey: entityIconKey(entity),
      })),
    [visibleInBounds],
  )

  const [icons, setIcons] = useState<Map<string, L.Icon>>(() => new Map())

  useLayoutEffect(() => {
    setIcons((prev) => {
      const next = new Map<string, L.Icon>()
      for (const item of markerItems) {
        let icon = prev.get(item.cacheKey)
        if (!icon) icon = makeEntityIcon(item.cacheKey)
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
            position={item.position as LatLng}
            icon={icon}
            interactive={interactive}
            eventHandlers={interactive ? { click: () => selectEntity(item.entity.id) } : undefined}
          >
            <Popup>{item.entity.name}</Popup>
          </Marker>
        )
      })}
    </>
  )
})
