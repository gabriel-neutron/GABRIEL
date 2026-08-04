import { describe, expect, it } from "vitest"
import { hierarchyIndex } from "./hierarchyIndex"
import type { Relationship } from "./relationship"

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

describe("hierarchyIndex", () => {
  describe("the five states", () => {
    it("reads an id with no bearing edge as a root", () => {
      const index = hierarchyIndex([rel({ id: "e-1", fromId: "a", toId: "b" })])
      expect(index.linkFor("b")).toEqual({ state: "root" })
      // And so is an id the edge set says nothing about, when no entity set is supplied:
      // edges are all this index has seen, and "no edge places it" is the honest answer.
      expect(index.linkFor("never-heard-of-it")).toEqual({ state: "root" })
    })

    it("reads a single bearing edge as a parent, carrying the edge that decided it", () => {
      const edge = rel({ id: "e-1", fromId: "a", toId: "b" })
      expect(hierarchyIndex([edge]).linkFor("a")).toEqual({
        state: "parent", parentId: "b", via: [edge],
      })
    })

    it("reads two competing edges as contested, and elects no winner", () => {
      const first = rel({ id: "e-1", fromId: "a", toId: "b" })
      const second = rel({ id: "e-2", fromId: "a", toId: "c" })
      const index = hierarchyIndex([first, second])
      expect(index.linkFor("a")).toEqual({ state: "contested", via: [first, second] })
      // The competing parents are reachable from the link, so nothing needs a second pass
      // to discover what the derivation already knew (ADR 0011).
      expect(index.parents().has("a")).toBe(false)
      expect(index.contested().get("a")).toEqual(["e-1", "e-2"])
    })

    it("counts two edges to the SAME parent as two competing assertions", () => {
      // Collapsing them would be the derivation deciding the two records say the same
      // thing, which is exactly the judgement Q40 reserves for a person.
      const index = hierarchyIndex([
        rel({ id: "e-1", fromId: "a", toId: "b" }),
        rel({ id: "e-2", fromId: "a", toId: "b" }),
      ])
      expect(index.linkFor("a").state).toBe("contested")
    })

    it("reads a parent outside the entity set as unresolvable, not as a root (T15)", () => {
      const edge = rel({ id: "e-1", fromId: "a", toId: "gone" })
      const index = hierarchyIndex([edge], { entityIds: new Set(["a"]) })
      expect(index.linkFor("a")).toEqual({
        state: "unresolvable", parentId: "gone", via: [edge],
      })
      // The distinction the field cannot express: it never reaches `parents()`, so nothing
      // writes a parent_id that would make the next load throw, and the reason survives.
      expect(index.parents().size).toBe(0)
      expect(hierarchyIndex([edge]).linkFor("a").state).toBe("parent")
    })

    it("reads an id outside the entity set as unknown", () => {
      const index = hierarchyIndex([], { entityIds: new Set(["a"]) })
      expect(index.linkFor("a")).toEqual({ state: "root" })
      expect(index.linkFor("b")).toEqual({ state: "unknown" })
    })

    it("contributes nothing for an edge whose CHILD is outside the entity set", () => {
      // A dangling endpoint, which load.ts treats as making the file unopenable. A second
      // policy here would be a second answer to a settled question.
      const index = hierarchyIndex([rel({ id: "e-1", fromId: "ghost", toId: "b" })], {
        entityIds: new Set(["b"]),
      })
      expect(index.linkFor("ghost")).toEqual({ state: "unknown" })
      expect(index.parents().size).toBe(0)
      expect(index.contested().size).toBe(0)
    })
  })

  describe("which edges bear the hierarchy", () => {
    it("ignores an attached subordinate_to, an ended edge, and every other type", () => {
      const index = hierarchyIndex([
        rel({ id: "e-1", fromId: "a", toId: "b", metadata: { attachment: "attached" } }),
        rel({ id: "e-2", fromId: "c", toId: "b", endDate: "2020-01-01" }),
        rel({ id: "e-3", fromId: "d", toId: "b", type: "supplies" }),
      ])
      for (const id of ["a", "c", "d"]) expect(index.linkFor(id)).toEqual({ state: "root" })
    })

    it("counts a corporate_parent edge", () => {
      const index = hierarchyIndex([rel({ id: "e-1", fromId: "a", toId: "b", type: "corporate_parent" })])
      expect(index.linkFor("a")).toMatchObject({ state: "parent", parentId: "b" })
    })

    it("reads the hierarchy as at a date when asked", () => {
      const ended = rel({ id: "e-1", fromId: "a", toId: "b", startDate: "2020-01-01", endDate: "2024-01-01" })
      const later = rel({ id: "e-2", fromId: "a", toId: "c", startDate: "2024-01-01" })
      const rels = [ended, later]
      // As at now, only the open edge bears — which is why the real project, whose 1012
      // edges all carry two null dates, renders one identical tree for every date.
      expect(hierarchyIndex(rels).linkFor("a")).toMatchObject({ state: "parent", parentId: "c" })
      // Half-open: on the day it ended the edge is already absent.
      expect(hierarchyIndex(rels, { onDate: "2024-01-01" }).linkFor("a"))
        .toMatchObject({ state: "parent", parentId: "c" })
      expect(hierarchyIndex(rels, { onDate: "2023-12-31" }).linkFor("a"))
        .toMatchObject({ state: "parent", parentId: "b" })
      // And a date on which both were open is a contest, not a silent pick.
      expect(hierarchyIndex(
        [ended, rel({ id: "e-3", fromId: "a", toId: "c", startDate: "2021-01-01" })],
        { onDate: "2022-06-01" },
      ).linkFor("a").state).toBe("contested")
    })

    it("takes an injected predicate over the default one", () => {
      const index = hierarchyIndex([rel({ id: "e-1", fromId: "a", toId: "b", type: "supplies" })], {
        bearing: (edge) => edge.type === "supplies",
      })
      expect(index.linkFor("a")).toMatchObject({ state: "parent", parentId: "b" })
    })
  })

  describe("the projections", () => {
    it("hands back fresh maps a caller may mutate", () => {
      const index = hierarchyIndex([rel({ id: "e-1", fromId: "a", toId: "b" })])
      const first = index.parents()
      first.delete("a")
      // crossKindParentEvents deletes from the map it is handed, so a shared instance
      // would let one load's minting change what a later reader sees.
      expect(index.parents().get("a")).toBe("b")
    })

    it("keeps children in edge-scan order", () => {
      const index = hierarchyIndex([
        rel({ id: "e-1", fromId: "c", toId: "z" }),
        rel({ id: "e-2", fromId: "a", toId: "z" }),
        rel({ id: "e-3", fromId: "b", toId: "z" }),
      ])
      expect([...index.parents().keys()]).toEqual(["c", "a", "b"])
    })
  })
})
