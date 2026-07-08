import { afterEach, describe, expect, it } from "vitest"
import { nextSavePackageFileName } from "./browserSaveFile"

const globalRecord = globalThis as unknown as Record<string, unknown>

describe("nextSavePackageFileName", () => {
  afterEach(() => {
    delete globalRecord.window
  })

  it("returns a UUID-based name outside the browser (no window global)", () => {
    expect(nextSavePackageFileName()).toMatch(/^gabriel-[0-9a-f-]+\.gpkg$/)
  })

  it("round-robins through a fixed pool of 8 names in the browser", () => {
    globalRecord.window = {}
    const names = Array.from({ length: 10 }, () => nextSavePackageFileName())

    for (const name of names) {
      expect(name).toMatch(/^gabriel-browser-save-\d\.gpkg$/)
    }
    // Cycles back to the same name after BROWSER_SAVE_FILE_POOL_SIZE (8) calls,
    // avoiding unbounded virtual-FS filename growth in the browser/sql.js runtime.
    expect(names[8]).toBe(names[0])
    expect(names[9]).toBe(names[1])
    expect(new Set(names.slice(0, 8)).size).toBe(8)
  })
})
