import { useMemo, useLayoutEffect, useState } from "react"
import L from "leaflet"
import { Marker, Popup } from "react-leaflet"
import { makeOrganisationIcon } from "@/modules/orbat/services/organisation-icons"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { useProjectStore } from "@/store/useProjectStore"
import { INDUSTRY_LAYER_ID, type OrganisationType } from "@/types/organisation.types"
import type { LatLng } from "@/core/coordinates"
import type { MapBounds } from "@/core/map/MapBoundsReporter"

const BOUNDS_BUFFER = 0.5

type Props = {
  visibleLayerIds: Set<string>
  onSelectOrganisation: (id: string | null) => void
  mapBounds?: MapBounds | null
  interactive?: boolean
}

export function OrganisationsLayer({
  visibleLayerIds,
  onSelectOrganisation,
  mapBounds,
  interactive = true,
}: Props): React.ReactElement {
  const allEntities = useProjectStore((s) => s.entities)
  const organisations = useMemo(() => allEntities.filter((e) => e.kind === "corporate"), [allEntities])
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)

  const positionMap = useMemo(() => {
    const all = computeAllEntityPositions(organisations, drawnGeometries)
    return new Map(all.map(({ entity, position }) => [entity.id, position]))
  }, [organisations, drawnGeometries])

  const visible = useMemo(() => {
    if (!visibleLayerIds.has(INDUSTRY_LAYER_ID)) return []
    return organisations.flatMap((org) => {
      const position = positionMap.get(org.id)
      return position ? [{ org, position }] : []
    })
  }, [organisations, positionMap, visibleLayerIds])

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
            eventHandlers={
              interactive
                ? { click: () => onSelectOrganisation(item.org.id) }
                : undefined
            }
          >
            <Popup>{item.org.name}</Popup>
          </Marker>
        )
      })}
    </>
  )
}
