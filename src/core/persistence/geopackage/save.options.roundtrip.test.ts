import { readFileSync } from "node:fs"
import { readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { describe, expect, it, afterEach } from "vitest"
import { loadGeoPackage, saveGeoPackage } from "./index"
import { tableExists } from "./columnDescriptor"
import { ORGANISATIONS_TABLE } from "./organisations.table"
import type { GpkgGeometry, GpkgRatingEvent } from "./types"

/**
 * One save, all eight options supplied non-vacuously, one reload: the refactor that compiles
 * and passes most tests is the one that quietly drops a field, so every option gets its own
 * assertion group. Real WASM against the real checked-in demo project, read-only.
 */
describe("saveGeoPackage options (real pre-E1 fixture, read-only)", () => {
  // The green path supplies baseBuffer, so nothing is written to cwd. But the one regression
  // this test exists to catch — a dropped baseBuffer — is exactly what sends the save down
  // createGeoPackageWithRetry and litters the repo root, so the failing run must clean up too.
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
    "round-trips every one of the eight save options through one reopen-and-save",
    async () => {
      // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a
      // shared backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
      // public/project.gpkg is only ever read; nothing here writes to it.
      const fileBytes = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
      const buffer = Uint8Array.from(fileBytes).buffer
      const first = await loadGeoPackage(buffer)

      const markerEntity = first.entities.find((e) => e.kind === "unit")!
      const entities = first.entities.map((e) =>
        e.id === markerEntity.id ? { ...e, aliases: ["Вагнер", "PMC Wagner"] } : e,
      )
      const markerGeometry: GpkgGeometry = {
        id: "geom-marker-roundtrip",
        layerId: first.layers[0]!.id,
        entityId: null,
        type: "point",
        lat: 50.45,
        lng: 30.52,
      }
      const geometries = [...first.geometries, markerGeometry]
      const researchSources = new Map(first.sourceCache)
      researchSources.set("https://example.org/marker", "marker snippet")
      const ratingEvent: GpkgRatingEvent = {
        id: "evt-roundtrip-1",
        targetType: "source",
        targetId: first.sources[0]!.id,
        kind: "reliability",
        value: "B",
        assessor: { kind: "analyst" },
        timestamp: "2026-07-30T00:00:00.000Z",
      }

      // Nothing below can pass by accident on an empty input.
      expect(first.layers.length).toBeGreaterThan(0)
      expect(first.entities.length).toBeGreaterThan(0)
      expect(first.sources.length).toBeGreaterThan(0)
      expect(first.claims.length).toBeGreaterThan(0)

      const bytes = await saveGeoPackage({
        layers: first.layers,
        entities,
        geometries,
        researchSources,
        baseBuffer: buffer,
        sources: first.sources,
        claims: first.claims,
        ratingEvents: [ratingEvent],
        // Fed straight back from the load, like every other option here: the fixture's
        // hierarchy reaches this save as edges (ADR 0011), and `[]` would wipe the table
        // and flatten every parent on the reload below.
        relationships: first.relationships,
        integrityEvents: first.integrityEvents,
      })
      const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      // layers
      expect(second.layers).toHaveLength(first.layers.length)

      // entities
      expect(second.entities).toHaveLength(entities.length)
      expect(second.entities.find((e) => e.id === markerEntity.id)!.aliases).toEqual(["Вагнер", "PMC Wagner"])
      // Every other row stays clean (undefined) — the marker survives on exactly one entity.
      expect(second.entities.filter((e) => e.aliases != null)).toHaveLength(1)

      // geometries
      expect(second.geometries).toHaveLength(geometries.length)

      // researchSources
      expect(second.sourceCache.get("https://example.org/marker")).toBe("marker snippet")

      // sources
      expect(second.sources).toHaveLength(first.sources.length)

      // claims
      expect(second.claims).toHaveLength(first.claims.length)

      // ratingEvents
      expect(second.ratingEvents).toEqual([ratingEvent])

      // baseBuffer. clearLegacyOrganisationsTable empties the legacy `organisations` table but
      // never drops it, and a package created without a baseBuffer never creates it at all — so
      // the table's mere presence proves the reopen branch ran on the buffer that was passed.
      const geoPackage = await GeoPackageAPI.open(new Uint8Array(bytes))
      try {
        expect(tableExists(geoPackage.connection, ORGANISATIONS_TABLE)).toBe(true)
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )
})
