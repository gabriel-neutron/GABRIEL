import { useState, useRef, useEffect } from "react"
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
import { cn } from "@/lib/utils"

const ZOOM_ON_SELECT = 14

export function MapSearch() {
  const map = useMap()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
    setResults([])
    try {
      const osmParsed = parseOsmIdInput(trimmed)
      if (osmParsed) {
        const one = await lookupOsmId(osmParsed.type, osmParsed.id)
        setResults(one ? [one] : [])
      } else {
        setResults(await searchPlace(trimmed, 8))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(result: NominatimResult) {
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], ZOOM_ON_SELECT, { duration: 0.4 })
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
          placeholder="Place, city or OSM ID (e.g. way 123)"
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
        <div className={cn("mt-1 max-h-64 overflow-auto rounded-md border bg-background", "empty:hidden")}>
          {loading && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Searching…</p>
          )}
          {error && (
            <p className="px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && results.length === 0 && query.trim() && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No results</p>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={`${r.osm_type ?? ""}-${r.osm_id ?? i}-${r.lat}-${r.lon}`}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              onClick={() => handleSelect(r)}
            >
              <span className="line-clamp-2">{r.display_name}</span>
              {(r.type ?? r.class) && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[r.type, r.class].filter(Boolean).join(" · ")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}