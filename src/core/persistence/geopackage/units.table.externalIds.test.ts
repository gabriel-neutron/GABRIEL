import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import { createUnitsTable, readEntities, unitColumns, writeEntities } from "./units.table"

/**
 * Slice 1's `external_ids` column, split out of `units.table.test.ts` because that
 * file is already at 282 lines against the 300-line cap (CONSTRAINTS.md:113).
 * Real WASM throughout, no mocking (CONSTRAINTS.md:102).
 */
async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create("gabriel-test-" + crypto.randomUUID() + ".gpkg")
  geoPackage.createRequiredTables()
  return geoPackage
}

/** The 17 columns the units descriptor list carried before Slice 1 (spec, criterion 40). */
const PRE_SLICE_1_COLUMNS = [
  "id",
  "name",
  "layer_id",
  "parent_id",
  "aliases",
  "kind",
  "type",
  "nato_symbol_code",
  "echelon",
  "affiliation",
  "domain",
  "osm_relation_id",
  "military_unit_id",
  "notes",
  "analyzed_at",
  "position_mode",
  "is_exact_position",
]

describe("units.table external_ids descriptor", () => {
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

  it("declares external_ids optional with a NULL fallback and no constraints", () => {
    const descriptor = unitColumns.find((d) => d.column === "external_ids")
    expect(descriptor).toBeDefined()
    expect(descriptor!.prop).toBe("externalIds")
    expect(descriptor!.sqlType).toBe("TEXT")
    // T3: `optional` without `fallbackSql` makes buildSelectClause throw on every read.
    expect(descriptor!.optional).toBe(true)
    expect(descriptor!.fallbackSql).toBe("NULL")
    // T4: ensureOptionalColumns splices `constraints` straight into
    // ALTER TABLE ... ADD COLUMN, and SQLite rejects NOT NULL there without a constant
    // default — a failure that surfaces only on the reopened-old-file path.
    expect("constraints" in descriptor!).toBe(false)
    expect(descriptor!.constraints).toBeUndefined()
  })

  it("adds exactly one column to the units descriptor list", () => {
    expect(unitColumns).toHaveLength(18)
    expect(unitColumns.filter((d) => d.column === "external_ids")).toHaveLength(1)

    const columns = unitColumns.map((d) => d.column)
    for (const column of PRE_SLICE_1_COLUMNS) {
      expect(columns).toContain(column)
    }
  })

  it("keeps kind decoded before type and osm_relation_id", () => {
    const indexOf = (column: string): number => unitColumns.findIndex((d) => d.column === column)
    // DecodeContext.decoded only carries props declared earlier in the array, and both
    // `type` and `osm_relation_id` decode differently per kind.
    expect(indexOf("kind")).toBeGreaterThanOrEqual(0)
    expect(indexOf("kind")).toBeLessThan(indexOf("type"))
    expect(indexOf("kind")).toBeLessThan(indexOf("osm_relation_id"))
  })

  it(
    "round-trips external ids through a fresh units table",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const externalIds = [
          { scheme: "imo" as const, value: "9074729" },
          { scheme: "lei" as const, value: "5493001KJTIIGC8Y1R12" },
        ]
        const entity: MapEntity = {
          kind: "unit",
          id: "e-ids",
          name: "Identified Unit",
          layerId: "layer-1",
          parentId: null,
          externalIds,
        }
        writeEntities(geoPackage, [entity])
        const [loaded] = readEntities(geoPackage)

        expect(loaded.externalIds).toEqual(externalIds)
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "encodes an absent or empty externalIds array as SQL NULL and decodes it back to undefined",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const base = { kind: "unit" as const, layerId: "layer-1", parentId: null }
        writeEntities(geoPackage, [
          { ...base, id: "e-absent", name: "Absent", externalIds: undefined },
          { ...base, id: "e-empty", name: "Empty", externalIds: [] },
          { ...base, id: "e-real", name: "Real", externalIds: [{ scheme: "imo", value: "9074729" }] },
        ])

        // Asserted at the column too, so the NULL is proven to come from encode rather
        // than from a decode that quietly discards a stored "[]".
        const stored = geoPackage.connection.all(
          "SELECT id, external_ids FROM units ORDER BY id",
        ) as Array<{ id: string; external_ids: string | null }>
        expect(stored.find((r) => r.id === "e-absent")!.external_ids).toBeNull()
        expect(stored.find((r) => r.id === "e-empty")!.external_ids).toBeNull()

        const loaded = readEntities(geoPackage)
        // T5: undefined, never [] and never null — the hard gate's "every other row stays
        // clean" count depends on this.
        expect(loaded.find((e) => e.id === "e-absent")!.externalIds).toBeUndefined()
        expect(loaded.find((e) => e.id === "e-empty")!.externalIds).toBeUndefined()
        expect(loaded.find((e) => e.id === "e-real")!.externalIds).toEqual([
          { scheme: "imo", value: "9074729" },
        ])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "defaults externalIds to undefined when the column is absent (pre-Slice-1 schema)",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createUnitsTable(geoPackage)
        const entity: MapEntity = {
          kind: "unit",
          id: "e-legacy",
          name: "Legacy Unit",
          layerId: "layer-1",
          parentId: null,
        }
        writeEntities(geoPackage, [entity])
        geoPackage.connection.run("ALTER TABLE units DROP COLUMN external_ids")
        const columns = geoPackage.connection.all("PRAGMA table_info(units)") as Array<{ name: string }>
        expect(columns.map((c) => c.name)).not.toContain("external_ids")

        // T3: the fallbackSql branch of buildSelectClause must fire here. Without it the
        // read throws "'external_ids' is optional but has no fallbackSql" — a total load
        // failure on every pre-Slice-1 file, not graceful degradation.
        const [loaded] = readEntities(geoPackage)
        expect(loaded.externalIds).toBeUndefined()
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )
})
