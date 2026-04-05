import { useState, useRef, useEffect, useMemo } from "react"
import { useMap } from "react-leaflet"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchPlace, type NominatimResult } from "@/services/nominatim.service"
import { searchLocalOsmFeatures, type LocalOsmSearchHit } from "@/utils/osmLocalSearch"
import type { Layer, MapEntity } from "@/types/domain.types"
import { cn } from "@/lib/utils"

const ZOOM_ON_SELECT = 14

type CoordinateHit = {
  source: "coordinates"
  lat: number
  lng: number
  display_name: string
}

type MapSearchResult =
  | (NominatimResult & { source: "nominatim" })
  | LocalOsmSearchHit
  | CoordinateHit

type MapSearchProps = {
  layers: Layer[]
  entityOsmGeometries?: Record<string, GeoJSON.FeatureCollection>
  entities?: MapEntity[]
}

/** First value latitude, second longitude (decimal degrees). */
function parseLatLngPair(query: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)\s*$/.exec(query.trim())
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  let lat = a
  let lng = b
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
      lat = b
      lng = a
    } else {
      return null
    }
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function MapSearch({ layers, entityOsmGeometries, entities }: MapSearchProps) {
  const map = useMap()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MapSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const entityNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of entities ?? []) m.set(e.id, e.name)
    return m
  }, [entities])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setOpen(false)
      return
    }
    setError(null)
    setLoading(true)
    setOpen(true)
    const requestId = ++requestIdRef.current

    const coord = parseLatLngPair(trimmed)
    const coordHit: CoordinateHit | null = coord
      ? {
          source: "coordinates",
          lat: coord.lat,
          lng: coord.lng,
          display_name: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
        }
      : null

    const localHits = searchLocalOsmFeatures(layers, trimmed, {
      entityOsmGeometries,
      entityNameById,
      limit: 12,
    })

    const baseResults: MapSearchResult[] = coordHit ? [coordHit, ...localHits] : localHits
    if (requestId === requestIdRef.current) setResults(baseResults)

    if (coord) {
      if (requestId === requestIdRef.current) setLoading(false)
      return
    }

    try {
      const next = await searchPlace(trimmed, 8)
      if (requestId === requestIdRef.current) {
        setResults([...baseResults, ...next.map((r) => ({ ...r, source: "nominatim" as const }))])
      }
    } catch (e) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : "Search failed")
        setResults(baseResults)
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  function handleSelect(result: MapSearchResult) {
    if (result.source === "coordinates") {
      map.flyTo([result.lat, result.lng], ZOOM_ON_SELECT, { duration: 0.4 })
    } else if (result.source === "local-osm") {
      map.flyTo([result.lat, result.lng], ZOOM_ON_SELECT, { duration: 0.4 })
    } else {
      const lat = Number(result.lat)
      const lng = Number(result.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.flyTo([lat, lng], ZOOM_ON_SELECT, { duration: 0.4 })
      }
    }
    setOpen(false)
    setQuery("")
    setResults([])
  }

  return (
    <div
      ref={wrapperRef}
      className="absolute right-2 top-2 z-[1000] w-80 max-w-[calc(100%-1rem)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1 rounded-md border bg-background/95 p-1 shadow-md backdrop-blur-sm">
        <Input
          type="text"
          placeholder="Place (online), coordinates, or local OSM tags"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="shadow-xs border"
          onClick={handleSearch}
          disabled={loading}
          title="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="mt-1 max-h-64 overflow-auto rounded-md border bg-background empty:hidden">
          {loading && results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          ) : error && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-destructive">{error}</p>
          ) : results.length === 0 && query.trim() ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results
            </p>
          ) : (
            results.map((r, i) => {
              const isLocal = r.source === "local-osm"
              const isCoord = r.source === "coordinates"
              const key = isCoord
                ? `coord-${r.lat}-${r.lng}`
                : isLocal
                  ? `local-${r.layerLabel}-${r.lat}-${r.lng}-${i}`
                  : `${r.osm_type ?? ""}-${r.osm_id ?? i}-${r.lat}-${r.lon}`
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
                    isLocal && "border-l-2 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10 focus:bg-amber-500/10",
                    isCoord && "border-l-2 border-l-sky-500 bg-sky-500/5 hover:bg-sky-500/10 focus:bg-sky-500/10",
                  )}
                  onClick={() => handleSelect(r)}
                >
                  <span className="line-clamp-2">{r.display_name}</span>
                  {isLocal ? (
                    <span className="mt-0.5 block text-xs text-amber-800/90 dark:text-amber-200/90">
                      {r.detail ?? r.layerLabel}
                    </span>
                  ) : isCoord ? (
                    <span className="mt-0.5 block text-xs text-sky-800/90 dark:text-sky-200/90">
                      Coordinates
                    </span>
                  ) : (
                    (r.type ?? r.class) && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[r.type, r.class].filter(Boolean).join(" · ")}
                      </span>
                    )
                  )}
                </button>
              )
            })
          )}
          {error && results.length > 0 && (
            <p className="border-t px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {loading && results.length > 0 && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Loading online results…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
