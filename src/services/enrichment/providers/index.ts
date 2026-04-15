import { OpenAIModelAdapter } from "./openai.adapter"
import { OverpassAdapter } from "./overpass.adapter"
import { TavilyAdapter } from "./tavily.adapter"
import type { AiModelAdapter, RetrievalAdapter } from "./provider.types"
import { getAiProviderKeys } from "../settings.service"

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
      new OverpassAdapter(),
    ],
  }
}

