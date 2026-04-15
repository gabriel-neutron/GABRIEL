import type { Feature, GeoJsonProperties, Geometry } from "geojson"

export type SourceDomainType =
  | "wikipedia"
  | "official"
  | "osint"
  | "social"
  | "forum"
  | "news"
  | "web"

export type EnrichmentRunStatus = "idle" | "running" | "success" | "partial" | "failed"

export type EnrichmentFeature = Feature<Geometry, GeoJsonProperties>

export type EnrichmentContextParent = {
  id: string
  name: string
  echelon: string
  hq_location?: string
} | null

export type EnrichmentContextChild = {
  id: string
  name: string
  echelon: string
}

export type EnrichmentContext = {
  parent: EnrichmentContextParent
  children: EnrichmentContextChild[]
}

export type OutputSchemaProperty = {
  type: string | string[]
  items?: { type: string; format?: string }
}

export type EnrichmentOutputSchema = {
  type: "object"
  properties: Record<string, OutputSchemaProperty>
  required: string[]
  additionalProperties: false
}

export type EnrichmentRequest = {
  prompt: string
  feature: EnrichmentFeature
  context: EnrichmentContext
  outputSchema: EnrichmentOutputSchema
  maxDepth: number
}

export type EnrichmentSource = {
  url: string
  title: string
  snippet: string
  domainType: SourceDomainType
}

export type EnrichmentProposal = {
  field: string
  currentValue: unknown
  proposedValue: unknown
  sources: EnrichmentSource[]
  reasoning: string
}

export type EnrichmentResponse = {
  status: Exclude<EnrichmentRunStatus, "idle" | "running">
  featureId: string
  depthUsed: number
  proposals: EnrichmentProposal[]
  unresolvedFields: string[]
  notes: string
  queryTrace: string[]
  processingTimeMs: number
}

export type EnrichmentError = {
  code:
    | "INVALID_INPUT"
    | "PROVIDER_ERROR"
    | "SYNTHESIS_INVALID"
    | "VALIDATION_ERROR"
    | "TIMEOUT"
    | "UNKNOWN"
  message: string
  details?: string
}

export type ProviderSearchResult = {
  url: string
  title: string
  snippet: string
}

export type RetrievalChunk = {
  query: string
  url: string
  title: string
  snippet: string
  domainType: SourceDomainType
  authorityWeight: number
}

export type RetrievalDiagnostics = {
  provider: string
  query: string
  ok: boolean
  error?: string
}

export type EnrichmentUsage = {
  providerCalls: Record<string, number>
  estimatedInputTokens: number
  estimatedOutputTokens: number
}

export const ENRICHMENT_DOMAIN_TYPES: SourceDomainType[] = [
  "wikipedia",
  "official",
  "osint",
  "social",
  "forum",
  "news",
  "web",
]
