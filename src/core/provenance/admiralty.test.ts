import { describe, expect, it } from "vitest"
import { clampCredibility, decodeAdmiraltyCredibility, decodeAdmiraltyReliability, setSourceReliability } from "./admiralty"
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

  it("marks a set rating as a human override (ADR 0009: A/B reachable only this way)", () => {
    const result = setSourceReliability(sources, "src-1", "B")
    const meta = result.find((s) => s.id === "src-1")?.reliabilityMeta
    expect(meta?.overridden).toBe(true)
    expect(meta?.assessor).toEqual({ kind: "analyst" })
  })

  it("clears a rating back to null", () => {
    const rated = setSourceReliability(sources, "src-1", "B")
    const cleared = setSourceReliability(rated, "src-1", null)
    expect(cleared.find((s) => s.id === "src-1")?.reliability).toBeNull()
  })

  it("clears reliabilityMeta along with the rating", () => {
    const rated = setSourceReliability(sources, "src-1", "B")
    const cleared = setSourceReliability(rated, "src-1", null)
    expect(cleared.find((s) => s.id === "src-1")?.reliabilityMeta).toBeUndefined()
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

describe("clampCredibility", () => {
  it("never returns 1, even if the AI suggests it (ADR 0009: 1 is human-only)", () => {
    expect(clampCredibility(1, { hasBasis: true, clusterCount: 3, contradicted: false })).toBeGreaterThanOrEqual(2)
  })

  it("caps a single-cluster corroboration at 2", () => {
    expect(clampCredibility(1, { hasBasis: true, clusterCount: 1, contradicted: false })).toBe(2)
    expect(clampCredibility(6, { hasBasis: true, clusterCount: 1, contradicted: false })).toBe(2)
  })

  it("caps multi-cluster, uncontradicted corroboration at 2 too — 1 stays human-only regardless of cluster count", () => {
    expect(clampCredibility(1, { hasBasis: true, clusterCount: 4, contradicted: false })).toBe(2)
  })

  it("caps a contradicted claim at 4, or 5 when positively contradicted", () => {
    expect(clampCredibility(6, { hasBasis: true, clusterCount: 2, contradicted: true })).toBe(4)
    expect(clampCredibility(6, { hasBasis: true, clusterCount: 2, contradicted: true, positivelyContradicted: true })).toBe(5)
  })

  it("returns 6 (abstention) when there is no basis at all, regardless of the AI's suggestion", () => {
    expect(clampCredibility(2, { hasBasis: false, clusterCount: 0, contradicted: false })).toBe(6)
  })

  it("floors an out-of-range or non-numeric AI suggestion at the scenario's minimum (2)", () => {
    expect(clampCredibility(Number.NaN, { hasBasis: true, clusterCount: 1, contradicted: false })).toBe(2)
    expect(clampCredibility(-5, { hasBasis: true, clusterCount: 1, contradicted: false })).toBe(2)
  })
})
