import { describe, expect, it } from "vitest"
import type { Relationship } from "@/core/relationship/relationship"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import { withContestedParentEvents } from "./contestedParentEvents"
import type { IntegrityEvent } from "./integrityEvent"

/**
 * Direct tests, because Slice 3 makes this the ONLY minter of a `multiple-active-hierarchy`
 * row — on the load path and the edit path alike. Its coverage ran through the Zustand store
 * until now, and testing only through a store is exactly how 2B shipped an `ActiveParentMap.
 * contested` that was dead on the edit path with every test green.
 */
const NOW = "2026-08-04T00:00:00.000Z"

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

const ENTITIES = [
  { id: "child", name: "3rd Battalion" },
  { id: "hq-a", name: "1st Brigade" },
  { id: "hq-b", name: "Coastal Defence Group" },
]

const RELS = [edge("e-1", "child", "hq-a"), edge("e-2", "child", "hq-b")]

function contestedFrom(rels: Relationship[]): Map<string, string[]> {
  return hierarchyIndex(rels).contested()
}

function mint(ledger: IntegrityEvent[] = [], rels: Relationship[] = RELS): IntegrityEvent[] {
  return withContestedParentEvents(ledger, contestedFrom(rels), rels, ENTITIES, NOW)
}

describe("withContestedParentEvents", () => {
  it("mints one row per contested CHILD, not one per offending edge", () => {
    // The finding is "this entity has two parents", which the two edges assert jointly.
    const minted = mint()
    expect(minted).toHaveLength(1)
    expect(minted[0]).toMatchObject({
      id: "integrity:multiple-active-hierarchy:child",
      kind: "multiple-active-hierarchy",
      createdAt: NOW,
      detail: { childId: "child", relationshipIds: ["e-1", "e-2"], parentIds: ["hq-a", "hq-b"] },
    })
  })

  it("writes a sentence naming the entities, fit to publish", () => {
    expect(mint()[0].summary).toBe(
      "\"3rd Battalion\" is placed under 2 parents at once (\"1st Brigade\", " +
      "\"Coastal Defence Group\"), so it is left without a derived parent until a person " +
      "records which is correct.",
    )
  })

  it("falls back to the id for an entity it has no name for", () => {
    const minted = withContestedParentEvents([], contestedFrom(RELS), RELS, [], NOW)
    expect(minted[0].summary).toContain("\"child\"")
  })

  it("leaves an existing row exactly as it stands", () => {
    // It may carry an acknowledgement someone typed, which a fresh copy cannot — and two rows
    // sharing an id would abort the save on the table's PRIMARY KEY (Q2B-8b).
    const acknowledged: IntegrityEvent = {
      id: "integrity:multiple-active-hierarchy:child",
      kind: "multiple-active-hierarchy",
      createdAt: "2026-01-01T00:00:00.000Z",
      summary: "already recorded",
      detail: {},
      acknowledgedBy: "an analyst",
    }
    expect(mint([acknowledged])).toEqual([acknowledged])
  })

  it("keeps a row whose child is no longer contested", () => {
    // A finding is retired by being acknowledged, never by the condition quietly going away
    // (Q2B-23): deleting one of the two edges must not delete the record that both existed.
    const stale: IntegrityEvent = {
      id: "integrity:multiple-active-hierarchy:child",
      kind: "multiple-active-hierarchy",
      createdAt: NOW,
      summary: "recorded when it was contested",
      detail: {},
    }
    const resolved = [edge("e-1", "child", "hq-a")]
    expect(withContestedParentEvents([stale], contestedFrom(resolved), resolved, ENTITIES, NOW))
      .toEqual([stale])
  })

  it("returns the ledger it was given when there is nothing to record", () => {
    const ledger: IntegrityEvent[] = []
    expect(withContestedParentEvents(ledger, new Map(), RELS, ENTITIES, NOW)).toBe(ledger)
  })

  it("keeps every competing edge id when one of them cannot be resolved to a parent", () => {
    // The degenerate case, and the one place this differs from the minter Slice 3 deleted:
    // that one dropped an edge absent from the relationship set outright, so the row under-
    // counted the contest. Here the count and the edge ids are what the derivation decided,
    // and only the unresolvable PARENT is left out of the sentence.
    const contested = new Map([["child", ["e-1", "e-ghost"]]])
    const minted = withContestedParentEvents([], contested, RELS, ENTITIES, NOW)
    expect(minted[0].detail).toMatchObject({
      relationshipIds: ["e-1", "e-ghost"],
      parentIds: ["hq-a"],
    })
    expect(minted[0].summary).toContain("under 2 parents at once")
  })
})
