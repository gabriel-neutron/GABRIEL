import { describe, expect, it } from "vitest"
import { enterAction, nextActiveRow, NO_ACTIVE_ROW } from "./searchNavigation"

/**
 * The two decisions the shipped dropdown got wrong, driven in a browser on 2026-08-05: the arrow
 * keys did nothing, and Enter ran an online geocode while an exact name match sat at row 0.
 * There is no jsdom in this repository, so these are the only level at which either can be
 * asserted at all — which is why they are functions and not `if` statements in a handler.
 */

describe("nextActiveRow", () => {
  it("takes the first row from nothing highlighted, going down", () => {
    expect(nextActiveRow(NO_ACTIVE_ROW, 1, 5)).toBe(0)
  })

  it("takes the LAST row from nothing highlighted, going up", () => {
    // One key to the bottom of a short list, rather than `length` of them.
    expect(nextActiveRow(NO_ACTIVE_ROW, -1, 5)).toBe(4)
  })

  it("wraps at both ends", () => {
    expect(nextActiveRow(4, 1, 5)).toBe(0)
    expect(nextActiveRow(0, -1, 5)).toBe(4)
  })

  it("moves one row at a time in the middle", () => {
    expect(nextActiveRow(2, 1, 5)).toBe(3)
    expect(nextActiveRow(2, -1, 5)).toBe(1)
  })

  it("highlights nothing in an empty list rather than row 0", () => {
    // Row 0 of an empty list is a row that is not on screen, and Enter would then select it.
    expect(nextActiveRow(NO_ACTIVE_ROW, 1, 0)).toBe(NO_ACTIVE_ROW)
    expect(nextActiveRow(3, 1, 0)).toBe(NO_ACTIVE_ROW)
  })

  it("stays inside a list of one", () => {
    expect(nextActiveRow(0, 1, 1)).toBe(0)
    expect(nextActiveRow(0, -1, 1)).toBe(0)
  })
})

describe("enterAction", () => {
  it("takes the highlighted row", () => {
    expect(enterAction(2, 5)).toEqual({ kind: "select", index: 2 })
  })

  it("takes the top row when nothing is highlighted", () => {
    // The defect this replaces: with "Rostec State Corporation" at row 0, Enter fetched a
    // technical college in Pretoria and a restaurant in Lombardy from Nominatim instead.
    expect(enterAction(NO_ACTIVE_ROW, 5)).toEqual({ kind: "select", index: 0 })
  })

  it("reaches the network only when the query matched nothing at all", () => {
    expect(enterAction(NO_ACTIVE_ROW, 0)).toEqual({ kind: "online" })
    expect(enterAction(3, 0)).toEqual({ kind: "online" })
  })

  it("falls back to the top row rather than selecting past the end of the list", () => {
    // A stale highlight must never index outside the rows: the caller would read `undefined`
    // and silently do nothing, which reads to the analyst exactly like a broken Enter key.
    expect(enterAction(9, 3)).toEqual({ kind: "select", index: 0 })
  })
})
