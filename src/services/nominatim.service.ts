/**
 * Nominatim (OSM) search and lookup. Used for map place/city/OSM ID search.
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
const HEADERS: HeadersInit = {
  "Accept": "application/json",
  "User-Agent": "GabrielMilitaryMap/1.0 (local mapping app)",
}

export type NominatimResult = {
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
  osm_type?: string
  osm_id?: number
}

export async function searchPlace(query: string, limit = 8): Promise<NominatimResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: String(limit),
    addressdetails: "0",
  })
  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, { headers: HEADERS })
  if (!res.ok) throw new Error("Search failed")
  const data = (await res.json()) as NominatimResult[]
  return data
}

/** Parse "123", "way 123", "node/456" style input for OSM lookup */
export function parseOsmIdInput(query: string): { type: "node" | "way" | "relation"; id: number } | null {
  const trimmed = query.trim()
  const simple = /^(\d+)$/.exec(trimmed)
  if (simple) {
    const id = parseInt(simple[1], 10)
    if (Number.isInteger(id) && id > 0) return { type: "way", id }
    return null
  }
  const prefixed = /^(node|way|relation)\s*[\/\s]*(\d+)$/i.exec(trimmed)
  if (prefixed) {
    const id = parseInt(prefixed[2], 10)
    if (Number.isInteger(id) && id > 0)
      return { type: prefixed[1].toLowerCase() as "node" | "way" | "relation", id }
  }
  return null
}

export async function lookupOsmId(
  type: "node" | "way" | "relation",
  id: number
): Promise<NominatimResult | null> {
  const prefix = type === "node" ? "N" : type === "way" ? "W" : "R"
  const osmIds = `${prefix}${id}`
  const params = new URLSearchParams({ osm_ids: osmIds, format: "json" })
  const res = await fetch(`${NOMINATIM_BASE}/lookup?${params}`, { headers: HEADERS })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResult[]
  const first = data[0]
  return first ?? null
}
