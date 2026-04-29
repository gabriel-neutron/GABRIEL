import { useState, useRef, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { Search } from "lucide-react"
import { useProjectStore } from "@/store/useProjectStore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchPlace, type NominatimResult } from "@/services/nominatim.service"
import { searchLocalOsmFeatures, type LocalOsmSearchHit } from "@/utils/osmLocalSearch"
import { cn } from "@/lib/utils"

export type FlyToFn = (lat: number, lng: number, zoom?: number) => void

type EntityHit = { source: "entity"; id: string; name: string }
type CoordinateHit = { source: "coordinates"; lat: number; lng: number; display_name: string }
type SearchResult =
  | EntityHit
  | CoordinateHit
  | LocalOsmSearchHit
  | (NominatimResult & { source: "nominatim" })

type DropdownPos = { top: number; left: number; width: number }

type Props = { flyToRef: React.RefObject<FlyToFn | null> }

function parseLatLngPair(query: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)\s*$/.exec(query.trim())
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  let lat = a
  let lng = b
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) { lat = b; lng = a } else return null
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function UnifiedSearch({ flyToRef }: Props) {
  const entities = useProjectStore((s) => s.entities)
  const layers = useProjectStore((s) => s.layers)
  const entityOsmGeometries = useProjectStore((s) => s.entityOsmGeometries)

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)
  const [nominatimResults, setNominatimResults] = useState<(NominatimResult & { source: "nominatim" })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const entityNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of entities) m.set(e.id, e.name)
    return m
  }, [entities])

  const instantResults = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const entityHits: EntityHit[] = entities
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((e) => ({ source: "entity" as const, id: e.id, name: e.name }))

    const coord = parseLatLngPair(query)
    const coordHit: CoordinateHit | null = coord
      ? { source: "coordinates", lat: coord.lat, lng: coord.lng, display_name: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` }
      : null

    const osmHits = searchLocalOsmFeatures(layers, query, { entityOsmGeometries, entityNameById, limit: 6 })

    return [...entityHits, ...(coordHit ? [coordHit] : []), ...osmHits]
  }, [query, entities, layers, entityOsmGeometries, entityNameById])

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener("keydown", onGlobalKey)
    return () => document.removeEventListener("keydown", onGlobalKey)
  }, [])

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onOutsideClick)
    return () => document.removeEventListener("mousedown", onOutsideClick)
  }, [])

  function computeDropdownPos() {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setNominatimResults([])
    setError(null)
    if (val.trim().length > 0) {
      computeDropdownPos()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  async function triggerNominatim() {
    const trimmed = query.trim()
    if (!trimmed || parseLatLngPair(trimmed)) return
    setError(null)
    setLoading(true)
    computeDropdownPos()
    setOpen(true)
    const requestId = ++requestIdRef.current
    try {
      const next = await searchPlace(trimmed, 8)
      if (requestId === requestIdRef.current) {
        setNominatimResults(next.map((r) => ({ ...r, source: "nominatim" as const })))
      }
    } catch (e) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : "Search failed")
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("")
      setOpen(false)
      setNominatimResults([])
      setError(null)
      inputRef.current?.blur()
    } else if (e.key === "Enter") {
      void triggerNominatim()
    }
  }

  function handleSelect(result: SearchResult) {
    if (result.source === "entity") {
      useProjectStore.getState().setSelectedEntityId(result.id)
    } else if (result.source === "coordinates" || result.source === "local-osm") {
      flyToRef.current?.(result.lat, result.lng, 14)
    } else {
      const lat = Number(result.lat)
      const lng = Number(result.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) flyToRef.current?.(lat, lng, 14)
    }
    setQuery("")
    setOpen(false)
    setNominatimResults([])
    inputRef.current?.blur()
  }

  const hasInstant = instantResults.length > 0
  const hasNominatim = nominatimResults.length > 0

  const dropdown = open && dropdownPos
    ? createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="z-[9999] max-h-72 overflow-auto rounded-md border bg-background shadow-md"
        >
          {!hasInstant && !hasNominatim && !loading && query.trim() && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results — press Enter to search online
            </p>
          )}

          {instantResults.map((r, i) => {
            const isEntity = r.source === "entity"
            const isCoord = r.source === "coordinates"
            const isOsm = r.source === "local-osm"
            const key = isEntity ? `ent-${r.id}` : isCoord ? `coord-${r.lat}-${r.lng}` : `osm-${i}`
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={false}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
                  isEntity && "border-l-2 border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10",
                  isCoord && "border-l-2 border-l-sky-500 bg-sky-500/5 hover:bg-sky-500/10",
                  isOsm && "border-l-2 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
              >
                <span className="line-clamp-1 font-medium">{isEntity ? r.name : r.display_name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {isEntity ? "Entity" : isCoord ? "Coordinates" : (isOsm ? (r.detail ?? r.layerLabel) : "")}
                </span>
              </button>
            )
          })}

          {hasInstant && hasNominatim && <div className="mx-3 my-1 border-t border-border" />}

          {nominatimResults.map((r, i) => (
            <button
              key={`nom-${r.osm_type ?? ""}-${r.osm_id ?? i}`}
              type="button"
              role="option"
              aria-selected={false}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              onMouseDown={(e) => e.preventDefault()}
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

          {loading && (
            <p className={cn("px-3 py-2 text-xs text-muted-foreground", (hasInstant || hasNominatim) && "border-t")}>
              {hasInstant || hasNominatim ? "Loading online results…" : "Searching…"}
            </p>
          )}

          {error && <p className="border-t px-3 py-2 text-sm text-destructive">{error}</p>}

          {hasInstant && !hasNominatim && !loading && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Press Enter to search online places
            </p>
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div className="flex w-full items-center gap-1">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search entities or places… (Ctrl+K)"
          className="h-8 flex-1 text-xs"
          aria-label="Search entities or places"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void triggerNominatim()}
          disabled={loading || !query.trim()}
          title="Search online places (Enter)"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
      {dropdown}
    </>
  )
}
