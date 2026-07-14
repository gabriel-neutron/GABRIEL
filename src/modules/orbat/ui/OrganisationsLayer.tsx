import { memo, useMemo, useLayoutEffect, useState } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { makeOrganisationIcon } from "@/modules/orbat/services/organisation-icons"
import { useProjectStore } from "@/store/useProjectStore"
import { useMapViewStore, useMapInteractive } from "@/core/map/useMapViewStore"
import { usePositionMap } from "@/core/map/usePositionMap"
import { useVisibleLayerIds } from "@/core/map/useVisibleLayerIds"
import { selectEntity } from "@/core/map/selection"
import { INDUSTRY_LAYER_ID, type OrganisationType } from "@/types/organisation.types"
import type { LatLng } from "@/core/coordinates"

const BOUNDS_BUFFER = 0.5

/** Self-contained map layer (ADR 0007) — reads its own selection/viewport inputs. */
export const OrganisationsLayer = memo(function OrganisationsLayer(): React.ReactElement {
  const allEntities = useProjectStore((s) => s.entities)
  const organisations = useMemo(() => allEntities.filter((e) => e.kind === "corporate"), [allEntities])
  const mapBounds = useMapViewStore((s) => s.mapBounds)
  const interactive = useMapInteractive()
  const visibleLayerIds = useVisibleLayerIds()

  // Same-kind-only parenting (enforced at load time, ADR 0004/E1) means a corporate
  // entity's ancestor chain never crosses into units — computing positions over every
  // entity and filtering to organisations here yields identical results to computing
  // over the organisation-only subset, so this reuses the shared hook instead of a
  // second computeAllEntityPositions call.
  const allPositions = usePositionMap()

  const visible = useMemo(() => {
    if (!visibleLayerIds.has(INDUSTRY_LAYER_ID)) return []
    return organisations.flatMap((org) => {
      const position = allPositions.get(org.id)
      return position ? [{ org, position }] : []
    })
  }, [organisations, allPositions, visibleLayerIds])

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
      visibleInBounds.map(({ org, position }) => ({
        org,
        position,
        // Corporate entities always carry a type (CorporateProfile.type is required); the
        // fallback only guards Entity's necessarily-widened `type?: string` at the type level.
        cacheKey: (org.type as OrganisationType | undefined) ?? "other",
      })),
    [visibleInBounds],
  )

  const [icons, setIcons] = useState<Map<string, L.Icon>>(() => new Map())

  useLayoutEffect(() => {
    setIcons((prev) => {
      const next = new Map<string, L.Icon>()
      for (const item of markerItems) {
        let icon = prev.get(item.cacheKey)
        if (!icon) icon = makeOrganisationIcon(item.cacheKey)
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
            key={item.org.id}
            position={item.position as LatLng}
            icon={icon}
            interactive={interactive}
            eventHandlers={interactive ? { click: () => selectEntity(item.org.id) } : undefined}
          >
            <Popup>{item.org.name}</Popup>
          </Marker>
        )
      })}
    </>
  )
})
