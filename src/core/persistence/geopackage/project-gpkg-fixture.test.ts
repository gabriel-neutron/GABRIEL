import { readFileSync } from "node:fs"
import { readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, afterEach } from "vitest"
import { loadGeoPackage, saveGeoPackage } from "./index"

/**
 * The real, checked-in demo project (public/project.gpkg) predates E1 (ADR 0004): it has
 * a separate `organisations` table and no `kind` column on `units`. This is the literal
 * "existing .gpkg files round-trip losslessly" success criterion from ROADMAP.md's E1 —
 * tested against a real file, not only synthetic fixtures.
 */
describe("public/project.gpkg round-trip (real pre-E1 fixture)", () => {
  afterEach(() => {
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  })

  it(
    "loads every unit and legacy organisation into one unified, kind-tagged entities array",
    async () => {
      const buffer = readFileSync(resolve(process.cwd(), "public/project.gpkg")).buffer as ArrayBuffer
      const loaded = await loadGeoPackage(buffer)

      const units = loaded.entities.filter((e) => e.kind === "unit")
      const corporate = loaded.entities.filter((e) => e.kind === "corporate")

      expect(units.length).toBeGreaterThan(0)
      expect(corporate.length).toBeGreaterThan(0)
      expect(loaded.entities).toHaveLength(units.length + corporate.length)

      // Every corporate entity migrated from the legacy `organisations` table lands
      // on the fixed synthetic Industry layer, never an arbitrary one.
      for (const org of corporate) {
        expect(org.layerId).toBe("industry")
      }

      // No id collisions between the two legacy tables now sharing one array.
      const ids = loaded.entities.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    },
    60_000,
  )

  it(
    "round-trips losslessly: re-saving and reloading preserves every entity, geometry, and layer",
    async () => {
      const buffer = readFileSync(resolve(process.cwd(), "public/project.gpkg")).buffer as ArrayBuffer
      const first = await loadGeoPackage(buffer)

      const bytes = await saveGeoPackage(first.layers, first.entities, first.geometries, first.sourceCache)
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      expect(second.entities).toHaveLength(first.entities.length)
      expect(second.geometries).toHaveLength(first.geometries.length)
      expect(second.layers).toHaveLength(first.layers.length)

      const firstById = new Map(first.entities.map((e) => [e.id, e]))
      for (const entity of second.entities) {
        const original = firstById.get(entity.id)
        expect(original).toBeDefined()
        expect(entity.kind).toBe(original!.kind)
        expect(entity.name).toBe(original!.name)
        expect(entity.layerId).toBe(original!.layerId)
        expect(entity.parentId).toBe(original!.parentId)
      }
    },
    60_000,
  )
})
