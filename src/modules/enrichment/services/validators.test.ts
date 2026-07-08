import { describe, expect, it } from "vitest"
import { DEFAULT_ENRICHMENT_OUTPUT_SCHEMA } from "./schema.fixtures"
import {
  getAuthorityWeight,
  getDomainTypeFromUrl,
  MIN_SOURCES_PER_PROPOSAL,
  validateEnrichmentRequest,
  validateEnrichmentResponse,
  validateProposal,
  validateSource,
} from "./validators"
import type { EnrichmentProposal, EnrichmentResponse } from "@/types/enrichment.types"
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

  it("rejects non-parseable publishedAt", () => {
    const errors = validateSource({
      url: "https://example.com/article",
      title: "Example",
      snippet: "This snippet is long enough for validation rules.",
      domainType: "web",
      publishedAt: "not-a-date",
    })
    expect(errors.some((e) => e.includes("publishedAt"))).toBe(true)
  })
})

const validSource = {
  url: "https://example.com/evidence",
  title: "Evidence",
  snippet: "This snippet is long enough for validation rules.",
  domainType: "web" as const,
}

function baseResponse(overrides: Partial<EnrichmentResponse>): EnrichmentResponse {
  return {
    status: "success",
    featureId: "f1",
    depthUsed: 1,
    proposals: [],
    unresolvedFields: [],
    unresolvedReasons: {},
    notes: "",
    queryTrace: [],
    processingTimeMs: 1,
    ...overrides,
  }
}

describe("validateProposal", () => {
  it(`requires at least ${MIN_SOURCES_PER_PROPOSAL} source(s)`, () => {
    const proposal: EnrichmentProposal = {
      field: "notes",
      currentValue: null,
      proposedValue: "Proposed text here.",
      reasoning: "Backed by retrieval.",
      citations: [],
    }
    expect(validateProposal(proposal).some((e) => e.includes("at least"))).toBe(true)
  })
})

describe("validateEnrichmentResponse", () => {
  it("accepts response with unresolved reasons per field", () => {
    const errors = validateEnrichmentResponse(
      baseResponse({
        status: "partial",
        unresolvedFields: ["militaryUnitId"],
        unresolvedReasons: { militaryUnitId: "stale" },
      }),
    )
    expect(errors).toEqual([])
  })

  it("rejects conflict reason without conflict candidates", () => {
    const errors = validateEnrichmentResponse(
      baseResponse({
        status: "partial",
        unresolvedFields: ["militaryUnitId"],
        unresolvedReasons: { militaryUnitId: "conflict" },
      }),
    )
    expect(errors.some((e) => e.includes("conflicts[militaryUnitId]"))).toBe(true)
  })

  it("accepts conflict reason with valid candidate sources", () => {
    const longSnippet = "Candidate evidence text is long enough for validation rules."
    const errors = validateEnrichmentResponse(
      baseResponse({
        status: "partial",
        unresolvedFields: ["militaryUnitId"],
        unresolvedReasons: { militaryUnitId: "conflict" },
        conflicts: {
          militaryUnitId: [
            { value: "A", sources: [{ ...validSource, snippet: longSnippet }] },
            { value: "B", sources: [{ ...validSource, url: "https://other.example/doc", snippet: longSnippet }] },
          ],
        },
      }),
    )
    expect(errors).toEqual([])
  })
})

describe("domain classification", () => {
  it("classifies wikipedia and authority weights deterministically", () => {
    expect(getDomainTypeFromUrl("https://en.wikipedia.org/wiki/Test")).toBe("wikipedia")
    expect(getAuthorityWeight("wikipedia")).toBeGreaterThan(getAuthorityWeight("web"))
  })

  it("ranks wikipedia below osint and above news, not tied with official", () => {
    expect(getAuthorityWeight("osint")).toBeGreaterThan(getAuthorityWeight("wikipedia"))
    expect(getAuthorityWeight("wikipedia")).toBeGreaterThan(getAuthorityWeight("news"))
    expect(getAuthorityWeight("wikipedia")).toBeLessThan(getAuthorityWeight("official"))
  })
})

