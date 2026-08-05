/**
 * A search box query read as a coordinate pair.
 *
 * Lifted out of `UnifiedSearch` unchanged in behaviour: it was the one piece of that
 * component with a decidable right answer and no way to test it, since there is no React
 * Testing Library in this repo. It lives beside the instant index because it is the other
 * half of the same question — what did the analyst just type?
 */

const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)\s*$/

function inRange(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/**
 * `null` for anything that is not a bare pair of numbers — a name must never parse as a
 * coordinate, or pressing Enter on it would fly the map somewhere instead of searching.
 *
 * A pair is read as `lat, lng` first and swapped only when that reading is impossible and
 * the swapped one is valid. Silently reordering an already-valid pair would move the map
 * to a place the analyst did not ask for and give them no way to tell.
 */
export function parseCoordinateQuery(query: string): { lat: number; lng: number } | null {
  const match = PAIR.exec(query.trim())
  if (!match) return null

  const first = Number(match[1])
  const second = Number(match[2])
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null

  if (inRange(first, second)) return { lat: first, lng: second }
  if (inRange(second, first)) return { lat: second, lng: first }
  return null
}
