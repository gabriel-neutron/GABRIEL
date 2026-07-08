import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import { createResearchSourcesTable, readSourceCache, writeSourceCache } from "./researchSources.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("researchSources.table", () => {
  afterEach(() => {
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-test-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  })

  it(
    "round-trips a URL -> content cache through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createResearchSourcesTable(geoPackage)
        const cache = new Map([
          ["https://example.org/a", "snippet A"],
          ["https://example.org/b", "snippet B"],
        ])
        writeSourceCache(geoPackage, cache)
        const loaded = readSourceCache(geoPackage)

        expect(loaded).toEqual(cache)
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("is a no-op when no research sources are given", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createResearchSourcesTable(geoPackage)
      writeSourceCache(geoPackage, undefined)
      expect(readSourceCache(geoPackage)).toEqual(new Map())
    } finally {
      geoPackage.close()
    }
  })
})
