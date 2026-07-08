/**
 * Search loaded OSM GeoJSON (layer overlays and entity-linked caches).
 * Matching uses all tag/property values. OSM element id is matched exactly for digit-only
 * queries so "123" does not match node/123456 via substring on the id string.
 */

import { centroid } from "@turf/turf"
import type { Feature } from "geojson"
import type { Layer } from "@/types/domain.types"

export type LocalOsmSearchHit = {
  source: "local-osm"
  lat: number
  lng: number
  display_name: string
  layerLabel: string
  detail?: string
}

/** Preferred keys for human-readable titles in results (matching uses all properties). */
const NAME_KEYS = ["name", "official_name", "short_name", "ref", "operator", "brand"] as const

function collectStrings(value: unknown, out: string[]): void {
  if (value == null) return
  const t = typeof value
  if (t === "string" || t === "number" || t === "boolean") {
    out.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out)
    return
  }
  if (t === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out)
  }
}

/** Lowercased blob of all property values for substring search (excludes GeoJSON feature.id). */
function propertiesHaystack(props: Record<string, unknown>): string {
  const parts: string[] = []
  collectStrings(props, parts)
  return parts.join("\u0001").toLowerCase()
}

function pickDisplayName(props: Record<string, unknown>): string | null {
  for (const k of NAME_KEYS) {
    const v = props[k]
    if (typeof v === "string" && v.trim() !== "") return v.trim()
  }
  return null
}

/**
 * Read OSM numeric id from loaded GeoJSON (osmtogeojson uses ids like "node/123").
 * Used only for exact digit-only search matches and fallback labels — not for parsing user input.
 */
function readOsmNumericIdString(
  feature: GeoJSON.Feature & { id?: string },
  props: Record<string, unknown>,
): string | null {
  if (typeof feature.id === "string") {
    const m = /^(?:node|way|relation)\/(\d+)$/.exec(feature.id)
    if (m) return m[1]
  }
  const t = props["@type"] ?? props.type
  const id = props["@id"] ?? props.id
  if (
    (t === "node" || t === "way" || t === "relation") &&
    (typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id)))
  ) {
    return String(id)
  }
  return null
}

function featureMatchesQuery(feature: GeoJSON.Feature & { id?: string }, qRaw: string): boolean {
  const q = qRaw.trim().toLowerCase()
  if (!q) return false
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const tags = propertiesHaystack(props)

  if (/^\d+$/.test(q)) {
    const idNum = readOsmNumericIdString(feature, props)
    if (idNum !== null && idNum === q) return true
    return tags.includes(q)
  }

  return tags.includes(q)
}

function representativeLatLng(feature: GeoJSON.Feature): [number, number] | null {
  if (!feature.geometry) return null
  try {
    const c = centroid(feature as Feature)
    const [lng, lat] = c.geometry.coordinates
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  } catch {
    /* ignore */
  }
  return null
}

function labelFeature(
  feature: GeoJSON.Feature & { id?: string },
  layerLabel: string,
): { display_name: string; detail?: string } {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const title = pickDisplayName(props)
  const idNum = readOsmNumericIdString(feature, props)
  const geomType = feature.geometry?.type
  const display_name = title ?? (idNum != null ? `OSM #${idNum}` : null) ?? geomType ?? "OSM feature"
  const detailParts: string[] = [layerLabel]
  if (title && idNum != null) detailParts.push(`#${idNum}`)
  else if (!title && geomType != null) detailParts.push(geomType)
  const detail = detailParts.length > 1 ? detailParts.join(" · ") : layerLabel
  return { display_name, detail }
}

export function searchLocalOsmFeatures(
  layers: Layer[],
  query: string,
  options: {
    entityOsmGeometries?: Record<string, GeoJSON.FeatureCollection>
    entityNameById?: Map<string, string>
    limit?: number
  } = {},
): LocalOsmSearchHit[] {
  const qRaw = query.trim()
  if (!qRaw) return []

  const limit = options.limit ?? 12
  const entityNameById = options.entityNameById ?? new Map<string, string>()
  const hits: LocalOsmSearchHit[] = []
  const seen = new Set<string>()

  function tryAdd(
    feature: GeoJSON.Feature & { id?: string },
    layerLabel: string,
    dedupeKey: string,
  ): boolean {
    if (hits.length >= limit) return false
    if (seen.has(dedupeKey)) return false
    if (!featureMatchesQuery(feature, qRaw)) return false
    const pos = representativeLatLng(feature)
    if (!pos) return false
    seen.add(dedupeKey)
    const { display_name, detail } = labelFeature(feature, layerLabel)
    hits.push({
      source: "local-osm",
      lat: pos[0],
      lng: pos[1],
      display_name,
      layerLabel,
      detail,
    })
    return true
  }

  for (const layer of layers) {
    if (layer.kind !== "osm" || !layer.osmData?.features?.length) continue
    const layerLabel = layer.name || "OSM layer"
    let fi = 0
    for (const f of layer.osmData.features) {
      const feat = f as GeoJSON.Feature & { id?: string }
      const key = `layer:${layer.id}:${String(feat.id ?? fi++)}`
      tryAdd(feat, layerLabel, key)
      if (hits.length >= limit) return hits
    }
  }

  if (options.entityOsmGeometries) {
    for (const [entityId, fc] of Object.entries(options.entityOsmGeometries)) {
      const entityName = entityNameById.get(entityId)
      const layerLabel = entityName ? `Linked OSM · ${entityName}` : "Linked OSM geometry"
      let fi = 0
      for (const f of fc.features) {
        const feat = f as GeoJSON.Feature & { id?: string }
        const key = `entity:${entityId}:${String(feat.id ?? fi++)}`
        tryAdd(feat, layerLabel, key)
        if (hits.length >= limit) return hits
      }
    }
  }

  return hits
}
