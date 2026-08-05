import { describe, expect, it } from "vitest"
import type { Relationship, RelationshipDraft } from "./relationship"
import { withAuthoredEdge, withEndDatedEdge, withoutEdge } from "./authoring"

function draft(over: Partial<RelationshipDraft> = {}): RelationshipDraft {
  return {
    fromId: "a", toId: "b", type: "supplies",
    startDate: null, endDate: null, metadata: {},
    ...over,
  }
}

function edge(id: string, over: Partial<Relationship> = {}): Relationship {
  return {
    id, fromId: "a", toId: "b", type: "supplies",
    startDate: null, endDate: null, metadata: {},
    ...over,
  }
}

const ENTITIES = new Set(["a", "b", "c"])

describe("withAuthoredEdge", () => {
  it("appends the drafted edge under the injected id and leaves the existing set alone", () => {
    const existing = edge("r-old", { fromId: "c", toId: "b" })
    const result = withAuthoredEdge([existing], draft(), "r-new", ENTITIES)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships).toEqual([existing, edge("r-new")])
    // The minted edge is handed back so the caller can name it without searching for it.
    expect(result.edge).toEqual(edge("r-new"))
  })

  it("refuses an edge whose type requires a start date it does not carry", () => {
    const result = withAuthoredEdge([], draft({ type: "shipped_to" }), "r-1", ENTITIES)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["missing-required-date"])
    expect(result.violations[0]!.relationshipId).toBe("r-1")
  })

  it("refuses a metadata value outside the set its type declares", () => {
    const result = withAuthoredEdge(
      [], draft({ type: "officer_of", metadata: { role: "auditor" } as never }), "r-1", ENTITIES,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["invalid-metadata"])
  })

  it("refuses a self-loop", () => {
    const result = withAuthoredEdge([], draft({ toId: "a" }), "r-1", ENTITIES)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["self-loop"])
  })

  it("refuses an endpoint absent from the entity set", () => {
    const result = withAuthoredEdge([], draft({ toId: "ghost" }), "r-1", ENTITIES)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["dangling-endpoint"])
  })

  it("commits despite a violation the corpus already carried before this write", () => {
    // The real project's 1,012 edges are not guaranteed clean, and a validator run over the
    // whole next set reports every fault in it. Refusing on the total would let one bad edge
    // somewhere in the corpus make authoring impossible everywhere — so only what the write
    // ADDS may refuse it.
    const preexisting = edge("r-bad", { fromId: "a", toId: "a" })
    const result = withAuthoredEdge([preexisting], draft(), "r-new", ENTITIES)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships).toHaveLength(2)
  })

  it("refuses a second active hierarchy-bearing edge, naming both competitors", () => {
    // Authoring APPENDS where the parent picker replaces (`withActiveParent`). A second active
    // hierarchy edge leaves the child contested and deriving no parent at all, so the analyst
    // must be told rather than shown their pick disappear at the next load.
    const existing = edge("r-1", { fromId: "a", toId: "b", type: "corporate_parent" })
    const result = withAuthoredEdge(
      [existing], draft({ toId: "c", type: "corporate_parent" }), "r-2", ENTITIES,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual([
      "multiple-active-hierarchy", "multiple-active-hierarchy",
    ])
    // Both, not just the new one: the fault is the pair, and the analyst needs the edge that
    // was already there in order to decide which of the two to end-date.
    expect(result.violations.map((v) => v.relationshipId).sort()).toEqual(["r-1", "r-2"])
  })

  it("validates without an entity set, still catching everything but dangling endpoints", () => {
    expect(withAuthoredEdge([], draft({ toId: "ghost" }), "r-1").ok).toBe(true)
    expect(withAuthoredEdge([], draft({ toId: "a" }), "r-1").ok).toBe(false)
  })
})

describe("withEndDatedEdge", () => {
  it("writes the end date on the named edge and on no other", () => {
    const other = edge("r-2", { fromId: "c" })
    const result = withEndDatedEdge([edge("r-1"), other], "r-1", "2026-03-01", ENTITIES)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships).toEqual([edge("r-1", { endDate: "2026-03-01" }), other])
  })

  it("refuses an end date that falls before the edge's start date", () => {
    const result = withEndDatedEdge(
      [edge("r-1", { startDate: "2026-05-01" })], "r-1", "2026-03-01", ENTITIES,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["date-order"])
  })

  it("refuses a malformed date rather than storing it", () => {
    const result = withEndDatedEdge([edge("r-1")], "r-1", "01/03/2026", ENTITIES)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.violations.map((v) => v.code)).toEqual(["invalid-date"])
  })

  it("resolves a contest when one of two competing hierarchy edges is ended", () => {
    // The half that makes end-dating worth having: a corpus that already violates
    // multiple-active-hierarchy must be repairable, and the repair is an edit that would
    // itself look violating if the rule were read on the total instead of the difference.
    const rels = [
      edge("r-1", { fromId: "a", toId: "b", type: "corporate_parent" }),
      edge("r-2", { fromId: "a", toId: "c", type: "corporate_parent" }),
    ]
    const result = withEndDatedEdge(rels, "r-2", "2026-03-01", ENTITIES)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships[1]!.endDate).toBe("2026-03-01")
  })

  it("clears an end date when handed null", () => {
    const result = withEndDatedEdge([edge("r-1", { endDate: "2026-03-01" })], "r-1", null, ENTITIES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships[0]!.endDate).toBeNull()
  })

  it("returns the set unchanged for an id it does not hold", () => {
    const rels = [edge("r-1")]
    const result = withEndDatedEdge(rels, "r-absent", "2026-03-01", ENTITIES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relationships).toEqual(rels)
  })
})

describe("withoutEdge", () => {
  it("removes the named edge and returns a fresh array", () => {
    const kept = edge("r-2", { fromId: "c" })
    const rels = [edge("r-1"), kept]
    const next = withoutEdge(rels, "r-1")

    expect(next).toEqual([kept])
    expect(next).not.toBe(rels)
  })

  it("is a no-op for an id it does not hold", () => {
    expect(withoutEdge([edge("r-1")], "r-absent")).toEqual([edge("r-1")])
  })
})
