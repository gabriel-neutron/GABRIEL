import { describe, expect, it, vi, beforeEach } from "vitest"
import { buildBfsLayers, runLayeredResearch } from "./layered-research.service"
import { runEnrichment } from "@/modules/enrichment/services/enrichment.service"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"

vi.mock("@/modules/enrichment/services/enrichment.service", () => ({
  runEnrichment: vi.fn(),
}))

const mockedRunEnrichment = vi.mocked(runEnrichment)

function makeEntities(): MapEntity[] {
  return [
    {
      kind: "unit",
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

  it("marks all remaining entities across deeper layers as skipped on abort", async () => {
    // Chain e1 -> e2 -> e3 across three BFS layers. Abort after e1 completes; the
    // top-of-loop check must skip the rest of the current layer AND every deeper layer,
    // not just the current one (review finding #4).
    const chain: MapEntity[] = [
      { kind: "unit", id: "e1", name: "e1", layerId: "l", parentId: null, isExactPosition: false },
      { kind: "unit", id: "e2", name: "e2", layerId: "l", parentId: "e1", isExactPosition: false },
      { kind: "unit", id: "e3", name: "e3", layerId: "l", parentId: "e2", isExactPosition: false },
    ]
    mockedRunEnrichment.mockResolvedValue({
      response: {
        status: "success",
        featureId: "e1",
        depthUsed: 1,
        proposals: [],
        unresolvedFields: [],
        unresolvedReasons: {},
        notes: "",
        queryTrace: [],
        processingTimeMs: 1,
      },
      usage: { providerCalls: {}, estimatedInputTokens: 0, estimatedOutputTokens: 0 },
    })

    const controller = new AbortController()
    const result = await runLayeredResearch(chain, geometries, {
      delayBetweenEntitiesMs: 0,
      signal: controller.signal,
      onEntityComplete: () => controller.abort(),
    })

    expect(result.skippedEntityIds).toEqual(["e2", "e3"])
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
        unresolvedReasons: {},
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

describe("buildBfsLayers", () => {
  function entity(id: string, parentId: string | null): MapEntity {
    return { kind: "unit", id, name: id, layerId: "layer-1", parentId }
  }

  it("treats an orphan (parentId set but absent) as a root, so it is still enriched", () => {
    const layers = buildBfsLayers([entity("orphan", "missing-parent"), entity("child", "orphan")])
    expect(layers[0].map((e) => e.id)).toEqual(["orphan"])
    expect(layers[1].map((e) => e.id)).toEqual(["child"])
  })

  it("still processes an all-cyclic entity set instead of returning no layers", () => {
    const layers = buildBfsLayers([entity("a", "b"), entity("b", "a")])
    expect(layers.flat().map((e) => e.id).sort()).toEqual(["a", "b"])
  })
})
