import { describe, expect, it } from "vitest"
import { selectPersistableSnapshot, type ProjectState } from "./useProjectStore"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Organisation } from "@/types/organisation.types"

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    layers: [],
    entities: [],
    organisations: [],
    drawnGeometries: [],
    selectedEntityId: null,
    selectedOrganisationId: null,
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

  it("filters entities and geometries on OSM layers, but not organisations", () => {
    const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    const layers: Layer[] = [
      { id: "osm-1", name: "OSM Layer", visible: true, kind: "osm", osmData },
      { id: "custom-1", name: "Custom", visible: true, kind: "custom" },
    ]
    const entities: MapEntity[] = [
      { kind: "unit", id: "e-osm", name: "On OSM layer", layerId: "osm-1", parentId: null },
      { kind: "unit", id: "e-custom", name: "On custom layer", layerId: "custom-1", parentId: null },
    ]
    const drawnGeometries: DrawnGeometry[] = [
      { id: "g-osm", layerId: "osm-1", entityId: null, type: "point", lat: 0, lng: 0 },
      { id: "g-custom", layerId: "custom-1", entityId: null, type: "point", lat: 0, lng: 0 },
    ]
    const organisations: Organisation[] = [
      {
        id: "org-1",
        name: "Org",
        type: "other",
        parentId: null,
        notes: null,
        sources: null,
        osmRelationId: null,
        positionMode: "own",
        isExactPosition: false,
      },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, drawnGeometries, organisations }), new Map())

    expect(snapshot.entities.map((e) => e.id)).toEqual(["e-custom"])
    expect(snapshot.geometries.map((g) => g.id)).toEqual(["g-custom"])
    expect(snapshot.organisations).toHaveLength(1)
  })

  it("trims blank entity and organisation names to 'Untitled'", () => {
    const layers: Layer[] = [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }]
    const entities: MapEntity[] = [{ kind: "unit", id: "e-1", name: "   ", layerId: "custom-1", parentId: null }]
    const organisations: Organisation[] = [
      {
        id: "org-1",
        name: "  ",
        type: "other",
        parentId: null,
        notes: null,
        sources: null,
        osmRelationId: null,
        positionMode: "own",
        isExactPosition: false,
      },
    ]
    const snapshot = selectPersistableSnapshot(makeState({ layers, entities, organisations }), new Map())
    expect(snapshot.entities[0].name).toBe("Untitled")
    expect(snapshot.organisations[0].name).toBe("Untitled")
  })
})
