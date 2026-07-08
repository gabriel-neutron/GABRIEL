import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Organisation } from "@/types/organisation.types"
import { createOrganisationsTable, readOrganisations, writeOrganisations } from "./organisations.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("organisations.table", () => {
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
    "round-trips every field of an organisation through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createOrganisationsTable(geoPackage)
        const organisation: Organisation = {
          id: "org-1",
          name: "Test Holding",
          type: "holding",
          parentId: "org-0",
          notes: "org note",
          sources: "https://example.org/org-source",
          osmRelationId: 42,
          positionMode: "parent",
          isExactPosition: true,
        }
        writeOrganisations(geoPackage, [organisation])
        const [loaded] = readOrganisations(geoPackage)

        // Iterate the fixture's OWN keys, not organisationColumns — asserting against
        // the descriptor list under test would let a deleted descriptor row silently
        // shrink this loop instead of failing it.
        for (const key of Object.keys(organisation) as (keyof Organisation)[]) {
          expect(loaded[key]).toEqual(organisation[key])
        }
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("returns an empty array when the organisations table does not exist (pre-organisations projects)", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      expect(readOrganisations(geoPackage)).toEqual([])
    } finally {
      geoPackage.close()
    }
  })

  it("defaults invalid/legacy type and positionMode values on read", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createOrganisationsTable(geoPackage)
      geoPackage.connection.run(
        `INSERT INTO organisations (id, name, type, position_mode, is_exact_position) VALUES (?, ?, ?, ?, ?)`,
        ["org-legacy", "Legacy Org", "bogus_type", "bogus_mode", 0],
      )
      const [loaded] = readOrganisations(geoPackage)
      expect(loaded).toEqual(
        expect.objectContaining({ id: "org-legacy", name: "Legacy Org", type: "other", positionMode: "own" }),
      )
    } finally {
      geoPackage.close()
    }
  })
})
