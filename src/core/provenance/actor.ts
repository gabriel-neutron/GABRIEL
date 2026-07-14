/**
 * Phase 6 (v2, exploratory): an Actor (URL -> channel/domain/byline) is the
 * doctrinally-correct unit a reliability *posterior* attaches to — not the individual
 * `Source` row, since the same outlet re-appears across many URLs. Right-sized for v1:
 * no persisted `Actor` table (see `right-size-to-project-scale`) — `Source.url`
 * already carries everything needed to derive one deterministically, so an Actor is a
 * pure computed identity, not a stored entity, until this needs richer per-actor state
 * (a byline, a maintained affiliation) an on-the-fly derivation can't hold.
 */
export function deriveActorId(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}
