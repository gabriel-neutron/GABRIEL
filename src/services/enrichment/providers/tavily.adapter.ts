import type { ProviderSearchResult } from "@/types/enrichment.types"
import type { RetrievalAdapter } from "./provider.types"

const TAVILY_ENDPOINT = "https://api.tavily.com/search"

export class TavilyAdapter implements RetrievalAdapter {
  name = "tavily"
  private readonly apiKey: string | null

  constructor(apiKey: string | null) {
    this.apiKey = apiKey
  }

  async search(query: string, signal?: AbortSignal): Promise<ProviderSearchResult[]> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is missing")
    }

    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: 3,
        search_depth: "basic",
        include_raw_content: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Tavily search failed (${response.status})`)
    }

    const payload = (await response.json()) as {
      results?: Array<{
        url?: string
        title?: string
        content?: string
      }>
    }

    return (payload.results ?? [])
      .filter((item) => typeof item.url === "string")
      .map((item) => ({
        url: item.url ?? "",
        title: item.title ?? item.url ?? "Untitled source",
        snippet: item.content ?? "",
      }))
  }
}
