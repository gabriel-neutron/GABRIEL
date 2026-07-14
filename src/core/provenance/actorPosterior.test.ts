import { describe, expect, it } from "vitest"
import { applyActorPosterior, computeActorTrackRecord } from "./actorPosterior"
import type { Source } from "./source"
import type { Claim } from "./claim"
import type { RatingEvent } from "./ratingEvent"

function confirmEvent(targetId: string): RatingEvent {
  return { id: crypto.randomUUID(), targetType: "claim", targetId, kind: "credibility", value: "1", assessor: { kind: "analyst" }, timestamp: "2026-01-01T00:00:00.000Z" }
}
function refuteEvent(targetId: string): RatingEvent {
  return { id: crypto.randomUUID(), targetType: "claim", targetId, kind: "credibility", value: "refuted", assessor: { kind: "analyst" }, timestamp: "2026-01-01T00:00:00.000Z" }
}

describe("computeActorTrackRecord", () => {
  const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
  const claims: Claim[] = [
    { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 1, timestamp: null },
    { id: "c-2", entityId: "e-2", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null },
  ]

  it("counts confirmed and refuted events belonging to the given actor's claims only", () => {
    const events = [confirmEvent("c-1"), refuteEvent("c-2")]
    const record = computeActorTrackRecord("bellingcat.com", events, claims, [source])
    expect(record).toEqual({ confirmedCount: 1, refutedCount: 1 })
  })

  it("ignores events belonging to a different actor's claims", () => {
    const otherSource: Source = { id: "src-2", url: "https://other.example/a", domainType: "news", reliability: "D" }
    const otherClaim: Claim = { id: "c-3", entityId: "e-3", field: "sources", value: null, sourceId: "src-2", credibility: 1, timestamp: null }
    const events = [confirmEvent("c-3")]
    const record = computeActorTrackRecord("bellingcat.com", events, [...claims, otherClaim], [source, otherSource])
    expect(record).toEqual({ confirmedCount: 0, refutedCount: 0 })
  })
})

describe("applyActorPosterior", () => {
  function manyConfirmedClaims(sourceId: string, count: number): Claim[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `c-${sourceId}-${i}`,
      entityId: `e-${i}`,
      field: "sources",
      value: null,
      sourceId,
      credibility: 1 as const,
      timestamp: null,
    }))
  }

  it("nudges a source's reliability up to B after >=3 confirmed, zero refuted claims from its actor", () => {
    const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const claims = manyConfirmedClaims("src-1", 3)
    const events = claims.map((c) => confirmEvent(c.id))
    const result = applyActorPosterior([source], events, claims)
    expect(result.sources[0]!.reliability).toBe("B")
    expect(result.sources[0]!.reliabilityMeta?.assessor).toEqual({ kind: "actor-posterior" })
  })

  it("nudges up to A after >=6 confirmed, zero refuted claims", () => {
    const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const claims = manyConfirmedClaims("src-1", 6)
    const events = claims.map((c) => confirmEvent(c.id))
    const result = applyActorPosterior([source], events, claims)
    expect(result.sources[0]!.reliability).toBe("A")
  })

  it("emits an auditable rating_event for every nudge it makes", () => {
    const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const claims = manyConfirmedClaims("src-1", 3)
    const events = claims.map((c) => confirmEvent(c.id))
    const result = applyActorPosterior([source], events, claims)
    const nudgeEvent = result.events.find((e) => e.targetType === "source" && e.targetId === "src-1")
    expect(nudgeEvent).toBeDefined()
    expect(nudgeEvent!.value).toBe("B")
    expect(nudgeEvent!.assessor).toEqual({ kind: "actor-posterior" })
  })

  it("does not nudge when a single refutation is present, however many confirmations", () => {
    const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const claims = manyConfirmedClaims("src-1", 6)
    const events = [...claims.map((c) => confirmEvent(c.id)), refuteEvent(claims[0]!.id)]
    const result = applyActorPosterior([source], events, claims)
    expect(result.sources[0]!.reliability).toBe("C")
    expect(result.events).toEqual([])
  })

  it("never overwrites a human-overridden source, however strong the track record", () => {
    const source: Source = {
      id: "src-1",
      url: "https://bellingcat.com/a",
      domainType: "osint",
      reliability: "F",
      reliabilityMeta: { confidence: null, rationale: null, assessor: { kind: "analyst" }, updatedAt: "t", overridden: true },
    }
    const claims = manyConfirmedClaims("src-1", 6)
    const events = claims.map((c) => confirmEvent(c.id))
    const result = applyActorPosterior([source], events, claims)
    expect(result.sources[0]).toEqual(source)
    expect(result.events).toEqual([])
  })

  it("is a no-op with no confirmed history (the dormant default until real usage exists)", () => {
    const source: Source = { id: "src-1", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const result = applyActorPosterior([source], [], [])
    expect(result.sources).toEqual([source])
    expect(result.events).toEqual([])
  })

  it("tallies multiple distinct actors correctly in one pass — the batched grouping this perf fix introduced", () => {
    const strongSource: Source = { id: "src-strong", url: "https://bellingcat.com/a", domainType: "osint", reliability: "C" }
    const weakSource: Source = { id: "src-weak", url: "https://other.example/a", domainType: "news", reliability: "D" }
    const strongClaims = manyConfirmedClaims("src-strong", 3)
    const weakClaims = manyConfirmedClaims("src-weak", 1) // below the B threshold
    const events = [...strongClaims.map((c) => confirmEvent(c.id)), ...weakClaims.map((c) => confirmEvent(c.id))]
    const result = applyActorPosterior([strongSource, weakSource], events, [...strongClaims, ...weakClaims])
    const byId = new Map(result.sources.map((s) => [s.id, s]))
    expect(byId.get("src-strong")!.reliability).toBe("B") // 3 confirmed, its own actor's tally
    expect(byId.get("src-weak")!.reliability).toBe("D") // only 1 confirmed, unaffected by the other actor's 3
  })
})
