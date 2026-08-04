import { describe, expect, it } from "vitest"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { Relationship } from "@/core/relationship/relationship"
import { buildOrbat } from "./hierarchy"

type Node = { id: string; parentId: string | null }

function n(id: string, parentId: string | null): Node {
  return { id, parentId }
}

function edge(id: string, fromId: string, toId: string): Relationship {
  return {
    id, fromId, toId, type: "subordinate_to",
    startDate: null, endDate: null, metadata: {},
  }
}

describe("buildOrbat over a hierarchy index", () => {
  it("takes the edge set as the authority, not the parentId field", () => {
    // A field left stale by any write path at all: the edges say b is under a, the field
    // says it is under c. ADR 0011 makes the edge set the only record.
    const items = [n("a", null), n("b", "c"), n("c", null)]
    const index = hierarchyIndex([edge("e-1", "b", "a")])
    const orbat = buildOrbat(items, index)
    expect(orbat.childrenOf("a").map((i) => i.id)).toEqual(["b"])
    expect(orbat.childrenOf("c")).toEqual([])
    expect(orbat.ancestors("b").map((i) => i.id)).toEqual(["a"])
    expect(orbat.depthOf("b")).toBe(1)
  })

  it("tells a contested child apart from a root, which the tree shape cannot", () => {
    // The defect ADR 0011 said could not happen: a contested child derives no parent, so
    // roots() returns it, and a panel rendering roots() alone states "this unit answers to
    // no one" — an affirmative ORBAT claim, about the one entity that has two masters.
    const items = [n("hq-1", null), n("hq-2", null), n("disputed", null), n("under", "disputed")]
    const first = edge("e-1", "disputed", "hq-1")
    const second = edge("e-2", "disputed", "hq-2")
    const index = hierarchyIndex(
      [first, second, edge("e-3", "under", "disputed")],
      { entities: items },
    )
    const orbat = buildOrbat(items, index)

    expect(orbat.roots().map((i) => i.id)).toEqual(["hq-1", "hq-2", "disputed"])
    expect(orbat.isRoot("disputed")).toBe(true)
    expect(orbat.parentOf("hq-1")).toEqual({ state: "root" })
    // Both competing edges travel with the link, so the surface that renders it can name
    // them without a second pass over the edge set.
    expect(orbat.parentOf("disputed")).toEqual({ state: "contested", via: [first, second] })
    // No winner is elected, in either direction.
    expect(orbat.childrenOf("hq-1")).toEqual([])
    expect(orbat.childrenOf("hq-2")).toEqual([])
    // And the subtree under it stays attached to it rather than disappearing with it.
    expect(orbat.childrenOf("disputed").map((i) => i.id)).toEqual(["under"])
    expect(orbat.depthOf("under")).toBe(1)
  })

  it("reports a parent the entity set cannot place as unresolvable", () => {
    const index = hierarchyIndex([edge("e-1", "a", "gone")], { entities: [{ id: "a" }] })
    const orbat = buildOrbat([n("a", null)], index)
    expect(orbat.parentOf("a")).toMatchObject({ state: "unresolvable", parentId: "gone" })
    // The orphan policy is unchanged: it renders, at the top level.
    expect(orbat.roots().map((i) => i.id)).toEqual(["a"])
  })

  it("answers unknown for an id outside its own items, index or no index", () => {
    const index = hierarchyIndex([edge("e-1", "a", "b")])
    expect(buildOrbat([n("a", null)], index).parentOf("b")).toEqual({ state: "unknown" })
    expect(buildOrbat([n("a", null)]).parentOf("b")).toEqual({ state: "unknown" })
  })

  describe("without an index", () => {
    it("answers from the field, carrying no edges", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "missing")])
      expect(orbat.parentOf("a")).toEqual({ state: "root" })
      expect(orbat.parentOf("b")).toEqual({ state: "parent", parentId: "a", via: [] })
      expect(orbat.parentOf("c")).toEqual({ state: "unresolvable", parentId: "missing", via: [] })
    })

    it("cannot see a contest, which is the whole reason the index exists", () => {
      // Both entities carry the same derived null. Six consumers read that field, and this
      // is what each of them saw before Slice 3.
      const orbat = buildOrbat([n("root", null), n("contested", null)])
      expect(orbat.parentOf("root")).toEqual(orbat.parentOf("contested"))
    })
  })
})
