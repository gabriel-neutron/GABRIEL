import { OpenAIModelAdapter } from "./openai.adapter"
import { OverpassAdapter } from "./overpass.adapter"
import { TavilyAdapter } from "./tavily.adapter"
import { CachedContentAdapter } from "./cached-content.adapter"
import type { AiModelAdapter, RetrievalAdapter } from "./provider.types"
import { getAiProviderKeys } from "../settings.service"

export { CachedContentAdapter }

function toNullable(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

export type ProviderBundle = {
  model: AiModelAdapter
  retrieval: RetrievalAdapter[]
}

export function createDefaultProviderBundle(): ProviderBundle {
  const keys = getAiProviderKeys()
  return {
    model: new OpenAIModelAdapter(toNullable(keys.openaiApiKey)),
    retrieval: [
      new TavilyAdapter(toNullable(keys.tavilyApiKey)),
    ],
  }
}

/**
 * Provider bundle for the layered research pipeline.
 * Uses gpt-4o for synthesis (better at noisy OSINT) and, when a source cache
 * is provided, prepends a CachedContentAdapter so the synthesizer sees richer
 * cached snippets before Tavily results for the same URLs.
 */
export function createLayeredResearchProviderBundle(
  sourceCache?: Map<string, string>,
): ProviderBundle {
  const keys = getAiProviderKeys()
  const retrieval: RetrievalAdapter[] = []
  if (sourceCache && sourceCache.size > 0) {
    retrieval.push(new CachedContentAdapter(sourceCache))
  }
  retrieval.push(new TavilyAdapter(toNullable(keys.tavilyApiKey)))
  return {
    model: new OpenAIModelAdapter(toNullable(keys.openaiApiKey), "gpt-4o"),
    retrieval,
  }
}

