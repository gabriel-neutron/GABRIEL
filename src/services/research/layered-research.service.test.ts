import { describe, expect, it, vi, beforeEach } from "vitest"
import { runLayeredResearch } from "./layered-research.service"
import { runEnrichment } from "@/services/enrichment/enrichment.service"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"

vi.mock("@/services/enrichment/enrichment.service", () => ({
  runEnrichment: vi.fn(),
}))

const mockedRunEnrichment = vi.mocked(runEnrichment)

function makeEntities(): MapEntity[] {
  return [
    {
      id: "entity-1",
      name: "Root",
      layerId: "layer-1",
      parentId: null,
      affiliation: "Hostile",
      isExactPosition: false,
    },
  ]
}

const geometries: DrawnGeometry[] = []

describe("runLayeredResearch", () => {
  beforeEach(() => {
    mockedRunEnrichment.mockReset()
    vi.unstubAllGlobals()
  })

  it("tracks enrichment errors as failed instead of skipped", async () => {
    mockedRunEnrichment.mockRejectedValueOnce(new Error("provider unavailable"))

    const result = await runLayeredResearch(makeEntities(), geometries, {
      delayBetweenEntitiesMs: 0,
      maxEntities: 1,
    })

    expect(result.failedEntityIds).toEqual(["entity-1"])
    expect(result.skippedEntityIds).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatchObject({
      entityId: "entity-1",
      source: "enrichment",
    })
    expect(result.stats.entitiesProcessed).toBe(1)
  })

  it("reports overpass endpoint failures as warnings", async () => {
    const entities = makeEntities().map((entity) => ({ ...entity, militaryUnitId: "64123" }))
    mockedRunEnrichment.mockResolvedValueOnce({
      response: {
        status: "success",
        featureId: "entity-1",
        depthUsed: 1,
        proposals: [],
        unresolvedFields: [],
        notes: "",
        queryTrace: [],
        processingTimeMs: 12,
      },
      usage: {
        providerCalls: {},
        estimatedInputTokens: 10,
        estimatedOutputTokens: 5,
      },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }),
    )

    const result = await runLayeredResearch(entities, geometries, {
      delayBetweenEntitiesMs: 0,
      maxEntities: 1,
    })

    expect(result.failedEntityIds).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatchObject({
      entityId: "entity-1",
      source: "overpass",
    })
  })
})
