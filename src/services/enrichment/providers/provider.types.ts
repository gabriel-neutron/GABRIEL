import type { EnrichmentContext, EnrichmentFeature, ProviderSearchResult } from "@/types/enrichment.types"

export type QueryGenerationInput = {
  feature: EnrichmentFeature
  context: EnrichmentContext
  prompt: string
  unresolvedFields: string[]
}

export type RetrievalAdapter = {
  name: string
  search: (query: string, signal?: AbortSignal) => Promise<ProviderSearchResult[]>
}

export type SynthesisInput = {
  feature: EnrichmentFeature
  context: EnrichmentContext
  prompt: string
  outputSchemaFields: string[]
  chunks: Array<{
    fieldHints: string[]
    url: string
    title: string
    snippet: string
  }>
}

export type SynthesisAdapter = {
  synthesize: (input: SynthesisInput, signal?: AbortSignal) => Promise<Record<string, unknown>>
}

export type AiModelAdapter = {
  generateQueries: (input: QueryGenerationInput, signal?: AbortSignal) => Promise<string[]>
  synthesize: (input: SynthesisInput, signal?: AbortSignal) => Promise<Record<string, unknown>>
}

