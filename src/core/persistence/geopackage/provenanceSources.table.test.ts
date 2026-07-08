import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Source } from "@/core/provenance/source"
import {
  createProvenanceSourcesTable,
  readProvenanceSources,
  writeProvenanceSources,
} from "./provenanceSources.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("provenanceSources.table", () => {
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
    "round-trips every field through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createProvenanceSourcesTable(geoPackage)
        const source: Source = { id: "src-1", url: "https://example.org/a", domainType: "web", reliability: "B" }
        writeProvenanceSources(geoPackage, [source])
        expect(readProvenanceSources(geoPackage)).toEqual([source])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "round-trips null domainType/reliability",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createProvenanceSourcesTable(geoPackage)
        const source: Source = { id: "src-1", url: "https://example.org/a", domainType: null, reliability: null }
        writeProvenanceSources(geoPackage, [source])
        expect(readProvenanceSources(geoPackage)).toEqual([source])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("returns an empty array when the table does not exist (pre-E2 projects)", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      expect(readProvenanceSources(geoPackage)).toEqual([])
    } finally {
      geoPackage.close()
    }
  })
})
