/**
 * The keyboard decisions for the search dropdown, as pure functions.
 *
 * They live here rather than inside `UnifiedSearch` because this repository has no jsdom and no
 * testing-library (a standing decision — `vitest.config.ts` runs `environment: "node"`), so
 * anything left inside the component is untestable by construction. Driving the shipped dropdown
 * in a browser on 2026-08-05 found that Enter ran an online geocode while an exact name match sat
 * at the top of the list, and that the arrow keys did nothing at all: both are decisions, and a
 * decision that cannot be asserted is a decision that drifts.
 */

/** No row is highlighted. Distinct from row 0, which is a real, chosen row. */
export const NO_ACTIVE_ROW = -1

/**
 * Arrow-key movement, wrapping at both ends. From nothing highlighted, ArrowDown takes the first
 * row and ArrowUp takes the last, so a user reaching for the bottom of a short list gets there in
 * one key rather than in `length` of them.
 */
export function nextActiveRow(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return NO_ACTIVE_ROW
  if (current < 0) return delta === 1 ? 0 : length - 1
  return (current + delta + length) % length
}

export type EnterAction = { kind: "select"; index: number } | { kind: "online" }

/**
 * What Enter does, per the owner's ruling of 2026-08-05: the highlighted row if there is one,
 * otherwise the top result, and the online geocode ONLY when the query matched nothing locally.
 *
 * The ordering matters for more than convenience. The shipped behaviour sent whatever the analyst
 * had typed — an entity name, out of a local-first project — to `nominatim.openstreetmap.org` on
 * a keystroke they had every reason to read as "select the thing I am looking at". Reaching the
 * network is now something the query has to earn by matching nothing on the device.
 */
export function enterAction(activeIndex: number, rowCount: number): EnterAction {
  if (rowCount > 0) {
    return { kind: "select", index: activeIndex >= 0 && activeIndex < rowCount ? activeIndex : 0 }
  }
  return { kind: "online" }
}
