import { describe, expect, it } from "vitest"
import {
  createCitationClaim,
  createFieldClaim,
  filterCitationClaims,
  GENERAL_CITATION_FIELD,
  groupCitationClaimsByEntityId,
  type Claim,
} from "./claim"

describe("createFieldClaim", () => {
  it("creates a claim for a specific field/value pair, distinct from the general-citation sentinel", () => {
    const claim = createFieldClaim("e-1", "src-1", "echelon", "Brigade")
    expect(claim.field).toBe("echelon")
    expect(claim.value).toBe("Brigade")
    expect(claim.entityId).toBe("e-1")
    expect(claim.sourceId).toBe("src-1")
    expect(claim.credibility).toBeNull()
  })
})

describe("createCitationClaim", () => {
  it("still produces the general-citation sentinel shape (field=sources, value=null)", () => {
    const claim = createCitationClaim("e-1", "src-1")
    expect(claim.field).toBe(GENERAL_CITATION_FIELD)
    expect(claim.value).toBeNull()
  })
})

describe("Phase 6 (v2, exploratory): per-field claims coexist with general-citation claims", () => {
  it("filterCitationClaims/groupCitationClaimsByEntityId ignore a per-field claim entirely, without needing any change", () => {
    const citation = createCitationClaim("e-1", "src-1")
    const fieldClaim = createFieldClaim("e-1", "src-2", "echelon", "Brigade")
    const claims: Claim[] = [citation, fieldClaim]

    expect(filterCitationClaims(claims, "e-1")).toEqual([citation])
    expect(groupCitationClaimsByEntityId(claims).get("e-1")).toEqual([citation])
  })

  it("a per-field claim can carry its own credibility, independent of the entity's general citations", () => {
    const citation = createCitationClaim("e-1", "src-1")
    const fieldClaim: Claim = { ...createFieldClaim("e-1", "src-2", "echelon", "Brigade"), credibility: 2 }

    expect(citation.credibility).toBeNull()
    expect(fieldClaim.credibility).toBe(2)
  })
})
