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

export function setSourceReliability(
  sources: Source[],
  sourceId: string,
  reliability: AdmiraltyReliability | null,
): Source[] {
  return sources.map((s) => (s.id === sourceId ? { ...s, reliability } : s))
}
