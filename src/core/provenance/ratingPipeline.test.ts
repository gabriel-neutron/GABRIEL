import { describe, expect, it } from "vitest"
import { applyDeterministicRatingPipeline } from "./ratingPipeline"
import type { Source } from "./source"
import type { Claim } from "./claim"
import type { RatingEvent } from "./ratingEvent"

describe("applyDeterministicRatingPipeline", () => {
  it("backfills a null reliability, then leaves it alone for the (currently absent) actor posterior", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://gov.uk/a", domainType: "official", reliability: null }]
    const result = applyDeterministicRatingPipeline(sources, [], [])
    expect(result.sources[0]!.reliability).toBe("C")
    expect(result.events).toEqual([])
  })

  it("runs the actor posterior after backfill, on the letter backfill just assigned", () => {
    const sources: Source[] = [{ id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: null }]
    const claims: Claim[] = Array.from({ length: 3 }, (_, i) => ({
      id: `c-${i}`,
      entityId: `e-${i}`,
      field: "sources",
      value: null,
      sourceId: "src-1",
      credibility: 1,
      timestamp: null,
    }))
    const events: RatingEvent[] = claims.map((c) => ({
      id: crypto.randomUUID(),
      targetType: "claim",
      targetId: c.id,
      kind: "credibility",
      value: "1",
      assessor: { kind: "analyst" },
      timestamp: "2026-01-01T00:00:00.000Z",
    }))
    const result = applyDeterministicRatingPipeline(sources, claims, events)
    // Backfill would give osint -> C; the actor's 3-confirmed track record nudges it to B.
    expect(result.sources[0]!.reliability).toBe("B")
    // The original 3 confirm events survive, plus exactly one new posterior nudge event.
    expect(result.events).toHaveLength(events.length + 1)
    const nudgeEvent = result.events.find((e) => e.assessor.kind === "actor-posterior")
    expect(nudgeEvent).toBeDefined()
  })

  it("preserves the original event log and appends only the new posterior events", () => {
    const priorEvent: RatingEvent = {
      id: "evt-existing",
      targetType: "source",
      targetId: "src-1",
      kind: "reliability",
      value: "C",
      assessor: { kind: "analyst" },
      timestamp: "2026-01-01T00:00:00.000Z",
    }
    const sources: Source[] = [{ id: "src-1", url: "https://a.example", domainType: "web", reliability: null }]
    const result = applyDeterministicRatingPipeline(sources, [], [priorEvent])
    expect(result.events).toEqual([priorEvent])
  })
})
