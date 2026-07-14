import { beforeEach, describe, expect, it } from "vitest"
import { selectPersistableSnapshot, useProjectStore, type ProjectState } from "./useProjectStore"
import { useProvenanceStore } from "./useProvenanceStore"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Claim } from "@/core/provenance/claim"

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    layers: [],
    entities: [],
    drawnGeometries: [],
    claims: [],
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
      selectedEntityId: null,
    })
    useProjectStore.getState().removeLayer("custom-1")
    expect(useProjectStore.getState().claims.map((c) => c.id)).toEqual(["c-2"])
  })
})

describe("useProjectStore.confirmClaimCredibility (ADR 0009 Confirm gate)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
    useProvenanceStore.getState().resetSources()
  })

  it("promotes an eligible claim to credibility 1 and logs a rating event", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        {
          id: "c-1",
          entityId: "e-1",
          field: "sources",
          value: null,
          sourceId: "src-1",
          credibility: 2,
          timestamp: null,
          credibilityMeta: {
            confidence: 0.8,
            rationale: "r",
            assessor: { kind: "ai" },
            updatedAt: "t",
            overridden: false,
            evidenceRefs: ["https://a.example", "https://b.example"],
            corroborationClusters: 2,
            statedAttribution: null,
            dates: ["2026-01-01"],
          },
        },
      ],
      selectedEntityId: null,
    })
    useProjectStore.getState().confirmClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(1)
    expect(useProvenanceStore.getState().ratingEvents).toHaveLength(1)
    expect(useProvenanceStore.getState().ratingEvents[0]).toMatchObject({ targetType: "claim", targetId: "c-1", kind: "credibility", value: "1" })
  })

  it("does not log an event when the claim is ineligible (confirmCredibility is a no-op)", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null },
      ],
      selectedEntityId: null,
    })
    useProjectStore.getState().confirmClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(2)
    expect(useProvenanceStore.getState().ratingEvents).toEqual([])
  })

  it("refuteClaimCredibility marks the claim overridden, logs a 'refuted' event, and leaves credibility unchanged", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null },
      ],
      selectedEntityId: null,
    })
    useProjectStore.getState().refuteClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(2)
    expect(useProjectStore.getState().claims[0]!.credibilityMeta?.overridden).toBe(true)
    expect(useProvenanceStore.getState().ratingEvents[0]).toMatchObject({ targetType: "claim", targetId: "c-1", kind: "credibility", value: "refuted" })
  })
})

describe("useProjectStore.applyCredibilityToClaims (detached credibility patch)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  const result = {
    credibility: 2 as const,
    meta: {
      confidence: 0.8,
      rationale: "r",
      assessor: { kind: "ai" as const },
      updatedAt: "2026-07-14T00:00:00.000Z",
      overridden: false,
      evidenceRefs: ["https://a.example"],
      corroborationClusters: 1,
      statedAttribution: null,
    },
  }

  function setupClaims(claims: Claim[]) {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims,
      selectedEntityId: null,
    })
  }

  it("patches only the targeted claim id(s), leaving others untouched", () => {
    setupClaims([
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      { id: "c-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-2", credibility: null, timestamp: null },
    ])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], result)
    const claims = useProjectStore.getState().claims
    expect(claims.find((c) => c.id === "c-1")?.credibility).toBe(2)
    expect(claims.find((c) => c.id === "c-2")?.credibility).toBeNull()
  })

  it("is a no-op when the result is null", () => {
    setupClaims([{ id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], null)
    expect(useProjectStore.getState().claims[0]!.credibility).toBeNull()
  })

  it("is a no-op when the claim id no longer exists (e.g. deleted before the assessment resolved)", () => {
    setupClaims([{ id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }])
    expect(() => useProjectStore.getState().applyCredibilityToClaims(["gone"], result)).not.toThrow()
    expect(useProjectStore.getState().claims[0]!.credibility).toBeNull()
  })

  it("does not clobber a claim already overridden by a human in the meantime", () => {
    setupClaims([
      {
        id: "c-1",
        entityId: "e-1",
        field: "sources",
        value: null,
        sourceId: "src-1",
        credibility: 1,
        timestamp: null,
        credibilityMeta: { ...result.meta, overridden: true, assessor: { kind: "analyst" } },
      },
    ])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], result)
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(1)
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
