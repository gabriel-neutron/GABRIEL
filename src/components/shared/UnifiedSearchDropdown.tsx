import { createPortal } from "react-dom"
import { explainHit, type SearchGroup, type SearchHit } from "@/core/search/searchQuery"
import type { NominatimResult } from "@/modules/osm/services/nominatim.service"
import type { LocalOsmSearchHit } from "@/modules/osm/services/osmLocalSearch"
import { cn } from "@/lib/utils"

export type EntityHit = { source: "entity"; hit: SearchHit }
export type CoordinateHit = { source: "coordinates"; lat: number; lng: number; display_name: string }
export type NominatimHit = NominatimResult & { source: "nominatim" }
export type SearchResult = EntityHit | CoordinateHit | LocalOsmSearchHit | NominatimHit

export type DropdownPos = { top: number; left: number; width: number }

type Props = {
  pos: DropdownPos
  query: string
  entityGroups: SearchGroup[]
  coordinateHit: CoordinateHit | null
  osmHits: LocalOsmSearchHit[]
  nominatimResults: NominatimHit[]
  loading: boolean
  error: string | null
  dropdownRef: React.RefObject<HTMLDivElement | null>
  onSelect: (result: SearchResult) => void
}

type RowProps = {
  title: string
  detail: string
  accent: "entity" | "coordinates" | "osm" | null
  onSelect: () => void
}

function ResultRow({ title, detail, accent, onSelect }: RowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      className={cn(
        "w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
        accent === "entity" && "border-l-2 border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10",
        accent === "coordinates" && "border-l-2 border-l-sky-500 bg-sky-500/5 hover:bg-sky-500/10",
        accent === "osm" && "border-l-2 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10",
      )}
      // Preserving focus on the input is what keeps Escape and Enter working while the
      // pointer is over the list.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      <span className="line-clamp-1 font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
    </button>
  )
}

function GroupHeading({ label }: { label: string }) {
  return (
    <div className="bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  )
}

function entityRow(hit: SearchHit, onSelect: (result: SearchResult) => void) {
  return (
    <ResultRow
      key={"ent-" + hit.entityId}
      title={hit.entityName}
      // The reason, not the kind: an analyst who cannot see *why* a row is in the list
      // cannot tell a name match from a URL that merely mentions the word.
      detail={explainHit(hit)}
      accent="entity"
      onSelect={() => onSelect({ source: "entity", hit })}
    />
  )
}

export function UnifiedSearchDropdown({
  pos,
  query,
  entityGroups,
  coordinateHit,
  osmHits,
  nominatimResults,
  loading,
  error,
  dropdownRef,
  onSelect,
}: Props) {
  const hasInstant = entityGroups.length > 0 || coordinateHit !== null || osmHits.length > 0
  const hasNominatim = nominatimResults.length > 0

  return createPortal(
    <div
      ref={dropdownRef}
      role="listbox"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
      className="z-[9999] max-h-72 overflow-auto rounded-md border bg-background shadow-md"
    >
      {!hasInstant && !hasNominatim && !loading && query.trim() && (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          No results — press Enter to search online
        </p>
      )}

      {entityGroups.map((group) => (
        <div key={group.kind} role="group" aria-label={group.label}>
          <GroupHeading label={group.label} />
          {group.hits.map((hit) => entityRow(hit, onSelect))}
        </div>
      ))}

      {coordinateHit && (
        <div role="group" aria-label="Coordinates">
          <GroupHeading label="Coordinates" />
          <ResultRow
            title={coordinateHit.display_name}
            detail="Coordinates"
            accent="coordinates"
            onSelect={() => onSelect(coordinateHit)}
          />
        </div>
      )}

      {osmHits.length > 0 && (
        <div role="group" aria-label="OSM features">
          <GroupHeading label="OSM features" />
          {osmHits.map((hit, i) => (
            <ResultRow
              key={"osm-" + String(i)}
              title={hit.display_name}
              detail={hit.detail ?? hit.layerLabel}
              accent="osm"
              onSelect={() => onSelect(hit)}
            />
          ))}
        </div>
      )}

      {hasNominatim && (
        <div role="group" aria-label="Online places">
          {hasInstant && <div className="mx-3 my-1 border-t border-border" />}
          <GroupHeading label="Online places" />
          {nominatimResults.map((r, i) => (
            <ResultRow
              key={"nom-" + String(r.osm_type ?? "") + "-" + String(r.osm_id ?? i)}
              title={r.display_name}
              detail={[r.type, r.class].filter(Boolean).join(" · ")}
              accent={null}
              onSelect={() => onSelect(r)}
            />
          ))}
        </div>
      )}

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
}
