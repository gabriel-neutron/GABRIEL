import { describe, expect, it } from "vitest"
import { toLeafletCoord, toGeoJsonCoord, asLatLng } from "@/types/coordinates"
import type { GpkgGeometry } from "./geopackage.service"

// These tests verify the coordinate contract introduced in Phase 8:
// internal [lat, lng] ↔ GeoJSON [lng, lat] round-trips losslessly.
// The GeoPackage service uses toLeafletCoord on read and toGeoJsonCoord on write;
// testing those functions directly avoids WASM initialization in a Node.js test runner.

describe("coordinate round-trip", () => {
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
