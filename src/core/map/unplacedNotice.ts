/** Only what naming an absent entity needs, so the notice is testable without a whole
 *  `MapEntity` -- the precedent is `Positionable` in `geometry.ts`. */
type Nameable = { id: string; name: string }

export type UnplacedNotice = {
  count: number
  names: string[]
  sentence: string
}

/**
 * The honest rendering of a contested entity is **nothing drawn** -- no invented midpoint and
 * no elected winner (ADR 0011) -- which leaves the reader with a map that is silently short.
 * This is the statement of that absence, and it is the only thing `unplacedByContest` was
 * ever for: `computeAllEntityPositions` has returned it since Slice 3 and nothing read it.
 *
 * Returns `null` rather than a zero-count notice, so the caller renders nothing at all in the
 * ordinary case instead of a reassurance nobody asked for.
 */
export function describeUnplacedByContest(
  unplacedIds: readonly string[],
  entities: readonly Nameable[],
): UnplacedNotice | null {
  const unique = [...new Set(unplacedIds)]
  if (unique.length === 0) return null

  const nameById = new Map(entities.map((e) => [e.id, e.name]))
  // The id is the fallback for an absent entity AND for a blank name: a list shorter than its
  // own count is the failure mode worth avoiding here, since the count is the claim being made.
  const names = unique
    .map((id) => (nameById.get(id) ?? "").trim() || id)
    .sort((a, b) => a.localeCompare(b))

  const plural = unique.length !== 1
  const sentence = plural
    ? String(unique.length) + " entities are not on the map: their parent is contested, so no position is derived for them."
    : "1 entity is not on the map: its parent is contested, so no position is derived for it."

  return { count: unique.length, names, sentence }
}
