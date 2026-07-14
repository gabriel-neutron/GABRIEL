import { backfillReliability } from "./reliabilityTable"
import { applyActorPosterior } from "./actorPosterior"
import type { Source } from "./source"
import type { Claim } from "./claim"
import type { RatingEvent } from "./ratingEvent"

/**
 * The two deterministic (zero-AI) rating passes that run on every project load, in
 * order: Phase 2's null-fill type-table backfill, then Phase 6's actor-posterior
 * nudge (which needs the letter backfill just assigned, to know what it's nudging
 * from). Returns the full event log with any new posterior nudges appended — dormant
 * (no new events) until real Confirm/Refute history exists to nudge from.
 */
export function applyDeterministicRatingPipeline(
  sources: Source[],
  claims: Claim[],
  events: RatingEvent[],
): { sources: Source[]; events: RatingEvent[] } {
  const backfilled = backfillReliability(sources)
  const posterior = applyActorPosterior(backfilled, events, claims)
  return { sources: posterior.sources, events: [...events, ...posterior.events] }
}
