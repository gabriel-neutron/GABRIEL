/**
 * Nominatim (OSM) search. Used for map place/city search.
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
