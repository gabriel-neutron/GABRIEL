import { describe, expect, it } from "vitest"
import {
  buildMetadata,
  edgeTypeLabel,
  metadataFieldsFor,
  orderTargets,
  refusalMessages,
  type TargetCandidate,
} from "./edgeForm"
import { EDGE_TYPES } from "./vocabulary"

describe("metadataFieldsFor", () => {
  it("derives an enum field from the set its type declares", () => {
    expect(metadataFieldsFor("officer_of")).toEqual([
      { key: "role", kind: "enum", options: ["director", "secretary", "registered_agent"] },
    ])
  })

  it("derives a numeric field from the range its type declares", () => {
    expect(metadataFieldsFor("owned_by")).toEqual([{ key: "percent", kind: "number", min: 0, max: 100 }])
  })

  it("offers the attachment qualifier on subordinate_to", () => {
    // Standing defect 2: attachment has been modelled and unauthorable since the vocabulary
    // landed, and "attached" is the marked case that opts an edge OUT of the hierarchy.
    expect(metadataFieldsFor("subordinate_to")).toEqual([
      { key: "attachment", kind: "enum", options: ["organic", "attached"] },
    ])
  })

  it("returns nothing for a type that declares no metadata", () => {
    expect(metadataFieldsFor("supplies")).toEqual([])
  })

  it("covers every key every type declares, so no rule is unreachable from the form", () => {
    for (const definition of Object.values(EDGE_TYPES)) {
      const declared = Object.keys(definition.metadata).sort()
      const offered = metadataFieldsFor(definition.type).map((f) => f.key as string).sort()
      expect(offered).toEqual(declared)
    }
  })
})

describe("buildMetadata", () => {
  it("keeps a value the type declares", () => {
    expect(buildMetadata("officer_of", { role: "director" })).toEqual({ role: "director" })
  })

  it("omits a key the analyst left blank rather than storing an empty string", () => {
    expect(buildMetadata("officer_of", { role: "" })).toEqual({})
    expect(buildMetadata("officer_of", {})).toEqual({})
  })

  it("parses a numeric field to a number", () => {
    expect(buildMetadata("owned_by", { percent: "51" })).toEqual({ percent: 51 })
  })

  it("keeps an unparseable number as NaN so validation refuses it rather than dropping it", () => {
    // Silently discarding "fifty" would commit an ownership edge with no percentage while the
    // analyst believed they had recorded one. NaN survives to `validateRelationships`, which
    // reports invalid-metadata.
    const built = buildMetadata("owned_by", { percent: "fifty" }) as { percent: number }
    expect(Number.isNaN(built.percent)).toBe(true)
  })

  it("drops a key the type does not declare", () => {
    // Keys are owned by exactly one declaring type. Carrying `role` over when the analyst
    // switches the form from officer_of to supplies would commit a key that type never declared.
    expect(buildMetadata("supplies", { role: "director" })).toEqual({})
  })
})

describe("refusalMessages", () => {
  it("shows one sentence per distinct explanation", () => {
    // The multiple-active-hierarchy case in the real project: two violations, one on each
    // competing edge, carrying the identical detail. The form has no edge to hang them on, so
    // rendering both prints the same sentence twice and reads as a bug.
    const detail = "entity \"x\" has 2 active hierarchy-bearing edges, and may have only one"
    expect(refusalMessages([{ detail }, { detail }])).toEqual([detail])
  })

  it("keeps two genuinely different explanations", () => {
    expect(refusalMessages([{ detail: "a" }, { detail: "b" }])).toEqual(["a", "b"])
  })
})

describe("edgeTypeLabel", () => {
  it("reads as the middle of the sentence the type is named for", () => {
    expect(edgeTypeLabel("beneficially_owned_by")).toBe("beneficially owned by")
    expect(edgeTypeLabel("supplies")).toBe("supplies")
  })
})

function target(id: string, kind: TargetCandidate["kind"], name = id): TargetCandidate {
  return { id, name, kind }
}

describe("orderTargets", () => {
  const candidates = [
    target("u1", "unit"), target("p1", "person"), target("c1", "corporate"), target("v1", "vessel"),
  ]

  it("puts the kinds the type prefers first and keeps the rest", () => {
    // `toKinds` is advisory by the vocabulary's own JSDoc: it orders and filters the picker and
    // NEVER rejects. An analyst who knows better must still be able to pick.
    const ordered = orderTargets("owned_by", "x", candidates)
    expect(ordered.map((t) => t.id)).toEqual(["p1", "u1", "c1", "v1"])
  })

  it("preserves the incoming order within each group", () => {
    const ordered = orderTargets("beneficially_owned_by", "x", candidates)
    expect(ordered.map((t) => t.id)).toEqual(["p1", "c1", "u1", "v1"])
  })

  it("excludes the edge's own source, which could only make a self-loop", () => {
    expect(orderTargets("supplies", "c1", candidates).map((t) => t.id)).not.toContain("c1")
  })

  it("returns every candidate for an unknown type rather than an empty picker", () => {
    const ordered = orderTargets("not_a_type" as never, "x", candidates)
    expect(ordered.map((t) => t.id)).toEqual(["u1", "p1", "c1", "v1"])
  })
})
