import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { describe, expect, it, afterEach } from "vitest"
import { toLeafletCoord, toGeoJsonCoord, asLatLng } from "@/core/coordinates"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage, saveGeoPackage, type GpkgLayer } from "./index"
import type { GpkgGeometry } from "./index"

// Coordinate contract: internal [lat, lng] ↔ storage [lng, lat].

describe("coordinate round-trip", () => {
  afterEach(() => {
    // Best-effort cleanup of stray browser-save-pool files: another parallel test file's
    // worker process may still hold a lock on a same-named pooled file on Windows, so a
    // transient EPERM here isn't a real failure (the file just outlives this run).
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
    "saveGeoPackage -> loadGeoPackage round-trips entities, geometries, and source cache",
    async () => {
      const layers: GpkgLayer[] = [
        { id: "division", name: "Division", visible: true, kind: "echelon" },
        { id: "custom-1", name: "Custom Layer", visible: true, kind: "custom" },
      ]
      const entities: MapEntity[] = [
        {
          kind: "unit",
          id: "e-1",
          name: "1st Test Division",
          layerId: "division",
          parentId: null,
          type: "infantry",
          notes: "HQ test note",
          sources: "https://example.org/source-a",
          positionMode: "own",
          isExactPosition: true,
        },
      ]
      const geometries: GpkgGeometry[] = [
        { id: "p-1", layerId: "division", entityId: "e-1", type: "point", lat: 48.5, lng: 134.7 },
        {
          id: "l-1",
          layerId: "custom-1",
          entityId: null,
          type: "line",
          positions: [asLatLng(48.5, 134.7), asLatLng(49.0, 135.2)],
        },
      ]
      const sourceCache = new Map<string, string>([
        ["https://example.org/source-a", "cached snippet A"],
        ["https://example.org/source-b", "cached snippet B"],
      ])

      const bytes = await saveGeoPackage(layers, entities, geometries, sourceCache)
      const persistedBuffer = Uint8Array.from(bytes).buffer
      const loaded = await loadGeoPackage(persistedBuffer)

      expect(loaded.layers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "division", name: "Division", kind: "echelon", visible: true }),
          expect.objectContaining({ id: "custom-1", name: "Custom Layer", kind: "custom", visible: true }),
        ]),
      )
      expect(loaded.entities).toHaveLength(1)
      expect(loaded.entities[0]).toEqual(
        expect.objectContaining({
          id: "e-1",
          name: "1st Test Division",
          layerId: "division",
          notes: "HQ test note",
          sources: "https://example.org/source-a",
          positionMode: "own",
          isExactPosition: true,
        }),
      )
      expect(loaded.geometries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "p-1", type: "point", lat: 48.5, lng: 134.7 }),
          expect.objectContaining({
            id: "l-1",
            type: "line",
            positions: [asLatLng(48.5, 134.7), asLatLng(49.0, 135.2)],
          }),
        ]),
      )
      expect(loaded.sourceCache.get("https://example.org/source-a")).toBe("cached snippet A")
      expect(loaded.sourceCache.get("https://example.org/source-b")).toBe("cached snippet B")
    },
    30_000,
  )

  it(
    "saveGeoPackage -> loadGeoPackage round-trips corporate entities (kind: 'corporate')",
    async () => {
      const layers: GpkgLayer[] = [{ id: "industry", name: "Industry", visible: true, kind: "organisation" }]
      const entities: MapEntity[] = [
        {
          kind: "corporate",
          id: "org-1",
          name: "Test Holding",
          type: "holding",
          layerId: "industry",
          parentId: null,
          notes: "Parent org note",
          sources: "https://example.org/org-source",
          osmRelationId: 42,
          positionMode: "own",
          isExactPosition: true,
        },
        {
          kind: "corporate",
          id: "org-2",
          name: "Test Factory",
          type: "factory",
          layerId: "industry",
          parentId: "org-1",
          notes: null,
          sources: null,
          osmRelationId: null,
          positionMode: "parent",
          isExactPosition: false,
        },
      ]

      const bytes = await saveGeoPackage(layers, entities, [], undefined)
      const persistedBuffer = Uint8Array.from(bytes).buffer
      const loaded = await loadGeoPackage(persistedBuffer)

      expect(loaded.entities).toHaveLength(2)
      expect(loaded.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "corporate",
            id: "org-1",
            name: "Test Holding",
            type: "holding",
            parentId: null,
            notes: "Parent org note",
            sources: "https://example.org/org-source",
            osmRelationId: 42,
            positionMode: "own",
            isExactPosition: true,
          }),
          expect.objectContaining({
            kind: "corporate",
            id: "org-2",
            name: "Test Factory",
            type: "factory",
            parentId: "org-1",
            // The shared units-table columns decode a null column to undefined (the
            // Unit convention), not null (the old, now-retired Organisation table's
            // convention) — a cosmetic difference nothing in the app distinguishes
            // (every read site checks `!= null`), not lossy: SQL NULL round-trips
            // either way since the encode side treats undefined and null identically.
            notes: undefined,
            sources: undefined,
            osmRelationId: undefined,
            positionMode: "parent",
            isExactPosition: false,
          }),
        ]),
      )
    },
    30_000,
  )

  it(
    "loadGeoPackage falls back to defaults when analyzed_at/position_mode/is_exact_position columns are missing (pre-migration schema)",
    async () => {
      const layers: GpkgLayer[] = [{ id: "division", name: "Division", visible: true, kind: "echelon" }]
      const entities: MapEntity[] = [
        {
          kind: "unit",
          id: "e-1",
          name: "Old Schema Unit",
          layerId: "division",
          parentId: null,
          notes: "predates the analyzed_at/position_mode/is_exact_position columns",
        },
      ]
      const bytes = await saveGeoPackage(layers, entities, [])
      const geoPackage = await GeoPackageAPI.open(new Uint8Array(bytes))
      try {
        geoPackage.connection.run("ALTER TABLE units DROP COLUMN analyzed_at")
        geoPackage.connection.run("ALTER TABLE units DROP COLUMN position_mode")
        geoPackage.connection.run("ALTER TABLE units DROP COLUMN is_exact_position")
        const columns = geoPackage.connection.all("PRAGMA table_info(units)") as Array<{ name: string }>
        expect(columns.map((c) => c.name)).not.toEqual(
          expect.arrayContaining(["analyzed_at", "position_mode", "is_exact_position"]),
        )
        const migratedBytes = await geoPackage.export()
        if (!(migratedBytes instanceof Uint8Array)) throw new Error("Export did not return Uint8Array")

        const loaded = await loadGeoPackage(Uint8Array.from(migratedBytes).buffer)

        expect(loaded.entities).toHaveLength(1)
        expect(loaded.entities[0]).toEqual(
          expect.objectContaining({
            id: "e-1",
            name: "Old Schema Unit",
            analyzedAt: undefined,
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

  it("toLeafletCoord and toGeoJsonCoord are inverses", () => {
    const lat = 48.5
    const lng = 134.7
    const pos = toLeafletCoord(lng, lat)
    const storage = toGeoJsonCoord(pos)
    const restored = toLeafletCoord(storage[0], storage[1])

    expect(restored[0]).toBeCloseTo(lat, 10)
    expect(restored[1]).toBeCloseTo(lng, 10)
  })

  it("toLeafletCoord produces [lat, lng] order", () => {
    const pos = toLeafletCoord(134.7, 48.5)
    expect(pos[0]).toBe(48.5) // lat first
    expect(pos[1]).toBe(134.7) // lng second
  })

  it("toGeoJsonCoord produces [lng, lat] order", () => {
    const pos = asLatLng(48.5, 134.7)
    const storage = toGeoJsonCoord(pos)
    expect(storage[0]).toBe(134.7) // lng first (GeoJSON convention)
    expect(storage[1]).toBe(48.5) // lat second
  })

  it("point geometry coordinates survive write→read", () => {
    const lat = 48.5
    const lng = 134.7
    // Simulate what saveGeoPackage writes and loadGeoPackage reads
    const stored: [number, number] = [lng, lat] // GeoJSON [lng, lat]
    const loaded = toLeafletCoord(stored[0], stored[1])
    expect(loaded[0]).toBe(lat)
    expect(loaded[1]).toBe(lng)
  })

  it("line geometry coordinates survive write→read", () => {
    const positions: GpkgGeometry & { type: "line" } = {
      id: "g-1",
      layerId: "layer-1",
      entityId: null,
      type: "line",
      positions: [asLatLng(48.5, 134.7), asLatLng(49.0, 135.2)],
    }

    // simulate saveGeoPackage write path: positions.map(toGeoJsonCoord)
    const stored = positions.positions.map(toGeoJsonCoord)
    // simulate loadGeoPackage read path: coords.map(([lng, lat]) => toLeafletCoord(lng, lat))
    const reloaded = stored.map(([lng, lat]) => toLeafletCoord(lng, lat))

    for (let i = 0; i < positions.positions.length; i++) {
      expect(reloaded[i][0]).toBeCloseTo(positions.positions[i][0], 10)
      expect(reloaded[i][1]).toBeCloseTo(positions.positions[i][1], 10)
    }
  })

  it("polygon ring coordinates survive write→read", () => {
    const ring = [
      asLatLng(48.5, 134.7),
      asLatLng(48.5, 135.0),
      asLatLng(49.0, 135.0),
      asLatLng(48.5, 134.7),
    ]
    const geometry: GpkgGeometry & { type: "polygon" } = {
      id: "g-2",
      layerId: "layer-1",
      entityId: null,
      type: "polygon",
      rings: [ring],
    }

    // simulate write then read
    const storedRings = geometry.rings.map((r) => r.map(toGeoJsonCoord))
    const reloadedRings = storedRings.map((r) => r.map(([lng, lat]) => toLeafletCoord(lng, lat)))

    for (let i = 0; i < ring.length; i++) {
      expect(reloadedRings[0][i][0]).toBeCloseTo(ring[i][0], 10)
      expect(reloadedRings[0][i][1]).toBeCloseTo(ring[i][1], 10)
    }
  })
})
