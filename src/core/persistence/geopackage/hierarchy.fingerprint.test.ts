import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import {
  depthMap,
  fingerprintDepths,
  fingerprintParents,
  fingerprintPositions,
  fingerprintGeoPackageFile,
  parentsFromField,
  parentsFromIndex,
  positionMap,
  type FingerprintReport,
} from "./hierarchy.fingerprint.harness"
import { formatComparison, formatReport } from "./hierarchy.fingerprint.report"

/**
 * The gate for the Slice 3 consumer rewrite, over the real 1,027-entity project.
 *
 * Slice 3 moves six consumers off the derived `parentId` field and onto the edge set. The
 * failure mode is topological, not count-based: 741 of the 1010 units take their map position
 * from the parent chain, so the derivation can be subtly wrong while every count — 1012 edges,
 * 1012 parents, 1027 entities — reads perfect and 741 units silently move. A count of edges is
 * not evidence (ADR 0011). So this compares the whole mapping, BOTH WAYS, and pins three
 * fingerprints — two of them measured against the pre-Slice-3 code, which is where the force
 * of this gate actually comes from (see `parentsFromIndex`).
 *
 * It is ALSO §10 step 19. `GABRIEL_FINGERPRINT_GPKG` points the whole file at
 * `project-migrated-<date>.gpkg` instead, and then every assertion below is a step-19 criterion
 * read against the migrated file — the same three hashes, from the same code, with zero
 * tolerance. Unset, it is `public/project.gpkg` and nothing about this test has changed.
 * `GABRIEL_FINGERPRINT_BASELINE` additionally loads a second file and prints the per-entity
 * diff, which is step 19's diagnosis rather than its verdict.
 *
 *   GABRIEL_FINGERPRINT_GPKG=project-migrated-2026-08-06.gpkg \
 *   GABRIEL_FINGERPRINT_BASELINE=public/project.gpkg \
 *   npx vitest run --pool=threads --no-file-parallelism --reporter=verbose \
 *     src/core/persistence/geopackage/hierarchy.fingerprint.test.ts
 *
 * `--reporter=verbose` is not optional: vitest 4's default reporter hides the console output of
 * a test that PASSED, which is precisely the run whose numbers you need to copy out.
 *
 * The file is read once with `readFileSync` and NEVER opened for writing. Everything after
 * that read is an in-memory buffer. `public/project.gpkg` is the analyst's irreplaceable
 * working project; the revert point is `be980a5` (corrected 2026-08-05 from `5b0d2ed`, whose blob
 * predates the research-cache strip — see ADR 0011).
 */
const HASH_A = "71cc3b332e6f50f3ce772f43d321ab6b6044b7abf6d06620508a5197804673a2"
const HASH_B = "7e6570ef74b436336a76cd94965b7aca0f05bec2461cdbf945749bbcf49fac84"
/**
 * Hash C is measured 2026-08-04, on THIS code, and is not a pre-Slice-3 baseline like A and B.
 * It is still evidence about the old tree rather than a tautology: the depth map is a pure
 * function of the entity ids and the parent map, and the parent map is pinned at A, which WAS
 * measured against the old code. What it adds is a hold on the shape of the tree — A pins who
 * sits under whom and B pins where they render, and an entity carrying its own geometry can be
 * re-parented without either of those moving.
 */
const HASH_C = "d55f6e4813541e1a3a2aebf65be515afd233c08e1883c34d8df01783a85083b7"

const TARGET = process.env.GABRIEL_FINGERPRINT_GPKG ?? "public/project.gpkg"
const BASELINE = process.env.GABRIEL_FINGERPRINT_BASELINE

let report: FingerprintReport

describe(`the hierarchy read two ways over ${TARGET} (read-only)`, () => {
  beforeAll(async () => {
    report = await fingerprintGeoPackageFile(resolve(process.cwd(), TARGET))
    // Printed, not merely asserted: step 19 compares VALUES taken from two files, and a test
    // that only says "passed" leaves the analyst to hand-roll a sha256 mid-ceremony.
    console.log(formatReport(report))
    if (BASELINE !== undefined && BASELINE !== TARGET) {
      const before = await fingerprintGeoPackageFile(resolve(process.cwd(), BASELINE))
      console.log(formatComparison(before, report))
    }
  }, 300_000)

  it("derives the same parent for every entity through the field and through the index", () => {
    const field = parentsFromField(report.loaded.entities)
    const edges = parentsFromIndex(report.loaded.entities, report.index)

    expect(field.size).toBe(1012)
    expect(edges).toEqual(field)
    expect(fingerprintParents(field)).toBe(HASH_A)
    expect(fingerprintParents(edges)).toBe(HASH_A)
    expect(report.hashA).toBe(HASH_A)
  }, 60_000)

  it("renders every entity in the same place through the field and through the index", () => {
    const field = positionMap(report.loaded)
    const edges = positionMap(report.loaded, report.index)

    // Pinned, not "> 0": two identical EMPTY maps deep-equal each other, so this count is what
    // stops the gate passing on a project that renders nothing. Measured: 1024 of 1027.
    expect(field.rendered.size).toBe(1024)
    expect(edges.rendered).toEqual(field.rendered)
    expect(fingerprintPositions(field.rendered)).toBe(HASH_B)
    expect(fingerprintPositions(edges.rendered)).toBe(HASH_B)
    expect(report.hashB).toBe(HASH_B)
  }, 60_000)

  it("puts every entity at the same depth through the field and through the index", () => {
    const field = depthMap(report.loaded.entities)
    const edges = depthMap(report.loaded.entities, report.index)
    expect(edges).toEqual(field)
    expect(fingerprintDepths(field)).toBe(HASH_C)
    expect(fingerprintDepths(edges)).toBe(HASH_C)
    expect(report.hashC).toBe(HASH_C)
    // Not all one number: a flattened tree would deep-equal itself both ways and pass the
    // equality above on any entity that carries its own geometry.
    expect(new Set(field.values()).size).toBeGreaterThan(3)
  }, 60_000)

  it("finds no contest in this corpus, which is why the two readings can agree at all", () => {
    // The reason the port is safe, stated rather than assumed. Where the two readings CAN
    // disagree is exactly a contested child — the field says null, the index says which two
    // edges compete — and there are none here. If this ever fails, the three assertions above
    // are no longer expected to hold and the fingerprints must be re-measured, not forced.
    expect(report.contestedCount).toBe(0)
    expect(positionMap(report.loaded, report.index).unplacedByContest).toEqual([])
    expect(report.loaded.integrityEvents.filter((e) => e.kind === "multiple-active-hierarchy")).toEqual([])
  }, 60_000)

  it("reports the step-8 row counts, distinguishing an empty table from an absent one", () => {
    // §10 step 8 names `claims`, `sources` and `rating_events`, none of which exist in the
    // pre-migration file — `save.ts` creates them on the first write. An absent table and an
    // empty one are different pre-write facts, so the harness reports them differently and
    // step 22 compares against the right one.
    const byName = new Map(report.tables.map((t) => [t.table, t]))
    expect(byName.get("geometries")?.count).toBe(291)
    expect(byName.get("layers")?.count).toBe(16)
    expect(byName.get("units")?.parented).toBe(999)
    expect(byName.get("organisations")?.parented).toBe(13)
    expect(report.fileSizeBytes).toBeGreaterThan(0)
  }, 60_000)
})
