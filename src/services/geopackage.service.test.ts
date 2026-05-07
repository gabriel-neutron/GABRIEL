import { readdirSync, rmSync } from "node:fs"
import { describe, expect, it, afterEach } from "vitest"
import { toLeafletCoord, toGeoJsonCoord, asLatLng } from "@/types/coordinates"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage, saveGeoPackage, type GpkgLayer } from "./geopackage.service"
import type { GpkgGeometry } from "./geopackage.service"

// Coordinate contract: internal [lat, lng] ↔ storage [lng, lat].

describe("coordinate round-trip", () => {
  afterEach(() => {
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-") && file.endsWith(".gpkg")) {
        rmSync(file, { force: true })
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

      const bytes = await saveGeoPackage(layers, entities, [], geometries, sourceCache)
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
