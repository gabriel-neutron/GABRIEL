import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { clearTiles, countTiles, deleteTile, getTile, pruneTileCache, putTile } from "./tileCache.service"

const pngBlob = (bytes: number[]): Blob => new Blob([new Uint8Array(bytes)], { type: "image/png" })

describe("tileCache.service", () => {
  beforeEach(async () => {
    await clearTiles()
  })

  it("round-trips a tile blob under a key", async () => {
    await putTile("osm|5/18/10", pngBlob([1, 2, 3]))
    const got = await getTile("osm|5/18/10")
    expect(got).toBeInstanceOf(Blob)
    expect(got?.size).toBe(3)
  })

  it("returns null for a missing key", async () => {
    await expect(getTile("does-not-exist")).resolves.toBeNull()
  })

  it("overwrites the same key without duplicating", async () => {
    await putTile("k", pngBlob([1]))
    await putTile("k", pngBlob([1, 2]))
    expect(await countTiles()).toBe(1)
    expect((await getTile("k"))?.size).toBe(2)
  })

  it("deletes a single poisoned tile without touching others", async () => {
    await putTile("good", pngBlob([1]))
    await putTile("bad", pngBlob([2]))
    await deleteTile("bad")
    expect(await getTile("bad")).toBeNull()
    expect(await getTile("good")).not.toBeNull()
    expect(await countTiles()).toBe(1)
  })

  it("prunes down to the watermark when over the cap", async () => {
    for (let i = 0; i < 5; i++) {
      await putTile(`k${i}`, pngBlob([i + 1]))
    }
    // cap 2, watermark 0.8 -> target 1; delete 5-1=4 oldest, leaving 1.
    await pruneTileCache(2)
    expect(await countTiles()).toBe(1)
  })

  it("does not prune when under the cap", async () => {
    await putTile("a", pngBlob([1]))
    await putTile("b", pngBlob([2]))
    await pruneTileCache(15_000)
    expect(await countTiles()).toBe(2)
  })
})
