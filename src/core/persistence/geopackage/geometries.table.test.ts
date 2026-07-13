import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { DrawnGeometry } from "@/types/domain.types"
import { asLatLng } from "@/core/coordinates"
import { createGeometriesTable, readGeometries, writeGeometries } from "./geometries.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("geometries.table", () => {
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
    "round-trips point, line, and polygon geometries including properties and coordinates",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createGeometriesTable(geoPackage)
        const geometries: DrawnGeometry[] = [
          { id: "p-1", layerId: "layer-1", entityId: "e-1", type: "point", lat: 48.5, lng: 134.7 },
          {
            id: "l-1",
            layerId: "layer-1",
            entityId: null,
            type: "line",
            positions: [asLatLng(48.5, 134.7), asLatLng(49.0, 135.2)],
          },
          {
            id: "poly-1",
            layerId: "layer-2",
            entityId: "e-2",
            type: "polygon",
            rings: [[asLatLng(48.5, 134.7), asLatLng(48.5, 135.0), asLatLng(49.0, 135.0), asLatLng(48.5, 134.7)]],
          },
        ]
        writeGeometries(geoPackage, geometries)
        const loaded = await readGeometries(geoPackage)

        expect(loaded).toEqual(expect.arrayContaining(geometries))
        expect(loaded).toHaveLength(3)
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "throws when the geometries feature table is missing",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        await expect(readGeometries(geoPackage)).rejects.toThrow(/Missing feature table/)
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )
})
