import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import { selectPersistableSnapshot, useProjectStore } from "@/store/useProjectStore"
import { tableExists } from "./columnDescriptor"
import { loadGeoPackage, projectStateFromLoadResult, saveGeoPackage } from "./index"
import { ORGANISATIONS_TABLE } from "./organisations.table"

/**
 * The store path the running app actually takes on Open-then-Save, against the real
 * checked-in project: load -> projectStateFromLoadResult -> setProject ->
 * selectPersistableSnapshot -> save -> reload.
 *
 * Every other persistence test feeds loadGeoPackage's own result straight back into
 * saveGeoPackage, so the store — which re-injects layers, trims names and drops claims whose
 * endpoint is gone — sits outside their coverage. A regression in that reshaping destroys the
 * analyst's project while those tests stay green: that is the gap this file closes.
 *
 * public/project.gpkg is read with readFileSync and never written; everything after the read
 * happens on in-memory buffers.
 */
describe("real project through the store path (public/project.gpkg)", () => {
  afterEach(() => {
    // The project store is a module singleton: leaving it loaded would make another test
    // file's result depend on file ordering.
    useProjectStore.getState().resetProject()
    // A baseBuffer is supplied below, so save.ts' create-with-retry pool should never run.
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

  it(
    "carries a real project through the store path: load -> setProject -> selectPersistableSnapshot -> save -> reload",
    async () => {
      // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
      // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
      const fileBytes = readFileSync(resolve(process.cwd(), "public/project.gpkg"))
      const buffer = Uint8Array.from(fileBytes).buffer

      const loaded = await loadGeoPackage(buffer)
      expect(loaded.entities.length).toBeGreaterThan(0)

      // The one shared state literal every load path hands to setProject (applyResult.ts).
      useProjectStore.getState().setProject(projectStateFromLoadResult(loaded))
      const state = useProjectStore.getState()

      // Called exactly as handleSave calls it: store state first, then the peripheral stores'
      // data positionally. The load result stands in for those peripheral stores here — this
      // test is about the project-store chain, not the rating pipeline that fills them.
      const snapshot = selectPersistableSnapshot(state, loaded.sourceCache, loaded.sources, loaded.ratingEvents)

      // Mapped exactly as performSaveProject maps it, including the store's sourceCache ->
      // researchSources rename, and the baseBuffer that makes this the reopen-and-save path
      // the app really runs (a missing baseBuffer would save into a blank GeoPackage instead).
      const bytes = await saveGeoPackage({
        layers: snapshot.layers,
        entities: snapshot.entities,
        geometries: snapshot.geometries,
        researchSources: snapshot.sourceCache,
        baseBuffer: buffer,
        sources: snapshot.sources,
        claims: snapshot.claims,
        ratingEvents: snapshot.ratingEvents,
        // From the snapshot, exactly as performProjectSave takes them (projectSave.ts): after
        // ADR 0011 the edge set IS the hierarchy, so a hard-coded `[]` here would not be a
        // neutral fixture value — it would wipe the relationships table and make the parent-map
        // comparison below assert nothing but "everything flattened to null, twice".
        relationships: snapshot.relationships,
        integrityEvents: snapshot.integrityEvents,
      })
      const reloaded = await loadGeoPackage(Uint8Array.from(bytes).buffer)

      // The saved bytes must really descend from the opened file. Every assertion below is
      // satisfied by a save into a brand-new GeoPackage too (the snapshot supplies all the
      // rows), so without this the baseBuffer link in the chain would be untested: the
      // pre-E1 legacy table only exists in the bytes if the reopen path ran.
      const savedGeoPackage = await GeoPackageAPI.open(new Uint8Array(bytes))
      try {
        expect(tableExists(savedGeoPackage.connection, ORGANISATIONS_TABLE)).toBe(true)
      } finally {
        savedGeoPackage.close()
      }

      // --- Entities survive in full -------------------------------------------------------
      // Measured on the real file: 1027 entities load, 1027 reach the store, 1027 reach the
      // snapshot. The fixture carries no OSM layer, so the snapshot's OSM filter drops
      // nothing — asserted rather than assumed, since a silent drop here is exactly the
      // data loss this path can cause.
      expect(snapshot.entities).toHaveLength(loaded.entities.length)
      expect(reloaded.entities).toHaveLength(snapshot.entities.length)

      // Counts alone would pass through a hierarchy that had been flattened or rewired: the
      // failure mode is topological, so compare the whole mapping.
      const parentsIn = new Map(loaded.entities.map((e) => [e.id, e.parentId]))
      const parentsOut = new Map(reloaded.entities.map((e) => [e.id, e.parentId]))
      expect(parentsOut).toEqual(parentsIn)
      // A mapping of all nulls would deep-equal itself, so pin that real parent links exist.
      expect([...parentsIn.values()].filter((parentId) => parentId != null).length).toBeGreaterThan(0)

      // --- Layer growth is accounted for --------------------------------------------------
      // applyGeoPackageResult re-injects the default echelon layers plus Industry, so the
      // state handed to setProject can carry more layers than the file did. Measured on this
      // file it carries exactly as many (16 -> 16): the fixture already holds all 14 echelon
      // layers, one custom layer and Industry, so the re-injection is a no-op here. What is
      // asserted is therefore the invariant, not that count: the store may add layers, never
      // lose one.
      expect(state.layers.length).toBeGreaterThanOrEqual(loaded.layers.length)
      const reloadedLayerIds = new Set(reloaded.layers.map((l) => l.id))
      for (const layer of loaded.layers) {
        expect(reloadedLayerIds.has(layer.id)).toBe(true)
      }
      // No entity may be orphaned onto a layer the round-trip did not write.
      for (const entity of reloaded.entities) {
        expect(reloadedLayerIds.has(entity.layerId)).toBe(true)
      }

      // --- Claims survive -----------------------------------------------------------------
      // Against the snapshot, not the raw load: selectPersistableSnapshot deliberately drops
      // claims whose entity the OSM filter removed, so the raw count is the wrong yardstick.
      expect(snapshot.claims.length).toBeGreaterThan(0)
      expect(reloaded.claims).toHaveLength(snapshot.claims.length)

      // --- Geometries survive, count for count --------------------------------------------
      expect(snapshot.geometries.length).toBeGreaterThan(0)
      expect(reloaded.geometries).toHaveLength(snapshot.geometries.length)

      // The snapshot renames a blank entity to "Untitled"; nothing may arrive nameless.
      for (const entity of reloaded.entities) {
        expect(entity.name.trim().length).toBeGreaterThan(0)
      }
    },
    60_000,
  )
})
