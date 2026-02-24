import { useEffect } from "react"
import { useMap } from "react-leaflet"

export type MapBounds = { south: number; west: number; north: number; east: number }

type Props = {
  onBoundsChange: (bounds: MapBounds) => void
}

export function MapBoundsReporter({ onBoundsChange }: Props) {
  const map = useMap()

  useEffect(() => {
    const update = () => {
      const b = map.getBounds()
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      })
    }
    update()
    map.on("moveend", update)
    map.on("zoomend", update)
    return () => {
      map.off("moveend", update)
      map.off("zoomend", update)
    }
  }, [map, onBoundsChange])

  return null
}