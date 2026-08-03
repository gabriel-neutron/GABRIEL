import { describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import type { Relationship } from "@/core/relationship/relationship"
import {
  applyNameChange,
  applyParentChange,
  type EntityInspectorWriters,
} from "./entityInspectorCommands"

/**
 * Closes Q2B-21. `useEntityInspector.parent.test.ts` drives the real store and the real
 * `withActiveParent` through the composition the hook performs, which proves the collaborators
 * behave — but it cannot see *which* action the body called, only where the store ended up, and
 * before the extraction it could not fail at all if the body were deleted.
 *
 * These tests hold the body. The writers are recording doubles, so the assertions are on the
 * calls themselves: how many, in which order, with which arguments, and — the half no end-state
 * assertion can make — which calls did NOT happen.
 */
function recorder(): EntityInspectorWriters & {
  updates: { id: string; patch: Partial<MapEntity> }[]
  commits: Relationship[][]
} {
  const updates: { id: string; patch: Partial<MapEntity> }[] = []
  const commits: Relationship[][] = []
  return {
    updates,
    commits,
    updateEntity: (id, patch) => {
      updates.push({ id, patch })
    },
    setRelationships: (next) => {
      commits.push(next)
    },
  }
}

function unit(id: string, extra: Partial<MapEntity> = {}): MapEntity {
  return { kind: "unit", id, name: id.toUpperCase(), layerId: "custom-1", parentId: null, ...extra } as MapEntity
}

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

describe("applyParentChange — the inspector parent picker's body", () => {
  it("commits exactly one edge set through setRelationships and writes no entity field", () => {
    const w = recorder()
    applyParentChange(unit("child"), [], "p1", "e-1", w)

    expect(w.commits).toHaveLength(1)
    expect(w.commits[0]).toEqual([edge("e-1", "child", "p1")])
    // The parent is a derived field (ADR 0011, criterion 62b): setting a parent must touch the
    // entity table not at all. An end-state assertion cannot see this — a body that wrote the
    // edge AND `parentId` would leave exactly the same store behind.
    expect(w.updates).toEqual([])
  })

  it("uses the injected edge id rather than minting one", () => {
    const w = recorder()
    applyParentChange(unit("child"), [], "p1", "injected-id", w)
    expect(w.commits[0]![0]!.id).toBe("injected-id")
  })

  it("hands setRelationships the child's OLD edge replaced, not a second one appended (Q2B-15)", () => {
    const w = recorder()
    applyParentChange(unit("child"), [edge("e-old", "child", "p1")], "p2", "e-new", w)

    // Two active hierarchy-bearing edges would make the child contested, `activeParentMap` leaves
    // a contested child out of `parentById`, and the analyst's pick vanishes at the next load.
    expect(w.commits[0]).toEqual([edge("e-new", "child", "p2")])
  })

  it("leaves every other child's edges in the array it commits", () => {
    const w = recorder()
    const sibling = edge("e-sib", "sibling", "p1")
    applyParentChange(unit("child"), [sibling, edge("e-old", "child", "p1")], "p2", "e-new", w)

    expect(w.commits[0]).toEqual([sibling, edge("e-new", "child", "p2")])
  })

  it("commits an edge set with the child's edge gone when the parent is cleared", () => {
    const w = recorder()
    const sibling = edge("e-sib", "sibling", "p1")
    applyParentChange(unit("child"), [sibling, edge("e-old", "child", "p1")], null, "unused", w)

    expect(w.commits[0]).toEqual([sibling])
  })

  it("forces positionMode 'none' when the parent is cleared on a parent-positioned entity", () => {
    const w = recorder()
    applyParentChange(unit("child", { positionMode: "parent" }), [edge("e-old", "child", "p1")], null, "x", w)

    // Frozen criterion 62's second half. The patch is asserted whole, so a body that also slipped
    // `parentId` into it fails here too.
    expect(w.updates).toEqual([{ id: "child", patch: { positionMode: "none" } }])
  })

  it("writes nothing to the entity when the cleared entity was positioned some other way", () => {
    const w = recorder()
    applyParentChange(unit("child", { positionMode: "own" }), [edge("e-old", "child", "p1")], null, "x", w)
    expect(w.updates).toEqual([])
  })

  it("writes nothing to the entity when a parent-positioned entity is REPARENTED rather than cleared", () => {
    const w = recorder()
    applyParentChange(unit("child", { positionMode: "parent" }), [edge("e-old", "child", "p1")], "p2", "e-new", w)

    // The guard is `parentId == null`, not "the entity is parent-positioned". Dropping the null
    // test would strand this entity at `positionMode: "none"` while it still has a parent to sit
    // on — and no end-state test of a reparent would notice, because the edge set is still right.
    expect(w.updates).toEqual([])
  })
})

describe("applyNameChange — the inspector name field's body", () => {
  it("infers a blank unit's echelon from the new name, in the same patch as the name", () => {
    const w = recorder()
    applyNameChange(unit("child"), "72nd Motor Rifle Brigade", w)
    // One patch, not two: a second `updateEntity` would be a second store notification for one
    // edit, and the two halves could be observed apart.
    expect(w.updates).toEqual([{ id: "child", patch: { name: "72nd Motor Rifle Brigade", echelon: "Brigade" } }])
  })

  it("never re-infers over an echelon the analyst already set", () => {
    const w = recorder()
    applyNameChange(unit("child", { echelon: "Division" }), "1st Brigade", w)
    // A rename is not a statement about echelon; overwriting here would let a typo fix destroy a
    // human judgement.
    expect(w.updates).toEqual([{ id: "child", patch: { name: "1st Brigade" } }])
  })

  it("leaves the echelon blank when the name carries no echelon word", () => {
    const w = recorder()
    applyNameChange(unit("child"), "Unnamed formation", w)
    expect(w.updates).toEqual([{ id: "child", patch: { name: "Unnamed formation" } }])
  })

  it("does not infer an echelon for a corporate entity, whose name words mean something else", () => {
    const w = recorder()
    const corporate = { kind: "corporate", id: "org-1", name: "X", type: "other", layerId: "industry", parentId: null } as MapEntity
    applyNameChange(corporate, "Brigade Holdings SA", w)
    expect(w.updates).toEqual([{ id: "org-1", patch: { name: "Brigade Holdings SA" } }])
  })
})
