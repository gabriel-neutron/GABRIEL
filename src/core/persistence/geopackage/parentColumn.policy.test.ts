import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import { loadGeoPackage, saveGeoPackage, type GpkgLayer } from "./index"

/**
 * What a load does with a stored `parent_id` it cannot resolve — and the answer differs by
 * whether the file has been migrated, which is the whole point.
 *
 * A corporate entity stored under a unit: the cross-kind reference under test is the one in the
 * COLUMN, not in the edge set, so these fixtures carry no edges at all.
 */
const LAYERS: GpkgLayer[] = [
  { id: "division", name: "Division", visible: true, kind: "echelon" },
  { id: "industry", name: "Industry", visible: true, kind: "organisation" },
]
const ENTITIES: MapEntity[] = [
  { kind: "unit", id: "unit-1", name: "1st Division", layerId: "division", parentId: null },
  {
    kind: "corporate",
    id: "org-1",
    name: "Cross-kind org",
    type: "other",
    layerId: "industry",
    parentId: "unit-1",
  },
]

async function saveFixture(): Promise<Uint8Array> {
  return saveGeoPackage({
    layers: LAYERS, entities: ENTITIES, geometries: [],
    researchSources: undefined, baseBuffer: undefined, sources: undefined, claims: undefined,
    ratingEvents: undefined, relationships: [], integrityEvents: [],
  })
}

describe("the persisted parent_id column", () => {
  afterEach(() => {
    // Best-effort cleanup of stray browser-save-pool files: another parallel test file's worker
    // may still hold a lock on a same-named pooled file on Windows, so a transient EPERM here
    // isn't a real failure.
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

  it(
    "records an unresolvable stored parent rather than making a migrated project unopenable",
    async () => {
      // Once `relationships` exists, `parent_id` is a DERIVATION that this load overwrites, so
      // its only surviving effect was the power to refuse to open the analyst's project. A
      // control that destroys the work it protects is the wrong control (Slice 3).
      const bytes = await saveFixture()
      const result = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      const stale = result.integrityEvents.filter((e) => e.detail.code === "stale-parent")
      expect(stale).toHaveLength(1)
      expect(stale[0].kind).toBe("invalid-entry")
      expect(stale[0].detail).toMatchObject({ entityId: "org-1", parentId: "unit-1", parentKind: "unit" })
      // Named entities, not ids: the row is meant to be read by a person.
      expect(stale[0].summary).toContain("\"Cross-kind org\"")
      expect(stale[0].summary).toContain("crosses entity kinds")
      // And the value itself is not carried forward under any circumstances.
      expect(result.entities.find((e) => e.id === "org-1")?.parentId).toBeNull()
    },
    30_000,
  )

  it(
    "still refuses a file that has no relationships table, where parent_id is the record",
    async () => {
      // The un-migrated path. `migrateHierarchyToRelationships` is about to mint one edge per
      // parented entity from this very column, so an unresolvable value would become an edge
      // with a dangling endpoint — fatal, found later, and diagnosed worse. The table is dropped
      // rather than never created because `saveGeoPackage` always creates it.
      const bytes = await saveFixture()
      const gpkg = await GeoPackageAPI.open(Uint8Array.from(bytes))
      let unmigrated: Uint8Array
      try {
        gpkg.connection.run("DROP TABLE relationships")
        unmigrated = await gpkg.export()
      } finally {
        gpkg.close()
      }

      await expect(loadGeoPackage(Uint8Array.from(unmigrated).buffer)).rejects.toThrow(
        /Unsupported schema.*missing parent/,
      )
    },
    30_000,
  )
})
