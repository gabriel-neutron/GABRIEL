/**
 * Pure tile-cache logic — no React, no DOM, no IndexedDB. Cache-key derivation and
 * eviction victim-selection live here so they stay unit-testable in node; the
 * IndexedDB adapter (`tileCache.service`) and the Leaflet layer (`CachedTileLayer`)
 * are thin wrappers around this.
 */

/** Max number of tiles kept before oldest-first pruning kicks in (~a few Russia work-zones). */
export const TILE_CACHE_CAP = 15_000

/**
 * Stable per-provider namespace, independent of the `{s}` subdomain rotation, so the
 * `a.`/`b.`/`c.` variants of one tile share a single cache entry, and two providers
 * sharing an identical URL template (the Esri base of `satellite` + `hybrid`) share keys.
 */
export function providerTag(urlTemplate: string): string {
  return urlTemplate.replace(/\{s\}\.?/g, "")
}

/** Cache key for a tile: provider namespace + z/x/y. */
export function tileCacheKey(urlTemplate: string, z: number, x: number, y: number): string {
  return `${providerTag(urlTemplate)}|${z}/${x}/${y}`
}

export interface TileMeta {
  key: string
  savedAt: number
}

/**
 * Given every cached tile's key + savedAt and a count cap, return the keys to delete
 * (oldest first) to bring the cache down to ~80% of the cap. Empty when at or under cap.
 */
export function selectEvictionVictims(
  entries: TileMeta[],
  cap: number = TILE_CACHE_CAP,
  watermark = 0.8,
): string[] {
  if (entries.length <= cap) return []
  const target = Math.floor(cap * watermark)
  const oldestFirst = [...entries].sort((a, b) => a.savedAt - b.savedAt)
  return oldestFirst.slice(0, entries.length - target).map((entry) => entry.key)
}
