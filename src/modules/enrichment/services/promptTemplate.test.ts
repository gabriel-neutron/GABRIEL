import { describe, expect, it } from "vitest"
import { buildCredibilityInstructions, buildCredibilityPayload, CREDIBILITY_PROMPT_VERSION } from "./promptTemplate"

describe("buildCredibilityInstructions", () => {
  it("never mentions reliability — the AI stays blind to the reliability letter (ADR 0009)", () => {
    expect(buildCredibilityInstructions().toLowerCase()).not.toContain("reliab")
  })

  it("explicitly forbids the model from outputting credibility 1", () => {
    expect(buildCredibilityInstructions()).toMatch(/never|cannot|reserved/i)
    expect(buildCredibilityInstructions()).toContain("1")
  })
})

describe("buildCredibilityPayload", () => {
  it("carries every citation side-by-side with an index, no reliability field", () => {
    const payload = buildCredibilityPayload({
      entityName: "1st Guards Tank Army",
      field: "sources",
      value: null,
      citations: [
        { url: "https://a.example", title: "A", snippet: "snippet a" },
        { url: "https://b.example", title: "B", snippet: "snippet b", publishedAt: "2026-01-01" },
      ],
    })
    expect(payload.citations).toEqual([
      { index: 0, url: "https://a.example", title: "A", snippet: "snippet a", publishedAt: null },
      { index: 1, url: "https://b.example", title: "B", snippet: "snippet b", publishedAt: "2026-01-01" },
    ])
    expect(JSON.stringify(payload).toLowerCase()).not.toContain("reliab")
  })
})

describe("CREDIBILITY_PROMPT_VERSION", () => {
  it("is a non-empty version stamp", () => {
    expect(CREDIBILITY_PROMPT_VERSION.length).toBeGreaterThan(0)
  })
})
