import { describe, expect, it } from "vitest"
import { buildReleaseBundle } from "./releaseBundle"
import type { Claim } from "@/core/provenance/claim"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { Relationship } from "@/core/relationship/relationship"

const LAYER = "layer-1"

function unit(id: string, name: string): MapEntity {
  return { kind: "unit", id, name, layerId: LAYER, parentId: null }
}
function edge(id: string, fromId: string, toId: string, over: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {}, ...over }
}
function claim(id: string, entityId: string, over: Partial<Claim> = {}): Claim {
  return { id, entityId, field: "sources", value: null, sourceId: "s-1", credibility: null, timestamp: null, ...over }
}

const ENTITIES = [unit("u-1", "HQ 1st Brigade"), unit("u-2", "B Company")]
const CLAIMS = [claim("c-1", "u-1", { credibility: 2 }), claim("c-2", "u-2")]
const GEOMETRIES: DrawnGeometry[] = [
  { id: "g-1", layerId: LAYER, entityId: "u-1", type: "point", lat: 48.8566, lng: 2.3522 },
]

function bundle(over: Partial<Parameters<typeof buildReleaseBundle>[0]> = {}) {
  return buildReleaseBundle({
    entities: ENTITIES,
    relationships: [edge("r-1", "u-2", "u-1")],
    claims: CLAIMS,
    geometries: GEOMETRIES,
    sources: [{ id: "s-1", url: "https://example.org/a", domainType: null, reliability: "B" }],
    generatedAt: "2026-08-04T12:00:00.000Z",
    ...over,
  })
}

describe("buildReleaseBundle: what it emits", () => {
  it("emits one file per format, plus the documents that make them citable", () => {
    expect([...bundle().files.keys()].sort()).toEqual([
      "README.md",
      "entities.csv",
      "entities.geojson",
      "graph.jsonld",
      "relationships.csv",
      "sources.csv",
    ])
  })

  it("passes the data through the export gate", () => {
    // u-2 has no claim, so its edge is unsourced and must not appear in any format.
    const b = bundle({ claims: [claim("c-1", "u-1")] })

    expect(b.gated.relationships).toEqual([])
    expect(b.files.get("relationships.csv")).not.toContain("r-1")
    expect(b.files.get("graph.jsonld")).not.toContain("r-1")
  })
})

describe("buildReleaseBundle: CSV", () => {
  it("writes a header and one row per entity", () => {
    const lines = (bundle().files.get("entities.csv") ?? "").trim().split("\n")

    expect(lines[0]).toContain("id,kind,name")
    expect(lines).toHaveLength(3)
  })

  // A name containing a comma or a quote is the oldest CSV defect there is, and unit names
  // in this dataset are full of both commas and parentheses.
  it("quotes and escapes a field containing a comma, a quote or a newline", () => {
    const b = bundle({ entities: [unit("u-1", 'A "Special", Detachment\nsecond line'), unit("u-2", "B")] })
    const csv = b.files.get("entities.csv") ?? ""

    expect(csv).toContain('"A ""Special"", Detachment\nsecond line"')
  })

  it("carries the ADMIRALTY ratings, which are the point of the dataset", () => {
    const csv = bundle().files.get("sources.csv") ?? ""

    expect(csv).toContain("reliability")
    expect(csv).toContain("B")
  })
})

describe("buildReleaseBundle: GeoJSON", () => {
  it("is a FeatureCollection with one feature per published entity", () => {
    const gj = JSON.parse(bundle().files.get("entities.geojson") ?? "{}") as {
      type: string
      features: { geometry: unknown; properties: Record<string, unknown> }[]
    }

    expect(gj.type).toBe("FeatureCollection")
    expect(gj.features).toHaveLength(2)
  })

  /**
   * The honesty rule, and the one most likely to be "fixed" by a later hand. Gabriel can
   * derive a display position for an entity from its parent chain, and 736 of this project's
   * entities have only that. A derived position is a RENDERING, not an observation, and
   * publishing it as geometry under CC-BY would put a coordinate into the world that no
   * source ever recorded. Same family as the invented midpoint ADR 0011 forbids.
   */
  it("publishes recorded geometry only, and null for an entity that has none", () => {
    const gj = JSON.parse(bundle().files.get("entities.geojson") ?? "{}") as {
      features: { geometry: unknown; properties: Record<string, unknown> }[]
    }
    const [withGeom, without] = gj.features

    expect(withGeom.geometry).toEqual({ type: "Point", coordinates: [2.3522, 48.8566] })
    expect(withGeom.properties.positionSource).toBe("recorded")
    expect(without.geometry).toBeNull()
    expect(without.properties.positionSource).toBe("none")
  })

  it("writes coordinates longitude-first, as GeoJSON requires", () => {
    const gj = JSON.parse(bundle().files.get("entities.geojson") ?? "{}") as {
      features: { geometry: { coordinates: number[] } | null }[]
    }

    expect(gj.features[0].geometry?.coordinates[0]).toBe(2.3522)
  })
})

describe("buildReleaseBundle: JSON-LD", () => {
  it("carries a context and the licence", () => {
    const ld = JSON.parse(bundle().files.get("graph.jsonld") ?? "{}") as Record<string, unknown>

    expect(ld["@context"]).toBeTruthy()
    expect(JSON.stringify(ld)).toContain("creativecommons.org/licenses/by/4.0")
  })

  // LICENSE-DATA.md: "Reusers must also preserve the edge-type definitions when
  // redistributing edges. A subordinate_to row without its published definition is a claim
  // stripped of the qualification that makes it defensible."
  it("carries the published definition of every edge type it uses, and no other", () => {
    const ld = JSON.parse(bundle().files.get("graph.jsonld") ?? "{}") as {
      edgeTypes: { type: string; publicDefinition: string; tier: string }[]
    }

    expect(ld.edgeTypes.map((d) => d.type)).toEqual(["subordinate_to"])
    expect(ld.edgeTypes[0].publicDefinition).toContain("recorded in a cited source")
    expect(ld.edgeTypes[0].tier).toBe("record")
  })

  it("stamps the vocabulary version the definitions belong to", () => {
    const ld = JSON.parse(bundle().files.get("graph.jsonld") ?? "{}") as { edgeVocabularyVersion: string }

    expect(ld.edgeVocabularyVersion).toBe("1.1.0")
  })
})

describe("buildReleaseBundle: README", () => {
  it("states the attribution a reuser owes", () => {
    const readme = bundle().files.get("README.md") ?? ""

    expect(readme).toContain("CC BY 4.0")
    expect(readme).toContain("github.com/gabriel-neutron/GABRIEL")
  })

  // Without this a reuser cannot tell "not subordinate" from "we did not publish the
  // subordination", which for a hierarchy dataset is the difference that matters.
  it("reports what was withheld, and why, in numbers", () => {
    const readme = bundle({ claims: [claim("c-1", "u-1")] }).files.get("README.md") ?? ""

    expect(readme).toContain("1 of 1")
    expect(readme).toContain("unsourced")
  })

  it("says the derived positions were not published", () => {
    expect(bundle().files.get("README.md") ?? "").toContain("derived")
  })
})
