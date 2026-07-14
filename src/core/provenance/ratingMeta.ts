/**
 * Provenance for a single reliability/credibility rating value — who/what assigned it
 * and how confident/overridable it is. Persisted as JSON in `reliability_meta` /
 * `credibility_meta` (both optional columns; see `provenanceSources.table.ts` /
 * `provenanceClaims.table.ts`). Phase 2/3 populate `mappingVersion` / `evidenceRefs`
 * etc.; Phase 1 only makes the shape and its round-trip through SQL exist.
 */
export type RatingAssessor = {
  /** Phase 6 (v2, exploratory): `actor-posterior` — a nudge earned by an Actor's own confirmed/refuted track record, not a fresh type-table prior. */
  kind: "ai" | "analyst" | "type-table" | "actor-posterior"
  model?: string
  promptVersion?: string
  analystId?: string
  mappingVersion?: string
}

export type RatingMeta = {
  confidence: number | null
  rationale: string | null
  assessor: RatingAssessor
  mappingVersion?: string
  updatedAt: string
  overridden: boolean
}

/** `Claim.credibilityMeta`'s shape (ADR 0009): the evidence a credibility rating rests on. */
export type CredibilityMeta = RatingMeta & {
  evidenceRefs: string[]
  corroborationClusters: number
  statedAttribution: string | null
  /** Citation `publishedAt` dates that were available (ISO strings) — the human Confirm gate (Phase 4) requires at least one. */
  dates?: string[]
}

export function encodeRatingMeta(meta: RatingMeta | undefined): string | null {
  return meta != null ? JSON.stringify(meta) : null
}

/**
 * `undefined` (not `null`), mirroring `decodeAliases` (units.table.ts): opt-in metadata
 * stays absent rather than defaulted, and a corrupt/future-format value decodes back to
 * absent instead of throwing.
 */
export function decodeRatingMeta(raw: unknown): RatingMeta | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined
  try {
    return JSON.parse(raw) as RatingMeta
  } catch {
    return undefined
  }
}
