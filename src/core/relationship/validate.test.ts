import { describe, expect, it } from "vitest"
import type { ExportOverride, Relationship, RelationshipType } from "./relationship"
import { isActive, RELATIONSHIP_VIOLATION_CODES, validateRelationships } from "./validate"
import { RECORD_TIER_TYPES } from "./vocabulary"

const VALID_OVERRIDE: ExportOverride = {
  proposedBy: "analyst-a",
  confirmedBy: "analyst-b",
  confirmedAt: "2026-07-29",
  rationale: "Two-person authorisation recorded for publication under CC-BY.",
}

function rel(overrides: Partial<Relationship> & { id: string }): Relationship {
  return {
    fromId: "a",
    toId: "b",
    type: "supplies",
    startDate: null,
    endDate: null,
    metadata: {},
    ...overrides,
  }
}

function codesOf(violations: ReturnType<typeof validateRelationships>): string[] {
  return violations.map((violation) => violation.code)
}

describe("validateRelationships", () => {
  it("emits every one of the nine violation codes on a crafted corpus", () => {
    const corpus: Relationship[] = [
      rel({ id: "r-unknown", type: "not_a_real_type" as RelationshipType }),
      rel({ id: "r-dangling", fromId: "ghost" }),
      rel({ id: "r-self", fromId: "a", toId: "a" }),
      rel({ id: "r-order", startDate: "2026-05-01", endDate: "2026-01-01" }),
      rel({ id: "r-invalid-date", startDate: "2026-1-5" }),
      rel({ id: "r-missing-date", type: "shipped_to", startDate: null }),
      rel({ id: "r-metadata", type: "supplies", metadata: { percent: 50 } }),
      rel({ id: "r-hier-1", type: "subordinate_to", fromId: "c", toId: "p1", metadata: { attachment: "organic" } }),
      rel({ id: "r-hier-2", type: "subordinate_to", fromId: "c", toId: "p2", metadata: { attachment: "organic" } }),
      rel({ id: "r-override", type: "supplies", exportOverride: VALID_OVERRIDE }),
    ]
    const entityIds = new Set(["a", "b", "c", "p1", "p2"])

    const violations = validateRelationships(corpus, entityIds)
    const emitted = new Set(codesOf(violations))

    expect(emitted).toEqual(new Set(RELATIONSHIP_VIOLATION_CODES))
    expect(emitted.size).toBe(9)
  })

  it("returns no violations for a clean corpus", () => {
    const corpus: Relationship[] = [
      rel({ id: "c-1", type: "subordinate_to", fromId: "u1", toId: "f1", metadata: { attachment: "organic" } }),
      rel({ id: "c-2", type: "shipped_to", fromId: "c1", toId: "c2", startDate: "2026-01-01" }),
      rel({ id: "c-3", type: "corporate_parent", fromId: "c1", toId: "c2", metadata: { percent: 49.9 } }),
      rel({
        id: "c-4", type: "owned_by", fromId: "c2", toId: "p1",
        startDate: "2020-01-01", endDate: "2026-01-01", metadata: { percent: 0 },
      }),
      rel({
        id: "c-5", type: "acts_for", fromId: "v1", toId: "c1",
        metadata: { basis: "intermediary" }, exportOverride: VALID_OVERRIDE,
      }),
      rel({ id: "c-6", type: "fields", fromId: "u1", toId: "e1" }),
    ]
    const entityIds = new Set(["u1", "f1", "c1", "c2", "p1", "v1", "e1"])

    expect(validateRelationships(corpus, entityIds)).toEqual([])
  })

  it("skips the dangling-endpoint check when entityIds is omitted", () => {
    const corpus: Relationship[] = [rel({ id: "d-1", fromId: "ghost-from", toId: "ghost-to" })]

    expect(validateRelationships(corpus)).toEqual([])

    const withEntityIds = validateRelationships(corpus, new Set(["a", "b"]))
    expect(codesOf(withEntityIds)).toEqual(["dangling-endpoint"])
    expect(withEntityIds[0].relationshipId).toBe("d-1")
  })

  it("reports invalid-date and not date-order for a non-padded start date", () => {
    // September before October in real dates, but "2026-9-1" > "2026-10-01" as a
    // string compare — the ordering check must never see a malformed date.
    const violations = validateRelationships([
      rel({ id: "dt-1", startDate: "2026-9-1", endDate: "2026-10-01" }),
    ])

    expect(codesOf(violations)).toContain("invalid-date")
    expect(codesOf(violations)).not.toContain("date-order")
    expect(violations).toHaveLength(1)
  })

  it("emits one multiple-active-hierarchy violation per offending edge", () => {
    const corpus: Relationship[] = [
      rel({ id: "h-1", type: "subordinate_to", fromId: "child", toId: "p1", metadata: { attachment: "organic" } }),
      rel({ id: "h-2", type: "subordinate_to", fromId: "child", toId: "p2", metadata: { attachment: "organic" } }),
      // An attached edge alongside an organic one is normal: attachment is not hierarchy.
      rel({ id: "h-3", type: "subordinate_to", fromId: "other", toId: "p1", metadata: { attachment: "organic" } }),
      rel({ id: "h-4", type: "subordinate_to", fromId: "other", toId: "p2", metadata: { attachment: "attached" } }),
      // An ended organic edge is not active, so it does not conflict.
      rel({ id: "h-5", type: "subordinate_to", fromId: "third", toId: "p1", metadata: { attachment: "organic" } }),
      rel({
        id: "h-6", type: "subordinate_to", fromId: "third", toId: "p2",
        endDate: "2020-01-01", metadata: { attachment: "organic" },
      }),
    ]

    const violations = validateRelationships(corpus)
    const hierarchy = violations.filter((violation) => violation.code === "multiple-active-hierarchy")

    expect(hierarchy).toHaveLength(2)
    expect(hierarchy.map((violation) => violation.relationshipId).sort()).toEqual(["h-1", "h-2"])
    expect(violations).toHaveLength(2)
  })

  it("draws the conflict for one active subordinate_to and one active corporate_parent", () => {
    // Q39: one definition of hierarchy-bearing, so a unit edge and a corporate
    // edge on the same child are two parents, not one of each kind.
    const mixed: Relationship[] = [
      rel({ id: "q-1", type: "subordinate_to", fromId: "child", toId: "p1" }),
      rel({ id: "q-2", type: "corporate_parent", fromId: "child", toId: "p2" }),
    ]

    const violations = validateRelationships(mixed)
    expect(codesOf(violations)).toEqual(["multiple-active-hierarchy", "multiple-active-hierarchy"])
    expect(violations.map((violation) => violation.relationshipId)).toEqual(["q-1", "q-2"])

    // The same child, once the corporate edge has ended: no conflict at all.
    expect(validateRelationships([
      mixed[0],
      rel({ id: "q-2", type: "corporate_parent", fromId: "child", toId: "p2", endDate: "2024-01-01" }),
    ])).toEqual([])
  })

  it("counts a subordinate_to edge that records no attachment as organic", () => {
    // Owner ruling 2026-07-29: organic is the default, "attached" the marked
    // exception. Slice 2 mints its subordinate_to edges without an attachment,
    // and the gate has to fire on them.
    const unmarked: Relationship[] = [
      rel({ id: "u-1", type: "subordinate_to", fromId: "child", toId: "p1", metadata: {} }),
      rel({ id: "u-2", type: "subordinate_to", fromId: "child", toId: "p2", metadata: {} }),
    ]

    const violations = validateRelationships(unmarked)
    expect(codesOf(violations)).toEqual(["multiple-active-hierarchy", "multiple-active-hierarchy"])
    expect(violations.map((violation) => violation.relationshipId)).toEqual(["u-1", "u-2"])

    // A key present with value undefined is absent, and absent is still organic.
    expect(validateRelationships([
      rel({ id: "u-3", type: "subordinate_to", fromId: "child", toId: "p1", metadata: { attachment: undefined } }),
      rel({ id: "u-4", type: "subordinate_to", fromId: "child", toId: "p2", metadata: {} }),
    ])).toHaveLength(2)

    // An unmarked edge conflicts with an explicitly organic one just the same.
    expect(validateRelationships([
      rel({ id: "u-5", type: "subordinate_to", fromId: "child", toId: "p1", metadata: {} }),
      rel({ id: "u-6", type: "subordinate_to", fromId: "child", toId: "p2", metadata: { attachment: "organic" } }),
    ])).toHaveLength(2)
  })

  it("drops the conflict when one of two unmarked edges is marked attached", () => {
    const violations = validateRelationships([
      rel({ id: "u-7", type: "subordinate_to", fromId: "child", toId: "p1", metadata: {} }),
      rel({ id: "u-8", type: "subordinate_to", fromId: "child", toId: "p2", metadata: { attachment: "attached" } }),
    ])

    expect(violations).toEqual([])
  })

  it("treats a metadata key present with value undefined as absent", () => {
    const withUndefined = validateRelationships([
      rel({ id: "m-1", type: "subordinate_to", metadata: { attachment: "organic", role: undefined } }),
    ])
    expect(withUndefined).toEqual([])

    const withValue = validateRelationships([
      rel({ id: "m-2", type: "subordinate_to", metadata: { attachment: "organic", role: "director" } }),
    ])
    expect(codesOf(withValue)).toEqual(["invalid-metadata"])
  })

  it("rejects a metadata value outside the declared set", () => {
    const violations = validateRelationships([
      rel({ id: "m-3", type: "subordinate_to", metadata: { attachment: "seconded" as never } }),
    ])
    expect(codesOf(violations)).toEqual(["invalid-metadata"])
  })

  it("rejects an export override on a record-tier edge", () => {
    for (const type of RECORD_TIER_TYPES) {
      const violations = validateRelationships([
        rel({ id: "x-" + type, type, startDate: "2026-01-01", exportOverride: VALID_OVERRIDE }),
      ])
      expect(codesOf(violations)).toEqual(["invalid-export-override"])
    }

    const assessment = validateRelationships([
      rel({ id: "x-acts-for", type: "acts_for", exportOverride: VALID_OVERRIDE }),
    ])
    expect(assessment).toEqual([])

    const selfConfirmed = validateRelationships([
      rel({
        id: "x-self", type: "acts_for",
        exportOverride: { ...VALID_OVERRIDE, confirmedBy: VALID_OVERRIDE.proposedBy },
      }),
    ])
    expect(codesOf(selfConfirmed)).toEqual(["invalid-export-override"])
  })

  it("treats a null or undefined exportOverride as absent, not as malformed", () => {
    // Trap T6: decodeRow assigns every descriptor prop unconditionally, so a NULL
    // persisted column arrives as a present key holding null.
    const persistedNull = validateRelationships([
      rel({ id: "xo-null", type: "acts_for", exportOverride: null as unknown as ExportOverride }),
    ])
    expect(persistedNull).toEqual([])

    const persistedUndefined = validateRelationships([
      rel({ id: "xo-undefined", type: "acts_for", exportOverride: undefined }),
    ])
    expect(persistedUndefined).toEqual([])
  })

  it("distinguishes a self-confirmed exportOverride from a structurally malformed one", () => {
    const selfConfirmed = validateRelationships([
      rel({
        id: "xo-self", type: "acts_for",
        exportOverride: { ...VALID_OVERRIDE, confirmedBy: VALID_OVERRIDE.proposedBy },
      }),
    ])
    const malformed = validateRelationships([
      rel({ id: "xo-bad", type: "acts_for", exportOverride: { ...VALID_OVERRIDE, rationale: "" } }),
    ])

    expect(codesOf(selfConfirmed)).toEqual(["invalid-export-override"])
    expect(codesOf(malformed)).toEqual(["invalid-export-override"])
    expect(selfConfirmed[0].detail).not.toEqual(malformed[0].detail)
    expect(selfConfirmed[0].detail).toContain("confirmedBy")
    expect(selfConfirmed[0].detail).toContain(VALID_OVERRIDE.proposedBy)
    expect(selfConfirmed[0].detail).not.toContain("malformed")
    expect(malformed[0].detail).toContain("malformed")
  })

  it("accepts a percent of 0, 100 and a non-integer, and rejects 101 and NaN", () => {
    for (const percent of [0, 100, 49.9]) {
      expect(validateRelationships([
        rel({ id: "pc-ok", type: "corporate_parent", metadata: { percent } }),
      ])).toEqual([])
    }

    for (const percent of [101, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(codesOf(validateRelationships([
        rel({ id: "pc-bad", type: "corporate_parent", metadata: { percent } }),
      ]))).toEqual(["invalid-metadata"])
    }
  })

  it("names the offending edge on every violation it emits", () => {
    const violations = validateRelationships([rel({ id: "n-1", fromId: "a", toId: "a" })])
    expect(violations[0].relationshipId).toBe("n-1")
    expect(violations[0].detail.length).toBeGreaterThan(0)
  })
})

describe("isActive", () => {
  it("treats an edge ended on a date as absent on that date and present the day before", () => {
    const ended = rel({ id: "a-1", endDate: "2026-03-01" })
    expect(isActive(ended, "2026-03-01")).toBe(false)
    expect(isActive(ended, "2026-02-28")).toBe(true)
  })

  it("treats an edge with a null endDate as active when no date is given", () => {
    expect(isActive(rel({ id: "a-2", endDate: null }))).toBe(true)
    expect(isActive(rel({ id: "a-3", endDate: "2026-03-01" }))).toBe(false)
    // With no date argument the start is irrelevant: active means "has not ended".
    expect(isActive(rel({ id: "a-4", startDate: "2999-01-01", endDate: null }))).toBe(true)
  })

  it("treats an edge started on a date as present on that date and absent the day before", () => {
    const started = rel({ id: "a-5", startDate: "2026-03-01" })
    expect(isActive(started, "2026-03-01")).toBe(true)
    expect(isActive(started, "2026-02-28")).toBe(false)
  })

  it("treats an open-ended edge as active on any date at or after its start", () => {
    const open = rel({ id: "a-6", startDate: null, endDate: null })
    expect(isActive(open, "1999-01-01")).toBe(true)
    expect(isActive(open, "2999-01-01")).toBe(true)
  })
})
