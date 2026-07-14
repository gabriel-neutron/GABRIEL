import { describe, expect, it } from "vitest"
import { buildAcceptedPatch, resolveAcceptedPatchTarget } from "./enrichmentApply"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal } from "@/types/enrichment.types"
import { GENERAL_CITATION_FIELD, type Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"

const baseEntity: MapEntity = {
  kind: "unit",
  id: "e1",
  name: "Test",
  layerId: "l1",
  parentId: null,
  affiliation: "Hostile",
  isExactPosition: false,
}

const existingSources: Source[] = [
  { id: "s-a", url: "https://a.example", domainType: null, reliability: null },
  { id: "s-b", url: "https://b.example", domainType: null, reliability: null },
]

const existingClaims: Claim[] = [
  { id: "cl-a", entityId: "e1", field: GENERAL_CITATION_FIELD, value: null, sourceId: "s-a", credibility: null, timestamp: null },
  { id: "cl-b", entityId: "e1", field: GENERAL_CITATION_FIELD, value: null, sourceId: "s-b", credibility: null, timestamp: null },
]

function proposal(
  field: string,
  proposedValue: unknown,
  sourceUrls: string[],
): EnrichmentProposal {
  return {
    field,
    currentValue: null,
    proposedValue,
    reasoning: "",
    citations: sourceUrls.map((url) => ({ url, title: "", snippet: "", domainType: "news" as const })),
  }
}

describe("buildAcceptedPatch", () => {
  it("returns null when no decisions are accepted", () => {
    const result = buildAcceptedPatch({
      decisions: { notes: "pending", sources: "rejected" },
      overlay: { notes: "x" },
      proposals: [proposal("notes", "x", ["https://ev.example"])],
      entity: baseEntity,
      existingClaims: [],
      existingSources: [],
    })
    expect(result).toBeNull()
  })

  it("returns null when entity is null", () => {
    const result = buildAcceptedPatch({
      decisions: { notes: "accepted" },
      overlay: { notes: "x" },
      proposals: [],
      entity: null,
      existingClaims: [],
      existingSources: [],
    })
    expect(result).toBeNull()
  })

  it("creates claims for proposed sources and evidence URLs not already known to the entity", () => {
    const result = buildAcceptedPatch({
      decisions: { notes: "accepted", sources: "accepted" },
      overlay: { notes: "HQ note", sources: "https://c.example" },
      proposals: [
        proposal("notes", "HQ note", ["https://ev1.example", "https://ev2.example"]),
        proposal("sources", "https://c.example", []),
      ],
      entity: baseEntity,
      existingClaims,
      existingSources,
    })
    expect(result).not.toBeNull()
    expect(result!.patch).toEqual({ notes: "HQ note" })
    expect(result!.newSources.map((s) => s.url).sort()).toEqual(
      ["https://c.example", "https://ev1.example", "https://ev2.example"].sort(),
    )
    const sourceById = new Map(result!.newSources.map((s) => [s.id, s]))
    const claimedUrls = result!.newClaims.map((c) => sourceById.get(c.sourceId)?.url).sort()
    expect(claimedUrls).toEqual(["https://c.example", "https://ev1.example", "https://ev2.example"].sort())
    expect(result!.newClaims.every((c) => c.entityId === "e1" && c.field === GENERAL_CITATION_FIELD)).toBe(true)
  })

  it("adds evidence URLs from accepted non-source fields without accepted sources field", () => {
    const result = buildAcceptedPatch({
      decisions: { militaryUnitId: "accepted" },
      overlay: { militaryUnitId: "42" },
      proposals: [proposal("militaryUnitId", "42", ["https://mil.example"])],
      entity: baseEntity,
      existingClaims: [],
      existingSources: [],
    })
    expect(result!.patch).toEqual({ militaryUnitId: "42" })
    expect(result!.newSources).toHaveLength(1)
    expect(result!.newSources[0].url).toBe("https://mil.example")
    expect(result!.newClaims).toHaveLength(1)
    expect(result!.newClaims[0].sourceId).toBe(result!.newSources[0].id)
  })

  it("excludes a wikipedia citation from the new sources even when it ranks highest by weight", () => {
    const notesProposal: EnrichmentProposal = {
      field: "notes",
      currentValue: null,
      proposedValue: "HQ note",
      reasoning: "",
      citations: [
        { url: "https://en.wikipedia.org/wiki/Unit", title: "", snippet: "", domainType: "wikipedia" },
        { url: "https://news.example/article", title: "", snippet: "", domainType: "news" },
      ],
    }
    const result = buildAcceptedPatch({
      decisions: { notes: "accepted" },
      overlay: { notes: "HQ note" },
      proposals: [notesProposal],
      entity: baseEntity,
      existingClaims: [],
      existingSources: [],
    })
    expect(result!.patch).toEqual({ notes: "HQ note" })
    expect(result!.newSources.map((s) => s.url)).toEqual(["https://news.example/article"])
  })

  it("reuses an existing global Source when a different entity already cited the URL, without duplicating the Source record", () => {
    const sharedSource: Source = { id: "s-shared", url: "https://shared.example", domainType: null, reliability: null }
    const result = buildAcceptedPatch({
      decisions: { sources: "accepted" },
      overlay: { sources: "https://shared.example" },
      proposals: [],
      entity: baseEntity,
      existingClaims: [], // no claim from THIS entity yet, even though the Source already exists
      existingSources: [sharedSource],
    })
    expect(result!.newSources).toHaveLength(0)
    expect(result!.newClaims).toHaveLength(1)
    expect(result!.newClaims[0].sourceId).toBe("s-shared")
    // citedSources must include the reused Source even though it's absent from newSources —
    // a caller assessing credibility for newClaims needs every claim's actual cited Source.
    expect(result!.citedSources).toEqual([sharedSource])
  })

  it("citedSources covers every newClaim's Source, whether newly minted or reused", () => {
    const sharedSource: Source = { id: "s-shared", url: "https://shared.example", domainType: null, reliability: null }
    const result = buildAcceptedPatch({
      decisions: { sources: "accepted" },
      overlay: { sources: "https://shared.example\nhttps://fresh.example" },
      proposals: [],
      entity: baseEntity,
      existingClaims: [],
      existingSources: [sharedSource],
    })
    expect(result!.newSources.map((s) => s.url)).toEqual(["https://fresh.example"])
    expect(result!.newClaims).toHaveLength(2)
    const citedUrls = result!.citedSources.map((s) => s.url).sort()
    expect(citedUrls).toEqual(["https://fresh.example", "https://shared.example"])
    // Every claim's sourceId must resolve within citedSources.
    const citedIds = new Set(result!.citedSources.map((s) => s.id))
    expect(result!.newClaims.every((c) => citedIds.has(c.sourceId))).toBe(true)
  })

  it("mints no new claim when the entity already has a claim to that exact source", () => {
    const result = buildAcceptedPatch({
      decisions: { sources: "accepted" },
      overlay: { sources: "https://a.example" },
      proposals: [],
      entity: baseEntity,
      existingClaims,
      existingSources,
    })
    expect(result).toBeNull()
  })
})

describe("resolveAcceptedPatchTarget", () => {
  it("returns the id unchanged when the entity still exists", () => {
    expect(resolveAcceptedPatchTarget([baseEntity], {}, "e1")).toBe("e1")
  })

  it("redirects to the surviving entity when the id was merged away", () => {
    // e1 accepted-not-committed, then merged into e2 before commit.
    expect(resolveAcceptedPatchTarget([{ ...baseEntity, id: "e2" }], { e1: "e2" }, "e1")).toBe("e2")
  })

  it("returns the id unchanged when it's gone with no merge record (never existed)", () => {
    expect(resolveAcceptedPatchTarget([], {}, "ghost")).toBe("ghost")
  })
})
