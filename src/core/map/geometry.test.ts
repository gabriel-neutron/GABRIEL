import { describe, expect, it } from "vitest"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { Relationship } from "@/core/relationship/relationship"
import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import { computeAllEntityPositions } from "./geometry"

function unit(id: string, positionMode: PositionMode = "none"): MapEntity {
  // parentId is null on every fixture here on purpose: it is the DERIVED field, and a
  // contested child derives null exactly as a root does. That collapse is the defect.
  return { kind: "unit", id, name: id, layerId: "division", parentId: null, positionMode }
}

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

const PIN: DrawnGeometry = {
  id: "geometry-1", layerId: "division", entityId: "hq-1", type: "point", lat: 50.45, lng: 30.52,
}

/** One anchored HQ, a second unanchored HQ, a child claimed by both, and a grandchild. */
const ENTITIES = [unit("hq-1", "own"), unit("hq-2"), unit("disputed"), unit("under")]
const CONTEST = [
  edge("e-1", "disputed", "hq-1"),
  edge("e-2", "disputed", "hq-2"),
  edge("e-3", "under", "disputed"),
]
describe("computeAllEntityPositions with a contest in the chain", () => {
  it("names the contested entity and everything under it, and invents no position", () => {
    const index = hierarchyIndex(CONTEST, { entities: ENTITIES })
    const { positioned, unplacedByContest } = computeAllEntityPositions(ENTITIES, [PIN], index)

    // No midpoint between the two competing parents, and no winner: only the anchored HQ
    // renders. A fabricated coordinate here would reach a CC-BY dataset.
    expect(positioned.map((p) => p.entity.id)).toEqual(["hq-1"])
    // The grandchild is named too. It is just as absent from the map, and a reader told
    // only about "disputed" would go looking for its subtree.
    expect(unplacedByContest).toEqual(["disputed", "under"])
  })

  it("says nothing about hq-2, which is unplaced for its own reason", () => {
    // It has no geometry and no parent. Naming it here would blame a contest for an
    // absence the contest did not cause.
    const index = hierarchyIndex(CONTEST, { entities: ENTITIES })
    expect(computeAllEntityPositions(ENTITIES, [PIN], index).unplacedByContest).not.toContain("hq-2")
  })

  it("places a contested entity that carries its own geometry, and its subtree with it", () => {
    const entities = [unit("hq-1", "own"), unit("hq-2"), unit("disputed", "own"), unit("under")]
    const geometries: DrawnGeometry[] = [
      PIN,
      { id: "geometry-2", layerId: "division", entityId: "disputed", type: "point", lat: 51, lng: 31 },
    ]
    const index = hierarchyIndex(CONTEST, { entities: ENTITIES })
    const { positioned, unplacedByContest } = computeAllEntityPositions(entities, geometries, index)

    expect(positioned.map((p) => p.entity.id).sort()).toEqual(["disputed", "hq-1", "under"])
    // A contest is a finding about the hierarchy, not about the map. Pinned, it still renders.
    expect(unplacedByContest).toEqual([])
  })

  it("computes the identical position map with the index and without it", () => {
    // The index changes what is KNOWN, never where anything sits: the derived parentId
    // field is a projection of the same edges. This is the fingerprint assertion in
    // miniature, and the reason the six consumers could be ported one at a time.
    const derived = ENTITIES.map((e) => ({ ...e, parentId: e.id === "under" ? "disputed" : null }))
    const withIndex = computeAllEntityPositions(
      ENTITIES, [PIN], hierarchyIndex(CONTEST, { entities: ENTITIES }),
    )
    const withField = computeAllEntityPositions(derived, [PIN])

    expect(withField.positioned.map((p) => [p.entity.id, p.position]))
      .toEqual(withIndex.positioned.map((p) => [p.entity.id, p.position]))
    // And with no index there is nothing to report, because a contest is invisible
    // from the field alone — which is what every consumer saw before Slice 3.
    expect(withField.unplacedByContest).toEqual([])
  })
})
