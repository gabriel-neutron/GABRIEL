import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { EntityKind } from "@/core/entity/entity"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { Relationship } from "@/core/relationship/relationship"
import type { Layer, MapEntity } from "@/types/domain.types"
import { ensureOptionalColumns, insertRow } from "./columnDescriptor"
import { loadGeoPackage, saveGeoPackage } from "./index"
import { readEntities, unitColumns, UNITS_TABLE } from "./units.table"

/**
 * The four load-side controls that need a project shaped a way the real file is not: a
 * dangling endpoint (46), a cross-kind hierarchy edge (47), a forced migration-count failure
 * (49b) and a full edge/event round trip (51). Their criteria name
 * `migration.store-path.test.ts`; that file is at the 300-line cap with §10's eight real-file
 * gates, so they live here — `npx vitest run src/core/persistence/geopackage/ -t "<name>"`
 * finds every one of them.
 *
 * Every fixture is saved onto an in-memory copy of the real checked-in project as its
 * `baseBuffer`: that file is read once with `readFileSync` and never written, and the save
 * replaces every table it owns, so what reloads below is the synthetic project and nothing
 * else. It also keeps `save.ts`'s create-with-retry pool — which writes `gabriel-*.gpkg` into
 * the repo root — out of the picture entirely.
 */
const NOW = "2026-07-31T00:00:00.000Z"
const KAMAZ = "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39" // an organisation row that HAS a parent
const LAYER: Layer = { id: "layer-fixture", name: "Fixture", visible: true, kind: "custom" }
/** Explicitly organic rather than `{}`: `metadata: {}` is criterion 51's own case, asserted
 *  once there, and `attachment: "organic"` is what puts these edges under the very
 *  dual-subordination control the tests below are about (`isHierarchyBearing`). */
const ORGANIC = { attachment: "organic" } as const

let baseBuffer: ArrayBuffer

function entity(id: string, kind: EntityKind): MapEntity {
  return { id, name: id, kind, layerId: LAYER.id, parentId: null }
}

function edge(id: string, fromId: string, toId: string, over: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: ORGANIC, ...over }
}

async function saveFixture(
  entities: MapEntity[], relationships: Relationship[], integrityEvents: IntegrityEvent[],
): Promise<ArrayBuffer> {
  const bytes = await saveGeoPackage({
    layers: [LAYER], entities, geometries: [], researchSources: new Map(), baseBuffer,
    sources: [], claims: [], ratingEvents: [], relationships, integrityEvents,
  })
  return Uint8Array.from(bytes).buffer
}

describe("relationship and integrity controls on the load path (synthetic fixtures)", () => {
  beforeAll(() => {
    // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
    // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
    baseBuffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
  })

  afterEach(() => {
    // A baseBuffer is supplied above, so the create-with-retry pool should never run. If a
    // regression drops it, the pool litters the repo root — sweep so it does not outlive the
    // failure (criterion 75).
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  })

  it("round-trips relationships and integrity events", async () => {
    // §9 clause 1. The four shapes a lazy encoder loses: an empty metadata bag (T9 — it must
    // come back `{}` and never `undefined`), a recorded percentage, a null startDate, and an
    // exportOverride that was never set (T5/T6 — absent, not `{}`).
    const entities = [entity("e-parent", "unit"), entity("e-child", "unit"),
      entity("e-holder", "corporate"), entity("e-sub", "corporate")]
    const relationships: Relationship[] = [
      edge("rel-plain", "e-child", "e-parent", { metadata: {} }),
      edge("rel-priced", "e-sub", "e-holder", { type: "corporate_parent", metadata: { percent: 49.9 } }),
    ]
    const integrityEvents: IntegrityEvent[] = [{
      id: "integrity:fixture", kind: "hierarchy-migrated", createdAt: NOW,
      summary: "Two legacy parent links are now recorded as typed relationships.",
      detail: { mintedEdges: 2, sourceSentence: "... Rostec holds c.49.9% share." },
    }]

    const reloaded = await loadGeoPackage(await saveFixture(entities, relationships, integrityEvents))
    expect(reloaded.relationships).toEqual(relationships)
    expect(reloaded.integrityEvents).toEqual(integrityEvents)
    expect(reloaded.relationships[0]!.metadata).toEqual({})
    expect(reloaded.relationships[0]!.startDate).toBeNull()
    expect(reloaded.relationships[0]!.exportOverride).toBeUndefined()
    expect(reloaded.relationships[1]!.metadata.percent).toBe(49.9)
    // The edges are the hierarchy: the derivation has to reach the entities too (ADR 0011).
    expect(reloaded.entities.find((e) => e.id === "e-child")!.parentId).toBe("e-parent")
    expect(reloaded.entities.find((e) => e.id === "e-sub")!.parentId).toBe("e-holder")
  }, 60_000)

  it("dangling endpoint throws, and a contested child does not", async () => {
    // Criterion 46, §7 step 4: the two codes are not treated alike. An edge whose endpoint is
    // absent contradicts the entity set the loader has just validated — a schema problem, so
    // it throws.
    const entities = [entity("e-parent", "unit"), entity("e-child", "unit")]
    const dangling = await saveFixture(entities, [edge("rel-ghost", "e-child", "e-ghost")], [])
    await expect(loadGeoPackage(dangling)).rejects.toThrow(/dangling-endpoint/)
    await expect(loadGeoPackage(dangling)).rejects.toThrow(/^Unsupported schema/)

    // A child under two parents at once may well be TRUE. Throwing would make a legitimate
    // record unopenable and would destroy the finding instead of holding it open (Q40), so it
    // is recorded and the child derives no parent at all.
    const contested = await saveFixture(
      [...entities, entity("e-other", "unit")],
      [edge("rel-a", "e-child", "e-parent"), edge("rel-b", "e-child", "e-other")],
      [],
    )
    const reloaded = await loadGeoPackage(contested)
    expect(reloaded.entities.find((e) => e.id === "e-child")!.parentId).toBeNull()
    const events = reloaded.integrityEvents.filter((e) => e.kind === "multiple-active-hierarchy")
    expect(events).toHaveLength(1)
    expect(events[0]!.detail.childId).toBe("e-child")
    // Both edges are kept exactly as recorded — the finding is not resolved by deletion.
    expect(reloaded.relationships).toHaveLength(2)
  }, 60_000)

  it("cross-kind parent is recorded, not thrown", async () => {
    // Criterion 47, T10, §9 clause 11 — the artefact, not a count. A `subordinate_to` edge
    // from a unit to a corporate would derive a parent that makes the NEXT load throw at
    // load.ts:60-63, so the pair leaves the derivation by omission (T15) and is named in the
    // record. The edge itself is a legitimate record and survives untouched.
    const entities = [entity("e-unit", "unit"), entity("e-corp", "corporate")]
    const relationships = [edge("rel-cross", "e-unit", "e-corp")]
    const reloaded = await loadGeoPackage(await saveFixture(entities, relationships, []))

    expect(reloaded.entities.find((e) => e.id === "e-unit")!.parentId).toBeNull()
    const events = reloaded.integrityEvents.filter((e) => e.kind === "cross-kind-parent")
    expect(events).toHaveLength(1)
    expect(events[0]!.detail.childId).toBe("e-unit")
    expect(events[0]!.summary).toContain("e-unit")
    expect(reloaded.relationships).toEqual(relationships)
  }, 60_000)

  it("Hierarchy migration message survives the load path unwrapped", async () => {
    // Criterion 49b, T13, §9 clause 10. The reachable cause of the count assertion firing is a
    // duplicate child id: `units` and the legacy `organisations` table have independently
    // assigned ids, so one id present in both reaches `migrateHierarchyToRelationships` twice
    // and the second occurrence can be neither minted nor counted as already present.
    //
    // Built by inserting ONE row into an in-memory copy of the real file (which has no
    // `relationships` table, so the migration runs) whose id is an organisation that already
    // carries a parent. Nothing here writes to disk.
    const geoPackage = await GeoPackageAPI.open(new Uint8Array(baseBuffer))
    let bytes: Uint8Array
    try {
      const model = readEntities(geoPackage).find((e) => e.parentId != null)
      expect(model, "the real project carries no unit with a parent to copy").toBeDefined()
      // The real file's `units` predates the optional columns, exactly as it does for a
      // reopened baseBuffer — `save.ts` back-fills them the same way before any INSERT.
      ensureOptionalColumns(geoPackage.connection, UNITS_TABLE, unitColumns)
      insertRow(geoPackage.connection, UNITS_TABLE, unitColumns, {
        ...model!, id: KAMAZ, name: "Unit sharing an organisation's id",
      })
      bytes = await geoPackage.export()
    } finally {
      geoPackage.close()
    }

    // The file is healthy; one specific, nameable defect is not corruption, and telling an
    // analyst otherwise is a false diagnosis at the worst possible moment.
    await expect(loadGeoPackage(Uint8Array.from(bytes).buffer)).rejects.toThrow(/^Hierarchy migration/)
    await expect(loadGeoPackage(Uint8Array.from(bytes).buffer)).rejects.toThrow(
      new RegExp("Unaccounted children: " + KAMAZ),
    )
    await expect(loadGeoPackage(Uint8Array.from(bytes).buffer)).rejects.not.toThrow(/Corrupted GeoPackage/)
  }, 60_000)
})
