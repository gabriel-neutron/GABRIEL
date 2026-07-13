import { describe, expect, it } from "vitest"
import { buildEnrichmentRequest } from "./request-builder"
import { ENRICHMENT_MAX_DEPTH_DEFAULT } from "./enrichment.constants"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { GENERAL_CITATION_FIELD, type Claim } from "@/core/provenance/claim"

function makeEntity(overrides: Partial<MapEntity> = {}): MapEntity {
  return {
    kind: "unit",
    id: "e1",
    name: "1st Army",
    layerId: "layer1",
    parentId: null,
    echelon: "army",
    natoSymbolCode: "10031000000000000000",
    affiliation: "Friend",
    domain: "Ground",
    notes: null,
    militaryUnitId: null,
    osmRelationId: null,
    ...overrides,
  }
}

function makeClaim(entityId: string): Claim {
  return {
    id: "c1",
    entityId,
    field: GENERAL_CITATION_FIELD,
    value: null,
    sourceId: "s1",
    credibility: null,
    timestamp: null,
  }
}

const geometries: DrawnGeometry[] = []

describe("buildEnrichmentRequest", () => {
  it("uses opts.prompt verbatim when provided", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries, {
      prompt: "custom draft prompt unrelated to the default template",
    })
    expect(request.prompt).toBe("custom draft prompt unrelated to the default template")
  })

  it("builds the default prompt when opts.prompt is omitted", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries)
    expect(request.prompt).toContain("Find verified headquarters and garrison information for 1st Army")
  })

  it("includes an 'already known sources' hint when poolHintUrls is provided", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries, {
      poolHintUrls: ["https://example.com/a"],
    })
    expect(request.prompt).toContain("Already known sources")
    expect(request.prompt).toContain("https://example.com/a")
  })

  it("omits the pool-hint line when poolHintUrls is not provided", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries)
    expect(request.prompt).not.toContain("Already known sources")
  })

  it("includes the sources field in outputSchema when there are no existing claims", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries)
    expect(request.outputSchema.properties.sources).toBeDefined()
  })

  it("omits the sources field from outputSchema when the entity already has a citation claim", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries, { claims: [makeClaim(entity.id)] })
    expect(request.outputSchema.properties.sources).toBeUndefined()
  })

  it("always sets maxDepth to the default", () => {
    const entity = makeEntity()
    const request = buildEnrichmentRequest(entity, [entity], geometries, { prompt: "x" })
    expect(request.maxDepth).toBe(ENRICHMENT_MAX_DEPTH_DEFAULT)
  })

  it("builds feature/context matching the entity", () => {
    const entity = makeEntity({ id: "e1", name: "1st Army" })
    const request = buildEnrichmentRequest(entity, [entity], geometries, { prompt: "x" })
    expect(request.feature.id).toBe("e1")
    expect(request.feature.properties?.name).toBe("1st Army")
    expect(request.context.parent).toBeNull()
    expect(request.context.children).toEqual([])
  })
})
