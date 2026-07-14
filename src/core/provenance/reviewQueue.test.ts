import { describe, expect, it } from "vitest"
import { assignCredibility, confirmCredibility, needsReview, refuteCredibility } from "./reviewQueue"
import type { Source } from "./source"
import type { Claim } from "./claim"

function source(overrides: Partial<Source> = {}): Source {
  return { id: "src-1", url: "https://a.example", domainType: "news", reliability: "D", ...overrides }
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null, ...overrides }
}

describe("needsReview", () => {
  it("flags a reliability at D or worse", () => {
    expect(needsReview({ source: source({ reliability: "D" }), claim: null })).toBe(true)
    expect(needsReview({ source: source({ reliability: "F" }), claim: null })).toBe(true)
  })

  it("does not flag a C reliability with no other signal", () => {
    expect(needsReview({ source: source({ reliability: "C" }), claim: null })).toBe(false)
  })

  it("flags low assessor confidence", () => {
    const withLowConfidence = source({
      reliability: "C",
      reliabilityMeta: { confidence: 0.2, rationale: null, assessor: { kind: "type-table" }, updatedAt: "t", overridden: false },
    })
    expect(needsReview({ source: withLowConfidence, claim: null })).toBe(true)
  })

  it("flags single-cluster corroboration on the claim", () => {
    const c = claim({
      credibilityMeta: { confidence: 0.8, rationale: null, assessor: { kind: "ai" }, updatedAt: "t", overridden: false, evidenceRefs: ["u"], corroborationClusters: 1, statedAttribution: null },
    })
    expect(needsReview({ source: source({ reliability: "C" }), claim: c })).toBe(true)
  })

  it("flags an interested-party source as sole origin", () => {
    expect(needsReview({ source: source({ reliability: "C", interestedParty: true }), claim: null })).toBe(true)
  })

  it("flags a contradicted claim (credibility 4 or 5)", () => {
    expect(needsReview({ source: source({ reliability: "C" }), claim: claim({ credibility: 4 }) })).toBe(true)
    expect(needsReview({ source: source({ reliability: "C" }), claim: claim({ credibility: 5 }) })).toBe(true)
  })

  it("does not flag a clean C-reliability, multi-cluster, non-contradicted claim", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: { confidence: 0.9, rationale: null, assessor: { kind: "ai" }, updatedAt: "t", overridden: false, evidenceRefs: ["u1", "u2"], corroborationClusters: 2, statedAttribution: null },
    })
    expect(needsReview({ source: source({ reliability: "C" }), claim: c })).toBe(false)
  })

  it("flags a well-corroborated claim eligible for Confirm (credibility 2, >=2 clusters, dated evidence) so the action is reachable", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: { confidence: 0.9, rationale: null, assessor: { kind: "ai" }, updatedAt: "t", overridden: false, evidenceRefs: ["u1", "u2"], corroborationClusters: 2, statedAttribution: null, dates: ["2026-01-01"] },
    })
    expect(needsReview({ source: source({ reliability: "C" }), claim: c })).toBe(true)
  })

  it("no longer flags an overridden claim's low-confidence/single-cluster signals", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: { confidence: 0.1, rationale: null, assessor: { kind: "analyst" }, updatedAt: "t", overridden: true, evidenceRefs: ["u"], corroborationClusters: 1, statedAttribution: null },
    })
    expect(needsReview({ source: source({ reliability: "C" }), claim: c })).toBe(false)
  })

  it("no longer flags an overridden source's reliability-floor/low-confidence signals", () => {
    const s = source({
      reliability: "F",
      reliabilityMeta: { confidence: 0.1, rationale: null, assessor: { kind: "analyst" }, updatedAt: "t", overridden: true },
    })
    expect(needsReview({ source: s, claim: null })).toBe(false)
  })

  it("still flags an interested-party source even after its reliability was overridden — interestedParty is structural, not resolved by an override", () => {
    const s = source({
      reliability: "B",
      interestedParty: true,
      reliabilityMeta: { confidence: 0.9, rationale: null, assessor: { kind: "analyst" }, updatedAt: "t", overridden: true },
    })
    expect(needsReview({ source: s, claim: null })).toBe(true)
  })

  it("still flags a contradicted claim even after being refuted — contradiction is the model's standing finding, unaffected by refuteCredibility", () => {
    const c = claim({
      credibility: 4,
      credibilityMeta: { confidence: 0.5, rationale: null, assessor: { kind: "analyst" }, updatedAt: "t", overridden: true, evidenceRefs: ["u"], corroborationClusters: 2, statedAttribution: null },
    })
    expect(needsReview({ source: source({ reliability: "C" }), claim: c })).toBe(true)
  })
})

describe("assignCredibility", () => {
  const baseClaim: Claim = { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }
  const result = { credibility: 2 as const, meta: { confidence: 0.8, rationale: "r", assessor: { kind: "ai" as const, model: "gpt", promptVersion: "v1" }, updatedAt: "2026-07-14T00:00:00.000Z", overridden: false, evidenceRefs: ["https://a.example"], corroborationClusters: 1, statedAttribution: null } }

  it("stamps credibility and credibilityMeta on every claim", () => {
    const [stamped] = assignCredibility([baseClaim], result)
    expect(stamped!.credibility).toBe(2)
    expect(stamped!.credibilityMeta).toEqual(result.meta)
  })

  it("skips a claim already marked overridden by a human", () => {
    const overridden: Claim = { ...baseClaim, credibility: 1, credibilityMeta: { ...result.meta, overridden: true, assessor: { kind: "analyst" } } }
    const [kept] = assignCredibility([overridden], result)
    expect(kept).toEqual(overridden)
  })

  it("returns claims unchanged when there is no assessment result", () => {
    expect(assignCredibility([baseClaim], null)).toEqual([baseClaim])
  })
})

describe("confirmCredibility", () => {
  it("promotes an eligible claim (>=2 clusters, dated evidence) to credibility 1", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: {
        confidence: 0.8,
        rationale: "r",
        assessor: { kind: "ai" },
        updatedAt: "t",
        overridden: false,
        evidenceRefs: ["https://a.example", "https://b.example"],
        corroborationClusters: 2,
        statedAttribution: null,
        dates: ["2026-01-01"],
      },
    })
    const [confirmed] = confirmCredibility([c], "c-1")
    expect(confirmed!.credibility).toBe(1)
    expect(confirmed!.credibilityMeta?.overridden).toBe(true)
    expect(confirmed!.credibilityMeta?.assessor).toEqual({ kind: "analyst" })
  })

  it("refuses to promote a single-cluster claim, leaving it unchanged", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: { confidence: 0.8, rationale: "r", assessor: { kind: "ai" }, updatedAt: "t", overridden: false, evidenceRefs: ["a"], corroborationClusters: 1, statedAttribution: null, dates: ["2026-01-01"] },
    })
    expect(confirmCredibility([c], "c-1")).toEqual([c])
  })

  it("refuses to promote a multi-cluster claim with no dated evidence", () => {
    const c = claim({
      credibility: 2,
      credibilityMeta: { confidence: 0.8, rationale: "r", assessor: { kind: "ai" }, updatedAt: "t", overridden: false, evidenceRefs: ["a", "b"], corroborationClusters: 2, statedAttribution: null, dates: [] },
    })
    expect(confirmCredibility([c], "c-1")).toEqual([c])
  })

  it("is a no-op for a claim id that doesn't match", () => {
    const c = claim()
    expect(confirmCredibility([c], "missing")).toEqual([c])
  })
})

describe("refuteCredibility", () => {
  it("marks a claim overridden without changing its numeric credibility", () => {
    const c = claim({ credibility: 2 })
    const [refuted] = refuteCredibility([c], "c-1")
    expect(refuted!.credibility).toBe(2)
    expect(refuted!.credibilityMeta?.overridden).toBe(true)
    expect(refuted!.credibilityMeta?.assessor).toEqual({ kind: "analyst" })
  })

  it("is a no-op for a claim id that doesn't match", () => {
    const c = claim()
    expect(refuteCredibility([c], "missing")).toEqual([c])
  })
})
