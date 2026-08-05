import { useState, useRef, useEffect, useMemo } from "react"
import { Search } from "lucide-react"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { useOsmViewStore } from "@/store/useOsmViewStore"
import { selectEntity } from "@/core/map/selection"
import { parseCoordinateQuery } from "@/core/search/coordinateQuery"
import { buildSearchIndex } from "@/core/search/searchIndex"
import { groupHitsByKind, searchEntities } from "@/core/search/searchQuery"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { searchPlace } from "@/modules/osm/services/nominatim.service"
import { searchLocalOsmFeatures } from "@/modules/osm/services/osmLocalSearch"
import {
  UnifiedSearchDropdown,
  type CoordinateHit,
  type DropdownPos,
  type NominatimHit,
  type SearchResult,
} from "./UnifiedSearchDropdown"

export type FlyToFn = (lat: number, lng: number, zoom?: number) => void

type Props = { flyToRef: React.RefObject<FlyToFn | null> }

/**
 * How many entity hits reach the dropdown. A cap still exists — the list is a dropdown, not
 * a report — but it is applied after ranking, which is the whole difference from the six
 * results this component used to take in array order.
 */
const ENTITY_HIT_LIMIT = 10

export function UnifiedSearch({ flyToRef }: Props) {
  const entities = useProjectStore((s) => s.entities)
  const claims = useProjectStore((s) => s.claims)
  const layers = useProjectStore((s) => s.layers)
  const sources = useProvenanceStore((s) => s.sources)
  const entityOsmGeometries = useOsmViewStore((s) => s.entityOsmGeometries)

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)
  const [nominatimResults, setNominatimResults] = useState<NominatimHit[]>([])
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

  // Normalising several thousand strings is the expensive half of the search, so it is done
  // once per corpus rather than once per keystroke.
  const index = useMemo(
    () => buildSearchIndex({ entities, claims, sources }),
    [entities, claims, sources],
  )

  const entityGroups = useMemo(
    () => groupHitsByKind(searchEntities(index, query, { limit: ENTITY_HIT_LIMIT })),
    [index, query],
  )

  const coordinateHit = useMemo((): CoordinateHit | null => {
    const coord = parseCoordinateQuery(query)
    if (!coord) return null
    return {
      source: "coordinates",
      lat: coord.lat,
      lng: coord.lng,
      display_name: coord.lat.toFixed(5) + ", " + coord.lng.toFixed(5),
    }
  }, [query])

  const osmHits = useMemo(
    () =>
      query.trim()
        ? searchLocalOsmFeatures(layers, query, { entityOsmGeometries, entityNameById, limit: 6 })
        : [],
    [query, layers, entityOsmGeometries, entityNameById],
  )

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
    if (!trimmed || parseCoordinateQuery(trimmed)) return
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
      selectEntity(result.hit.entityId)
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

  return (
    <>
      <div className="flex w-full items-center gap-1">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search entities, ids, notes or places… (Ctrl+K)"
          className="h-8 flex-1 text-xs"
          aria-label="Search entities or places"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 border-input"
          onClick={() => void triggerNominatim()}
          disabled={loading || !query.trim()}
          title="Search online places (Enter)"
        >
          <Search className="h-3.5 w-3.5 text-foreground" />
        </Button>
      </div>
      {open && dropdownPos && (
        <UnifiedSearchDropdown
          pos={dropdownPos}
          query={query}
          entityGroups={entityGroups}
          coordinateHit={coordinateHit}
          osmHits={osmHits}
          nominatimResults={nominatimResults}
          loading={loading}
          error={error}
          dropdownRef={dropdownRef}
          onSelect={handleSelect}
        />
      )}
    </>
  )
}
