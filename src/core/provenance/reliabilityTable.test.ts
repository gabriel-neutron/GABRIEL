import { describe, expect, it } from "vitest"
import { backfillReliability, getReliabilityFromType, RELIABILITY_MAPPING_VERSION } from "./reliabilityTable"
import type { Source } from "./source"

describe("getReliabilityFromType", () => {
  it("caps official and osint sources at C (never A/B, per ADR 0008)", () => {
    expect(getReliabilityFromType("official")).toBe("C")
    expect(getReliabilityFromType("osint")).toBe("C")
  })

  it("rates news and wikipedia D", () => {
    expect(getReliabilityFromType("news")).toBe("D")
    expect(getReliabilityFromType("wikipedia")).toBe("D")
  })

  it("rates social/forum/web/unknown F, a neutral 'cannot be judged' abstention rather than E", () => {
    expect(getReliabilityFromType("social")).toBe("F")
    expect(getReliabilityFromType("forum")).toBe("F")
    expect(getReliabilityFromType("web")).toBe("F")
    expect(getReliabilityFromType(null)).toBe("F")
  })
})

describe("RELIABILITY_MAPPING_VERSION", () => {
  it("is a non-empty version stamp", () => {
    expect(RELIABILITY_MAPPING_VERSION.length).toBeGreaterThan(0)
  })
})

describe("backfillReliability", () => {
  it("fills a null-reliability source with the type-table letter, stamped type-table/mappingVersion", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://gov.uk/a", domainType: "official", reliability: null }]
    const [result] = backfillReliability(sources)
    expect(result!.reliability).toBe("C")
    expect(result!.reliabilityMeta?.assessor).toEqual({ kind: "type-table", mappingVersion: RELIABILITY_MAPPING_VERSION })
    expect(result!.reliabilityMeta?.mappingVersion).toBe(RELIABILITY_MAPPING_VERSION)
    expect(result!.reliabilityMeta?.overridden).toBe(false)
  })

  it("never touches a source that already has a reliability letter (human or prior)", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://a.example", domainType: "web", reliability: "A" }]
    expect(backfillReliability(sources)).toEqual(sources)
  })

  it("is idempotent: re-running after a first backfill changes nothing", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://gov.uk/a", domainType: "official", reliability: null }]
    const first = backfillReliability(sources)
    expect(backfillReliability(first)).toEqual(first)
  })

  it("flags an interested-party source and caps its prior one notch below the bare type-table letter", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://tass.com/a", domainType: "official", reliability: null }]
    const [result] = backfillReliability(sources)
    expect(result!.interestedParty).toBe(true)
    expect(result!.reliability).toBe("D")
  })
})
