import { describe, expect, it, vi } from "vitest"
import { TavilyAdapter } from "./tavily.adapter"

describe("TavilyAdapter", () => {
  it("sends API key in JSON body, not in URL, and errors do not echo the key", async () => {
    const secret = "tvly-secret-ABC-no-leak-in-message"
    const originalFetch = globalThis.fetch
    try {
      let requestUrl = ""
      let requestBody = ""
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(input)
        requestBody = String(init?.body ?? "")
        return new Response(JSON.stringify({ results: [] }), { status: 401 })
      }) as typeof fetch

      const adapter = new TavilyAdapter(secret)
      let message = ""
      try {
        await adapter.search("test query")
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }

      expect(requestUrl).not.toContain(secret)
      expect(requestBody).toContain(secret)
      expect(message).toMatch(/Tavily search failed \(401\)/)
      expect(message).not.toContain(secret)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
