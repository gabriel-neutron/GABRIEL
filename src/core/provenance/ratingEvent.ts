import type { RatingAssessor } from "./ratingMeta"

/**
 * Phase 4 (v1.5): an append-only audit trail entry, written on every rating change.
 * The current value stays materialized on the `Source`/`Claim` row (no replay needed
 * to render); this is the queryable history alongside it, persisted in `rating_events`.
 */
export type RatingEvent = {
  id: string
  targetType: "source" | "claim"
  targetId: string
  kind: "reliability" | "credibility"
  /** The letter (reliability) or number (credibility) as a string — one column serves both. */
  value: string
  assessor: RatingAssessor
  timestamp: string
}

export function createRatingEvent(args: {
  targetType: RatingEvent["targetType"]
  targetId: string
  kind: RatingEvent["kind"]
  value: string
  assessor: RatingAssessor
}): RatingEvent {
  return {
    id: crypto.randomUUID(),
    ...args,
    timestamp: new Date().toISOString(),
  }
}
