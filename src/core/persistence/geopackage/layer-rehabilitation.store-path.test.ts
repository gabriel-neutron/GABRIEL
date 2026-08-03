import { afterEach, describe, expect, it } from "vitest"
import { selectPersistableSnapshot, useProjectStore } from "@/store/useProjectStore"
import { projectStateFromLoadResult } from "./applyResult"
import type { GeoPackageLoadResult, GpkgLayer } from "./types"

/**
 * ADR 0012, strongest consequence: a `.gpkg` written or edited by a foreign tool opens with
 * its layers, entities, geometries AND claims intact.
 *
 * The loss was never confined to the layer, so neither is this test. `selectPersistableSnapshot`
 * builds its surviving-id set from the layers in the store and filters entities by *membership*
 * in that set, so a layer dropped on load took its entities with it, and with them their
 * geometries and their claims — all deleted at the next save. Only the whole chain
 * (load result -> projectStateFromLoadResult -> setProject -> selectPersistableSnapshot)
 * shows that; an assertion on the returned layer array alone would not.
 *
 * The load result is a plain object literal, as in useProjectIO.load-state.test.ts. Nothing is
 * mocked: every function under test here is the real one.
 */

function makeLoadResultOnLayer(layer: GpkgLayer): GeoPackageLoadResult {
  return {
    layers: [layer],
    entities: [{ kind: "unit", id: "entity-1", name: "1st Battalion", layerId: layer.id, parentId: null }],
    geometries: [
      { id: "geometry-1", layerId: layer.id, entityId: "entity-1", type: "point", lat: 50.45, lng: 30.52 },
    ],
    sourceCache: new Map(),
    sources: [{ id: "source-1", url: "https://example.org/report", domainType: null, reliability: null }],
    claims: [
      {
        id: "claim-1",
        entityId: "entity-1",
        field: "sources",
        value: null,
        sourceId: "source-1",
        credibility: null,
        timestamp: null,
      },
    ],
    ratingEvents: [],
    // The single entity is a root, so this fixture carries no edges and no integrity findings.
    relationships: [],
    integrityEvents: [],
  }
}

function snapshotAfterOpening(result: GeoPackageLoadResult) {
  useProjectStore.getState().setProject(projectStateFromLoadResult(result))
  return selectPersistableSnapshot(useProjectStore.getState(), result.sourceCache, result.sources, result.ratingEvents)
}

describe("opening a project whose layer this version cannot classify (ADR 0012)", () => {
  afterEach(() => {
    // The project store is a module singleton: leaving it loaded would make another test
    // file's result depend on file ordering.
    useProjectStore.getState().resetProject()
  })

  it("saves the layer, entity, geometry and claim of a layer whose kind column is NULL", () => {
    const result = makeLoadResultOnLayer({ id: "qgis-1", name: "Couche QGIS", visible: true, kind: undefined })

    const snapshot = snapshotAfterOpening(result)

    expect(snapshot.layers.map((l) => l.id)).toContain("qgis-1")
    expect(snapshot.entities.map((e) => e.id)).toEqual(["entity-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["geometry-1"])
    // The easiest one to lose and the last one noticed: a claim is dropped by entity id, two
    // filters downstream of the layer that actually went missing.
    expect(snapshot.claims.map((c) => c.id)).toEqual(["claim-1"])
  })

  it("saves the layer, entity, geometry and claim of a layer whose kind this version does not recognise", () => {
    const foreign = { id: "raster-1", name: "Raster", visible: true, kind: "raster" } as unknown as GpkgLayer
    const result = makeLoadResultOnLayer(foreign)

    const snapshot = snapshotAfterOpening(result)

    expect(snapshot.layers.map((l) => l.id)).toContain("raster-1")
    expect(snapshot.entities.map((e) => e.id)).toEqual(["entity-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["geometry-1"])
    expect(snapshot.claims.map((c) => c.id)).toEqual(["claim-1"])
  })

  it("saves the entity, geometry and claim of an OSM layer whose cached payload is gone", () => {
    // The stated side effect of the demotion: with its OSM-ness gone the layer is no longer
    // excluded by the snapshot's OSM filter, so its entities persist for the first time.
    const result = makeLoadResultOnLayer({
      id: "osm-1",
      name: "Bridges",
      visible: true,
      kind: "osm",
      osmData: undefined,
      sourceQuery: "bridge in Kyiv",
    })

    const snapshot = snapshotAfterOpening(result)

    expect(snapshot.layers.find((l) => l.id === "osm-1")?.kind).toBe("custom")
    expect(snapshot.entities.map((e) => e.id)).toEqual(["entity-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["geometry-1"])
    expect(snapshot.claims.map((c) => c.id)).toEqual(["claim-1"])
  })

  it("saves the entity, geometry and claim of an organisation layer that is not the Industry layer", () => {
    const result = makeLoadResultOnLayer({ id: "not-industry", name: "Shipyards", visible: true, kind: "organisation" })

    const snapshot = snapshotAfterOpening(result)

    expect(snapshot.layers.map((l) => l.id)).toContain("not-industry")
    expect(snapshot.entities.map((e) => e.id)).toEqual(["entity-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["geometry-1"])
    expect(snapshot.claims.map((c) => c.id)).toEqual(["claim-1"])
  })

  it("saves the entity, geometry and claim of an echelon layer whose id is not a vocabulary value", () => {
    const result = makeLoadResultOnLayer({ id: "Okrug", name: "Okrug", visible: true, kind: "echelon" })

    const snapshot = snapshotAfterOpening(result)

    expect(snapshot.layers.map((l) => l.id)).toContain("Okrug")
    expect(snapshot.entities.map((e) => e.id)).toEqual(["entity-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["geometry-1"])
    expect(snapshot.claims.map((c) => c.id)).toEqual(["claim-1"])
  })

  it("lets the analyst rename and then remove the layer it could not classify", () => {
    // The point of rehabilitating rather than quarantining: `custom` is the one kind that is
    // both renameable and deletable, so the layer is the analyst's to deal with deliberately.
    const result = makeLoadResultOnLayer({ id: "qgis-1", name: "Couche QGIS", visible: true, kind: undefined })
    useProjectStore.getState().setProject(projectStateFromLoadResult(result))

    useProjectStore.getState().renameLayer("qgis-1", "Imported from QGIS")
    expect(useProjectStore.getState().layers.find((l) => l.id === "qgis-1")?.name).toBe("Imported from QGIS")

    useProjectStore.getState().removeLayer("qgis-1")
    const after = useProjectStore.getState()
    expect(after.layers.some((l) => l.id === "qgis-1")).toBe(false)
    expect(after.entities).toEqual([])
    expect(after.drawnGeometries).toEqual([])
    expect(after.claims).toEqual([])
  })
})
