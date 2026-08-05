import { describe, expect, it } from "vitest"
import type { Relationship, RelationshipDraft } from "@/core/relationship/relationship"
import {
  applyAuthorEdge,
  applyDeleteEdge,
  applyEndDate,
  type RelationshipEditorWriters,
} from "./relationshipEditorCommands"

/**
 * The bodies of the relationship editor's write handlers, held directly. The writer is a
 * recording double, so these assert on the calls — and above all on the call that must NOT
 * happen: a refused edge reaching `setRelationships` would be committed to the session's edge
 * set, and an end-state assertion over a store cannot tell "refused" from "committed then
 * overwritten".
 */
function recorder(): RelationshipEditorWriters & { commits: Relationship[][] } {
  const commits: Relationship[][] = []
  return { commits, setRelationships: (next) => { commits.push(next) } }
}

function draft(over: Partial<RelationshipDraft> = {}): RelationshipDraft {
  return { fromId: "a", toId: "b", type: "supplies", startDate: null, endDate: null, metadata: {}, ...over }
}

function edge(id: string, over: Partial<Relationship> = {}): Relationship {
  return { id, fromId: "a", toId: "b", type: "supplies", startDate: null, endDate: null, metadata: {}, ...over }
}

const ENTITIES = new Set(["a", "b", "c"])

describe("applyAuthorEdge", () => {
  it("commits exactly one edge set carrying the new edge, and reports no violation", () => {
    const w = recorder()
    const violations = applyAuthorEdge([], draft(), "r-1", ENTITIES, w)

    expect(violations).toEqual([])
    expect(w.commits).toEqual([[edge("r-1")]])
  })

  it("commits nothing at all when the edge is refused", () => {
    const w = recorder()
    const violations = applyAuthorEdge([], draft({ type: "shipped_to" }), "r-1", ENTITIES, w)

    expect(violations.map((v) => v.code)).toEqual(["missing-required-date"])
    expect(w.commits).toEqual([])
  })

  it("uses the injected edge id rather than minting one", () => {
    const w = recorder()
    applyAuthorEdge([], draft(), "injected-id", ENTITIES, w)
    expect(w.commits[0]![0]!.id).toBe("injected-id")
  })
})

describe("applyEndDate", () => {
  it("commits the edge set with the end date written", () => {
    const w = recorder()
    const violations = applyEndDate([edge("r-1")], "r-1", "2026-03-01", ENTITIES, w)

    expect(violations).toEqual([])
    expect(w.commits).toEqual([[edge("r-1", { endDate: "2026-03-01" })]])
  })

  it("commits nothing when the end date would precede the start date", () => {
    const w = recorder()
    const violations = applyEndDate(
      [edge("r-1", { startDate: "2026-05-01" })], "r-1", "2026-03-01", ENTITIES, w,
    )

    expect(violations.map((v) => v.code)).toEqual(["date-order"])
    expect(w.commits).toEqual([])
  })
})

describe("applyDeleteEdge", () => {
  it("commits the edge set with the edge gone", () => {
    const w = recorder()
    applyDeleteEdge([edge("r-1"), edge("r-2", { fromId: "c" })], "r-1", w)
    expect(w.commits).toEqual([[edge("r-2", { fromId: "c" })]])
  })
})
