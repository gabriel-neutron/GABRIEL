import { beforeEach, describe, expect, it } from "vitest"
import { selectPersistableSnapshot, useProjectStore, type ProjectState } from "./useProjectStore"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Claim } from "@/core/provenance/claim"

/**
 * `selectPersistableSnapshot`, the cascade rules and `mergeEntities`. The two credibility concerns
 * that used to sit between them moved to `useProjectStore.credibility.test.ts` when this file was
 * split back under the 300-line cap (`CONSTRAINTS.md:113`); the further snapshot and relationship
 * cases already live in `useProjectStore.snapshot.test.ts` and `.relationships.test.ts`.
 */

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    layers: [],
    entities: [],
    drawnGeometries: [],
    claims: [],
    relationships: [],
    integrityEvents: [],
    selectedEntityId: null,
    entityMergeMap: {},
    ...overrides,
  }
}

describe("selectPersistableSnapshot", () => {
  it("leaves an already-tagged layer's kind untouched", () => {
    const layers: Layer[] = [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }]
    const snapshot = selectPersistableSnapshot(makeState({ layers }), new Map())
    expect(snapshot.layers).toEqual([{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }])
  })

  it("infers kind='osm' for a layer with cached osmData but no explicit kind", () => {
    const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    const layers: Layer[] = [{ id: "legacy-osm", name: "Legacy OSM Layer", visible: true, osmData }]
    const snapshot = selectPersistableSnapshot(makeState({ layers }), new Map())
    expect(snapshot.layers[0].kind).toBe("osm")
  })

  it("leaves kind undefined for a layer with neither an explicit kind nor osmData", () => {
    const layers: Layer[] = [{ id: "bare", name: "Bare Layer", visible: true }]
    const snapshot = selectPersistableSnapshot(makeState({ layers }), new Map())
    expect(snapshot.layers[0].kind).toBeUndefined()
  })

  it("filters entities and geometries on OSM layers, but not the fixed Industry layer", () => {
    const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    const layers: Layer[] = [
      { id: "osm-1", name: "OSM Layer", visible: true, kind: "osm", osmData },
      { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
      { id: "industry", name: "Industry", visible: true, kind: "organisation" },
    ]
    const entities: MapEntity[] = [
      { kind: "unit", id: "e-osm", name: "On OSM layer", layerId: "osm-1", parentId: null },
      { kind: "unit", id: "e-custom", name: "On custom layer", layerId: "custom-1", parentId: null },
      {
        kind: "corporate",
        id: "org-1",
        name: "Org",
        type: "other",
        layerId: "industry",
        parentId: null,
        notes: null,
        osmRelationId: null,
        positionMode: "own",
        isExactPosition: false,
      },
    ]
    const drawnGeometries: DrawnGeometry[] = [
      { id: "g-osm", layerId: "osm-1", entityId: null, type: "point", lat: 0, lng: 0 },
      { id: "g-custom", layerId: "custom-1", entityId: null, type: "point", lat: 0, lng: 0 },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, drawnGeometries }), new Map())

    expect(snapshot.entities.map((e) => e.id)).toEqual(["e-custom", "org-1"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["g-custom"])
  })

  it("trims blank entity names (of any kind) to 'Untitled'", () => {
    const layers: Layer[] = [
      { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
      { id: "industry", name: "Industry", visible: true, kind: "organisation" },
    ]
    const entities: MapEntity[] = [
      { kind: "unit", id: "e-1", name: "   ", layerId: "custom-1", parentId: null },
      {
        kind: "corporate",
        id: "org-1",
        name: "  ",
        type: "other",
        layerId: "industry",
        parentId: null,
        notes: null,
        osmRelationId: null,
        positionMode: "own",
        isExactPosition: false,
      },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities }), new Map())
    expect(snapshot.entities.find((e) => e.id === "e-1")?.name).toBe("Untitled")
    expect(snapshot.entities.find((e) => e.id === "org-1")?.name).toBe("Untitled")
  })

  it("excludes claims belonging to a filtered-out (OSM-layer) entity", () => {
    const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    const layers: Layer[] = [
      { id: "osm-1", name: "OSM Layer", visible: true, kind: "osm", osmData },
      { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
    ]
    const entities: MapEntity[] = [
      { kind: "unit", id: "e-osm", name: "On OSM layer", layerId: "osm-1", parentId: null },
      { kind: "unit", id: "e-custom", name: "On custom layer", layerId: "custom-1", parentId: null },
    ]
    const claims: Claim[] = [
      { id: "c-osm", entityId: "e-osm", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      { id: "c-custom", entityId: "e-custom", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, claims }), new Map())
    expect(snapshot.claims.map((c) => c.id)).toEqual(["c-custom"])
  })
})

describe("useProjectStore claims cascade", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("deleteEntity removes claims belonging to the deleted entity", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [
        { kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null },
        { kind: "unit", id: "e-2", name: "B", layerId: "custom-1", parentId: null },
      ],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
        { id: "c-2", entityId: "e-2", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      ],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().deleteEntity("e-1")
    expect(useProjectStore.getState().claims.map((c) => c.id)).toEqual(["c-2"])
  })

  it("removeLayer cascades to claims of every entity removed with that layer", () => {
    useProjectStore.getState().setProject({
      layers: [
        { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
        { id: "custom-2", name: "Custom 2", visible: true, kind: "custom" },
      ],
      entities: [
        { kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null },
        { kind: "unit", id: "e-2", name: "B", layerId: "custom-2", parentId: null },
      ],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
        { id: "c-2", entityId: "e-2", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      ],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().removeLayer("custom-1")
    expect(useProjectStore.getState().claims.map((c) => c.id)).toEqual(["c-2"])
  })
})

describe("useProjectStore mergeEntities (ADR 0006, E3)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("collapses the secondary into the primary atomically, preserving claims and geometries", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [
        { kind: "unit", id: "a", name: "Wagner", layerId: "custom-1", parentId: null },
        { kind: "unit", id: "b", name: "Вагнер", layerId: "custom-1", parentId: null },
        { kind: "unit", id: "child", name: "Sub", layerId: "custom-1", parentId: "b" },
      ],
      drawnGeometries: [
        { id: "g-1", layerId: "custom-1", entityId: "b", type: "point", lat: 1, lng: 2 },
      ],
      claims: [
        { id: "c-1", entityId: "b", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      ],
      // ADR 0011: the hierarchy IS the edge set, so "child is under b" is an EDGE. A post-2B
      // store carries edges; `parentId` alone is derived and would be nulled by the derivation.
      relationships: [{ id: "r-1", fromId: "child", toId: "b", type: "subordinate_to", startDate: null, endDate: null, metadata: {} }], integrityEvents: [],
      selectedEntityId: "b",
    })
    useProjectStore.getState().mergeEntities("a", "b")
    const s = useProjectStore.getState()

    expect(s.entities.map((e) => e.id).sort()).toEqual(["a", "child"])
    expect(s.entities.find((e) => e.id === "a")!.aliases).toEqual(["Вагнер"])
    expect(s.entities.find((e) => e.id === "child")!.parentId).toBe("a")
    expect(s.drawnGeometries[0].entityId).toBe("a")
    expect(s.claims[0].entityId).toBe("a")
    // A selection pointing at the now-gone secondary follows the surviving primary.
    expect(s.selectedEntityId).toBe("a")
    // The secondary's id is recorded as merged-away so consumers keyed to it can redirect.
    expect(s.entityMergeMap).toEqual({ b: "a" })
  })

  it("is a no-op on a cross-kind merge", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [
        { kind: "unit", id: "a", name: "Wagner", layerId: "custom-1", parentId: null },
        { kind: "corporate", id: "c", name: "Wagner", layerId: "industry", parentId: null, type: "other" },
      ],
      drawnGeometries: [],
      claims: [],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().mergeEntities("a", "c")
    expect(useProjectStore.getState().entities.map((e) => e.id).sort()).toEqual(["a", "c"])
    // A no-op merge must not record a remap for an entity that's still alive.
    expect(useProjectStore.getState().entityMergeMap).toEqual({})
  })

  it("does not record a remap when the secondary id never existed", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "a", name: "Wagner", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    // secondaryId "ghost" was never a real entity (e.g. a stale duplicate-candidate row) —
    // mergeIdentityGraph is a no-op, and post-merge absence of "ghost" alone must not be
    // mistaken for "ghost was merged away", or a later id lookup would be misredirected.
    useProjectStore.getState().mergeEntities("a", "ghost")
    expect(useProjectStore.getState().entities.map((e) => e.id)).toEqual(["a"])
    expect(useProjectStore.getState().entityMergeMap).toEqual({})
  })
})
