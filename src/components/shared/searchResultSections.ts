import { explainHit, type SearchGroup, type SearchHit } from "@/core/search/searchQuery"
import type { NominatimResult } from "@/modules/osm/services/nominatim.service"
import type { LocalOsmSearchHit } from "@/modules/osm/services/osmLocalSearch"

export type EntityHit = { source: "entity"; hit: SearchHit }
export type CoordinateHit = { source: "coordinates"; lat: number; lng: number; display_name: string }
export type NominatimHit = NominatimResult & { source: "nominatim" }
export type SearchResult = EntityHit | CoordinateHit | LocalOsmSearchHit | NominatimHit

export type DropdownPos = { top: number; left: number; width: number }

export type RowAccent = "entity" | "coordinates" | "osm" | null
export type ResultRowSpec = {
  key: string
  title: string
  detail: string
  accent: RowAccent
  result: SearchResult
}
/** `startIndex` is the row's position in the flattened list, precomputed so the dropdown can
 *  paint a running index without mutating a counter across a render. */
export type ResultSection = { key: string; label: string; startIndex: number; rows: ResultRowSpec[] }

export type SectionInput = {
  entityGroups: SearchGroup[]
  coordinateHit: CoordinateHit | null
  osmHits: LocalOsmSearchHit[]
  nominatimResults: NominatimHit[]
}

export const ACTIVE_ROW_ID_PREFIX = "search-result-"

/**
 * Every row the dropdown will render, in the order it will render them.
 *
 * This is the single ordering. `UnifiedSearchDropdown` walks it to paint, and `UnifiedSearch`
 * flattens the same value to decide what ArrowDown highlights and what Enter takes — so the
 * highlight cannot land on a different row than the one under the cursor. Two independent
 * orderings would agree for exactly as long as nobody added a section.
 */
export function resultSections(input: SectionInput): ResultSection[] {
  const built: Omit<ResultSection, "startIndex">[] = []

  for (const group of input.entityGroups) {
    built.push({
      key: "kind-" + group.kind,
      label: group.label,
      rows: group.hits.map((hit) => ({
        key: "ent-" + hit.entityId,
        title: hit.entityName,
        // The reason, not the kind: an analyst who cannot see *why* a row is in the list
        // cannot tell a name match from a URL that merely mentions the word.
        detail: explainHit(hit),
        accent: "entity" as const,
        result: { source: "entity" as const, hit },
      })),
    })
  }

  if (input.coordinateHit) {
    const coordinateHit = input.coordinateHit
    built.push({
      key: "coordinates",
      label: "Coordinates",
      rows: [{
        key: "coord",
        title: coordinateHit.display_name,
        detail: "Coordinates",
        accent: "coordinates",
        result: coordinateHit,
      }],
    })
  }

  if (input.osmHits.length > 0) {
    built.push({
      key: "osm",
      label: "OSM features",
      rows: input.osmHits.map((hit, i) => ({
        key: "osm-" + String(i),
        title: hit.display_name,
        detail: hit.detail ?? hit.layerLabel,
        accent: "osm" as const,
        result: hit,
      })),
    })
  }

  if (input.nominatimResults.length > 0) {
    built.push({
      key: "nominatim",
      label: "Online places",
      rows: input.nominatimResults.map((r, i) => ({
        key: "nom-" + String(r.osm_type ?? "") + "-" + String(r.osm_id ?? i),
        title: r.display_name,
        detail: [r.type, r.class].filter(Boolean).join(" · "),
        accent: null,
        result: r,
      })),
    })
  }

  let startIndex = 0
  return built.map((section) => {
    const withStart = { ...section, startIndex }
    startIndex += section.rows.length
    return withStart
  })
}

export function flattenSections(sections: readonly ResultSection[]): ResultRowSpec[] {
  return sections.flatMap((section) => section.rows)
}

/** Everything that is not an online place — the local corpus. Enter reaches the network only
 *  when this is empty, so the test for it has to be one thing and not four. */
export function hasLocalRows(sections: readonly ResultSection[]): boolean {
  return sections.some((section) => section.key !== "nominatim" && section.rows.length > 0)
}
