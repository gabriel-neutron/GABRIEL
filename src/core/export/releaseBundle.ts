import { applyExportGate, EXPORT_GATE_RULES, type ExportGateResult } from "./exportGate"
import { toCsv } from "./csv"
import { toGeoJsonCoord, type LatLng } from "@/core/coordinates"
import { EDGE_TYPES, EDGE_VOCABULARY_VERSION } from "@/core/relationship/vocabulary"
import type { Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"
import type { Relationship, RelationshipType } from "@/core/relationship/relationship"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"

/**
 * A CC-BY 4.0 release, as named files. Everything here is a pure function of its input: the
 * caller decides where bytes land, so the part that can be tested is the whole part that
 * decides what the world gets to read.
 *
 * One gate feeds every format (`applyExportGate`), so CSV, GeoJSON and JSON-LD cannot come
 * to disagree about what was withheld.
 */

export const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/"
export const ATTRIBUTION = "Gabriel — https://github.com/gabriel-neutron/GABRIEL — CC BY 4.0"

export type ReleaseInput = {
  entities: readonly MapEntity[]
  relationships: readonly Relationship[]
  claims: readonly Claim[]
  geometries: readonly DrawnGeometry[]
  sources: readonly Source[]
  /** Injected. Never read from a clock in here. */
  generatedAt: string
}

export type ReleaseBundle = {
  files: Map<string, string>
  gated: ExportGateResult
}

type GeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] }

/** GeoJSON is longitude-first (RFC 7946 §3.1.1). Gabriel's `LatLng` is a `[lat, lng]` tuple and
 *  is not, and getting this backwards puts every unit in the dataset in the Indian Ocean. The
 *  swap goes through `toGeoJsonCoord` rather than being written out again here, so there is one
 *  place in the codebase that knows which way round the pair goes. */
function pair(p: LatLng): [number, number] {
  const swapped = toGeoJsonCoord(p)
  return [swapped[0], swapped[1]]
}

function toGeoJsonGeometry(geom: DrawnGeometry): GeoJsonGeometry {
  if (geom.type === "point") return { type: "Point", coordinates: [geom.lng, geom.lat] }
  if (geom.type === "line") return { type: "LineString", coordinates: geom.positions.map(pair) }
  return { type: "Polygon", coordinates: geom.rings.map((ring) => ring.map(pair)) }
}

function entityRows(entities: readonly MapEntity[]): (readonly unknown[])[] {
  return entities.map((e) => [e.id, e.kind, e.name, e.layerId, e.notes ?? ""])
}

function relationshipRows(relationships: readonly Relationship[]): (readonly unknown[])[] {
  return relationships.map((r) => [
    r.id, r.type, r.fromId, r.toId, r.startDate ?? "", r.endDate ?? "",
    EDGE_TYPES[r.type]?.tier ?? "", JSON.stringify(r.metadata),
  ])
}

function sourceRows(sources: readonly Source[], claims: readonly Claim[]): (readonly unknown[])[] {
  const byId = new Map(sources.map((s) => [s.id, s]))
  return claims.map((c) => {
    const source = byId.get(c.sourceId)
    // Reliability is the source's and credibility is the claim's; they are different ratings
    // about different things and flattening them into one column is the "diagonal collapse"
    // ADR 0009 exists to resist.
    return [c.id, c.entityId, c.field, c.value ?? "", c.sourceId, source?.url ?? "", source?.reliability ?? "", c.credibility ?? ""]
  })
}

/** Only the definitions of the types actually present, so a reuser is handed the schema for
 *  what they have rather than a vocabulary dump they must filter. */
function usedEdgeTypes(relationships: readonly Relationship[]) {
  const used = [...new Set(relationships.map((r) => r.type))].sort() as RelationshipType[]
  return used.map((type) => ({
    type,
    tier: EDGE_TYPES[type].tier,
    layer: EDGE_TYPES[type].layer,
    publicDefinition: EDGE_TYPES[type].publicDefinition,
  }))
}

function withheldSummary(gated: ExportGateResult, totalRelationships: number): string {
  const byReason = new Map<string, number>()
  for (const e of gated.excluded.relationships) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1)
  if (byReason.size === 0) return "No relationships were withheld.\n"

  const lines = [...byReason.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => "- **" + String(n) + " of " + String(totalRelationships) + "** withheld as `" + reason + "`")
  return lines.join("\n") + "\n"
}

function readme(input: ReleaseInput, gated: ExportGateResult): string {
  const rules = EXPORT_GATE_RULES.map((r) => "- **`" + r.reason + "`** — " + r.statement).join("\n")
  return [
    "# Gabriel — dataset release",
    "",
    "Generated " + input.generatedAt + ".",
    "",
    "## Licence and attribution",
    "",
    "Licensed under [CC BY 4.0](" + LICENCE_URL + "). Attribute as:",
    "",
    "> " + ATTRIBUTION,
    "",
    "Preserve `graph.jsonld`'s `edgeTypes` when redistributing relationships. A relationship row",
    "without its published definition is a claim stripped of the qualification that makes it",
    "defensible — the definitions describe **records and observations**, not facts about the world.",
    "",
    "## Files",
    "",
    "| file | contents |",
    "|---|---|",
    "| `entities.csv` | every published entity |",
    "| `relationships.csv` | every published relationship, with its tier |",
    "| `sources.csv` | one row per claim, with its source URL, ADMIRALTY reliability and credibility |",
    "| `entities.geojson` | the same entities as a FeatureCollection, for QGIS |",
    "| `graph.jsonld` | the whole graph as linked data, with the edge-type definitions |",
    "",
    "## What was withheld",
    "",
    "Stated in numbers, because otherwise the absence of a row is indistinguishable from an",
    "absence of evidence — for a hierarchy dataset, the difference between \"not subordinate\"",
    "and \"we did not publish the subordination\".",
    "",
    withheldSummary(gated, input.relationships.length),
    "Entities withheld: " + String(gated.excluded.entities.length) + " of " + String(input.entities.length) + ".",
    "",
    "The rules applied:",
    "",
    rules,
    "",
    "## Positions are recorded, never derived",
    "",
    "`entities.geojson` carries a geometry only where one was actually recorded; every other",
    "feature has `\"geometry\": null` and `positionSource: \"none\"`. Gabriel can **derive** a",
    "display position for an entity from its parent's, and most entities on its map are drawn",
    "that way — but a derived position is a rendering, not an observation, and publishing one as",
    "geometry would put a coordinate into the world that no source ever recorded.",
    "",
    "## Dates",
    "",
    "A relationship with no `startDate` is undated: it states what a record said, not a verified",
    "present-tense fact, and nothing about when the relationship began or whether it still holds.",
    "",
  ].join("\n")
}

export function buildReleaseBundle(input: ReleaseInput): ReleaseBundle {
  const gated = applyExportGate(input)

  const geometryByEntity = new Map<string, DrawnGeometry>()
  for (const geom of input.geometries) {
    if (geom.entityId != null && !geometryByEntity.has(geom.entityId)) geometryByEntity.set(geom.entityId, geom)
  }

  const features = gated.entities.map((entity) => {
    const geom = geometryByEntity.get(entity.id)
    return {
      type: "Feature" as const,
      id: entity.id,
      geometry: geom == null ? null : toGeoJsonGeometry(geom),
      properties: {
        id: entity.id,
        kind: entity.kind,
        name: entity.name,
        layerId: entity.layerId,
        notes: entity.notes ?? null,
        positionSource: geom == null ? "none" : "recorded",
      },
    }
  })

  const jsonld = {
    "@context": {
      "@vocab": "https://github.com/gabriel-neutron/GABRIEL#",
      name: "http://schema.org/name",
      licence: "http://purl.org/dc/terms/license",
    },
    licence: LICENCE_URL,
    attribution: ATTRIBUTION,
    generatedAt: input.generatedAt,
    edgeVocabularyVersion: EDGE_VOCABULARY_VERSION,
    edgeTypes: usedEdgeTypes(gated.relationships),
    entities: gated.entities.map((e) => ({
      "@id": e.id, "@type": e.kind, name: e.name, notes: e.notes ?? null,
    })),
    relationships: gated.relationships.map((r) => ({
      "@id": r.id, "@type": r.type, from: r.fromId, to: r.toId,
      startDate: r.startDate, endDate: r.endDate, tier: EDGE_TYPES[r.type]?.tier ?? null,
    })),
  }

  const files = new Map<string, string>([
    ["entities.csv", toCsv(["id", "kind", "name", "layerId", "notes"], entityRows(gated.entities))],
    ["relationships.csv", toCsv(
      ["id", "type", "fromId", "toId", "startDate", "endDate", "tier", "metadata"],
      relationshipRows(gated.relationships),
    )],
    ["sources.csv", toCsv(
      ["claimId", "entityId", "field", "value", "sourceId", "url", "reliability", "credibility"],
      sourceRows(input.sources, gated.claims),
    )],
    ["entities.geojson", JSON.stringify({ type: "FeatureCollection", features }, null, 2) + "\n"],
    ["graph.jsonld", JSON.stringify(jsonld, null, 2) + "\n"],
    ["README.md", readme(input, gated)],
  ])

  return { files, gated }
}
