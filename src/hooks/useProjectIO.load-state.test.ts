import { describe, expect, it } from "vitest"
import { getDefaultEchelonLayers, type GeoPackageLoadResult } from "@/core/persistence/geopackage"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { projectStateFromLoadResult } from "./useProjectIO"

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
    // No sixth field reaches setProject.
    expect(Object.keys(state).sort()).toEqual([
      "claims",
      "drawnGeometries",
      "entities",
      "layers",
      "selectedEntityId",
    ])
  })
})
