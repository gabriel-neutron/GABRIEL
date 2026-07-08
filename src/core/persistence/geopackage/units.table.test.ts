import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import { createUnitsTable, readEntities, writeEntities } from "./units.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("units.table", () => {
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
    "round-trips every descriptor prop through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const entity: MapEntity = {
          kind: "unit",
          id: "e-1",
          name: "Test Unit",
          layerId: "layer-1",
          parentId: "parent-1",
          type: "infantry",
          natoSymbolCode: "1234",
          echelon: "Division",
          affiliation: "Hostile",
          domain: "Air",
          osmRelationId: 42,
          militaryUnitId: "mun-1",
          notes: "some notes",
          sources: "https://example.org",
          analyzedAt: "2026-01-01T00:00:00.000Z",
          positionMode: "parent",
          isExactPosition: true,
        }
        writeEntities(geoPackage, [entity])
        const [loaded] = readEntities(geoPackage)

        // Iterate the fixture's OWN keys, not unitColumns — asserting against the
        // descriptor list under test would let a deleted descriptor row silently
        // shrink this loop instead of failing it. Every key set on `entity` above
        // must survive the round-trip.
        for (const key of Object.keys(entity) as (keyof MapEntity)[]) {
          expect(loaded[key]).toEqual(entity[key])
        }
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "round-trips a corporate-profile row, keeping its type distinct from a unit's free-form type",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const unit: MapEntity = {
          kind: "unit",
          id: "u-1",
          name: "Recon Platoon",
          layerId: "layer-1",
          parentId: null,
          type: "recon",
        }
        const corporate: MapEntity = {
          kind: "corporate",
          id: "c-1",
          name: "Acme Holding",
          layerId: "industry",
          parentId: null,
          type: "holding",
          osmRelationId: 99,
          notes: "parent conglomerate",
        }
        writeEntities(geoPackage, [unit, corporate])
        const loaded = readEntities(geoPackage)

        expect(loaded.find((e) => e.id === "u-1")).toMatchObject({ kind: "unit", type: "recon" })
        expect(loaded.find((e) => e.id === "c-1")).toMatchObject({
          kind: "corporate",
          type: "holding",
          osmRelationId: 99,
          layerId: "industry",
          notes: "parent conglomerate",
        })
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "defaults an invalid persisted type to 'other' for a corporate row, mirroring decodeOrganisationType",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const corporate: MapEntity = {
          kind: "corporate",
          id: "c-2",
          name: "Mystery Corp",
          layerId: "industry",
          parentId: null,
          type: "not-a-real-type" as never,
        }
        writeEntities(geoPackage, [corporate])
        const [loaded] = readEntities(geoPackage)
        expect(loaded.type).toBe("other")
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "defaults kind to 'unit' when the column is absent (pre-E1 schema)",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const entity: MapEntity = { kind: "unit", id: "e-legacy", name: "Legacy Unit", layerId: "layer-1", parentId: null }
        writeEntities(geoPackage, [entity])
        geoPackage.connection.run("ALTER TABLE units DROP COLUMN kind")
        const columns = geoPackage.connection.all("PRAGMA table_info(units)") as Array<{ name: string }>
        expect(columns.map((c) => c.name)).not.toContain("kind")

        const [loaded] = readEntities(geoPackage)
        expect(loaded.kind).toBe("unit")
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "falls back to defaults when a nullable field is absent",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const entity: MapEntity = { kind: "unit", id: "e-2", name: "Minimal Unit", layerId: "layer-1", parentId: null }
        writeEntities(geoPackage, [entity])
        const [loaded] = readEntities(geoPackage)

        expect(loaded).toEqual(
          expect.objectContaining({
            id: "e-2",
            name: "Minimal Unit",
            layerId: "layer-1",
            parentId: null,
            positionMode: "own",
            isExactPosition: false,
          }),
        )
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )
})
