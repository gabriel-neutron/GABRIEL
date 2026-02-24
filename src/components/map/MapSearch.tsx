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
        const list = await searchPlace(trimmed, 8)
        setResults(list)
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
      className="absolute top-2 right-2 z-[1000] w-80 max-w-[calc(100%-1rem)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1 rounded-md border border-border bg-background shadow-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Place, city or OSM ID (e.g. way 123)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={handleSearch}
          disabled={loading}
          title="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {open && (
        <div
          className={cn(
            "mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background shadow-lg",
            "empty:hidden"
          )}
        >
          {loading && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results
            </div>
          )}
          {!loading &&
            results.length > 0 &&
            results.map((r, i) => (
              <button
                key={`${r.osm_type ?? ""}-${r.osm_id ?? i}-${r.lat}-${r.lon}`}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
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
