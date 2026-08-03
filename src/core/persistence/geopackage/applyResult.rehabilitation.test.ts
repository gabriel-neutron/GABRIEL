import { describe, expect, it } from "vitest"
import { ECHELON_OPTIONS } from "@/types/symbol.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { Layer } from "@/types/domain.types"
import { applyGeoPackageResult } from "./applyResult"
import type { GeoPackageLoadResult, GpkgLayer } from "./types"

/**
 * ADR 0012. Rule 1: the built-in vocabulary is authoritative for echelon layers.
 * Rule 2: no layer a project file carries is dropped on load — anything not otherwise
 * placed is rehabilitated as `custom`, keeping its id, name and visibility.
 */

function makeLoadResult(layers: GpkgLayer[]): GeoPackageLoadResult {
  return {
    layers,
    entities: [],
    geometries: [],
    sourceCache: new Map(),
    sources: [],
    claims: [],
    ratingEvents: [],
    // Layer rehabilitation is the subject here; these fixtures carry no entities, so no edges
    // and no integrity findings either.
    relationships: [],
    integrityEvents: [],
  }
}

function layerById(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id)
}

describe("applyGeoPackageResult: the echelon vocabulary is authoritative (ADR 0012 rule 1)", () => {
  it("shows the vocabulary label for an echelon layer that arrives under a foreign name", () => {
    const result = makeLoadResult([
      { id: "Division", name: "Divisions blindees", visible: false, kind: "echelon" },
    ])

    const state = applyGeoPackageResult(result, null)

    const division = layerById(state.layers, "Division")
    expect(division).toEqual({ id: "Division", name: "Division", visible: false, kind: "echelon" })
    expect(state.layers.some((l) => l.name === "Divisions blindees")).toBe(false)
  })

  it("carries exactly one layer per echelon vocabulary value, whatever the file held", () => {
    const result = makeLoadResult([
      { id: "Division", name: "Divisions blindees", visible: false, kind: "echelon" },
    ])

    const state = applyGeoPackageResult(result, null)

    const echelonLayers = state.layers.filter((l) => l.kind === "echelon")
    expect(echelonLayers).toHaveLength(ECHELON_OPTIONS.length)
    expect(echelonLayers.map((l) => l.id).sort()).toEqual(ECHELON_OPTIONS.map((o) => o.value).slice().sort())
  })
})

describe("applyGeoPackageResult: no layer that reached disk is dropped (ADR 0012 rule 2)", () => {
  it("keeps a layer whose kind column is NULL, as a renameable custom layer", () => {
    // What a GeoPackage authored or edited by QGIS carries: decodeLayerKind maps NULL to
    // undefined, so this is the shape applyGeoPackageResult really receives.
    const result = makeLoadResult([{ id: "qgis-1", name: "Couche QGIS", visible: false, kind: undefined }])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, "qgis-1")).toEqual({
      id: "qgis-1",
      name: "Couche QGIS",
      visible: false,
      kind: "custom",
    })
  })

  it("keeps a layer whose kind this version does not recognise, as a renameable custom layer", () => {
    const foreign = { id: "raster-1", name: "Raster", visible: true, kind: "raster" } as unknown as GpkgLayer
    const result = makeLoadResult([foreign])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, "raster-1")).toEqual({
      id: "raster-1",
      name: "Raster",
      visible: true,
      kind: "custom",
    })
  })

  it("keeps an OSM layer whose cached payload is gone, as a plain custom layer with no query recorded", () => {
    const result = makeLoadResult([
      {
        id: "osm-1",
        name: "Bridges",
        visible: true,
        kind: "osm",
        osmData: undefined,
        sourceQuery: "bridge in Kyiv",
      },
    ])

    const state = applyGeoPackageResult(result, null)

    const rehabilitated = layerById(state.layers, "osm-1")
    expect(rehabilitated).toEqual({ id: "osm-1", name: "Bridges", visible: true, kind: "custom" })
    // The demotion is deliberate and total: the OSM-ness and the query that produced it go.
    expect(rehabilitated?.osmData).toBeUndefined()
    expect(rehabilitated?.sourceQuery).toBeUndefined()
    expect(Object.keys(rehabilitated ?? {}).sort()).toEqual(["id", "kind", "name", "visible"])
  })

  it("keeps an organisation-kind layer that is not the Industry layer, as a renameable custom layer", () => {
    const result = makeLoadResult([{ id: "not-industry", name: "Shipyards", visible: true, kind: "organisation" }])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, "not-industry")).toEqual({
      id: "not-industry",
      name: "Shipyards",
      visible: true,
      kind: "custom",
    })
  })

  it("keeps an echelon-kind layer whose id is not a vocabulary value, as a renameable custom layer", () => {
    const result = makeLoadResult([{ id: "Okrug", name: "Okrug", visible: false, kind: "echelon" }])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, "Okrug")).toEqual({
      id: "Okrug",
      name: "Okrug",
      visible: false,
      kind: "custom",
    })
  })

  it("returns every layer id the file carried, whatever kinds it mixed", () => {
    const foreign = { id: "raster-1", name: "Raster", visible: true, kind: "raster" } as unknown as GpkgLayer
    const result = makeLoadResult([
      { id: "qgis-1", name: "Couche QGIS", visible: true, kind: undefined },
      foreign,
      { id: "osm-1", name: "Bridges", visible: true, kind: "osm", osmData: undefined },
      { id: "not-industry", name: "Shipyards", visible: true, kind: "organisation" },
      { id: "Okrug", name: "Okrug", visible: true, kind: "echelon" },
      { id: "custom-1", name: "Task Force", visible: true, kind: "custom" },
    ])

    const state = applyGeoPackageResult(result, null)

    const returnedIds = new Set(state.layers.map((l) => l.id))
    for (const layer of result.layers) {
      expect(returnedIds.has(layer.id)).toBe(true)
    }
    // Rehabilitation must not also duplicate a layer.
    expect(state.layers.map((l) => l.id)).toHaveLength(new Set(state.layers.map((l) => l.id)).size)
  })

  it("keeps the Industry layer as an organisation layer under the name the file gave it", () => {
    // The counterpart to rule 1: Industry's name does round-trip, which is why renameLayer
    // guards `echelon` only.
    const result = makeLoadResult([
      { id: INDUSTRY_LAYER_ID, name: "Industrie", visible: false, kind: "organisation" },
    ])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, INDUSTRY_LAYER_ID)).toEqual({
      id: INDUSTRY_LAYER_ID,
      name: "Industrie",
      visible: false,
      kind: "organisation",
    })
  })

  it("keeps an OSM layer whose payload is intact as an OSM layer with its query", () => {
    const osmData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
    const result = makeLoadResult([
      { id: "osm-1", name: "Bridges", visible: true, kind: "osm", osmData, sourceQuery: "bridge in Kyiv" },
    ])

    const state = applyGeoPackageResult(result, null)

    expect(layerById(state.layers, "osm-1")).toEqual({
      id: "osm-1",
      name: "Bridges",
      visible: true,
      kind: "osm",
      osmData,
      sourceQuery: "bridge in Kyiv",
    })
  })
})
