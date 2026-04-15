import { describe, expect, it } from "vitest"
import { DEFAULT_ENRICHMENT_OUTPUT_SCHEMA } from "./schema.fixtures"
import {
  getAuthorityWeight,
  getDomainTypeFromUrl,
  validateEnrichmentRequest,
  validateSource,
} from "./validators"
import type { EnrichmentRequest } from "@/types/enrichment.types"

function makeRequest(): EnrichmentRequest {
  return {
    prompt: "Find verified HQ and garrison details from reliable sources.",
    feature: {
      type: "Feature",
      id: "feature-1",
      geometry: { type: "Point", coordinates: [134.7, 48.5] },
      properties: { name: "64th Separate Motor Rifle Brigade" },
    },
    context: {
      parent: null,
      children: [],
    },
    outputSchema: DEFAULT_ENRICHMENT_OUTPUT_SCHEMA,
    maxDepth: 2,
  }
}

describe("validateEnrichmentRequest", () => {
  it("accepts a valid request", () => {
    const errors = validateEnrichmentRequest(makeRequest())
    expect(errors).toEqual([])
  })

  it("uses only supported output schema fields by default", () => {
    expect(Object.keys(DEFAULT_ENRICHMENT_OUTPUT_SCHEMA.properties)).toEqual([
      "notes",
      "sources",
      "militaryUnitId",
      "osmRelationId",
    ])
  })

  it("rejects invalid maxDepth", () => {
    const request = makeRequest()
    request.maxDepth = 4
    const errors = validateEnrichmentRequest(request)
    expect(errors.some((error) => error.includes("maxDepth"))).toBe(true)
  })
})

describe("validateSource", () => {
  it("rejects short snippet and invalid url", () => {
    const errors = validateSource({
      url: "invalid-url",
      title: "source",
      snippet: "too short",
      domainType: "web",
    })
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe("domain classification", () => {
  it("classifies wikipedia and authority weights deterministically", () => {
    expect(getDomainTypeFromUrl("https://en.wikipedia.org/wiki/Test")).toBe("wikipedia")
    expect(getAuthorityWeight("wikipedia")).toBeGreaterThan(getAuthorityWeight("web"))
  })
})

