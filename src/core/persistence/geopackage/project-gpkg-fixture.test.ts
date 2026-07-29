import { readFileSync } from "node:fs"
import { readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { describe, expect, it, afterEach } from "vitest"
import { loadGeoPackage, saveGeoPackage } from "./index"
import { readProvenanceSources } from "./provenanceSources.table"
import { readProvenanceClaims } from "./provenanceClaims.table"
import { readRatingEvents } from "./ratingEvents.table"

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
      const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
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
      // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a
      // shared backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
      const fileBytes = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
      const buffer = Uint8Array.from(fileBytes).buffer
      const first = await loadGeoPackage(buffer)

      // Pass `buffer` as baseBuffer, mirroring performProjectSave's real reopen-and-save
      // path (useProjectIO.ts) — this is the exact path that silently went untested
      // pre-migration and let the crash-on-save regression ship.
      const bytes = await saveGeoPackage(first.layers, first.entities, first.geometries, first.sourceCache, buffer)
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

  it(
    "persists merge aliases through a reopen-and-save against the real pre-E3 fixture (ADR 0006, E3)",
    async () => {
      // The real fixture predates the `aliases` column — this drives ensureOptionalColumns'
      // ALTER path (reopen via baseBuffer), the exact shape E1.7's crash-on-save bug lived in.
      const fileBytes = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
      const buffer = Uint8Array.from(fileBytes).buffer
      const first = await loadGeoPackage(buffer)

      const target = first.entities.find((e) => e.kind === "unit")!
      const aliased = first.entities.map((e) =>
        e.id === target.id ? { ...e, aliases: ["Вагнер", "PMC Wagner"] } : e,
      )

      const bytes = await saveGeoPackage(first.layers, aliased, first.geometries, first.sourceCache, buffer)
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      expect(second.entities.find((e) => e.id === target.id)!.aliases).toEqual(["Вагнер", "PMC Wagner"])
      // Every other row stays clean (undefined) — aliases are opt-in, not defaulted to [].
      expect(second.entities.filter((e) => e.aliases != null)).toHaveLength(1)
    },
    60_000,
  )

  it(
    "persists external ids through a reopen-and-save against the real pre-Slice-1 fixture",
    async () => {
      // The real fixture predates the external_ids column, so this drives
      // ensureOptionalColumns' ALTER TABLE ... ADD COLUMN path (reopen via baseBuffer) —
      // the only path where a constraints clause on the descriptor (Trap T4) can fire.
      // Everything stays in memory: public/project.gpkg is never written to.
      const fileBytes = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
      const buffer = Uint8Array.from(fileBytes).buffer
      const first = await loadGeoPackage(buffer)

      const target = first.entities.find((e) => e.kind === "unit")!
      const withIds = first.entities.map((e) =>
        e.id === target.id ? { ...e, externalIds: [{ scheme: "imo" as const, value: "9074729" }] } : e,
      )

      const bytes = await saveGeoPackage(first.layers, withIds, first.geometries, first.sourceCache, buffer)
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      expect(second.entities.find((e) => e.id === target.id)!.externalIds).toEqual([
        { scheme: "imo", value: "9074729" },
      ])
      // Every other row stays clean. Trap T6: decodeRow assigns every descriptor prop
      // unconditionally, so an in-operator presence test reports true on all ~1027 rows —
      // only a != null test distinguishes them. If this reports more than 1,
      // decodeExternalIds is returning [] where it must return undefined (Trap T5).
      expect(second.entities.filter((e) => e.externalIds != null)).toHaveLength(1)
    },
    60_000,
  )

  it(
    "derives Source/Claim provenance from the real fixture's legacy sources strings, and a double round-trip doesn't duplicate them (ADR 0006, E2 Slice A)",
    async () => {
      const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
      const first = await loadGeoPackage(buffer)
      expect(first.sources.length).toBeGreaterThan(0)
      expect(first.claims.length).toBeGreaterThan(0)

      const firstBytes = await saveGeoPackage(
        first.layers,
        first.entities,
        first.geometries,
        first.sourceCache,
        buffer,
        first.sources,
        first.claims,
      )
      const second = await loadGeoPackage(Uint8Array.from(firstBytes).buffer)
      expect(second.sources).toHaveLength(first.sources.length)
      expect(second.claims).toHaveLength(first.claims.length)

      const secondBytes = await saveGeoPackage(
        second.layers,
        second.entities,
        second.geometries,
        second.sourceCache,
        Uint8Array.from(firstBytes).buffer,
        second.sources,
        second.claims,
      )
      const third = await loadGeoPackage(Uint8Array.from(secondBytes).buffer)
      expect(third.sources).toHaveLength(first.sources.length)
      expect(third.claims).toHaveLength(first.claims.length)
    },
    60_000,
  )

  it(
    "adds reliability_meta/credibility_meta to a reopened pre-feature fixture via ensureOptionalColumns, and a rating survives the round-trip",
    async () => {
      const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
      const first = await loadGeoPackage(buffer)
      expect(first.sources.every((s) => s.reliabilityMeta === undefined)).toBe(true)

      const target = first.sources[0]!
      const rated = first.sources.map((s) =>
        s.id === target.id
          ? {
              ...s,
              reliability: "C" as const,
              reliabilityMeta: {
                confidence: 0.5,
                rationale: "type-table prior",
                assessor: { kind: "type-table" as const, mappingVersion: "v1" },
                mappingVersion: "v1",
                updatedAt: "2026-07-14T00:00:00.000Z",
                overridden: false,
              },
            }
          : s,
      )

      const bytes = await saveGeoPackage(first.layers, first.entities, first.geometries, first.sourceCache, buffer, rated, first.claims)
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      expect(second.sources.find((s) => s.id === target.id)?.reliabilityMeta).toEqual(rated.find((s) => s.id === target.id)!.reliabilityMeta)
      // Every other source stays clean (undefined), not defaulted.
      expect(second.sources.filter((s) => s.reliabilityMeta != null)).toHaveLength(1)
    },
    60_000,
  )

  it(
    "adds rating_events to a reopened pre-Phase-4 fixture, and the audit trail survives the round-trip",
    async () => {
      const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
      const first = await loadGeoPackage(buffer)
      expect(first.ratingEvents).toEqual([])

      const event = {
        id: "evt-1",
        targetType: "source" as const,
        targetId: first.sources[0]!.id,
        kind: "reliability" as const,
        value: "B",
        assessor: { kind: "analyst" as const },
        timestamp: "2026-07-14T00:00:00.000Z",
      }
      const bytes = await saveGeoPackage(
        first.layers,
        first.entities,
        first.geometries,
        first.sourceCache,
        buffer,
        first.sources,
        first.claims,
        [event],
      )
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)
      expect(second.ratingEvents).toEqual([event])
    },
    60_000,
  )

  it(
    "wipes provenance_sources/provenance_claims/rating_events when a later save omits them, reusing a buffer that previously had rows (Fix 6 regression)",
    async () => {
      const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
      const first = await loadGeoPackage(buffer)
      expect(first.sources.length).toBeGreaterThan(0)

      const event = {
        id: "evt-1",
        targetType: "source" as const,
        targetId: first.sources[0]!.id,
        kind: "reliability" as const,
        value: "B",
        assessor: { kind: "analyst" as const },
        timestamp: "2026-07-14T00:00:00.000Z",
      }
      // First save populates sources/claims/ratingEvents into a fresh buffer.
      const firstBytes = await saveGeoPackage(
        first.layers,
        first.entities,
        first.geometries,
        first.sourceCache,
        buffer,
        first.sources,
        first.claims,
        [event],
      )

      // Second save reuses that buffer but omits sources/claims/ratingEvents entirely
      // (the "New Project" shape). Read the raw tables directly (bypassing
      // loadGeoPackage's legacy-column re-derivation, which would otherwise re-mint
      // sources from the entities' legacy `sources` strings and mask a broken wipe) to
      // assert the persisted tables themselves end up empty, not carrying over the
      // first save's rows.
      const secondBytes = await saveGeoPackage(
        first.layers,
        first.entities,
        first.geometries,
        first.sourceCache,
        Uint8Array.from(firstBytes).buffer,
      )
      const geoPackage = await GeoPackageAPI.open(new Uint8Array(secondBytes))
      try {
        expect(readProvenanceSources(geoPackage)).toEqual([])
        expect(readProvenanceClaims(geoPackage)).toEqual([])
        expect(readRatingEvents(geoPackage)).toEqual([])
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )
})
