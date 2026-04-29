import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { clearProject, loadProject, saveProject } from "./projectStorage.service"

describe("projectStorage.service", () => {
  beforeEach(async () => {
    await clearProject()
  })

  it("saves and loads a persisted project buffer", async () => {
    const source = new Uint8Array([1, 2, 3, 4]).buffer

    await saveProject(source, { fileName: "session.gpkg" })
    const loaded = await loadProject()

    expect(loaded).not.toBeNull()
    expect(loaded?.fileName).toBe("session.gpkg")
    expect(loaded?.buffer).toBeInstanceOf(ArrayBuffer)
    expect(Array.from(new Uint8Array(loaded?.buffer ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4])
  })

  it("returns null when no persisted session exists", async () => {
    await clearProject()
    await expect(loadProject()).resolves.toBeNull()
  })

  it("clears previously persisted session data", async () => {
    await saveProject(new Uint8Array([9, 8, 7]).buffer)
    await clearProject()

    const loaded = await loadProject()
    expect(loaded).toBeNull()
  })
})
