/**
 * ADR 0008: a small, curated set of state media / belligerent MoD domains — a
 * maintained affiliation platform is explicitly rejected as disproportionate for a
 * single-user, local-first tool (see `right-size-to-project-scale`). Grows only by
 * reviewing newly-observed sources (see the timeline's "Ongoing Cadence"), matched
 * by DNS *label* like `domainType.ts`'s `official`/`mil` check, not raw substring.
 */
const INTERESTED_PARTY_LABELS = new Set([
  "tass.com",
  "ria.ru",
  "rian.ru",
  "sputniknews.com",
  "rt.com",
  "mil.ru",
  // Phase 5 (v1.5): expanded from observed sources, per the timeline's "Ongoing Cadence".
  "kremlin.ru",
  "tvzvezda.ru", // Zvezda — the Russian MoD's own broadcaster, not merely state-adjacent
  "izvestia.ru",
  "belta.by", // Belarusian state news agency
])

/**
 * True if `url`'s host is a party to what it reports (state media, a belligerent
 * MoD) — lowers the reliability prior and disqualifies the source as an independent
 * corroborating origin (consumed by Phase 3's clustering). An unparseable URL is
 * simply not flagged, matching `getDomainTypeFromUrl`'s tolerance.
 */
export function isInterestedParty(url: string): boolean {
  let hostname = ""
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  for (const party of INTERESTED_PARTY_LABELS) {
    if (hostname === party || hostname.endsWith(`.${party}`)) return true
  }
  return false
}
