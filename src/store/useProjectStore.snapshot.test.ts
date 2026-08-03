import { describe, expect, it } from "vitest"
import type { Relationship } from "@/core/relationship/relationship"
import type { Layer, MapEntity } from "@/types/domain.types"
import { selectPersistableSnapshot, type ProjectState } from "./useProjectStore"

/**
 * Criterion 58 (§9 clause 6). Lives beside useProjectStore.test.ts rather than inside it: that
 * file is capped at 385 lines by criterion 5 and already sits at 382, and criterion 5 names the
 * sibling-file split (P1b's projectIO.authority.test.ts, P2's useProjectStore.renameLayer.test.ts)
 * as the way to add tests without touching the cap.
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

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

describe("selectPersistableSnapshot relationships", () => {
  const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
  const layers: Layer[] = [
    { id: "osm-1", name: "OSM Layer", visible: true, kind: "osm", osmData },
    { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
  ]
  const entities: MapEntity[] = [
    { kind: "unit", id: "e-osm", name: "On OSM layer", layerId: "osm-1", parentId: null },
    { kind: "unit", id: "e-a", name: "A", layerId: "custom-1", parentId: null },
    { kind: "unit", id: "e-b", name: "B", layerId: "custom-1", parentId: null },
  ]

  it("drops an edge whose endpoint is filtered out with its OSM layer, and keeps the surviving edge", () => {
    const relationships = [
      edge("r-from-osm", "e-osm", "e-a"),
      edge("r-to-osm", "e-a", "e-osm"),
      edge("r-survives", "e-b", "e-a"),
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, relationships }), new Map())
    // An edge onto an entity the OSM filter removed would reach disk with a dangling endpoint,
    // and load.ts throws on one — an unopenable project file. Both directions are checked
    // because fromId and toId are equally capable of dangling.
    expect(snapshot.relationships.map((r) => r.id)).toEqual(["r-survives"])
    // The artefact: without this, "drops every edge" would pass the assertion above.
    expect(snapshot.relationships[0]).toEqual(edge("r-survives", "e-b", "e-a"))
  })

  it("drops an edge naming an entity that is not in the project at all", () => {
    const relationships = [edge("r-ghost", "e-a", "ghost"), edge("r-survives", "e-b", "e-a")]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, relationships }), new Map())
    expect(snapshot.relationships.map((r) => r.id)).toEqual(["r-survives"])
  })

  it("returns the integrity events unfiltered, since an event is not entity-keyed", () => {
    const integrityEvents = [
      { id: "i-1", kind: "cross-kind-parent" as const, createdAt: "2026-07-31T00:00:00.000Z", summary: "s", detail: {} },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, integrityEvents }), new Map())
    expect(snapshot.integrityEvents).toEqual(integrityEvents)
  })
})
