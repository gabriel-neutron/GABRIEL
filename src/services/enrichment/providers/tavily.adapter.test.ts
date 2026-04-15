import { afterEach, describe, expect, it, vi } from "vitest"
import { TavilyAdapter } from "./tavily.adapter"

describe("TavilyAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("maps tavily results into provider search results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://example.com/source",
            title: "Example Source",
            content: "Snippet content long enough for filtering behavior.",
          },
        ],
      }),
    } as Response)

    const adapter = new TavilyAdapter("tavily-key")
    const results = await adapter.search("unit commander")

    expect(results).toEqual([
      {
        url: "https://example.com/source",
        title: "Example Source",
        snippet: "Snippet content long enough for filtering behavior.",
      },
    ])
  })

  it("throws when API key is missing", async () => {
    const adapter = new TavilyAdapter(null)
    await expect(adapter.search("unit commander")).rejects.toThrow("Tavily API key is missing")
  })
})
