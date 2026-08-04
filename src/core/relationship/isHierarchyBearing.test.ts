import { describe, expect, it } from "vitest"
import type { Relationship, RelationshipType } from "./relationship"
import { isHierarchyBearing } from "./isHierarchyBearing"
import { EDGE_TYPES } from "./vocabulary"

/** The truth table for "this edge places a child under a parent" lives here rather
 *  than in `validate.test.ts`, which is at its 300-line cap (criterion 6). */
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

const HIERARCHY_BEARING_TYPES: RelationshipType[] = ["subordinate_to", "corporate_parent"]

/** Derived from the shipped vocabulary, never spelled out, so a fourteenth edge
 *  type cannot enter the vocabulary without passing through this assertion. */
const OTHER_TYPES: RelationshipType[] = (Object.keys(EDGE_TYPES) as RelationshipType[])
  .filter((type) => !HIERARCHY_BEARING_TYPES.includes(type))

describe("isHierarchyBearing", () => {
  it("counts a subordinate_to edge that records no attachment", () => {
    expect(isHierarchyBearing(rel({ id: "h-1", metadata: {} }))).toBe(true)
    // A key present with value undefined is absent, and absent is still organic.
    expect(isHierarchyBearing(rel({ id: "h-2", metadata: { attachment: undefined } }))).toBe(true)
  })

  it("counts a subordinate_to edge marked organic", () => {
    expect(isHierarchyBearing(rel({ id: "h-3", metadata: { attachment: "organic" } }))).toBe(true)
  })

  it("does not count a subordinate_to edge marked attached", () => {
    expect(isHierarchyBearing(rel({ id: "h-4", metadata: { attachment: "attached" } }))).toBe(false)
  })

  it("counts a corporate_parent edge, attachment being no part of that type", () => {
    expect(isHierarchyBearing(rel({ id: "h-5", type: "corporate_parent" }))).toBe(true)
    expect(isHierarchyBearing(
      rel({ id: "h-6", type: "corporate_parent", metadata: { percent: 49.9 } }),
    )).toBe(true)
  })

  it("does not count an edge with a non-null endDate, for either type", () => {
    for (const type of HIERARCHY_BEARING_TYPES) {
      expect(isHierarchyBearing(rel({ id: "h-ended-" + type, type, endDate: "2020-01-01" }))).toBe(false)
      // Still true when only the start date is set: active means "has not ended".
      expect(isHierarchyBearing(rel({ id: "h-open-" + type, type, startDate: "2020-01-01" }))).toBe(true)
    }
  })

  it("counts none of the other eleven relationship types", () => {
    expect(OTHER_TYPES).toHaveLength(11)

    for (const type of OTHER_TYPES) {
      expect(isHierarchyBearing(rel({ id: "h-other-" + type, type }))).toBe(false)
      // Not even when they carry the attachment marker the hierarchy type reads.
      expect(isHierarchyBearing(
        rel({ id: "h-other-organic-" + type, type, metadata: { attachment: "organic" } }),
      )).toBe(false)
    }
  })

  it("counts none of a type outside the vocabulary altogether", () => {
    expect(isHierarchyBearing(
      rel({ id: "h-unknown", type: "not_a_real_type" as RelationshipType }),
    )).toBe(false)
  })
})
