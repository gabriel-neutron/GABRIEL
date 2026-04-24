import type { ProviderSearchResult } from "@/types/enrichment.types"
import type { RetrievalAdapter } from "./provider.types"

/**
 * Synthetic retrieval adapter that serves pre-cached URL → content pairs.
 * Added first in the provider bundle by the layered research orchestrator so
 * that `dedupeChunks` in enrichment.service.ts keeps the richer cached snippet
 * over whatever Tavily would return for the same URL.
 *
 * Returns all cached entries for every query — deduplication inside
 * runEnrichment handles URL-level deduplication across adapters and hops.
 */
export class CachedContentAdapter implements RetrievalAdapter {
  name = "cache"
  private readonly entries: ProviderSearchResult[]

  constructor(sourceCache: Map<string, string>) {
    this.entries = Array.from(sourceCache.entries()).map(([url, content]) => ({
      url,
      title: url,
      snippet: content,
    }))
  }

  async search(_query: string, _signal?: AbortSignal): Promise<ProviderSearchResult[]> {
    return this.entries
  }
}
