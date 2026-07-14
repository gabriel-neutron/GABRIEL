import type { Source } from "./source"

/** NATO STANAG 2511 (ADMIRALTY) source-reliability rating. */
export type AdmiraltyReliability = "A" | "B" | "C" | "D" | "E" | "F"

/** NATO STANAG 2511 (ADMIRALTY) information-credibility rating. */
export type AdmiraltyCredibility = 1 | 2 | 3 | 4 | 5 | 6

/** The closed ADMIRALTY reliability rating set, in canonical order (best to worst) — the single definition consumers (e.g. a rating `<select>`) should iterate rather than hand-copying. */
export const RELIABILITY_RATINGS: AdmiraltyReliability[] = ["A", "B", "C", "D", "E", "F"]
const RELIABILITY_VALUES = new Set<AdmiraltyReliability>(RELIABILITY_RATINGS)
const CREDIBILITY_VALUES = new Set<AdmiraltyCredibility>([1, 2, 3, 4, 5, 6])

/** A persisted value outside the closed rating set (corrupt/future file) defaults to null. */
export function decodeAdmiraltyReliability(raw: unknown): AdmiraltyReliability | null {
  return typeof raw === "string" && RELIABILITY_VALUES.has(raw as AdmiraltyReliability)
    ? (raw as AdmiraltyReliability)
    : null
}

export function decodeAdmiraltyCredibility(raw: unknown): AdmiraltyCredibility | null {
  const n = Number(raw)
  return CREDIBILITY_VALUES.has(n as AdmiraltyCredibility) ? (n as AdmiraltyCredibility) : null
}

export type CredibilityCapParams = {
  /** False when the clustering pass found no usable citation at all. */
  hasBasis: boolean
  clusterCount: number
  contradicted: boolean
  /** A clear timeline shows one side is favored, rather than an unresolved disagreement. */
  positivelyContradicted?: boolean
}

/**
 * ADR 0009: enforces the credibility ceiling **in code**, never trusting the AI's raw
 * number — `1` ("Confirmed") is reserved for the human review-queue Confirm action and
 * is categorically unreachable here. No basis at all is a first-class abstention (`6`),
 * never collapsed to a low number. A contradicted claim caps at `4` (`5` if a clear
 * timeline favors one side). Otherwise — any number of corroborating clusters, no
 * contradiction — caps at `2`: cluster count beyond one still doesn't earn `1`, which
 * stays human-only regardless of how much the machine has automatically corroborated.
 */
export function clampCredibility(aiSuggested: number, params: CredibilityCapParams): AdmiraltyCredibility {
  if (!params.hasBasis) return 6
  const cap: AdmiraltyCredibility = params.contradicted ? (params.positivelyContradicted ? 5 : 4) : 2
  const suggested = Number.isFinite(aiSuggested) ? Math.round(aiSuggested) : 2
  const clamped = Math.min(Math.max(suggested, 2), cap)
  return CREDIBILITY_VALUES.has(clamped as AdmiraltyCredibility) ? (clamped as AdmiraltyCredibility) : cap
}

/**
 * The human-override path (ADR 0009): the only way a Source reaches `A`/`B`. Always
 * wins over an AI/type-table value and marks `overridden: true` so a later backfill
 * or AI re-assessment skips it rather than clobbering it. Clearing back to `null`
 * clears `reliabilityMeta` too — no rating, no rating provenance.
 */
export function setSourceReliability(
  sources: Source[],
  sourceId: string,
  reliability: AdmiraltyReliability | null,
): Source[] {
  return sources.map((s) =>
    s.id === sourceId
      ? {
          ...s,
          reliability,
          reliabilityMeta:
            reliability == null
              ? undefined
              : {
                  confidence: null,
                  rationale: null,
                  assessor: { kind: "analyst" },
                  updatedAt: new Date().toISOString(),
                  overridden: true,
                },
        }
      : s,
  )
}
