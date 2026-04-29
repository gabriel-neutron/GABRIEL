import { describe, expect, it } from "vitest"
import { buildAcceptedPatch } from "./enrichmentApply"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal } from "@/types/enrichment.types"

const baseEntity: MapEntity = {
  id: "e1",
  name: "Test",
  layerId: "l1",
  parentId: null,
  affiliation: "Hostile",
  isExactPosition: false,
  sources: "https://a.example\nhttps://b.example",
}

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
    sources: sourceUrls.map((url) => ({ url, title: "", snippet: "", domainType: "news" as const })),
  }
}

describe("buildAcceptedPatch", () => {
  it("returns null when no decisions are accepted", () => {
    const patch = buildAcceptedPatch({
      decisions: { notes: "pending", sources: "rejected" },
      overlay: { notes: "x" },
      proposals: [proposal("notes", "x", ["https://ev.example"])],
      entity: baseEntity,
    })
    expect(patch).toBeNull()
  })

  it("merges existing sources with proposed sources and evidence URLs", () => {
    const patch = buildAcceptedPatch({
      decisions: {
        notes: "accepted",
        sources: "accepted",
      },
      overlay: {
        notes: "HQ note",
        sources: "https://c.example",
      },
      proposals: [
        proposal("notes", "HQ note", ["https://ev1.example", "https://ev2.example"]),
        proposal("sources", "https://c.example", []),
      ],
      entity: baseEntity,
    })
    expect(patch).not.toBeNull()
    const urls = (patch!.sources as string).split("\n").map((s) => s.trim()).filter(Boolean)
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://a.example",
        "https://b.example",
        "https://c.example",
        "https://ev1.example",
        "https://ev2.example",
      ]),
    )
    expect(urls.length).toBe(5)
    expect(patch!.notes).toBe("HQ note")
  })

  it("adds evidence URLs from accepted non-source fields without accepted sources field", () => {
    const patch = buildAcceptedPatch({
      decisions: { militaryUnitId: "accepted" },
      overlay: { militaryUnitId: "42" },
      proposals: [proposal("militaryUnitId", "42", ["https://mil.example"])],
      entity: { ...baseEntity, sources: null },
    })
    expect(patch).toEqual({
      militaryUnitId: "42",
      sources: "https://mil.example",
    })
  })

})
