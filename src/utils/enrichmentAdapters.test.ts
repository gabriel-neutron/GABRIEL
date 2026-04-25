import { describe, expect, it } from "vitest"
import { toEnrichmentFeature, toEnrichmentContext } from "./enrichmentAdapters"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"

function makeEntity(overrides: Partial<MapEntity> = {}): MapEntity {
  return {
    id: "e1",
    name: "1st Army",
    layerId: "layer1",
    parentId: null,
    echelon: "army",
    natoSymbolCode: "10031000000000000000",
    affiliation: "Friend",
    domain: "Ground",
    notes: null,
    sources: null,
    militaryUnitId: null,
    osmRelationId: null,
    ...overrides,
  }
}

function makePoint(entityId: string, lat: number, lng: number): DrawnGeometry {
  return { id: "g1", layerId: "l1", entityId, type: "point", lat, lng }
}

describe("toEnrichmentFeature", () => {
  it("returns correct coordinates for a matching point geometry", () => {
    const entity = makeEntity()
    const geometries: DrawnGeometry[] = [makePoint("e1", 51.5, 30.2)]
    const feature = toEnrichmentFeature(entity, geometries)
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [30.2, 51.5] })
  })

  it("returns [0, 0] when no geometry matches the entity", () => {
    const entity = makeEntity()
    const feature = toEnrichmentFeature(entity, [])
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [0, 0] })
  })

  it("returns [0, 0] when the only point belongs to a different entity", () => {
    const entity = makeEntity({ id: "e1" })
    const geometries: DrawnGeometry[] = [makePoint("e2", 51.5, 30.2)]
    const feature = toEnrichmentFeature(entity, geometries)
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [0, 0] })
  })

  it("sets properties correctly including null defaults", () => {
    const entity = makeEntity({ echelon: undefined, natoSymbolCode: null })
    const feature = toEnrichmentFeature(entity, [])
    expect(feature.properties).toMatchObject({
      id: "e1",
      name: "1st Army",
      echelon: null,
      natoSymbolCode: null,
      country: "RU",
      status: "active",
    })
  })

  it("sets id and type at the feature level", () => {
    const entity = makeEntity()
    const feature = toEnrichmentFeature(entity, [])
    expect(feature.type).toBe("Feature")
    expect(feature.id).toBe("e1")
  })
})

describe("toEnrichmentContext", () => {
  const root = makeEntity({ id: "root", parentId: null, name: "Root HQ", echelon: "corps" })
  const child1 = makeEntity({ id: "c1", parentId: "root", name: "1st Div", echelon: "division" })
  const child2 = makeEntity({ id: "c2", parentId: "root", name: "2nd Div", echelon: "division" })
  const leaf = makeEntity({ id: "leaf", parentId: "c1", name: "1st Bde", echelon: "brigade" })

  it("returns parent shape when entity has a parent", () => {
    const ctx = toEnrichmentContext(child1, [root, child1, child2, leaf])
    expect(ctx.parent).toEqual({ id: "root", name: "Root HQ", echelon: "corps", hq_location: undefined })
  })

  it("returns null parent for a root entity", () => {
    const ctx = toEnrichmentContext(root, [root, child1, child2])
    expect(ctx.parent).toBeNull()
  })

  it("returns children array correctly", () => {
    const ctx = toEnrichmentContext(root, [root, child1, child2, leaf])
    expect(ctx.children).toHaveLength(2)
    expect(ctx.children).toContainEqual({ id: "c1", name: "1st Div", echelon: "division" })
    expect(ctx.children).toContainEqual({ id: "c2", name: "2nd Div", echelon: "division" })
  })

  it("returns empty children array for a leaf entity", () => {
    const ctx = toEnrichmentContext(leaf, [root, child1, child2, leaf])
    expect(ctx.children).toHaveLength(0)
  })

  it("defaults unknown echelon to 'unknown'", () => {
    const noEchelonChild = makeEntity({ id: "cx", parentId: "root", name: "X", echelon: undefined })
    const ctx = toEnrichmentContext(root, [root, noEchelonChild])
    expect(ctx.children[0].echelon).toBe("unknown")
  })
})
