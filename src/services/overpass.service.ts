/**
 * Overpass API execution and OSM JSON → GeoJSON conversion.
 * No React; pure functions.
 */

import type { FeatureCollection } from "geojson"
import osmtogeojson from "osmtogeojson"

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"

export type OverpassResult =
  | { type: "success"; geojson: FeatureCollection }
  | { type: "empty" }

type OverpassResponse = {
  elements?: unknown[]
  remark?: string
  error?: string
}

function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ")
}

function buildQuery(rawQuery: string, bbox: { south: number; west: number; north: number; east: number } | null): string {
  const query = normalizeQuery(rawQuery)
  if (!query) throw new Error("Query is empty")
  const hasOut = /\[out:json\]/i.test(query)
  const withOut = (hasOut ? "" : "[out:json];\n") + query
  if (!bbox) {
    return withOut
  }
  const bboxClause = `[bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}];\n`
  const outMatch = withOut.match(/^(\[out:[^\]]+\];?\s*)/i)
  if (outMatch) {
    return outMatch[1] + bboxClause + withOut.slice(outMatch[1].length)
  }
  return bboxClause + withOut
}

/**
 * Execute Overpass query. Returns success with GeoJSON or empty; throws on failure.
 */
export async function executeOverpassQuery(
  query: string,
  bbox: { south: number; west: number; north: number; east: number } | null,
): Promise<OverpassResult> {
  const fullQuery = buildQuery(query, bbox)
  const data = await runOverpassBody(fullQuery)
  checkOverpassResponse(data)

  const elements = data.elements ?? []
  if (elements.length === 0) {
    return { type: "empty" }
  }

  const geojson = osmtogeojson(data) as FeatureCollection
  return { type: "success", geojson }
}

export { normalizeQuery }

/** OSM element candidate (relation, way, or node) for linking or context. */
export type OsmElementCandidate = {
  type: "node" | "way" | "relation"
  id: number
  tags: Record<string, string>
}

type OverpassElement = {
  type: "node" | "way" | "relation"
  id: number
  tags?: Record<string, string>
}

const OVERPASS_QUERY_TIMEOUT = 25

async function runOverpassBody(body: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: body.trim(),
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Overpass API error (${response.status}): ${text.slice(0, 300)}`)
  }
  try {
    return JSON.parse(text) as OverpassResponse
  } catch {
    throw new Error("Invalid JSON response from Overpass API")
  }
}

function checkOverpassResponse(data: OverpassResponse): void {
  if (data.error) throw new Error(`Overpass error: ${data.error}`)
  if (data.remark && /error|timeout|rate/i.test(data.remark)) {
    throw new Error(`Overpass: ${data.remark}`)
  }
}

function parseElements(data: OverpassResponse): OsmElementCandidate[] {
  const elements = (data.elements ?? []) as OverpassElement[]
  const seen = new Set<string>()
  return elements
    .filter((el): el is OverpassElement & { tags: Record<string, string> } => el.id != null)
    .map((el) => ({
      type: el.type as "node" | "way" | "relation",
      id: el.id,
      tags: el.tags ?? {},
    }))
    .filter((el) => {
      const key = `${el.type}/${el.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * Find OSM elements at the point (intersection) and within radius (default 100 m).
 * Runs two Overpass queries: (1) areas containing the point (way/relation via pivot),
 * (2) nodes/ways/relations within radius. Returns merged, deduplicated list.
 * If the intersection query returns 400, only the nearby query is used.
 */
export async function findOsmElementsAtPoint(
  lat: number,
  lng: number,
  options?: { radiusMeters?: number },
): Promise<OsmElementCandidate[]> {
  const radius = options?.radiusMeters ?? 100
  const latStr = String(Number(lat))
  const lngStr = String(Number(lng))
  const results: OsmElementCandidate[] = []
  const seen = new Set<string>()
  const add = (list: OsmElementCandidate[]) => {
    for (const el of list) {
      const key = `${el.type}/${el.id}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push(el)
    }
  }

  // Query 1: elements whose area contains the point (is_in + pivot; no tag filter for robustness)
  const intersectionQuery = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT}];
is_in(${latStr},${lngStr})->.a;
( way(pivot.a); rel(pivot.a); );
out ids tags;`
  try {
    const data = await runOverpassBody(intersectionQuery)
    checkOverpassResponse(data)
    add(parseElements(data))
  } catch (err) {
    if (err instanceof Error && err.message.includes("400")) {
      // Intersection query not supported or invalid; continue with nearby only
    } else {
      throw err
    }
  }

  // Query 2: elements within radius
  const nearbyQuery = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT}];
( node(around:${radius},${latStr},${lngStr}); way(around:${radius},${latStr},${lngStr}); rel(around:${radius},${latStr},${lngStr}); );
out ids tags;`
  const nearbyData = await runOverpassBody(nearbyQuery)
  checkOverpassResponse(nearbyData)
  add(parseElements(nearbyData))

  return results
}

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] }

export type OsmObjectDetails = {
  type: "node" | "way" | "relation"
  id: number
  version: number
  changeset: number
  timestamp: string
  user: string
  tags: Record<string, string>
}

/**
 * Fetch full OSM object metadata (version, changeset, timestamp, user, tags).
 * Uses Overpass API with `out meta` to get all metadata.
 */
export async function fetchOsmObjectDetails(
  type: "node" | "way" | "relation",
  id: number,
): Promise<OsmObjectDetails> {
  const query = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT}];
${type}(${id});
out meta;`

  const data = await runOverpassBody(query)
  checkOverpassResponse(data)

  const elements = (data.elements ?? []) as Array<{
    type: "node" | "way" | "relation"
    id: number
    version?: number
    changeset?: number
    timestamp?: string
    user?: string
    tags?: Record<string, string>
  }>

  if (elements.length === 0) {
    throw new Error(`OSM ${type} ${id} not found`)
  }

  const element = elements[0]
  if (element.id !== id || element.type !== type) {
    throw new Error(`Unexpected element returned: ${element.type} ${element.id}`)
  }

  return {
    type: element.type,
    id: element.id,
    version: element.version ?? 0,
    changeset: element.changeset ?? 0,
    timestamp: element.timestamp ?? "",
    user: element.user ?? "",
    tags: element.tags ?? {},
  }
}

/**
 * Fetch full geometry of an OSM relation by id. Returns GeoJSON FeatureCollection.
 * Returns empty FeatureCollection if relation not found or has no geometry.
 */
export async function fetchRelationGeometry(relationId: number): Promise<FeatureCollection> {
  const query = `[out:json];
rel(${relationId});
out geom;`

  const data = await runOverpassBody(query)
  checkOverpassResponse(data)

  const elements = data.elements ?? []
  if (elements.length === 0) {
    return EMPTY_FC
  }

  return osmtogeojson(data) as FeatureCollection
}
