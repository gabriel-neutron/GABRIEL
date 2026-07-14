import { describe, expect, it, vi } from "vitest"
import { assessEntityCredibility, selectCitationsForClaims } from "./credibility.service"
import type { EnrichmentSource, EnrichmentProposal } from "@/types/enrichment.types"
import type { Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"

function citation(overrides: Partial<EnrichmentSource> = {}): EnrichmentSource {
  return { url: "https://a.example", title: "A", snippet: "The unit relocated to a new garrison.", domainType: "news", ...overrides }
}

function proposal(citations: EnrichmentSource[]): EnrichmentProposal {
  return { field: "sources", currentValue: null, proposedValue: null, reasoning: "", citations }
}

describe("assessEntityCredibility", () => {
  it("Phase 6: assesses a per-field claim (e.g. echelon) exactly like the general-citation field — field/value are plain parameters, not hardcoded to 'sources'", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({ credibility: 6, contradicted: false, positivelyContradicted: false, statedAttribution: null, confidence: 0.6, rationale: "single field-level source" }),
    }
    const result = await assessEntityCredibility({
      entityName: "1GTA",
      field: "echelon",
      value: "Brigade",
      citations: [citation()],
      model,
    })
    expect(result?.credibility).toBe(2) // still capped by the single-cluster rule, same as the general path
    expect(model.assessCredibility).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ field: "echelon", value: "Brigade" }),
      undefined,
    )
  })

  it("returns null without calling the model when there are no citations", async () => {
    const model = { assessCredibility: vi.fn() }
    const result = await assessEntityCredibility({ entityName: "1GTA", field: "sources", value: null, citations: [], model })
    expect(result).toBeNull()
    expect(model.assessCredibility).not.toHaveBeenCalled()
  })

  it("clamps a single-cluster corroboration at 2, regardless of what the model suggests", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({ credibility: 1, contradicted: false, positivelyContradicted: false, statedAttribution: null, confidence: 0.8, rationale: "one source" }),
    }
    const result = await assessEntityCredibility({
      entityName: "1GTA",
      field: "sources",
      value: null,
      citations: [citation()],
      model,
    })
    expect(result?.credibility).toBe(2)
    expect(result?.meta.assessor).toMatchObject({ kind: "ai" })
    expect(result?.meta.overridden).toBe(false)
  })

  it("computes corroborationClusters deterministically from the citations, not from the model's own claim", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({ credibility: 5, contradicted: false, positivelyContradicted: false, statedAttribution: null, confidence: 0.9, rationale: "many sources" }),
    }
    // Two near-duplicate citations: one real cluster despite two URLs, and the model's
    // generous credibility=5 is still capped by our own count, not the model's opinion.
    const result = await assessEntityCredibility({
      entityName: "1GTA",
      field: "sources",
      value: null,
      citations: [
        citation({ url: "https://a.example", snippet: "The 42nd division redeployed to the border region." }),
        citation({ url: "https://mirror.example", snippet: "The 42nd division redeployed to the border region." }),
      ],
      model,
    })
    expect(result?.meta.corroborationClusters).toBe(1)
    expect(result?.credibility).toBe(2)
  })

  it("caps a contradicted claim at 4, or 5 when positively contradicted", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({ credibility: 6, contradicted: true, positivelyContradicted: true, statedAttribution: null, confidence: 0.5, rationale: "conflicting reports, but later evidence favors one side" }),
    }
    const result = await assessEntityCredibility({
      entityName: "1GTA",
      field: "sources",
      value: null,
      citations: [citation(), citation({ url: "https://b.example" })],
      model,
    })
    expect(result?.credibility).toBe(5)
  })

  it("Phase 5: carries the model's stated-attribution chain and citation dates through to meta unmodified", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({
        credibility: 2,
        contradicted: false,
        positivelyContradicted: false,
        statedAttribution: "according to a Ukrainian General Staff statement, citing local police",
        confidence: 0.7,
        rationale: "single sourced chain of attribution",
      }),
    }
    const result = await assessEntityCredibility({
      entityName: "1GTA",
      field: "sources",
      value: null,
      citations: [citation({ publishedAt: "2026-06-01" }), citation({ url: "https://b.example", publishedAt: undefined })],
      model,
    })
    expect(result?.meta.statedAttribution).toBe("according to a Ukrainian General Staff statement, citing local police")
    // Only the citation with a real publishedAt contributes a date — an absent date isn't backfilled as a fake one.
    expect(result?.meta.dates).toEqual(["2026-06-01"])
  })

  it("never returns credibility 1 even when the model tries", async () => {
    const model = {
      assessCredibility: vi.fn().mockResolvedValue({ credibility: 1, contradicted: false, positivelyContradicted: false, statedAttribution: null, confidence: 1, rationale: "confirmed" }),
    }
    const result = await assessEntityCredibility({ entityName: "1GTA", field: "sources", value: null, citations: [citation()], model })
    expect(result?.credibility).not.toBe(1)
  })
})

describe("selectCitationsForClaims", () => {
  it("includes a claim's citation even when its Source was reused (not newly minted) — regression for the citation-scoping bug", () => {
    const reusedSource: Source = { id: "src-reused", url: "https://reused.example", domainType: "news", reliability: null }
    const newClaims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-reused", credibility: null, timestamp: null },
    ]
    // sources passed in covers BOTH newly-minted and reused sources — the fix.
    const result = selectCitationsForClaims(
      newClaims,
      [reusedSource],
      [proposal([citation({ url: "https://reused.example", snippet: "reused source citation text" })])],
    )
    expect(result.map((c) => c.url)).toEqual(["https://reused.example"])
  })

  it("resolves citations for a mix of newly-minted and reused sources", () => {
    const freshSource: Source = { id: "src-fresh", url: "https://fresh.example", domainType: "news", reliability: null }
    const reusedSource: Source = { id: "src-reused", url: "https://reused.example", domainType: "news", reliability: null }
    const newClaims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-fresh", credibility: null, timestamp: null },
      { id: "c-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-reused", credibility: null, timestamp: null },
    ]
    const result = selectCitationsForClaims(
      newClaims,
      [freshSource, reusedSource],
      [proposal([citation({ url: "https://fresh.example" }), citation({ url: "https://reused.example" })])],
    )
    expect(result.map((c) => c.url).sort()).toEqual(["https://fresh.example", "https://reused.example"])
  })

  it("returns no citations when no claim's source resolves to a known URL", () => {
    const result = selectCitationsForClaims(
      [{ id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "missing", credibility: null, timestamp: null }],
      [],
      [proposal([citation()])],
    )
    expect(result).toEqual([])
  })

  it("deduplicates a URL cited by multiple proposals", () => {
    const source: Source = { id: "src-1", url: "https://a.example", domainType: "news", reliability: null }
    const newClaims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    const result = selectCitationsForClaims(
      newClaims,
      [source],
      [proposal([citation()]), proposal([citation({ title: "duplicate" })])],
    )
    expect(result).toHaveLength(1)
  })
})
