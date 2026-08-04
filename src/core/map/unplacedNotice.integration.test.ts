import { describe, expect, it } from "vitest"
import { computeAllEntityPositions } from "./geometry"
import { describeUnplacedByContest } from "./unplacedNotice"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { Relationship } from "@/core/relationship/relationship"

/**
 * The seam `IntegrityPanel` composes, tested without React because this repo has no React
 * Testing Library: the panel is a pass-through of exactly these two calls over
 * `useEntityPositions`, so what is proved here is what it renders.
 *
 * It exists because the defect being closed was never "the sentence is worded wrong" -- it
 * was that `unplacedByContest` reached no reader at all. A test of `describeUnplacedByContest`
 * alone would pass just as happily with nothing calling it.
 */

const LAYER = "layer-1"

function unit(id: string, name: string): MapEntity {
  return { kind: "unit", id, name, layerId: LAYER, parentId: null }
}

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

const entities: MapEntity[] = [
  unit("hq", "HQ 1st Brigade"),
  unit("log", "Logistics Detachment"),
  unit("b-coy", "B Company"),
  unit("b-pl", "2nd Platoon, B Company"),
]

// Only the two candidate parents are drawn, so every other placement has to be inherited.
const geometries: DrawnGeometry[] = [
  { id: "g-hq", type: "point", layerId: LAYER, entityId: "hq", lat: 48.8566, lng: 2.3522 },
  { id: "g-log", type: "point", layerId: LAYER, entityId: "log", lat: 48.852, lng: 2.345 },
]

/** B Company is claimed by two parents at once; its platoon hangs below it. */
const contested: Relationship[] = [
  edge("r-1", "b-coy", "hq"),
  edge("r-2", "b-coy", "log"),
  edge("r-3", "b-pl", "b-coy"),
]

const settled: Relationship[] = [edge("r-1", "b-coy", "hq"), edge("r-3", "b-pl", "b-coy")]

function noticeFor(relationships: Relationship[]) {
  const index = hierarchyIndex(relationships, { entities })
  const { unplacedByContest } = computeAllEntityPositions(entities, geometries, index)
  return describeUnplacedByContest(unplacedByContest, entities)
}

describe("the unplaced-by-contest notice, end to end", () => {
  it("says nothing when the hierarchy is settled", () => {
    expect(noticeFor(settled)).toBeNull()
  })

  // ADR 0011: a contested child gets no derived parent, so it inherits no position and is
  // simply absent from the map. Naming the descendant matters as much as naming the child --
  // a reader told only about B Company would go looking for its platoon.
  it("names the contested entity and everything below it", () => {
    const notice = noticeFor(contested)

    expect(notice?.count).toBe(2)
    expect(notice?.names).toEqual(["2nd Platoon, B Company", "B Company"])
    expect(notice?.sentence).toContain("2 entities are not on the map")
  })

  it("does not name an entity that is drawn in its own right", () => {
    expect(noticeFor(contested)?.names).not.toContain("HQ 1st Brigade")
  })
})
