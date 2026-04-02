import { useState, useRef, useEffect, useMemo } from "react"
import { useMap } from "react-leaflet"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  searchPlace,
  lookupOsmId,
  parseOsmIdInput,
  type NominatimResult,
} from "@/services/nominatim.service"
import { searchLocalOsmFeatures, type LocalOsmSearchHit } from "@/utils/osmLocalSearch"
import type { Layer, MapEntity } from "@/types/domain.types"
import { cn } from "@/lib/utils"

const ZOOM_ON_SELECT = 14

type MapSearchResult =
  | (NominatimResult & { source: "nominatim" })
  | LocalOsmSearchHit

type MapSearchProps = {
  layers: Layer[]
  entityOsmGeometries?: Record<string, GeoJSON.FeatureCollection>
  entities?: MapEntity[]
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
    const localHits = searchLocalOsmFeatures(layers, trimmed, {
      entityOsmGeometries,
      entityNameById,
      limit: 12,
    })
    if (requestId === requestIdRef.current) setResults(localHits)
    try {
      const osmParsed = parseOsmIdInput(trimmed)
      if (osmParsed) {
        const one = await lookupOsmId(osmParsed.type, osmParsed.id)
        if (requestId === requestIdRef.current) {
          const remote: MapSearchResult[] = one
            ? [{ ...one, source: "nominatim" as const }]
            : []
          setResults([...localHits, ...remote])
        }
      } else {
        const next = await searchPlace(trimmed, 8)
        if (requestId === requestIdRef.current) {
          setResults([...localHits, ...next.map((r) => ({ ...r, source: "nominatim" as const }))])
        }
      }
    } catch (e) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : "Search failed")
        setResults(localHits)
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  function handleSelect(result: MapSearchResult) {
    const lat = result.source === "local-osm" ? result.lat : Number(result.lat)
    const lng = result.source === "local-osm" ? result.lng : Number(result.lon)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], ZOOM_ON_SELECT, { duration: 0.4 })
    }
    setOpen(false); setQuery(""); setResults([])
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
          placeholder="Place, OSM ID, or local tag search"
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
              const key = isLocal
                ? `local-${r.layerLabel}-${r.lat}-${r.lng}-${i}`
                : `${r.osm_type ?? ""}-${r.osm_id ?? i}-${r.lat}-${r.lon}`
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
                    isLocal && "border-l-2 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10 focus:bg-amber-500/10",
                  )}
                  onClick={() => handleSelect(r)}
                >
                  <span className="line-clamp-2">{r.display_name}</span>
                  {isLocal ? (
                    <span className="mt-0.5 block text-xs text-amber-800/90 dark:text-amber-200/90">
                      {r.detail ?? r.layerLabel}
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