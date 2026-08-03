import { describe, expect, it } from "vitest"
import { activeParentMap, withActiveParent, withDerivedParents } from "./activeParent"
import type { Relationship } from "./relationship"

/** The edge reads "A <type> B", so for the hierarchy-bearing types the CHILD is
 *  `fromId` and the PARENT is `toId`. */
function rel(overrides: Partial<Relationship> & { id: string }): Relationship {
  return {
    fromId: "child",
    toId: "parent",
    type: "subordinate_to",
    startDate: null,
    endDate: null,
    metadata: {},
    ...overrides,
  }
}

type Item = { id: string; parentId: string | null; label?: string }

function item(id: string, parentId: string | null): Item {
  return { id, parentId, label: "item " + id }
}

describe("activeParentMap", () => {
  it("maps a child from a single hierarchy-bearing edge", () => {
    const map = activeParentMap([rel({ id: "e-1", fromId: "c", toId: "p" })])

    expect(map.parentById.get("c")).toBe("p")
    expect(map.parentById.size).toBe(1)
    expect(map.contested.size).toBe(0)
  })

  it("does not let an edge with an endDate compete", () => {
    const map = activeParentMap([
      rel({ id: "e-live", fromId: "c", toId: "p-live" }),
      rel({ id: "e-ended", fromId: "c", toId: "p-ended", endDate: "2020-01-01" }),
    ])

    expect(map.parentById.get("c")).toBe("p-live")
    expect(map.contested.size).toBe(0)
  })

  it("does not let an attached edge compete", () => {
    const map = activeParentMap([
      rel({ id: "e-organic", fromId: "c", toId: "p-organic" }),
      rel({ id: "e-attached", fromId: "c", toId: "p-attached", metadata: { attachment: "attached" } }),
    ])

    expect(map.parentById.get("c")).toBe("p-organic")
    expect(map.contested.size).toBe(0)
  })

  it("maps a child from a corporate_parent edge", () => {
    const map = activeParentMap([
      rel({ id: "e-corp", type: "corporate_parent", fromId: "sub", toId: "holding" }),
    ])

    expect(map.parentById.get("sub")).toBe("holding")
    expect(map.contested.size).toBe(0)
  })

  it("leaves a contested child absent from parentById, with both edge ids", () => {
    const map = activeParentMap([
      rel({ id: "e-a", fromId: "c", toId: "p1" }),
      rel({ id: "e-b", fromId: "c", toId: "p2" }),
    ])

    // Absent, NOT mapped to null: no arbitrary winner is elected (Q40).
    expect(map.parentById.has("c")).toBe(false)
    expect(map.contested.get("c")).toEqual(["e-a", "e-b"])
  })

  it("treats a subordinate_to and a corporate_parent edge as contested for one child", () => {
    // Additional, not criteria-mandated: the Q39 pairing, seen from the derivation.
    const map = activeParentMap([
      rel({ id: "e-sub", fromId: "c", toId: "p1" }),
      rel({ id: "e-corp", type: "corporate_parent", fromId: "c", toId: "p2" }),
    ])

    expect(map.parentById.has("c")).toBe(false)
    expect(map.contested.get("c")).toEqual(["e-sub", "e-corp"])
  })
})

describe("withDerivedParents", () => {
  it("never mutates a frozen input array or its frozen objects", () => {
    const items: Item[] = [
      Object.freeze(item("c", "stale-parent")),
      Object.freeze(item("p", null)),
    ]
    Object.freeze(items)
    const map = activeParentMap([rel({ id: "e-1", fromId: "c", toId: "p" })])

    let derived: Item[] = []
    expect(() => {
      derived = withDerivedParents(items, map)
    }).not.toThrow()

    expect(items[0]).toEqual({ id: "c", parentId: "stale-parent", label: "item c" })
    expect(items[1]).toEqual({ id: "p", parentId: null, label: "item p" })
    expect(derived[0]).not.toBe(items[0])
    expect(derived[0].parentId).toBe("p")
    expect(derived[0].label).toBe("item c")
  })

  it("sets parentId to null for an item absent from parentById", () => {
    // The incoming parentId is never read as an input: the edge set is the sole
    // authority once the field is derived.
    const derived = withDerivedParents([item("orphan", "x")], activeParentMap([]))

    expect(derived[0].parentId).toBeNull()
  })

  it("never emits a parent absent from the item set", () => {
    // T15: `buildOrbat` treats an unresolvable parent as a root while `load.ts`
    // THROWS on one, so the derivation reproduces the orphan policy by OMISSION
    // and never writes a dangling parent.
    const items = [item("c", null)]
    const map = activeParentMap([rel({ id: "e-ghost", fromId: "c", toId: "ghost" })])

    expect(map.parentById.get("c")).toBe("ghost")

    const derived = withDerivedParents(items, map)
    expect(derived[0].parentId).toBeNull()
    expect(derived[0].parentId).not.toBe("ghost")
  })
})

describe("withActiveParent", () => {
  // Additional, not criteria-mandated: this export ships on the hierarchy path
  // (inspector and MainLayout) but is named by no criterion in 16-21.
  const existing: Relationship[] = [
    rel({ id: "e-old", fromId: "c", toId: "p-old" }),
    rel({ id: "e-other", fromId: "sibling", toId: "p-old" }),
    rel({ id: "e-supplies", type: "supplies", fromId: "c", toId: "vendor" }),
  ]

  it("replaces the child's hierarchy-bearing edge rather than adding a second one", () => {
    const next = withActiveParent(existing, { id: "c", kind: "unit" }, "p-new", "e-new")
    const ids = new Set(next.map((edge) => edge.id))

    expect(ids).toEqual(new Set(["e-other", "e-supplies", "e-new"]))
    expect(activeParentMap(next).parentById.get("c")).toBe("p-new")
    expect(activeParentMap(next).contested.size).toBe(0)
    expect(existing.map((edge) => edge.id)).toEqual(["e-old", "e-other", "e-supplies"])
  })

  it("removes the child's hierarchy-bearing edges when the parent is null", () => {
    const next = withActiveParent(existing, { id: "c", kind: "unit" }, null, "unused")

    expect(new Set(next.map((edge) => edge.id))).toEqual(new Set(["e-other", "e-supplies"]))
    expect(activeParentMap(next).parentById.has("c")).toBe(false)
  })

  it("picks the edge type from the child's kind", () => {
    const unit = withActiveParent([], { id: "c", kind: "unit" }, "p", "e-u")
    const corporate = withActiveParent([], { id: "c", kind: "corporate" }, "p", "e-c")

    expect(unit[0].type).toBe("subordinate_to")
    expect(corporate[0].type).toBe("corporate_parent")
    expect(unit[0]).toEqual({
      id: "e-u", fromId: "c", toId: "p", type: "subordinate_to",
      startDate: null, endDate: null, metadata: {},
    })
  })
})
