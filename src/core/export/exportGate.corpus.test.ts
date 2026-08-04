import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { applyExportGate, type ExportGateResult } from "./exportGate"
import { buildReleaseBundle } from "./releaseBundle"
import { loadGeoPackage } from "@/core/persistence/geopackage"
import type { GeoPackageLoadResult } from "@/core/persistence/geopackage/types"

/**
 * What a CC-BY release of the real project would actually contain, measured 2026-08-04.
 *
 * These numbers are the point of the test, not a side effect of it. The gate's central rule
 * -- "a relationship ships only when both endpoints are cited" -- is a PROXY, adopted because
 * Gabriel's model attaches sources to entities and not to edges. A proxy that silently
 * publishes almost everything, or almost nothing, is the wrong proxy, and neither failure
 * mode is visible from the predicate's unit tests. So the corpus is measured and pinned.
 *
 * The file is read once with `readFileSync` and NEVER opened for writing.
 * `public/project.gpkg` is the analyst's irreplaceable working project.
 */
describe("the export gate over the real project", () => {
  let gated: ExportGateResult
  let loaded: GeoPackageLoadResult
  let totals: { entities: number; relationships: number; claims: number }

  beforeAll(async () => {
    const buffer = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
    loaded = await loadGeoPackage(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )
    totals = {
      entities: loaded.entities.length,
      relationships: loaded.relationships.length,
      claims: loaded.claims.length,
    }
    gated = applyExportGate(loaded)
  }, 120000)

  it("publishes every entity, because the project holds no natural persons", () => {
    expect(totals.entities).toBe(1027)
    expect(gated.entities).toHaveLength(1027)
    expect(gated.excluded.entities).toEqual([])
  })

  // The consequence of the endpoint proxy, stated in numbers rather than in prose. If a later
  // change makes this figure jump, the gate has been loosened and somebody has to say so out
  // loud -- which is exactly what this project's four documented vacuous checks failed to do.
  it("withholds most of the hierarchy, because most units carry no citation", () => {
    expect(totals.relationships).toBe(1012)
    expect(gated.relationships).toHaveLength(252)
    expect(gated.excluded.relationships).toHaveLength(760)
  })

  it("withholds them for want of a source, not for any other reason", () => {
    const reasons = new Set(gated.excluded.relationships.map((e) => e.reason))

    expect(reasons).toEqual(new Set(["unsourced"]))
  })

  it("publishes every claim, since no entity was excluded", () => {
    expect(gated.claims).toHaveLength(totals.claims)
  })
})

/**
 * The serialisers over the same 1,027-entity corpus. The unit tests build two-entity fixtures,
 * which is the wrong scale to catch a CSV that shifts a column on the one unit name containing
 * a quotation mark, or a GeoJSON that is only valid until a polygon appears in it.
 */
describe("a real release, serialised", () => {
  let files: Map<string, string>

  beforeAll(async () => {
    const buffer = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
    const project = await loadGeoPackage(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )
    files = buildReleaseBundle({
      entities: project.entities,
      relationships: project.relationships,
      claims: project.claims,
      geometries: project.geometries,
      sources: project.sources,
      generatedAt: "2026-08-04T00:00:00.000Z",
    }).files
  }, 120000)

  it("emits GeoJSON a parser accepts, one feature per published entity", () => {
    const gj = JSON.parse(files.get("entities.geojson") ?? "") as {
      type: string
      features: { geometry: { type: string; coordinates: unknown } | null }[]
    }

    expect(gj.type).toBe("FeatureCollection")
    expect(gj.features).toHaveLength(1027)
  })

  // 291 geometries are recorded against 1,027 entities. Every other feature must be an explicit
  // null rather than a derived coordinate, and this is the corpus-scale statement of that.
  it("publishes recorded positions only, and says so for the rest", () => {
    const gj = JSON.parse(files.get("entities.geojson") ?? "") as {
      features: { geometry: unknown; properties: { positionSource: string } }[]
    }
    const withGeometry = gj.features.filter((f) => f.geometry !== null)

    expect(withGeometry).toHaveLength(275)
    expect(withGeometry.every((f) => f.properties.positionSource === "recorded")).toBe(true)
    expect(gj.features.filter((f) => f.properties.positionSource === "none")).toHaveLength(752)
  })

  it("emits JSON-LD a parser accepts, carrying the definitions of the types it used", () => {
    const ld = JSON.parse(files.get("graph.jsonld") ?? "") as {
      edgeTypes: { type: string }[]
      relationships: unknown[]
    }

    expect(ld.relationships).toHaveLength(252)
    expect(ld.edgeTypes.map((t) => t.type)).toEqual(["corporate_parent", "subordinate_to"])
  })

  // A CSV whose row count does not match its data has quoted a newline wrongly somewhere, and
  // this corpus contains notes with newlines in them.
  it("emits CSV whose row count matches the data, despite embedded newlines and quotes", () => {
    const parse = (text: string): number => {
      let rows = 0, inQuotes = false
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]
        if (ch === '"') {
          if (inQuotes && text[i + 1] === '"') { i += 1; continue }
          inQuotes = !inQuotes
        } else if (ch === "\n" && !inQuotes) rows += 1
      }
      return rows
    }

    expect(parse(files.get("entities.csv") ?? "")).toBe(1028)
    expect(parse(files.get("relationships.csv") ?? "")).toBe(253)
  })
})
