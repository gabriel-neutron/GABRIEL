import type { FingerprintReport } from "./hierarchy.fingerprint.harness"

/**
 * Rendering and diffing for the step-19 harness. Separate from the computation so that a change
 * to how the report READS can never change what it MEASURES.
 *
 * §10 step 19 needs values, not a green tick: it compares Hash A and Hash B taken from the
 * migrated file against the same two taken before the write, with zero tolerance, and when B
 * differs its diagnosis is a count — "at or below 741 says the derivation is broken", 741 being
 * the units whose map position comes from the parent chain rather than their own geometry. So a
 * bare hash mismatch is not enough; the per-entity diff is the diagnosis.
 */

/** The units whose position derives from the parent chain rather than their own geometry. A
 *  position diff bounded by this number is a hierarchy fault, not a coordinate edit. */
export const DERIVED_POSITION_UNITS = 741

function pad(label: string): string {
  return (label + "                        ").slice(0, 24)
}

function countLine(entry: { table: string; count: number | null; parented: number | null }): string {
  const value = entry.count === null ? "table absent" : String(entry.count)
  const parented = entry.parented === null ? "" : `  (parent_id not null: ${String(entry.parented)})`
  return `  ${pad(entry.table)}${value}${parented}`
}

export function formatReport(report: FingerprintReport): string {
  const lines = [
    "",
    "=== hierarchy fingerprint ===============================================",
    `  ${pad("file")}${report.path}`,
    `  ${pad("size (bytes)")}${String(report.fileSizeBytes)}`,
    "",
    `  ${pad("Hash A (parents)")}${report.hashA}`,
    `  ${pad("Hash B (positions)")}${report.hashB}`,
    `  ${pad("Hash C (depths)")}${report.hashC}`,
    "",
    `  ${pad("entities")}${String(report.entityCount)}`,
    `  ${pad("parented")}${String(report.parents.size)}`,
    `  ${pad("rendered")}${String(report.renderedCount)}`,
    `  ${pad("relationships")}${String(report.relationshipCount)}`,
    `  ${pad("contested")}${String(report.contestedCount)}`,
    `  ${pad("integrity_events")}${report.integrityEventKinds.length === 0 ? "none" : report.integrityEventKinds.join(", ")}`,
    "",
    "  row counts (step 8):",
    ...report.tables.map(countLine),
    "=========================================================================",
    "",
  ]
  return lines.join("\n")
}

export interface MapDiff<T> {
  changed: { id: string; before: T; after: T }[]
  added: string[]
  removed: string[]
}

export function diffMaps<T>(
  before: Map<string, T>,
  after: Map<string, T>,
  equal: (a: T, b: T) => boolean,
): MapDiff<T> {
  const changed: { id: string; before: T; after: T }[] = []
  const removed: string[] = []
  for (const [id, value] of before) {
    const other = after.get(id)
    if (other === undefined) removed.push(id)
    else if (!equal(value, other)) changed.push({ id, before: value, after: other })
  }
  const added = [...after.keys()].filter((id) => !before.has(id))
  return { changed: changed.sort(byIdField), added: added.sort(), removed: removed.sort() }
}

function byIdField(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function diffParents(before: FingerprintReport, after: FingerprintReport): MapDiff<string> {
  return diffMaps(before.parents, after.parents, (a, b) => a === b)
}

export function diffPositions(
  before: FingerprintReport,
  after: FingerprintReport,
): MapDiff<[number, number]> {
  // Compared at the nine decimals Hash B encodes, so the diff and the hash cannot disagree about
  // whether an entity moved.
  const same = (a: [number, number], b: [number, number]): boolean =>
    a[0].toFixed(9) === b[0].toFixed(9) && a[1].toFixed(9) === b[1].toFixed(9)
  return diffMaps(before.positions, after.positions, same)
}

function place(pos: [number, number]): string {
  return pos[0].toFixed(9) + "," + pos[1].toFixed(9)
}

/** §10 step 19's diagnosis, stated rather than left to be recalled mid-ceremony. */
export function positionDiagnosis(moved: number): string {
  if (moved === 0) return "  no entity moved."
  if (moved <= DERIVED_POSITION_UNITS) {
    return `  ${String(moved)} entities moved, at or below ${String(DERIVED_POSITION_UNITS)} — this is the`
      + " signature of a broken parent derivation, NOT a coordinate edit. ABORT (§10 step 19)."
  }
  return `  ${String(moved)} entities moved, above ${String(DERIVED_POSITION_UNITS)} — more than the`
    + " derived-position units, so the geometry itself changed. ABORT and diagnose."
}

const SAMPLE = 20

export function formatComparison(before: FingerprintReport, after: FingerprintReport): string {
  const parents = diffParents(before, after)
  const positions = diffPositions(before, after)
  const lines = [
    "",
    "=== step 19 comparison (zero tolerance) =================================",
    `  before  ${before.path}`,
    `  after   ${after.path}`,
    "",
    `  Hash A  ${before.hashA === after.hashA ? "MATCH" : "DIFFER"}`,
    `  Hash B  ${before.hashB === after.hashB ? "MATCH" : "DIFFER"}`,
    `  Hash C  ${before.hashC === after.hashC ? "MATCH" : "DIFFER"}`,
    "",
    `  parents re-pointed ${String(parents.changed.length)}, gained ${String(parents.added.length)}, lost ${String(parents.removed.length)}`,
    `  positions moved    ${String(positions.changed.length)}, gained ${String(positions.added.length)}, lost ${String(positions.removed.length)}`,
    positionDiagnosis(positions.changed.length),
  ]
  if (parents.changed.length !== 0) {
    lines.push("", `  re-pointed (first ${String(SAMPLE)}):`)
    for (const d of parents.changed.slice(0, SAMPLE)) lines.push(`    ${d.id}  ${d.before} -> ${d.after}`)
  }
  if (positions.changed.length !== 0) {
    lines.push("", `  moved (first ${String(SAMPLE)}):`)
    for (const d of positions.changed.slice(0, SAMPLE)) {
      lines.push(`    ${d.id}  ${place(d.before)} -> ${place(d.after)}`)
    }
  }
  for (const [label, ids] of [["lost", positions.removed], ["gained", positions.added]] as const) {
    if (ids.length !== 0) lines.push("", `  ${label} a rendered position: ${ids.slice(0, SAMPLE).join(", ")}`)
  }
  lines.push("=========================================================================", "")
  return lines.join("\n")
}
