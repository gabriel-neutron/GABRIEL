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

  it("uses synthesis instructions that forbid non-actionable placeholders", async () => {
    const originalFetch = globalThis.fetch
    try {
      const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          input?: Array<{ role?: string; content?: Array<{ text?: string }> }>
        }
        const systemText = body.input?.[0]?.content?.[0]?.text ?? ""
        expect(systemText).toContain("If evidence is missing for a field, set the field to null.")
        expect(systemText).toContain(
          "Never output placeholders such as \"no source\", \"source not found\", \"unknown\", \"n/a\", \"none\", or similar text.",
        )
        return new Response(
          JSON.stringify({
            output_text: "{\"notes\": null, \"sources\": null}",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }) as typeof fetch

      globalThis.fetch = fetchMock
      const adapter = new OpenAIModelAdapter("test-key")
      const output = await adapter.synthesize(SYNTHESIS_INPUT)
      expect(output).toEqual({ notes: null, sources: null })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
