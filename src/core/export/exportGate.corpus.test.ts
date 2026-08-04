import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { applyExportGate, type ExportGateResult } from "./exportGate"
import { loadGeoPackage } from "@/core/persistence/geopackage"

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
  let totals: { entities: number; relationships: number; claims: number }

  beforeAll(async () => {
    const buffer = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
    const loaded = await loadGeoPackage(
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
