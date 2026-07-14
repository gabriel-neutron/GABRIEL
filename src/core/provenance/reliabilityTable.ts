import type { SourceDomainType } from "@/types/enrichment.types"
import { RELIABILITY_RATINGS, type AdmiraltyReliability } from "./admiralty"
import { isInterestedParty } from "./interestedParty"
import type { Source } from "./source"

/**
 * Bump on a deliberate re-tune of the table below. A version bump is what makes a
 * re-rate an explicit, logged action later — `backfillReliability` itself never
 * re-rates a source that already has a letter (null-fill only).
 */
export const RELIABILITY_MAPPING_VERSION = "v1"

/**
 * ADR 0008: a capped, deterministic type-prior — never `A`/`B` (those are earned via
 * human override or the future actor posterior), and `F` (not `E`) for sources this
 * table can't speak to at all, so a strong low-type primary witness (e.g. a named
 * milblogger) isn't pre-condemned below a state wire service.
 */
export function getReliabilityFromType(domainType: SourceDomainType | null): AdmiraltyReliability {
  switch (domainType) {
    case "official":
    case "osint":
      return "C"
    case "news":
    case "wikipedia":
      return "D"
    default:
      return "F"
  }
}

/** One notch worse than `letter`, clamped at `F` (the scale's floor) — never wraps. */
function oneNotchWorse(letter: AdmiraltyReliability): AdmiraltyReliability {
  const index = RELIABILITY_RATINGS.indexOf(letter)
  return RELIABILITY_RATINGS[Math.min(index + 1, RELIABILITY_RATINGS.length - 1)]!
}

/**
 * ADR 0008: null-fills every source lacking a reliability letter with the deterministic
 * type-table prior, stamped `type-table`/`RELIABILITY_MAPPING_VERSION`. Never touches a
 * source that already carries a letter (human-set or from a prior backfill run), so
 * re-running is a no-op — a re-tune requires bumping the mapping version and re-rating
 * explicitly (not yet implemented; see the timeline's "Ongoing Cadence"). An
 * interested-party source (ADR 0008) is flagged and its prior capped one notch below
 * the bare type-table letter — authoritative on provenance, interested on content.
 */
export function backfillReliability(sources: Source[]): Source[] {
  return sources.map((source) => {
    if (source.reliability != null) return source
    const interestedParty = isInterestedParty(source.url)
    const baseLetter = getReliabilityFromType(source.domainType)
    const reliability = interestedParty ? oneNotchWorse(baseLetter) : baseLetter
    return {
      ...source,
      reliability,
      interestedParty: interestedParty ? true : source.interestedParty,
      reliabilityMeta: {
        confidence: null,
        rationale: interestedParty
          ? "type-based prior, capped for an interested-party domain"
          : "type-based prior from domain classification",
        assessor: { kind: "type-table", mappingVersion: RELIABILITY_MAPPING_VERSION },
        mappingVersion: RELIABILITY_MAPPING_VERSION,
        updatedAt: new Date().toISOString(),
        overridden: false,
      },
    }
  })
}
