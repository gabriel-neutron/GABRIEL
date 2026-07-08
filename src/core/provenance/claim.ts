import type { AdmiraltyCredibility } from "./admiralty"

/**
 * ADR 0006: a specific asserted fact linked to the specific `Source` that asserts it.
 * `field: "sources"` with `value: null` is the sentinel used for a general citation not
 * tied to any one field (the shape every existing citation currently has — E2 does not
 * invent per-field attribution that isn't already in the data, see ROADMAP.md's E2 note).
 */
export type Claim = {
  id: string
  entityId: string
  field: string
  value: string | null
  sourceId: string
  credibility: AdmiraltyCredibility | null
  timestamp: string | null
}

export const GENERAL_CITATION_FIELD = "sources"
