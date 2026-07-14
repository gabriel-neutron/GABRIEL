import type { Source } from "./source"
import type { Claim } from "./claim"
import type { RatingEvent } from "./ratingEvent"
import { createRatingEvent } from "./ratingEvent"
import { deriveActorId } from "./actor"
import { RELIABILITY_RATINGS, type AdmiraltyReliability } from "./admiralty"

const CONFIRMED_FOR_B = 3
const CONFIRMED_FOR_A = 6

export type ActorTrackRecord = { confirmedCount: number; refutedCount: number }

/**
 * Tallies every actor's human `rating_events` in a single pass — a claim counts only
 * if it cites a Source whose derived Actor matches. `applyActorPosterior` calls this
 * once per `sources` array rather than once per source, so the lookup Maps and the
 * `events` scan aren't rebuilt/rerun on every source (O(sources+claims+events) total,
 * not O(sources × (sources+claims+events))).
 */
function computeAllActorTrackRecords(
  events: RatingEvent[],
  claims: Claim[],
  sources: Source[],
): Map<string, ActorTrackRecord> {
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const records = new Map<string, ActorTrackRecord>()
  for (const event of events) {
    if (event.kind !== "credibility" || event.targetType !== "claim") continue
    const claim = claimById.get(event.targetId)
    if (!claim) continue
    const source = sourceById.get(claim.sourceId)
    if (!source) continue
    const actorId = deriveActorId(source.url)
    if (actorId == null) continue
    const record = records.get(actorId) ?? { confirmedCount: 0, refutedCount: 0 }
    if (event.value === "1") record.confirmedCount += 1
    else if (event.value === "refuted") record.refutedCount += 1
    records.set(actorId, record)
  }
  return records
}

/**
 * Phase 6 (v2, exploratory): tallies a single actor's human `rating_events`. Dormant
 * (returns zero/zero) until enough human Confirm/Refute actions exist to say
 * anything, which is the honest state for a feature with no production usage yet.
 * A thin wrapper over `computeAllActorTrackRecords` — kept as the public,
 * single-actor entry point since callers/tests only ever need one actor's record.
 */
export function computeActorTrackRecord(
  actorId: string,
  events: RatingEvent[],
  claims: Claim[],
  sources: Source[],
): ActorTrackRecord {
  return computeAllActorTrackRecords(events, claims, sources).get(actorId) ?? { confirmedCount: 0, refutedCount: 0 }
}

/** Never worse than `current`, never past `A` — a nudge only ever moves reliability up. */
function nudgeUp(current: AdmiraltyReliability, record: ActorTrackRecord): AdmiraltyReliability {
  if (record.refutedCount > 0) return current
  const target: AdmiraltyReliability =
    record.confirmedCount >= CONFIRMED_FOR_A ? "A" : record.confirmedCount >= CONFIRMED_FOR_B ? "B" : current
  const currentRank = RELIABILITY_RATINGS.indexOf(current)
  const targetRank = RELIABILITY_RATINGS.indexOf(target)
  return targetRank < currentRank ? target : current
}

/**
 * ADR 0008's doctrinally-correct evolution: nudges a source's reliability up when its
 * Actor has earned a strong, unrefuted confirmed-claim track record — never below
 * `current`, never past `A`, and never touching a human-overridden source (that value
 * already reflects an analyst's direct judgment, which this must not silently
 * supersede). Every nudge it makes is returned as a `RatingEvent` so the caller can
 * append it to the audit trail — this is an automated change, unlike the Phase 2
 * type-table backfill, so it must be auditable.
 */
export function applyActorPosterior(
  sources: Source[],
  events: RatingEvent[],
  claims: Claim[],
): { sources: Source[]; events: RatingEvent[] } {
  const allRecords = computeAllActorTrackRecords(events, claims, sources)
  const newEvents: RatingEvent[] = []
  const nudgedSources = sources.map((source) => {
    if (source.reliability == null || source.reliabilityMeta?.overridden === true) return source
    const actorId = deriveActorId(source.url)
    if (actorId == null) return source
    const record = allRecords.get(actorId) ?? { confirmedCount: 0, refutedCount: 0 }
    const nudged = nudgeUp(source.reliability, record)
    if (nudged === source.reliability) return source

    newEvents.push(
      createRatingEvent({
        targetType: "source",
        targetId: source.id,
        kind: "reliability",
        value: nudged,
        assessor: { kind: "actor-posterior" },
      }),
    )
    return {
      ...source,
      reliability: nudged,
      reliabilityMeta: {
        confidence: null,
        rationale: `actor track record: ${record.confirmedCount} confirmed, ${record.refutedCount} refuted`,
        assessor: { kind: "actor-posterior" as const },
        updatedAt: new Date().toISOString(),
        overridden: false,
      },
    }
  })
  return { sources: nudgedSources, events: newEvents }
}
