import { describe, expect, it } from "vitest"
import { decodeAdmiraltyCredibility, decodeAdmiraltyReliability, setSourceReliability } from "./admiralty"
import type { Source } from "./source"

describe("setSourceReliability", () => {
  const sources: Source[] = [
    { id: "src-1", url: "https://a.example", domainType: "web", reliability: null },
    { id: "src-2", url: "https://b.example", domainType: "web", reliability: null },
  ]

  it("sets the rating on the matching source only", () => {
    const result = setSourceReliability(sources, "src-1", "B")
    expect(result.find((s) => s.id === "src-1")?.reliability).toBe("B")
    expect(result.find((s) => s.id === "src-2")?.reliability).toBeNull()
  })

  it("clears a rating back to null", () => {
    const rated = setSourceReliability(sources, "src-1", "B")
    const cleared = setSourceReliability(rated, "src-1", null)
    expect(cleared.find((s) => s.id === "src-1")?.reliability).toBeNull()
  })

  it("is a no-op array-shaped change when the id doesn't match anything", () => {
    const result = setSourceReliability(sources, "src-missing", "A")
    expect(result).toEqual(sources)
  })
})

describe("decodeAdmiraltyReliability", () => {
  it("accepts every value in the closed A-F set", () => {
    for (const value of ["A", "B", "C", "D", "E", "F"]) {
      expect(decodeAdmiraltyReliability(value)).toBe(value)
    }
  })

  it("defaults an invalid persisted value to null rather than throwing", () => {
    expect(decodeAdmiraltyReliability("Z")).toBeNull()
    expect(decodeAdmiraltyReliability(null)).toBeNull()
    expect(decodeAdmiraltyReliability(undefined)).toBeNull()
    expect(decodeAdmiraltyReliability(123)).toBeNull()
  })
})

describe("decodeAdmiraltyCredibility", () => {
  it("accepts every value in the closed 1-6 set", () => {
    for (const value of [1, 2, 3, 4, 5, 6]) {
      expect(decodeAdmiraltyCredibility(value)).toBe(value)
    }
  })

  it("defaults an invalid persisted value to null rather than throwing", () => {
    expect(decodeAdmiraltyCredibility(0)).toBeNull()
    expect(decodeAdmiraltyCredibility(7)).toBeNull()
    expect(decodeAdmiraltyCredibility(null)).toBeNull()
    expect(decodeAdmiraltyCredibility("bogus")).toBeNull()
  })
})
