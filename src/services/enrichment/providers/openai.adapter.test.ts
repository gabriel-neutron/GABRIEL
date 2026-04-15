import { describe, expect, it } from "vitest"
import { OpenAIModelAdapter } from "./openai.adapter"

const QUERY_INPUT = {
  feature: {
    type: "Feature" as const,
    id: "feature-1",
    geometry: { type: "Point" as const, coordinates: [0, 0] as [number, number] },
    properties: { name: "Unit" },
  },
  context: { parent: null, children: [] },
  prompt: "Find HQ and garrison details",
  unresolvedFields: ["notes", "sources"],
}

const SYNTHESIS_INPUT = {
  feature: QUERY_INPUT.feature,
  context: QUERY_INPUT.context,
  prompt: QUERY_INPUT.prompt,
  outputSchemaFields: ["notes", "sources"],
  chunks: [],
}

describe("OpenAIModelAdapter", () => {
  it("throws when API key is missing for query generation", async () => {
    const adapter = new OpenAIModelAdapter(null)
    await expect(adapter.generateQueries(QUERY_INPUT)).rejects.toThrow("OpenAI API key is missing")
  })

  it("throws when API key is missing for synthesis", async () => {
    const adapter = new OpenAIModelAdapter(null)
    await expect(adapter.synthesize(SYNTHESIS_INPUT)).rejects.toThrow("OpenAI API key is missing")
  })
})
