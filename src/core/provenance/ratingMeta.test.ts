import { describe, expect, it } from "vitest"
import { decodeRatingMeta, encodeRatingMeta, type RatingMeta } from "./ratingMeta"

describe("ratingMeta", () => {
  it("round-trips a rating meta value through encode -> decode", () => {
    const meta: RatingMeta = {
      confidence: 0.6,
      rationale: "official domain, type-table prior",
      assessor: { kind: "type-table", mappingVersion: "v1" },
      mappingVersion: "v1",
      updatedAt: "2026-07-14T00:00:00.000Z",
      overridden: false,
    }
    expect(decodeRatingMeta(encodeRatingMeta(meta))).toEqual(meta)
  })

  it("encodes undefined as null", () => {
    expect(encodeRatingMeta(undefined)).toBeNull()
  })

  it("decodes null/undefined as undefined", () => {
    expect(decodeRatingMeta(null)).toBeUndefined()
    expect(decodeRatingMeta(undefined)).toBeUndefined()
  })

  it("decodes invalid JSON as undefined rather than throwing", () => {
    expect(decodeRatingMeta("{not json")).toBeUndefined()
  })
})
