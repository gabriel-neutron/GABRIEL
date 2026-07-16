import { describe, expect, it } from "vitest"
import { TILE_CACHE_CAP, providerTag, selectEvictionVictims, tileCacheKey } from "./tileCache.logic"

describe("tileCache.logic", () => {
  describe("tileCacheKey", () => {
    it("is independent of the {s} subdomain placeholder", () => {
      const withSub = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png"
      const bare = "https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png"
      expect(tileCacheKey(withSub, 5, 18, 10)).toBe(tileCacheKey(bare, 5, 18, 10))
    })

    it("shares keys across providers with an identical URL template (Esri satellite + hybrid base)", () => {
      const esri =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      expect(tileCacheKey(esri, 5, 10, 18)).toBe(tileCacheKey(esri, 5, 10, 18))
      expect(providerTag(esri)).toBe(esri)
    })

    it("separates providers with different templates (osm vs topo)", () => {
      const osm = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      const topo = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
      expect(tileCacheKey(osm, 5, 18, 10)).not.toBe(tileCacheKey(topo, 5, 18, 10))
    })

    it("separates tiles by coordinate", () => {
      const osm = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      expect(tileCacheKey(osm, 5, 18, 10)).not.toBe(tileCacheKey(osm, 5, 18, 11))
      expect(tileCacheKey(osm, 5, 18, 10)).not.toBe(tileCacheKey(osm, 6, 18, 10))
    })
  })

  describe("selectEvictionVictims", () => {
    const meta = (n: number): { key: string; savedAt: number }[] =>
      Array.from({ length: n }, (_, i) => ({ key: `k${i}`, savedAt: i }))

    it("returns nothing when under the cap", () => {
      expect(selectEvictionVictims(meta(10), 20)).toEqual([])
    })

    it("returns nothing exactly at the cap", () => {
      expect(selectEvictionVictims(meta(20), 20)).toEqual([])
    })

    it("evicts oldest-first down to ~80% of the cap", () => {
      // cap 10, watermark 0.8 -> target 8; 13 entries -> delete 13-8=5 oldest
      expect(selectEvictionVictims(meta(13), 10)).toEqual(["k0", "k1", "k2", "k3", "k4"])
    })

    it("orders victims by savedAt, not insertion order", () => {
      const entries = [
        { key: "new", savedAt: 100 },
        { key: "old", savedAt: 1 },
        { key: "mid", savedAt: 50 },
      ]
      // cap 1, watermark 0.8 -> target 0; delete all 3, oldest first
      expect(selectEvictionVictims(entries, 1)).toEqual(["old", "mid", "new"])
    })

    it("uses the default cap constant when omitted", () => {
      expect(TILE_CACHE_CAP).toBeGreaterThan(0)
      expect(selectEvictionVictims(meta(5))).toEqual([])
    })
  })
})
