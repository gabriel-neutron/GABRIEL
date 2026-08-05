import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { buildOrbat } from "@/core/entity/hierarchy"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { hierarchyIndex, type HierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage } from "./index"
import type { GeoPackageLoadResult } from "./types"

/**
 * The step-19 harness: the three hierarchy fingerprints taken from an ARBITRARY `.gpkg`.
 *
 * `hierarchy.fingerprint.test.ts` pins A, B and C against `public/project.gpkg` and nothing else;
 * §10 step 19 has to take the same three from `project-migrated-<date>.gpkg` and compare with
 * zero tolerance. Hand-rolling a sha256 mid-ceremony is exactly the wrong moment to write code,
 * so the hashing lives here and both callers share it verbatim — a harness that computed the
 * hash a second way would compare two encodings rather than two files.
 *
 * READ-ONLY, and it must stay that way: `readFileSync` into an in-memory buffer, never a write
 * handle. The target of step 19 is the analyst's irreplaceable working project; the revert point
 * is `be980a5` (ADR 0011, corrected 2026-08-05 from `5b0d2ed`, whose blob predates the
 * research-cache strip and must never be restored).
 */

/** Hash A: one `<id>\t<parentId>` line per parented entity, sorted by id, joined with "\n". */
export function fingerprintParents(parents: Map<string, string>): string {
  const lines = [...parents].sort(byId).map(([id, parentId]) => id + "\t" + parentId)
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

/** Hash B: one `<id>\t<lat>,<lng>` line per rendered entity, nine decimals, sorted by id. */
export function fingerprintPositions(positions: Map<string, [number, number]>): string {
  const lines = [...positions].sort(byId)
    .map(([id, pos]) => id + "\t" + pos[0].toFixed(9) + "," + pos[1].toFixed(9))
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

/** Hash C: one `<id>\t<depth>` line per entity, sorted by id. */
export function fingerprintDepths(depths: Map<string, number>): string {
  const lines = [...depths].sort(byId).map(([id, depth]) => id + "\t" + String(depth))
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

function byId(a: [string, unknown], b: [string, unknown]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
}

/** The field's answer: what `withDerivedParents` wrote onto every entity. */
export function parentsFromField(entities: readonly MapEntity[]): Map<string, string> {
  const parents = new Map<string, string>()
  for (const e of entities) if (e.parentId != null) parents.set(e.id, e.parentId)
  return parents
}

/** The edge set's answer, read one entity at a time through `linkFor`, the interface the six
 *  Slice 3 consumers use. */
export function parentsFromIndex(entities: readonly MapEntity[], index: HierarchyIndex): Map<string, string> {
  const parents = new Map<string, string>()
  for (const e of entities) {
    const link = index.linkFor(e.id)
    if (link.state === "parent") parents.set(e.id, link.parentId)
  }
  return parents
}

export function positionMap(
  loaded: GeoPackageLoadResult,
  index?: HierarchyIndex,
): { rendered: Map<string, [number, number]>; unplacedByContest: string[] } {
  const result = computeAllEntityPositions(loaded.entities, loaded.geometries, index)
  return {
    rendered: new Map(result.positioned.map((p) => [p.entity.id, [p.position[0], p.position[1]]])),
    unplacedByContest: result.unplacedByContest,
  }
}

/** id -> depth, over the whole entity set. The position map alone would miss a reshuffle among
 *  entities that carry their own geometry, since those are placed whatever their parent is. */
export function depthMap(entities: MapEntity[], index?: HierarchyIndex): Map<string, number> {
  const orbat = buildOrbat(entities, index)
  return new Map(entities.map((e) => [e.id, orbat.depthOf(e.id)]))
}

/**
 * The tables §10 step 8 asks about, in the order it asks. Three of them do not exist in the
 * pre-migration file at all — `save.ts` creates them on the first write — so a count of 0 and
 * an absent table are different facts and this harness reports them as different facts. "table
 * absent" is the true pre-write state of `provenance_sources`, `provenance_claims` and
 * `rating_events`, and it is what step 22 compares against.
 */
const REPORTED_TABLES = [
  "units",
  "organisations",
  "layers",
  "geometries",
  "research_sources",
  "relationships",
  "integrity_events",
  "provenance_sources",
  "provenance_claims",
  "rating_events",
] as const

/** A row count, or `null` meaning the table is not in the file. */
export type TableCount = { table: string; count: number | null; parented: number | null }

export interface FingerprintReport {
  path: string
  fileSizeBytes: number
  /** Kept on the report so a caller that wants a fourth reading of the same file — the FIELD's
   *  parents, say — takes it from this load rather than opening the file a second time. */
  loaded: GeoPackageLoadResult
  index: HierarchyIndex
  hashA: string
  hashB: string
  hashC: string
  parents: Map<string, string>
  positions: Map<string, [number, number]>
  depths: Map<string, number>
  entityCount: number
  renderedCount: number
  relationshipCount: number
  contestedCount: number
  integrityEventKinds: string[]
  tables: TableCount[]
}

function firstNumber(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0
  const row: unknown = rows[0]
  if (typeof row !== "object" || row === null) return 0
  const value = Object.values(row)[0]
  return typeof value === "number" ? value : Number(value)
}

function readTableCounts(bytes: Uint8Array): Promise<TableCount[]> {
  return GeoPackageAPI.open(bytes).then((gpkg) => {
    try {
      const present = new Set<string>()
      const rows: unknown = gpkg.connection.all("SELECT name FROM sqlite_master WHERE type = 'table'")
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (typeof row === "object" && row !== null && "name" in row) present.add(String(row.name))
        }
      }
      return REPORTED_TABLES.map((table) => {
        if (!present.has(table)) return { table, count: null, parented: null }
        const count = firstNumber(gpkg.connection.all(`SELECT COUNT(*) AS n FROM "${table}"`))
        const columns: unknown = gpkg.connection.all(`PRAGMA table_info("${table}")`)
        const hasParent = Array.isArray(columns) && columns.some(
          (c) => typeof c === "object" && c !== null && "name" in c && String(c.name) === "parent_id",
        )
        const parented = hasParent
          ? firstNumber(gpkg.connection.all(`SELECT COUNT(*) AS n FROM "${table}" WHERE parent_id IS NOT NULL`))
          : null
        return { table, count, parented }
      })
    } finally {
      gpkg.close()
    }
  })
}

/**
 * Read the file once and take everything from that one read. Two `readFileSync` calls would be
 * two different files if anything touched the path in between, which during a ceremony that is
 * mid-Save-As is not hypothetical.
 */
export async function fingerprintGeoPackageFile(path: string): Promise<FingerprintReport> {
  const bytes = readFileSync(path)
  // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared backing
  // buffer, so `.buffer` alone can carry a nonzero byteOffset. Each consumer gets its own copy —
  // sql.js takes ownership of the bytes it is handed.
  const loaded = await loadGeoPackage(Uint8Array.from(bytes).buffer)
  const tables = await readTableCounts(Uint8Array.from(bytes))
  const index = hierarchyIndex(loaded.relationships, { entities: loaded.entities })

  const parents = parentsFromIndex(loaded.entities, index)
  const positions = positionMap(loaded, index).rendered
  const depths = depthMap(loaded.entities, index)

  return {
    path,
    fileSizeBytes: statSync(path).size,
    loaded,
    index,
    hashA: fingerprintParents(parents),
    hashB: fingerprintPositions(positions),
    hashC: fingerprintDepths(depths),
    parents,
    positions,
    depths,
    entityCount: loaded.entities.length,
    renderedCount: positions.size,
    relationshipCount: loaded.relationships.length,
    contestedCount: index.contested().size,
    integrityEventKinds: loaded.integrityEvents.map((e) => e.kind).sort(),
    tables,
  }
}
