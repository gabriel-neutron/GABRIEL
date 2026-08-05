import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { buildOrbat } from "@/core/entity/hierarchy"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { hierarchyIndex, type HierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage } from "./index"
import type { GeoPackageLoadResult } from "./types"

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

/** Hash A: one `<id>\t<parentId>` line per parented entity, sorted by id, joined with "\n". */
function fingerprintParents(parents: Map<string, string>): string {
  const lines = [...parents].sort(byId).map(([id, parentId]) => id + "\t" + parentId)
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

/** Hash B: one `<id>\t<lat>,<lng>` line per rendered entity, nine decimals, sorted by id. */
function fingerprintPositions(positions: Map<string, [number, number]>): string {
  const lines = [...positions].sort(byId)
    .map(([id, pos]) => id + "\t" + pos[0].toFixed(9) + "," + pos[1].toFixed(9))
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

/** Hash C: one `<id>\t<depth>` line per entity, sorted by id. */
function fingerprintDepths(depths: Map<string, number>): string {
  const lines = [...depths].sort(byId).map(([id, depth]) => id + "\t" + String(depth))
  return createHash("sha256").update(lines.join("\n")).digest("hex")
}

function byId(a: [string, unknown], b: [string, unknown]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
}

/** The field's answer: what `withDerivedParents` wrote onto every entity. */
function parentsFromField(entities: readonly MapEntity[]): Map<string, string> {
  const parents = new Map<string, string>()
  for (const e of entities) if (e.parentId != null) parents.set(e.id, e.parentId)
  return parents
}

/**
 * The edge set's answer, read one entity at a time through `linkFor`, the interface the six
 * consumers use.
 *
 * Be clear about what comparing this to the field does and does not prove. `withDerivedParents`
 * is fed by `activeParentMap`, which is now a projection of this same index, so the two
 * readings share one builder and a fault inside it corrupts both identically — measured, by
 * injecting one. The comparison catches a consumer reading the wrong accessor; it does NOT
 * catch a wrong derivation. The pinned hashes do, because they were measured against the code
 * that came before.
 */
function parentsFromIndex(entities: readonly MapEntity[], index: HierarchyIndex): Map<string, string> {
  const parents = new Map<string, string>()
  for (const e of entities) {
    const link = index.linkFor(e.id)
    if (link.state === "parent") parents.set(e.id, link.parentId)
  }
  return parents
}

function positionMap(
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
function depthMap(entities: MapEntity[], index?: HierarchyIndex): Map<string, number> {
  const orbat = buildOrbat(entities, index)
  return new Map(entities.map((e) => [e.id, orbat.depthOf(e.id)]))
}

let loaded: GeoPackageLoadResult
let index: HierarchyIndex

describe("the hierarchy read two ways over public/project.gpkg (read-only)", () => {
  beforeAll(async () => {
    // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
    // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
    const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
    loaded = await loadGeoPackage(buffer)
    index = hierarchyIndex(loaded.relationships, { entities: loaded.entities })
  }, 180_000)

  it("derives the same parent for every entity through the field and through the index", () => {
    const field = parentsFromField(loaded.entities)
    const edges = parentsFromIndex(loaded.entities, index)

    expect(field.size).toBe(1012)
    expect(edges).toEqual(field)
    expect(fingerprintParents(field)).toBe(HASH_A)
    expect(fingerprintParents(edges)).toBe(HASH_A)
  }, 60_000)

  it("renders every entity in the same place through the field and through the index", () => {
    const field = positionMap(loaded)
    const edges = positionMap(loaded, index)

    // Pinned, not "> 0": two identical EMPTY maps deep-equal each other, so this count is what
    // stops the gate passing on a project that renders nothing. Measured: 1024 of 1027.
    expect(field.rendered.size).toBe(1024)
    expect(edges.rendered).toEqual(field.rendered)
    expect(fingerprintPositions(field.rendered)).toBe(HASH_B)
    expect(fingerprintPositions(edges.rendered)).toBe(HASH_B)
  }, 60_000)

  it("puts every entity at the same depth through the field and through the index", () => {
    const field = depthMap(loaded.entities)
    const edges = depthMap(loaded.entities, index)
    expect(edges).toEqual(field)
    expect(fingerprintDepths(field)).toBe(HASH_C)
    expect(fingerprintDepths(edges)).toBe(HASH_C)
    // Not all one number: a flattened tree would deep-equal itself both ways and pass the
    // equality above on any entity that carries its own geometry.
    expect(new Set(field.values()).size).toBeGreaterThan(3)
  }, 60_000)

  it("finds no contest in this corpus, which is why the two readings can agree at all", () => {
    // The reason the port is safe, stated rather than assumed. Where the two readings CAN
    // disagree is exactly a contested child — the field says null, the index says which two
    // edges compete — and there are none here. If this ever fails, the three assertions above
    // are no longer expected to hold and the fingerprints must be re-measured, not forced.
    expect(index.contested().size).toBe(0)
    expect(positionMap(loaded, index).unplacedByContest).toEqual([])
    expect(loaded.integrityEvents.filter((e) => e.kind === "multiple-active-hierarchy")).toEqual([])
  }, 60_000)
})
