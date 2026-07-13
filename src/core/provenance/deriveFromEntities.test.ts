import { describe, expect, it } from "vitest"
import { deriveProvenanceFromEntities } from "./deriveFromEntities"
import type { Source } from "./source"
import type { Claim } from "./claim"

describe("deriveProvenanceFromEntities", () => {
  it("derives a Source and a general-citation Claim per URL on first pass (no prior state)", () => {
    const { sources, claims } = deriveProvenanceFromEntities(
      [{ id: "e-1", sources: "https://a.example\nhttps://b.example" }],
      [],
      [],
    )
    expect(sources.map((s) => s.url)).toEqual(["https://a.example", "https://b.example"])
    expect(claims).toHaveLength(2)
    expect(claims.every((c) => c.entityId === "e-1" && c.field === "sources")).toBe(true)
    expect(new Set(claims.map((c) => c.sourceId))).toEqual(new Set(sources.map((s) => s.id)))
  })

  it("is idempotent: re-deriving against its own prior output adds nothing new", () => {
    const entities = [{ id: "e-1", sources: "https://a.example\nhttps://b.example" }]
    const first = deriveProvenanceFromEntities(entities, [], [])
    const second = deriveProvenanceFromEntities(entities, first.sources, first.claims)
    expect(second.sources).toEqual(first.sources)
    expect(second.claims).toEqual(first.claims)
  })

  it("shares one Source record across two entities citing the same URL, with two distinct Claims", () => {
    const { sources, claims } = deriveProvenanceFromEntities(
      [
        { id: "e-1", sources: "https://shared.example" },
        { id: "e-2", sources: "https://shared.example" },
      ],
      [],
      [],
    )
    expect(sources).toHaveLength(1)
    expect(claims).toHaveLength(2)
    expect(claims.map((c) => c.entityId).sort()).toEqual(["e-1", "e-2"])
    expect(claims[0].sourceId).toBe(sources[0].id)
    expect(claims[1].sourceId).toBe(sources[0].id)
  })

  it("does not re-derive a claim that already exists for an entity+source pair", () => {
    const existingSources: Source[] = [{ id: "src-1", url: "https://a.example", domainType: "web", reliability: null }]
    const existingClaims: Claim[] = [
      { id: "claim-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    const { claims } = deriveProvenanceFromEntities(
      [{ id: "e-1", sources: "https://a.example" }],
      existingSources,
      existingClaims,
    )
    expect(claims).toEqual(existingClaims)
  })

  it("handles entities with no sources", () => {
    const result = deriveProvenanceFromEntities([{ id: "e-1", sources: null }, { id: "e-2" }], [], [])
    expect(result.sources).toEqual([])
    expect(result.claims).toEqual([])
  })
})
