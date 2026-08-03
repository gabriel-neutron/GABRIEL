import { describe, expect, it } from "vitest"
import {
  getDefaultEchelonLayers,
  projectStateFromLoadResult,
  type GeoPackageLoadResult,
} from "@/core/persistence/geopackage"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"

function makeLoadResult(): GeoPackageLoadResult {
  return {
    layers: [{ id: "custom-1", name: "Task Force", visible: false, kind: "custom" }],
    entities: [{ kind: "unit", id: "entity-1", name: "1st Battalion", layerId: "custom-1", parentId: null }],
    geometries: [
      { id: "geometry-1", layerId: "custom-1", entityId: "entity-1", type: "point", lat: 50.45, lng: 30.52 },
    ],
    sourceCache: new Map([["https://example.org/report", "cached snippet"]]),
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

describe("projectStateFromLoadResult", () => {
  it("builds one project state from a load result for both the restore and open paths", () => {
    const result = makeLoadResult()

    const state = projectStateFromLoadResult(result)

    // claims come from the load result, not from applyGeoPackageResult, which carries no
    // provenance claims at all: taking them from there would silently drop every claim on load.
    expect(state.claims).toBe(result.claims)
    expect(state.claims).toHaveLength(1)
    expect(state.entities).toEqual(result.entities)
    expect(state.drawnGeometries).toEqual(result.geometries)
    expect(state.selectedEntityId).toBeNull()
    expect(state.layers).toEqual([
      ...getDefaultEchelonLayers(),
      { id: "custom-1", name: "Task Force", visible: false, kind: "custom" },
      { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" },
    ])
    // No UNDECLARED field reaches setProject. Slice 2B took the declared set from five to seven:
    // `relationships` and `integrityEvents` are required on setProject, and this literal is the
    // one place a silent eighth would show up.
    expect(Object.keys(state).sort()).toEqual([
      "claims",
      "drawnGeometries",
      "entities",
      "integrityEvents",
      "layers",
      "relationships",
      "selectedEntityId",
    ])
  })
})
