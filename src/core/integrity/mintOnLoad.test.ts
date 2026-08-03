import { describe, expect, it } from "vitest"
import type { Relationship } from "@/core/relationship/relationship"
import { validateRelationships } from "@/core/relationship/validate"
import { INTEGRITY_EVENT_KINDS } from "./integrityEvent"
import { relationshipViolationEvents } from "./mintOnLoad"

/**
 * The owner ruling of 2026-08-03: the six violation codes with no kind of their own —
 * `unknown-type`, `date-order`, `invalid-date`, `missing-required-date`, `invalid-metadata`,
 * `invalid-export-override` — become durable `integrity_events` rows instead of a console
 * warning. Q2B-7's stopgap is superseded.
 */

const NOW = "2026-08-03T00:00:00.000Z"

const ENTITIES = [
  { id: "e-1", name: "3rd Motor Rifle Brigade", kind: "unit" },
  { id: "e-2", name: "58th Combined Arms Army", kind: "unit" },
]

function edge(id: string, extra: Partial<Relationship> = {}): Relationship {
  return {
    id, fromId: "e-1", toId: "e-2", type: "subordinate_to",
    startDate: null, endDate: null, metadata: {}, ...extra,
  }
}

describe("relationshipViolationEvents", () => {
  it("mints one acknowledgeable row per recordable violation, naming the entities", () => {
    const rels = [edge("r-1", { startDate: "2026-05-01", endDate: "2026-01-01" })]
    const events = relationshipViolationEvents(validateRelationships(rels), rels, ENTITIES, NOW)

    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe("invalid-entry")
    expect((INTEGRITY_EVENT_KINDS as readonly string[])).toContain(events[0].kind)
    expect(events[0].createdAt).toBe(NOW)
    // Pinned whole rather than by substring: criterion 82 grades the sentence a person reads,
    // and only an exact match catches it drifting back into a template. One "recorded", in the
    // tail, where it carries the meaning.
    expect(events[0].summary).toBe(
      "The relationship from \"3rd Motor Rifle Brigade\" to \"58th Combined Arms Army\" " +
      "is dated as having started after it ended, so it is kept exactly as recorded and left " +
      "for a person to correct.",
    )
    // The code and the offending edge are in `detail`, so the sentence stays readable and the
    // machine-side facts are still exact.
    expect(events[0].detail.code).toBe("date-order")
    expect(events[0].detail.relationshipId).toBe("r-1")
  })

  it("gives two violations on the same edge two ids, and re-detection the same ids", () => {
    const rels = [edge("r-1", { type: "invented_type" as Relationship["type"], startDate: "yesterday" })]
    const first = relationshipViolationEvents(validateRelationships(rels), rels, ENTITIES, NOW)
    const second = relationshipViolationEvents(validateRelationships(rels), rels, ENTITIES, NOW)

    expect(first.map((e) => e.id)).toEqual([
      "integrity:invalid-entry:unknown-type:r-1",
      "integrity:invalid-entry:invalid-date:r-1",
    ])
    // Deterministic, so a re-detected condition updates one row instead of accumulating rows.
    expect(second).toEqual(first)
  })

  it("records nothing for the codes that throw or have a kind of their own", () => {
    // `self-loop` (fatal, `load.ts` throws) and `multiple-active-hierarchy` (its own kind).
    const rels = [
      edge("r-loop", { fromId: "e-1", toId: "e-1" }),
      edge("r-a", { toId: "e-2" }),
      edge("r-b", { toId: "e-3" }),
    ]
    expect(relationshipViolationEvents(validateRelationships(rels), rels, ENTITIES, NOW)).toEqual([])
  })
})
