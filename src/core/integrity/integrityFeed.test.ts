import { describe, expect, it } from "vitest"
import type { IntegrityEvent } from "./integrityEvent"
import { INTEGRITY_EVENT_KINDS } from "./integrityEvent"
import { INTEGRITY_KIND_LABELS, orderIntegrityFeed, summariseDetail } from "./integrityFeed"

function event(overrides: Partial<IntegrityEvent> = {}): IntegrityEvent {
  return {
    id: "ie-1",
    kind: "multiple-active-hierarchy",
    createdAt: "2026-08-01T09:00:00.000Z",
    summary: "A contest.",
    detail: {},
    ...overrides,
  }
}

const ids = (events: readonly IntegrityEvent[]): string[] => events.map((e) => e.id)

describe("orderIntegrityFeed", () => {
  it("puts what nobody has acknowledged above what somebody has", () => {
    const feed = orderIntegrityFeed([
      event({ id: "done", acknowledgedAt: "2026-08-03T09:00:00.000Z", createdAt: "2026-08-03T09:00:00.000Z" }),
      event({ id: "open", createdAt: "2026-08-01T09:00:00.000Z" }),
    ])

    expect(ids(feed)).toEqual(["open", "done"])
  })

  it("orders each group newest first", () => {
    const feed = orderIntegrityFeed([
      event({ id: "old", createdAt: "2026-08-01T09:00:00.000Z" }),
      event({ id: "new", createdAt: "2026-08-03T09:00:00.000Z" }),
      event({ id: "mid", createdAt: "2026-08-02T09:00:00.000Z" }),
    ])

    expect(ids(feed)).toEqual(["new", "mid", "old"])
  })

  // Two events minted in the same derivation share a timestamp to the millisecond, which is
  // the common case rather than a corner one: `commitRelationships` stamps every contest it
  // mints with one `now`. Falling back to the id keeps a published audit trail in the same
  // order on every machine instead of depending on the sort's stability.
  it("breaks a timestamp tie on the id, so the order is reproducible", () => {
    const same = "2026-08-01T09:00:00.000Z"
    const forward = orderIntegrityFeed([event({ id: "b", createdAt: same }), event({ id: "a", createdAt: same })])
    const backward = orderIntegrityFeed([event({ id: "a", createdAt: same }), event({ id: "b", createdAt: same })])

    expect(ids(forward)).toEqual(["a", "b"])
    expect(ids(backward)).toEqual(["a", "b"])
  })

  it("does not mutate the array it is handed", () => {
    const events = [event({ id: "old", createdAt: "2026-08-01T09:00:00.000Z" }), event({ id: "new", createdAt: "2026-08-03T09:00:00.000Z" })]

    orderIntegrityFeed(events)

    expect(ids(events)).toEqual(["old", "new"])
  })
})

describe("INTEGRITY_KIND_LABELS", () => {
  // A kind added to the union without a label here would render as its raw slug in the one
  // surface that exists to be read by a person. The table is typed as a total record, so
  // this test guards the runtime list rather than the type.
  it("names every declared kind", () => {
    for (const kind of INTEGRITY_EVENT_KINDS) {
      expect(INTEGRITY_KIND_LABELS[kind]).toBeTruthy()
    }
  })
})

describe("summariseDetail", () => {
  it("returns nothing for an empty payload", () => {
    expect(summariseDetail({})).toEqual([])
  })

  it("orders keys alphabetically so two readings of one event agree", () => {
    expect(summariseDetail({ parentIds: ["e-2"], childId: "e-3" }).map((row) => row.key)).toEqual(["childId", "parentIds"])
  })

  it("joins an array rather than printing it as JSON", () => {
    expect(summariseDetail({ parentIds: ["e-1", "e-2"] })[0].value).toBe("e-1, e-2")
  })

  it("prints null as a word rather than as nothing", () => {
    expect(summariseDetail({ parentKind: null })[0].value).toBe("null")
  })

  it("falls back to JSON for a nested payload", () => {
    expect(summariseDetail({ detail: { at: 2 } })[0].value).toBe("{\"at\":2}")
  })
})
