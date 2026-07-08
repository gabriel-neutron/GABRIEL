import { describe, expect, it } from "vitest"
import { computeEntityRichness, shouldSkipEntity, DEFAULT_RICHNESS_THRESHOLD } from "./entity-richness"
import type { MapEntity } from "@/types/domain.types"
import { GENERAL_CITATION_FIELD, type Claim } from "@/core/provenance/claim"

const baseEntity: MapEntity = {
  kind: "unit",
  id: "e1",
  name: "Test",
  layerId: "l1",
  parentId: null,
}

function citationClaim(entityId: string): Claim {
  return {
    id: crypto.randomUUID(),
    entityId,
    field: GENERAL_CITATION_FIELD,
    value: null,
    sourceId: "s1",
    credibility: null,
    timestamp: null,
  }
}

describe("computeEntityRichness", () => {
  it("scores 2 points per citation claim belonging to the entity", () => {
    const claims = [citationClaim("e1"), citationClaim("e1"), citationClaim("e1")]
    expect(computeEntityRichness(baseEntity, claims)).toBe(6)
  })

  it("ignores claims belonging to a different entity", () => {
    const claims = [citationClaim("other-entity")]
    expect(computeEntityRichness(baseEntity, claims)).toBe(0)
  })

  it("ignores claims with a different field", () => {
    const claims: Claim[] = [{ ...citationClaim("e1"), field: "notes" }]
    expect(computeEntityRichness(baseEntity, claims)).toBe(0)
  })

  it("adds 1 point each for notes, militaryUnitId, and osmRelationId", () => {
    const richEntity: MapEntity = {
      ...baseEntity,
      notes: "some notes",
      militaryUnitId: "mun-1",
      osmRelationId: 42,
    }
    expect(computeEntityRichness(richEntity, [])).toBe(3)
  })

  it("does not count duplicate URLs as one — a raw claim count, not deduplicated", () => {
    // Preserves pre-E2.6 behavior where a raw-string split counted duplicate lines too.
    const claims = [citationClaim("e1"), citationClaim("e1")]
    expect(computeEntityRichness(baseEntity, claims)).toBe(4)
  })
})

describe("shouldSkipEntity", () => {
  it("returns false when threshold is 0 (never skip), regardless of richness", () => {
    const claims = [citationClaim("e1"), citationClaim("e1"), citationClaim("e1")]
    expect(shouldSkipEntity(baseEntity, claims, 0)).toBe(false)
  })

  it("returns true when the score meets the threshold", () => {
    const claims = [citationClaim("e1"), citationClaim("e1"), citationClaim("e1")]
    expect(shouldSkipEntity(baseEntity, claims, DEFAULT_RICHNESS_THRESHOLD)).toBe(true)
  })

  it("returns false when the score is below the threshold", () => {
    const claims = [citationClaim("e1")]
    expect(shouldSkipEntity(baseEntity, claims, DEFAULT_RICHNESS_THRESHOLD)).toBe(false)
  })

  it("defaults to DEFAULT_RICHNESS_THRESHOLD when no threshold is given", () => {
    const claims = [citationClaim("e1"), citationClaim("e1"), citationClaim("e1")]
    expect(shouldSkipEntity(baseEntity, claims)).toBe(true)
  })
})
