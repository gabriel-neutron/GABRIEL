import { describe, expect, it } from "vitest"
import { backfillReliability } from "@/core/provenance/reliabilityTable"
import { assessEntityCredibility } from "./credibility.service"
import type { Source } from "@/core/provenance/source"
import type { EnrichmentSource } from "@/types/enrichment.types"

/**
 * Phase 5 (v1.5): proves the ratings aren't decoration. Baker et al. (1968) found 87%
 * of NATO ratings land on the reliability×credibility diagonal (A1/B2/C3) because
 * raters let one axis leak into the other. Gabriel's caps (ADR 0008/0009) make that
 * diagonal structurally unreachable by the machine path — `A`/`B` need a human
 * override, `1` needs a human Confirm — so this fixture runs three archetypal cases
 * through the real deterministic + AI pipeline and asserts none of them land there,
 * regardless of how strong the underlying evidence looks.
 */

type EvalCase = {
  label: string
  source: Source
  citations: EnrichmentSource[]
  /** What the (mocked) AI is generous enough to suggest — deliberately optimistic, to prove the cap (not the model) is what holds the line. */
  aiSuggestedCredibility: number
}

function citation(overrides: Partial<EnrichmentSource>): EnrichmentSource {
  return { url: "https://a.example", title: "A", snippet: "default snippet text", domainType: "news", ...overrides }
}

const EVAL_CASES: EvalCase[] = [
  {
    // "Oryx-confirmed": a strong OSINT case — two genuinely independent outlets,
    // distinct wording, no interested party. The best evidence Gabriel can see.
    label: "oryx-confirmed (strong OSINT, 2 independent sources)",
    source: { id: "src-oryx", url: "https://oryxspioenkop.com/2026/loss-report", domainType: "osint", reliability: null },
    citations: [
      citation({ url: "https://oryxspioenkop.com/2026/loss-report", snippet: "Visual evidence confirms the vehicle was destroyed near the treeline, geolocated to grid reference alpha." }),
      citation({ url: "https://bellingcat.com/2026/verification", snippet: "Independent satellite imagery analysis corroborates the loss at the same coordinates, dated one day later." }),
    ],
    aiSuggestedCredibility: 6, // optimistic model guess — the cap, not the model, must hold this at 2
  },
  {
    // "debunked-MoD": a belligerent MoD press release — authoritative on provenance
    // (the ministry really did say this), interested on content, sole origin.
    label: "debunked-mod (interested party, sole origin)",
    source: { id: "src-mod", url: "https://function.mil.ru/news/2026/press-release", domainType: "official", reliability: null },
    citations: [
      citation({ url: "https://function.mil.ru/news/2026/press-release", snippet: "The ministry announced a successful operation with no losses reported on its side." }),
    ],
    aiSuggestedCredibility: 3,
  },
  {
    // "known-recycled-footage": one wire dispatch reposted across 5 domains —
    // many URLs, one real origin. Must not inflate credibility via URL count.
    label: "known-recycled-footage (wire-syndicated across 5 domains)",
    source: { id: "src-wire", url: "https://outlet-0.example/article", domainType: "news", reliability: null },
    citations: Array.from({ length: 5 }, (_, i) =>
      citation({
        url: `https://outlet-${i}.example/article`,
        snippet: "Footage circulating online shows the same convoy previously documented in an unrelated 2024 incident, now miscaptioned as current.",
      }),
    ),
    aiSuggestedCredibility: 5,
  },
]

describe("diagonal-collapse eval fixture (ADR 0008/0009)", () => {
  it("no machine-rated case lands on the A1/B2/C3 diagonal, however strong the evidence looks", async () => {
    const results: { label: string; reliability: string | null; credibility: number | null }[] = []

    for (const evalCase of EVAL_CASES) {
      const [rated] = backfillReliability([evalCase.source])
      const model = {
        assessCredibility: async () => ({
          credibility: evalCase.aiSuggestedCredibility,
          contradicted: false,
          positivelyContradicted: false,
          statedAttribution: null,
          confidence: 0.9,
          rationale: "eval fixture",
        }),
      }
      const assessment = await assessEntityCredibility({
        entityName: evalCase.label,
        field: "sources",
        value: null,
        citations: evalCase.citations,
        model,
      })
      results.push({ label: evalCase.label, reliability: rated!.reliability, credibility: assessment?.credibility ?? null })
    }

    const diagonalPairs = new Set(["A-1", "B-2", "C-3"])
    for (const r of results) {
      expect(diagonalPairs.has(`${r.reliability}-${r.credibility}`)).toBe(false)
      // The categorical guarantee, not just the specific diagonal: A/B and 1 are unreachable by the machine path at all.
      expect(r.reliability).not.toBe("A")
      expect(r.reliability).not.toBe("B")
      expect(r.credibility).not.toBe(1)
    }
  })

  it("the recycled-footage case collapses its 5 mirrored URLs to one cluster and does not inflate credibility above 2", async () => {
    const wireCase = EVAL_CASES[2]!
    const model = {
      assessCredibility: async () => ({
        credibility: wireCase.aiSuggestedCredibility,
        contradicted: false,
        positivelyContradicted: false,
        statedAttribution: null,
        confidence: 0.9,
        rationale: "eval fixture",
      }),
    }
    const assessment = await assessEntityCredibility({
      entityName: wireCase.label,
      field: "sources",
      value: null,
      citations: wireCase.citations,
      model,
    })
    expect(assessment?.meta.corroborationClusters).toBe(1)
    expect(assessment?.credibility).toBe(2)
  })

  it("the debunked-MoD case is flagged interested-party and capped below its bare type-table letter", () => {
    const modCase = EVAL_CASES[1]!
    const [rated] = backfillReliability([modCase.source])
    expect(rated!.interestedParty).toBe(true)
    // official's bare type-table letter is C; the interested-party flag must knock it down.
    expect(rated!.reliability).not.toBe("C")
  })
})
