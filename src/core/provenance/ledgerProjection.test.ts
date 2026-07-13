import { describe, expect, it } from "vitest"
import { projectEntityLedger } from "./ledgerProjection"
import type { Claim } from "./claim"
import type { Source } from "./source"

describe("projectEntityLedger", () => {
  const sources: Source[] = [
    { id: "src-1", url: "https://a.example", domainType: "web", reliability: null },
    { id: "src-2", url: "https://b.example", domainType: "web", reliability: null },
  ]

  it("returns URLs for the given entity's claims in first-seen order", () => {
    const claims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-2", credibility: null, timestamp: null },
      { id: "c-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    expect(projectEntityLedger("e-1", claims, sources)).toEqual(["https://b.example", "https://a.example"])
  })

  it("ignores claims belonging to other entities", () => {
    const claims: Claim[] = [
      { id: "c-1", entityId: "e-2", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    expect(projectEntityLedger("e-1", claims, sources)).toEqual([])
  })

  it("deduplicates repeated claims pointing at the same source", () => {
    const claims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      { id: "c-2", entityId: "e-1", field: "notes", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    expect(projectEntityLedger("e-1", claims, sources)).toEqual(["https://a.example"])
  })

  it("skips a claim whose source id no longer resolves", () => {
    const claims: Claim[] = [
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-missing", credibility: null, timestamp: null },
    ]
    expect(projectEntityLedger("e-1", claims, sources)).toEqual([])
  })
})
