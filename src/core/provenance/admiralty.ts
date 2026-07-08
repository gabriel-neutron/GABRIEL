import type { Source } from "./source"

/** NATO STANAG 2511 (ADMIRALTY) source-reliability rating. */
export type AdmiraltyReliability = "A" | "B" | "C" | "D" | "E" | "F"

/** NATO STANAG 2511 (ADMIRALTY) information-credibility rating. */
export type AdmiraltyCredibility = 1 | 2 | 3 | 4 | 5 | 6

export function setSourceReliability(
  sources: Source[],
  sourceId: string,
  reliability: AdmiraltyReliability | null,
): Source[] {
  return sources.map((s) => (s.id === sourceId ? { ...s, reliability } : s))
}
