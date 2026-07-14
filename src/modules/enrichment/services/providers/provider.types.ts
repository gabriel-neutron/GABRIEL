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
    publishedAt?: string
  }>
}

export type AiModelAdapter = {
  generateQueries: (input: QueryGenerationInput, signal?: AbortSignal) => Promise<string[]>
  synthesize: (input: SynthesisInput, signal?: AbortSignal) => Promise<Record<string, unknown>>
  /**
   * ADR 0009: the credibility pass. `instructions`/`payload` are pre-built by
   * `promptTemplate.ts` (reliability deliberately absent) — the adapter's job is only
   * to call the model and validate/coerce the response shape; caps are enforced by the
   * caller (`credibility.service.ts`), never trusted from this raw response.
   * Optional — like `aliases`/`reliabilityMeta` elsewhere, adapters and test fixtures
   * that predate this pass keep working; a caller skips credibility assessment
   * entirely when this is absent rather than crashing on a missing method.
   */
  assessCredibility?: (
    instructions: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{
    credibility: number
    contradicted: boolean
    positivelyContradicted: boolean
    statedAttribution: string | null
    confidence: number
    rationale: string
  }>
}

