import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import {
  organisationColumns,
  readOrganisations,
  migrateLegacyOrganisations,
  clearLegacyOrganisationsTable,
  readLegacyOrganisationSources,
} from "./organisations.table"
import { buildCreateTableColumnDefs, insertRow } from "./columnDescriptor"
import type { Organisation } from "@/types/organisation.types"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

/**
 * Nothing in production code creates or writes to the `organisations` table anymore
 * (E1, ADR 0004) — it only ever gets read for migration. These two helpers replicate
 * the deleted `createOrganisationsTable`/`writeOrganisations` purely so tests can set
 * up a genuine pre-E1 fixture to migrate from.
 */
function createLegacyOrganisationsTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(
    `CREATE TABLE IF NOT EXISTS organisations (\n  ${buildCreateTableColumnDefs(organisationColumns).join(",\n  ")}\n)`,
  )
}

function writeLegacyOrganisations(geoPackage: GeoPackage, organisations: Organisation[]): void {
  for (const organisation of organisations) {
    insertRow(geoPackage.connection, "organisations", organisationColumns, organisation)
  }
}

describe("organisations.table (legacy, read-only)", () => {
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
    "round-trips every field of a legacy organisation through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLegacyOrganisationsTable(geoPackage)
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
        writeLegacyOrganisations(geoPackage, [organisation])
        const [loaded] = readOrganisations(geoPackage)

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
      createLegacyOrganisationsTable(geoPackage)
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

  describe("migrateLegacyOrganisations", () => {
    it("folds a legacy organisation into an Entity tagged kind: 'corporate' on the fixed Industry layer", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLegacyOrganisationsTable(geoPackage)
        writeLegacyOrganisations(geoPackage, [
          {
            id: "org-1",
            name: "Test Holding",
            type: "holding",
            parentId: null,
            notes: "org note",
            sources: null,
            osmRelationId: 42,
            positionMode: "own",
            isExactPosition: true,
          },
        ])
        const [migrated] = migrateLegacyOrganisations(geoPackage)
        expect(migrated).toEqual(
          expect.objectContaining({
            kind: "corporate",
            id: "org-1",
            name: "Test Holding",
            type: "holding",
            layerId: INDUSTRY_LAYER_ID,
            parentId: null,
            osmRelationId: 42,
            positionMode: "own",
            isExactPosition: true,
          }),
        )
      } finally {
        geoPackage.close()
      }
    })

    it("returns an empty array when there is no legacy organisations table to migrate", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        expect(migrateLegacyOrganisations(geoPackage)).toEqual([])
      } finally {
        geoPackage.close()
      }
    })
  })

  describe("readLegacyOrganisationSources", () => {
    it("reads every non-null sources value keyed by entity id (ADR 0006, E2.6)", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLegacyOrganisationsTable(geoPackage)
        writeLegacyOrganisations(geoPackage, [
          {
            id: "org-1",
            name: "Test Holding",
            type: "holding",
            parentId: null,
            notes: null,
            sources: "https://org.example",
            osmRelationId: null,
            positionMode: "own",
            isExactPosition: true,
          },
          {
            id: "org-2",
            name: "No Sources Org",
            type: "other",
            parentId: null,
            notes: null,
            sources: null,
            osmRelationId: null,
            positionMode: "own",
            isExactPosition: true,
          },
        ])
        expect(readLegacyOrganisationSources(geoPackage)).toEqual(new Map([["org-1", "https://org.example"]]))
      } finally {
        geoPackage.close()
      }
    })

    it("returns an empty map when there is no legacy organisations table", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        expect(readLegacyOrganisationSources(geoPackage)).toEqual(new Map())
      } finally {
        geoPackage.close()
      }
    })
  })

  describe("clearLegacyOrganisationsTable", () => {
    it("empties a legacy organisations table's rows so a later load can't re-migrate them", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createLegacyOrganisationsTable(geoPackage)
        writeLegacyOrganisations(geoPackage, [
          {
            id: "org-1",
            name: "Test Holding",
            type: "holding",
            parentId: null,
            notes: null,
            sources: null,
            osmRelationId: null,
            positionMode: "own",
            isExactPosition: true,
          },
        ])
        expect(readOrganisations(geoPackage)).toHaveLength(1)

        clearLegacyOrganisationsTable(geoPackage)

        expect(readOrganisations(geoPackage)).toEqual([])
        expect(migrateLegacyOrganisations(geoPackage)).toEqual([])
      } finally {
        geoPackage.close()
      }
    })

    it("is a no-op when there is no legacy organisations table", async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        expect(() => clearLegacyOrganisationsTable(geoPackage)).not.toThrow()
      } finally {
        geoPackage.close()
      }
    })
  })
})
