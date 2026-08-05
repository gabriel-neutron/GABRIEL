import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { computeAllEntityPositions } from "@/core/map/geometry"
import { activeParentMap } from "@/core/relationship/activeParent"
import { RELATIONSHIP_VIOLATION_CODES, validateRelationships } from "@/core/relationship/validate"
import type { Relationship } from "@/core/relationship/relationship"
import { selectPersistableSnapshot, useProjectStore } from "@/store/useProjectStore"
import type { LatLng } from "@/core/coordinates"
import type { MapEntity } from "@/types/domain.types"
import { tableExists } from "./columnDescriptor"
import { loadGeoPackage, projectStateFromLoadResult, saveGeoPackage } from "./index"
import { migrateHierarchyToRelationships, type HierarchyMigrationResult } from "./migrateHierarchy"
import { ORGANISATIONS_TABLE, organisationsToCorporateEntities, readOrganisations } from "./organisations.table"
import { readRelationships } from "./relationships.table"
import { readEntities } from "./units.table"
import type { GeoPackageLoadResult } from "./types"

/**
 * §10 steps 6-16 as a read-only dry run: the hierarchy migration against the real checked-in
 * project, through the store path the running app actually takes. The three pre-existing
 * persistence tests feed `loadGeoPackage`'s own result straight back into `saveGeoPackage`, so
 * the store sits outside their coverage — which is how a hard gate can pass green while the
 * running app destroys the hierarchy (§8).
 *
 * The project file is read once with `readFileSync` and NEVER written: everything after that
 * read is an in-memory buffer, and §10's writing rehearsal is deliberately not run here.
 */
const NOW = "2026-07-31T00:00:00.000Z"
const ROSTEC = "23dfd3ce-6465-55ca-83d4-cc8c766d8444"
const TECHMASH = "b4f1f1cf-1791-58de-b761-f65842e9d202"
const MOTOVILIKHA = "f727b211-b3f4-525c-9776-07192c0d2e80"
const KAMAZ = "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39"
const KALASHNIKOV = "d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c"
const ORGANISATION_ROOTS = [
  "Rostec State Corporation", "JSC Concern VKO Almaz-Antey",
  "United Shipbuilding Corporation JSC (USC)", "JSC Tactical Missiles Corporation (KTRV)",
]

/** Non-null parents only: the derivation's answer to "who is this entity under". */
function parentMap(entities: readonly MapEntity[]): Map<string, string> {
  const parents = new Map<string, string>()
  for (const e of entities) if (e.parentId != null) parents.set(e.id, e.parentId)
  return parents
}

function positionMap(result: GeoPackageLoadResult): Map<string, LatLng> {
  return new Map(
    computeAllEntityPositions(result.entities, result.geometries)
      .positioned.map((p) => [p.entity.id, p.position]),
  )
}

let rawEntities: MapEntity[] = []
let rawParents = new Map<string, string>()
let rawRelationships: Relationship[] | null = []
let migration: HierarchyMigrationResult
let secondPass: HierarchyMigrationResult
let violations = validateRelationships([])
let loaded: GeoPackageLoadResult
let reloaded: GeoPackageLoadResult
let reloadedTwice: GeoPackageLoadResult
let savedRelationships: Relationship[] | null = null
let savedHasLegacyOrganisations = false
/** Caught rather than left to abort `beforeAll`: a throwing save would take the in-memory §10
 *  gates down with it and report nothing about the migration. Nothing is skipped — every
 *  round-trip test asserts this is null FIRST and fails carrying the real message. */
let storePathError: string | null = null

/** The store path exactly as `handleSave` runs it: setProject -> selectPersistableSnapshot ->
 *  saveGeoPackage, with the `baseBuffer` that makes this the reopen-and-save the app really
 *  performs (a missing one would save into a blank GeoPackage and litter the repo root). */
async function throughTheStore(base: ArrayBuffer, result: GeoPackageLoadResult): Promise<Uint8Array> {
  useProjectStore.getState().setProject(projectStateFromLoadResult(result))
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

describe("the hierarchy migration through the store path (public/project.gpkg, read-only)", () => {
  beforeAll(async () => {
    // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
    // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
    const buffer = Uint8Array.from(readFileSync(resolve(process.cwd(), "public/project.gpkg"))).buffer

    // §10 step 6 — the pre-migration fingerprint, read from the RAW tables before any
    // derivation has run, so it is the file's own answer and not the migration's.
    const raw = await GeoPackageAPI.open(new Uint8Array(buffer))
    try {
      rawEntities = [...readEntities(raw), ...organisationsToCorporateEntities(readOrganisations(raw))]
      rawRelationships = readRelationships(raw)
    } finally {
      raw.close()
    }
    rawParents = parentMap(rawEntities)
    migration = migrateHierarchyToRelationships(rawEntities, [], NOW)
    violations = validateRelationships(migration.relationships, new Set(rawEntities.map((e) => e.id)))
    // §10 step 15, in memory: the previous result's edges handed back as `existing`.
    secondPass = migrateHierarchyToRelationships(rawEntities, migration.relationships, NOW)

    loaded = await loadGeoPackage(buffer)
    try {
      const firstBytes = await throughTheStore(buffer, loaded)
      const firstBuffer = Uint8Array.from(firstBytes).buffer
      reloaded = await loadGeoPackage(firstBuffer)
      const secondBytes = await throughTheStore(firstBuffer, reloaded)
      reloadedTwice = await loadGeoPackage(Uint8Array.from(secondBytes).buffer)

      const saved = await GeoPackageAPI.open(new Uint8Array(firstBytes))
      try {
        savedRelationships = readRelationships(saved)
        savedHasLegacyOrganisations = tableExists(saved.connection, ORGANISATIONS_TABLE)
      } finally {
        saved.close()
      }
    } catch (e) {
      storePathError = e instanceof Error ? e.message : String(e)
    }
    useProjectStore.getState().resetProject()
  }, 180_000)

  afterEach(() => {
    // The project store is a module singleton: leaving it loaded would make another test
    // file's result depend on file ordering.
    useProjectStore.getState().resetProject()
    // A baseBuffer is supplied above, so save.ts' create-with-retry pool should never run.
    // If a regression drops that baseBuffer, the pool writes gabriel-*.gpkg into the repo
    // root — sweep them so the litter does not outlive the failure.
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

  it("carries the migrated project through the store path", () => {
    expect(storePathError, "load -> setProject -> snapshot -> save -> reload did not complete").toBeNull()
    // (a) §10 steps 6 and 13. Counts alone would pass through a flattened or rewired
    // hierarchy — the failure mode is topological, so the whole mapping is compared.
    expect(rawParents.size).toBe(1012)
    expect(parentMap(reloaded.entities)).toEqual(rawParents)
    expect(parentMap(reloadedTwice.entities)).toEqual(rawParents)

    // (b) §9 clause 3 — the resurrection guard. 2024 is the number a re-run migration
    // produces, and it is the one number that must never appear.
    expect(reloaded.relationships).toHaveLength(1012)
    expect(reloadedTwice.relationships).toHaveLength(1012)

    // (c) §8b lesson 3 — the artefacts, not the counts. Counts do not prove a path was taken.
    const expectedIds = new Set([...rawParents.keys()].map((id) => "hier:" + id))
    expect(new Set(reloaded.relationships.map((r) => r.id))).toEqual(expectedIds)
    // The raw file has no relationships TABLE (null, not []) — which is what made the load
    // above migrate at all — while the saved bytes carry one.
    expect(rawRelationships).toBeNull()
    expect(savedRelationships).not.toBeNull()
    expect(savedRelationships).toHaveLength(1012)
    // Only true if the baseBuffer reopen path ran: a save into a blank GeoPackage never
    // creates the pre-E1 legacy table (store-path.integration.test.ts:77-86).
    expect(savedHasLegacyOrganisations).toBe(true)

    // (d) T15 — a derived parent outside the entity set would make the NEXT load throw at
    // load.ts:60-63, so the omission policy is asserted rather than assumed.
    const reloadedIds = new Set(reloaded.entities.map((e) => e.id))
    for (const parentId of parentMap(reloaded.entities).values()) {
      expect(reloadedIds.has(parentId)).toBe(true)
    }
  }, 60_000)

  it("rendered position map is identical", () => {
    // §10 step 7, Hash B — the assertion nobody thinks to write. The parent map can be
    // perfect while 741 units move or vanish (599 position_mode "none" + 142 "parent" derive
    // their position from the parent chain), and a count of edges stays green throughout.
    expect(storePathError, "load -> setProject -> snapshot -> save -> reload did not complete").toBeNull()
    const before = positionMap(loaded)
    const after = positionMap(reloaded)
    const moved = [...before].filter(([id, pos]) => {
      const now = after.get(id)
      return now == null || now[0] !== pos[0] || now[1] !== pos[1]
    })
    expect(
      moved.length,
      String(moved.length) + " of " + String(before.size) + " rendered positions moved (" +
      String(after.size) + " rendered after, " + String(loaded.entities.length) + " entities). " +
      "At or below 741 the position derivation is broken, not the persistence. First: " +
      moved.slice(0, 3).map(([id, p]) => id + " " + JSON.stringify(p) + " -> " + JSON.stringify(after.get(id))).join("; "),
    ).toBe(0)
    expect(after).toEqual(before)
    // Pinned, not "> 0": two identical EMPTY maps deep-equal each other, so this count is what
    // stops the gate passing on a project that renders nothing. Measured: 1024 of 1027.
    expect(before.size).toBe(1024)
  }, 60_000)

  it("mints 1012 edges", () => {
    // §10 step 9. `entitiesWithParentId` is asserted too, so the count is exercised on the
    // real population rather than on whatever subset the migration chose to look at.
    expect(rawEntities).toHaveLength(1027)
    expect(migration.entitiesWithParentId).toBe(1012)
    expect(migration.mintedEdges).toBe(1012)
    const byType = new Map<string, number>()
    for (const rel of migration.relationships) byType.set(rel.type, (byType.get(rel.type) ?? 0) + 1)
    expect(Object.fromEntries(byType)).toEqual({ subordinate_to: 999, corporate_parent: 13 })
    expect(byType.get("acts_for") ?? 0).toBe(0)
  }, 60_000)

  it("zero violations", () => {
    // §10 step 10. A bare length check would let a future violation code hide inside it, so all
    // nine are asserted by name — including multiple-active-hierarchy, Q40's hard 0.
    expect(violations).toEqual([])
    const counts = Object.fromEntries(
      RELATIONSHIP_VIOLATION_CODES.map((code) => [code, violations.filter((v) => v.code === code).length]),
    )
    expect(counts).toEqual(Object.fromEntries(RELATIONSHIP_VIOLATION_CODES.map((code) => [code, 0])))
  }, 60_000)

  it("hier ids and the two percentages", () => {
    // §10 steps 11-12. Set-equal to the parented entity ids, so no minted edge belongs to an
    // entity that never had a parent.
    const ids = migration.relationships.map((rel) => rel.id)
    expect(new Set(ids).size).toBe(1012)
    expect(ids.every((id) => id.startsWith("hier:"))).toBe(true)
    expect(new Set(ids)).toEqual(new Set([...rawParents.keys()].map((id) => "hier:" + id)))

    const priced = migration.relationships.filter((rel) => rel.metadata.percent != null)
    expect(priced.map((rel) => [rel.fromId, rel.metadata.percent])).toEqual([
      [KAMAZ, 49.9], [KALASHNIKOV, 25],
    ])
    expect(migration.relationships.filter((rel) => rel.metadata.percent === undefined)).toHaveLength(1010)
  }, 60_000)

  it("the corporate chain", () => {
    // §10 step 14. Motovilikha -> Techmash -> Rostec is the only two-level chain, so both
    // hops are asserted: one hop alone passes on a hierarchy that was flattened by one level.
    const derived = activeParentMap(migration.relationships).parentById
    // §10 step 13 taken literally, on the MINTED edges rather than on the reloaded field. (a)
    // above compares the field after a full round-trip, which is a stronger claim about the
    // FILE but a weaker one about the migration: it reads the parent back through the same
    // derivation that wrote it. This is the migration's own answer against the file's own
    // answer, deep-equal — 1012 entries, none extra, none missing, not "same size".
    expect(derived).toEqual(rawParents)
    expect(derived.get(MOTOVILIKHA)).toBe(TECHMASH)
    expect(derived.get(TECHMASH)).toBe(ROSTEC)
    expect(derived.has(ROSTEC)).toBe(false)
    let depth = 0
    for (let at = derived.get(MOTOVILIKHA); at != null; at = derived.get(at)) depth += 1
    expect(depth).toBe(2)

    const incoming = migration.relationships.filter(
      (rel) => rel.toId === ROSTEC && rel.type === "corporate_parent",
    )
    expect(incoming).toHaveLength(12)
    // Roots: every entity the derivation leaves without a parent, 1027 - 1012.
    expect(rawEntities.filter((e) => !derived.has(e.id))).toHaveLength(15)

    const nameById = new Map(rawEntities.map((e) => [e.id, e.name]))
    const rootIds = ORGANISATION_ROOTS.map((name) => {
      const match = rawEntities.find((e) => e.name === name && e.kind === "corporate")
      expect(match, "organisation root " + name + " is absent from the project").toBeDefined()
      return match!.id
    })
    expect(nameById.get(ROSTEC)).toBe("Rostec State Corporation")
    for (const id of rootIds) {
      expect(migration.relationships.filter((r) => r.fromId === id && r.type === "corporate_parent")).toHaveLength(0)
    }
  }, 60_000)

  it("second pass", () => {
    // §10 step 15. `skippedAlreadyPresent` non-zero is the artefact that distinguishes
    // "recognised the existing edges" from "did nothing at all".
    expect(secondPass.relationships).toHaveLength(1012)
    expect(secondPass.relationships.length).not.toBe(2024)
    expect(secondPass.mintedEdges).toBe(0)
    expect(secondPass.skippedAlreadyPresent).toBe(1012)
    expect(secondPass.entitiesWithParentId).toBe(secondPass.mintedEdges + secondPass.skippedAlreadyPresent)
    // Nothing migrated, so nothing to record: an event would claim a migration that did not run.
    expect(secondPass.integrityEvents).toEqual([])
  }, 60_000)

  it("one hierarchy-migrated event", () => {
    // §10 step 16, asserted on the RELOADED events rather than only the in-memory ones, so
    // the row is proven to have survived the save.
    expect(storePathError, "load -> setProject -> snapshot -> save -> reload did not complete").toBeNull()
    expect(reloaded.integrityEvents).toHaveLength(1)
    expect(reloadedTwice.integrityEvents).toHaveLength(1)
    const event = reloaded.integrityEvents[0]!
    expect(event.kind).toBe("hierarchy-migrated")
    expect(loaded.integrityEvents.map((e) => e.id)).toEqual([event.id])
    // Both source sentences travel into the file verbatim: the derivation of the only two
    // published percentages has to be auditable inside the GeoPackage itself.
    const detail = JSON.stringify(event.detail)
    expect(detail).toContain("... Rostec holds c.49.9% share.")
    expect(detail).toContain("Rostec holds 25%+1 share; private majority.")
    expect(event.summary.trim().length).toBeGreaterThan(0)
  }, 60_000)
})
