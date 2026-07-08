import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Layer } from "@/types/domain.types"
import { createLayersTable, readLayers, writeLayers } from "./layers.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("layers.table", () => {
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
    "round-trips echelon, custom, and organisation layers",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLayersTable(geoPackage)
        const layers: Layer[] = [
          { id: "division", name: "Division", visible: true, kind: "echelon" },
          { id: "custom-1", name: "Custom Layer", visible: false, kind: "custom" },
          { id: "industry", name: "Industry", visible: true, kind: "organisation" },
        ]
        writeLayers(geoPackage, layers)
        const loaded = readLayers(geoPackage)

        expect(loaded).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "division", name: "Division", visible: true, kind: "echelon" }),
            expect.objectContaining({ id: "custom-1", name: "Custom Layer", visible: false, kind: "custom" }),
            expect.objectContaining({ id: "industry", name: "Industry", visible: true, kind: "organisation" }),
          ]),
        )
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "round-trips an OSM layer's sourceQuery and osmData",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLayersTable(geoPackage)
        const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
        const layers: Layer[] = [
          { id: "osm-1", name: "OSM Overlay", visible: true, kind: "osm", sourceQuery: "amenity=hospital", osmData },
        ]
        writeLayers(geoPackage, layers)
        const [loaded] = readLayers(geoPackage)

        expect(loaded).toEqual(
          expect.objectContaining({
            id: "osm-1",
            name: "OSM Overlay",
            kind: "osm",
            sourceQuery: "amenity=hospital",
            osmData,
          }),
        )
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "does not persist sourceQuery/osmData for a kind='osm' layer with no cached osmData",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLayersTable(geoPackage)
        const layers: Layer[] = [{ id: "osm-2", name: "Empty OSM Overlay", visible: true, kind: "osm", sourceQuery: "amenity=school" }]
        writeLayers(geoPackage, layers)
        const [loaded] = readLayers(geoPackage)

        expect(loaded.sourceQuery).toBeUndefined()
        expect(loaded.osmData).toBeUndefined()
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )
})
