import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { EntityKind } from "@/core/entity/entity"
import { withAuthoredEdge } from "@/core/relationship/authoring"
import type { Relationship, RelationshipDraft } from "@/core/relationship/relationship"
import { getDefaultEntityLayerId } from "@/shell/entityLayer"
import { newEntityForKind } from "@/shell/newEntity"
import { selectPersistableSnapshot, useProjectStore } from "@/store/useProjectStore"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage, projectStateFromLoadResult, saveGeoPackage } from "./index"
import type { GeoPackageLoadResult } from "./types"

/**
 * §10 steps 17-28 as a read-only dry run, for the three kinds commit 75af6e9 made creatable.
 *
 * `migration.store-path.test.ts` proves the 1,012 legacy edges survive the store path. It cannot
 * prove anything about a person, a vessel, or an authored edge, because the real project contains
 * none: its 1,012 edges are undated, unended and metadata-free, and every one of its 1,027
 * entities is a unit or a corporate. So the fields the editor gained in 2B — a non-null
 * `startDate`, a populated `metadata.role`, a bare profile with no `type` and no `affiliation` —
 * have never been round-tripped through `public/project.gpkg` at all, and the ceremony's
 * zero-tolerance hash comparison is the first thing that would notice.
 *
 * `MainLayout.tsx` has no test of its own, so the two lines that keep the creation path from
 * writing a corrupt hierarchy are reproduced here against the store rather than mocked: the
 * geometry takes `entity.layerId`, and a cross-kind selection mints NO hierarchy edge. The
 * cross-kind case is exercised anyway, by hand, because an edge the picker refuses to mint is
 * still an edge an analyst can author — and until 75af6e9 changed `load.ts`'s stored-`parent_id`
 * check to a per-kind id map, that edge made the file unopenable.
 *
 * The project file is read once with `readFileSync` and NEVER written.
 */
const PERSON_ID = "0f1e2d3c-0000-4000-8000-000000000001"
const VESSEL_ID = "0f1e2d3c-0000-4000-8000-000000000002"
const PERSON_GEOMETRY_ID = "0f1e2d3c-0000-4000-8000-00000000000a"
const VESSEL_GEOMETRY_ID = "0f1e2d3c-0000-4000-8000-00000000000b"
const OFFICER_EDGE_ID = "authored:officer-of"
const CROSS_KIND_EDGE_ID = "authored:cross-kind"
const OFFICER_START = "2019-04-01"
const ROSTEC = "23dfd3ce-6465-55ca-83d4-cc8c766d8444"
const CROSS_KIND_EVENT_ID = "integrity:cross-kind-parent:" + PERSON_ID

/** Ids are injected rather than minted so the two cycles compare a fixed population; the app
 *  passes `crypto.randomUUID()` here. */
function createThroughShellPath(kind: EntityKind, id: string, geometryId: string, lat: number): MapEntity {
  const s = useProjectStore.getState()
  const entity = newEntityForKind(kind, { id, defaultLayerId: getDefaultEntityLayerId(s.layers) })
  s.addEntity(entity)
  // `entity.layerId`, not the drawn geometry's own: `newEntityForKind` is entitled to overrule
  // the draw layer (a corporate is pinned to Industry), and a geometry left behind on the other
  // layer is one `load.ts` reads back onto an entity that is not there.
  s.addGeometry({ id: geometryId, layerId: entity.layerId, entityId: entity.id, type: "point", lat, lng: 37.6 })
  return entity
}

let loaded: GeoPackageLoadResult
let cycleOne: GeoPackageLoadResult
let cycleTwo: GeoPackageLoadResult
let unitTargetId = ""
let officerOk = false
let crossKindOk = false
/** Caught rather than left to abort `beforeAll`: a throwing save would take every assertion below
 *  down with it and report nothing. Each test asserts this is null FIRST. */
let storePathError: string | null = null

function edgeById(result: GeoPackageLoadResult, id: string): Relationship | undefined {
  return result.relationships.find((rel) => rel.id === id)
}

function entityById(result: GeoPackageLoadResult, id: string): MapEntity | undefined {
  return result.entities.find((e) => e.id === id)
}

function eventIds(result: GeoPackageLoadResult): Set<string> {
  return new Set(result.integrityEvents.map((e) => e.id))
}

/** The store path exactly as `handleSave` runs it, with the `baseBuffer` that makes it the
 *  reopen-and-save the app really performs. `edit` stands in for the analyst's session. */
async function throughTheStore(
  base: ArrayBuffer,
  result: GeoPackageLoadResult,
  edit?: () => void,
): Promise<Uint8Array> {
  useProjectStore.getState().setProject(projectStateFromLoadResult(result))
  edit?.()
  const snapshot = selectPersistableSnapshot(
    useProjectStore.getState(), result.sourceCache, result.sources, result.ratingEvents,
  )
  return saveGeoPackage({
    layers: snapshot.layers, entities: snapshot.entities, geometries: snapshot.geometries,
    researchSources: snapshot.sourceCache, baseBuffer: base, sources: snapshot.sources,
    claims: snapshot.claims, ratingEvents: snapshot.ratingEvents,
    relationships: snapshot.relationships, integrityEvents: snapshot.integrityEvents,
  })
}

/** Both edges through `withAuthoredEdge`, so what reaches disk is what the relationship editor
 *  would have produced — including its refusal, which is recorded rather than assumed. */
function authorTheSession(): void {
  createThroughShellPath("person", PERSON_ID, PERSON_GEOMETRY_ID, 55.7)
  createThroughShellPath("vessel", VESSEL_ID, VESSEL_GEOMETRY_ID, 55.8)

  const s = useProjectStore.getState()
  const ids = new Set(s.entities.map((e) => e.id))
  const officer: RelationshipDraft = {
    fromId: PERSON_ID, toId: ROSTEC, type: "officer_of",
    startDate: OFFICER_START, endDate: null, metadata: { role: "director" },
  }
  const first = withAuthoredEdge(s.relationships, officer, OFFICER_EDGE_ID, ids)
  officerOk = first.ok
  if (!first.ok) return

  const crossKind: RelationshipDraft = {
    fromId: PERSON_ID, toId: unitTargetId, type: "subordinate_to",
    startDate: null, endDate: null, metadata: {},
  }
  const second = withAuthoredEdge(first.relationships, crossKind, CROSS_KIND_EDGE_ID, ids)
  crossKindOk = second.ok
  if (!second.ok) return
  useProjectStore.getState().setRelationships(second.relationships)
}

describe("the five-kind creation path through the store path (public/project.gpkg, read-only)", () => {
  beforeAll(async () => {
    // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
    // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
    const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer
    try {
      loaded = await loadGeoPackage(buffer)
      unitTargetId = loaded.entities.find((e) => e.kind === "unit")?.id ?? ""
      const firstBytes = await throughTheStore(buffer, loaded, authorTheSession)
      const firstBuffer = Uint8Array.from(firstBytes).buffer
      cycleOne = await loadGeoPackage(firstBuffer)
      const secondBytes = await throughTheStore(firstBuffer, cycleOne)
      cycleTwo = await loadGeoPackage(Uint8Array.from(secondBytes).buffer)
    } catch (e) {
      storePathError = e instanceof Error ? e.message : String(e)
    }
    useProjectStore.getState().resetProject()
  }, 240_000)

  afterEach(() => {
    // The project store is a module singleton: leaving it loaded would make another test file's
    // result depend on file ordering.
    useProjectStore.getState().resetProject()
    // A baseBuffer is supplied above, so save.ts' create-with-retry pool should never run. If a
    // regression drops that baseBuffer, the pool writes gabriel-*.gpkg into the repo root —
    // sweep them so the litter does not outlive the failure.
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  }, 30_000)

  it("the authored session reaches disk at all", () => {
    expect(storePathError, "load -> setProject -> edit -> snapshot -> save -> reload did not complete").toBeNull()
    // The refusals are asserted, not the outcome tag alone: `withAuthoredEdge` returning
    // `ok: false` would leave the store holding the pre-edit edge set, and every assertion
    // below would then pass on a session that never happened.
    expect(officerOk, "withAuthoredEdge refused the officer_of edge").toBe(true)
    expect(crossKindOk, "withAuthoredEdge refused the cross-kind subordinate_to edge").toBe(true)
    expect(unitTargetId).not.toBe("")
    expect(entityById(loaded, ROSTEC)?.kind).toBe("corporate")
    expect(loaded.entities).toHaveLength(1027)
    expect(cycleOne.entities).toHaveLength(1029)
  }, 120_000)

  it("a person and a vessel survive as bare profiles", () => {
    expect(storePathError).toBeNull()
    const person = entityById(cycleOne, PERSON_ID)
    const vessel = entityById(cycleOne, VESSEL_ID)
    expect(person?.kind).toBe("person")
    expect(vessel?.kind).toBe("vessel")
    expect(person?.name).toBe("New person")
    expect(vessel?.name).toBe("New vessel")

    // ADR 0010 withheld the field sets of the three bare profiles until Slice 5, and `Entity` is
    // D1-loose, so nothing in the type system objects to a `type` appearing on a person. The
    // `units` table shares one `type` column between `UnitProfile` and `CorporateProfile`; an
    // encoder that stopped reading `row.kind` would default a person's absent value to "other"
    // and publish a field the model does not have.
    expect(person?.type).toBeUndefined()
    expect(vessel?.type).toBeUndefined()
    expect(person?.affiliation).toBeUndefined()
    expect(vessel?.affiliation).toBeUndefined()
  }, 120_000)

  it("a created entity keeps its geometry on its own layer", () => {
    expect(storePathError).toBeNull()
    const person = entityById(cycleOne, PERSON_ID)
    const geometry = cycleOne.geometries.find((g) => g.id === PERSON_GEOMETRY_ID)
    // A geometry on a layer its entity does not belong to is not a cosmetic mismatch: the
    // snapshot filters entities and geometries by layer independently, so the two can be split
    // across a save and the entity arrives at the next load without its position.
    expect(geometry?.layerId).toBe(person?.layerId)
    expect(geometry?.entityId).toBe(PERSON_ID)
    expect(cycleOne.geometries.find((g) => g.id === VESSEL_GEOMETRY_ID)?.entityId).toBe(VESSEL_ID)
  }, 120_000)

  it("an authored edge keeps its date and its role", () => {
    expect(storePathError).toBeNull()
    const officer = edgeById(cycleOne, OFFICER_EDGE_ID)
    expect(officer?.type).toBe("officer_of")
    expect(officer?.fromId).toBe(PERSON_ID)
    expect(officer?.toId).toBe(ROSTEC)
    // The two fields no edge in the real project carries. `metadata` is stored as a JSON column
    // whose encoder emits NULL for an empty bag, and 1,010 of the 1,012 existing edges take that
    // branch — so the populated branch is unexercised by the published file.
    expect(officer?.startDate).toBe(OFFICER_START)
    expect(officer?.endDate).toBeNull()
    expect(officer?.metadata).toEqual({ role: "director" })
  }, 120_000)

  it("a cross-kind hierarchy edge derives no parent and does not make the file unopenable", () => {
    expect(storePathError).toBeNull()
    const crossKind = edgeById(cycleOne, CROSS_KIND_EDGE_ID)
    expect(crossKind?.type).toBe("subordinate_to")
    expect(crossKind?.toId).toBe(unitTargetId)
    // Kept exactly as recorded — a person recorded under a unit is a legitimate assertion, and
    // throwing on it would make a legitimate record unopenable (ADR 0011).
    expect(entityById(cycleOne, PERSON_ID)?.parentId).toBeNull()
    expect(entityById(cycleTwo, PERSON_ID)?.parentId).toBeNull()
    // Recorded, not merely tolerated: before 75af6e9 the loader resolved a person's stored
    // parent against the UNIT id set, and the second open of this very file threw
    // "entity references missing parent".
    expect(eventIds(cycleOne).has(CROSS_KIND_EVENT_ID)).toBe(true)
  }, 120_000)

  it("the second cycle decodes to exactly what the first encoded", () => {
    expect(storePathError).toBeNull()
    // The fixed point step 19's zero-tolerance hash comparison rests on. A field that decodes to
    // a different value than it encoded drifts here on the second pass, while every count, every
    // parent map and every rendered position stays green.
    expect(cycleTwo.entities).toEqual(cycleOne.entities)
    expect(cycleTwo.relationships).toEqual(cycleOne.relationships)
    expect(cycleTwo.geometries).toEqual(cycleOne.geometries)
    expect(cycleOne.relationships).toHaveLength(1014)
  }, 120_000)

  it("the second cycle mints no integrity event the first did not", () => {
    expect(storePathError).toBeNull()
    // `createdAt` is read fresh on every load, so the ids are what can be compared — and the ids
    // are deterministic precisely so a re-detected condition updates one row instead of growing
    // the ledger by one row per open. An overnight cold reopen (step 27) is one more load.
    expect(eventIds(cycleTwo)).toEqual(eventIds(cycleOne))
    expect(cycleTwo.integrityEvents).toHaveLength(cycleOne.integrityEvents.length)
  }, 120_000)
})
