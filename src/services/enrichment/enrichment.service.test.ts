import { describe, expect, it } from "vitest"
import { runEnrichment } from "./enrichment.service"
import { DEFAULT_ENRICHMENT_OUTPUT_SCHEMA } from "./schema.fixtures"
import type { EnrichmentRequest } from "@/types/enrichment.types"
import type { ProviderBundle } from "./providers"

function makeRequest(): EnrichmentRequest {
  return {
    prompt: "Find headquarters and garrison details for the selected unit with sources.",
    feature: {
      type: "Feature",
      id: "feature-1",
      geometry: { type: "Point", coordinates: [134.7, 48.5] },
      properties: {
        id: "feature-1",
        name: "64th Separate Motor Rifle Brigade",
      },
    },
    context: {
      parent: null,
      children: [],
    },
    outputSchema: DEFAULT_ENRICHMENT_OUTPUT_SCHEMA,
    maxDepth: 2,
  }
}

function makeProviders(): ProviderBundle {
  return {
    model: {
      async generateQueries() {
        return ["64th Separate Motor Rifle Brigade HQ garrison notes 2023"]
      },
      async synthesize() {
        return {
          notes: "HQ reported in Khabarovsk Krai with permanent garrison activity in 2023.",
          sources:
            "https://en.wikipedia.org/wiki/64th_Separate_Motor_Rifle_Brigade\nhttps://example.mil.ru/unit/64th",
          militaryUnitId: "64123",
          osmRelationId: 123456,
        }
      },
    },
    retrieval: [
      {
        name: "mock",
        async search() {
          return [
            {
              url: "https://en.wikipedia.org/wiki/64th_Separate_Motor_Rifle_Brigade",
              title: "Wikipedia",
              snippet:
                "Research notes indicate the brigade HQ and garrison are documented in Khabarovsk Krai in 2023 reporting.",
            },
          ]
        },
      },
    ],
  }
}

describe("runEnrichment", () => {
  it("returns proposals with valid status", async () => {
    const result = await runEnrichment(makeRequest(), { providers: makeProviders() })
    expect(["success", "partial"]).toContain(result.response.status)
    expect(result.response.featureId).toBe("feature-1")
    expect(result.response.proposals.length).toBeGreaterThan(0)
    expect(result.response.notes).toContain("stop=")
  })

  it("rejects invalid request input", async () => {
    const invalid = makeRequest()
    invalid.prompt = "short"
    await expect(runEnrichment(invalid, { providers: makeProviders() })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
  })

  it("stops on token budget guardrail", async () => {
    const request = makeRequest()
    request.maxDepth = 3
    const hugeQuery = "q".repeat(60_000)
    const providers: ProviderBundle = {
      model: {
        async generateQueries() {
          return [hugeQuery]
        },
        async synthesize() {
          return { notes: "HQ location details are still uncertain." }
        },
      },
      retrieval: [
        {
          name: "mock",
          async search() {
            return [
              {
                url: "https://example.com/source",
                title: "Example Source",
                snippet: "HQ details remain uncertain for the selected unit in current reports.",
              },
            ]
          },
        },
      ],
    }

    const result = await runEnrichment(request, { providers })
    expect(result.response.notes).toContain("stop=token-budget")
  })

  it("fails loudly when synthesis provider fails", async () => {
    const providers: ProviderBundle = {
      model: {
        async generateQueries() {
          return ["64th Separate Motor Rifle Brigade HQ garrison 2023"]
        },
        async synthesize() {
          throw new Error("OpenAI API key is missing")
        },
      },
      retrieval: [
        {
          name: "mock",
          async search() {
            return [
              {
                url: "https://example.com/source",
                title: "Example Source",
                snippet: "HQ details remain uncertain for the selected unit in current reports.",
              },
            ]
          },
        },
      ],
    }

    await expect(runEnrichment(makeRequest(), { providers })).rejects.toMatchObject({
      code: "SYNTHESIS_INVALID",
    })
  })

  it("supports request cancellation with abort signal", async () => {
    const providers: ProviderBundle = {
      model: {
        async generateQueries() {
          await new Promise((resolve) => setTimeout(resolve, 25))
          return ["64th Separate Motor Rifle Brigade HQ garrison 2023"]
        },
        async synthesize() {
          return { notes: "HQ evidence found." }
        },
      },
      retrieval: [
        {
          name: "mock",
          async search(_query, signal) {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, 250)
              signal?.addEventListener("abort", () => {
                clearTimeout(timer)
                reject(new DOMException("Aborted", "AbortError"))
              })
            })
            return []
          },
        },
      ],
    }

    const controller = new AbortController()
    const promise = runEnrichment(makeRequest(), {
      providers,
      signal: controller.signal,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({
      name: "AbortError",
    })
  })

  it("drops unsupported synthesized fields from proposals", async () => {
    const providers: ProviderBundle = {
      model: {
        async generateQueries() {
          return ["64th Separate Motor Rifle Brigade HQ garrison 2023"]
        },
        async synthesize() {
          return {
            notes: "HQ and garrison confirmed in Khabarovsk Krai.",
            commander: "Should be ignored",
          }
        },
      },
      retrieval: [
        {
          name: "mock",
          async search() {
            return [
              {
                url: "https://example.com/hq",
                title: "HQ source",
                snippet: "HQ and garrison confirmed in Khabarovsk Krai by open reporting.",
              },
            ]
          },
        },
      ],
    }

    const result = await runEnrichment(makeRequest(), { providers })
    expect(result.response.proposals.some((proposal) => proposal.field === "commander")).toBe(false)
  })
})

