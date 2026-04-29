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

/** Why a field could not be proposed as an auditable value (AI-assigned; see enrichment prompt). */
export type UnresolvedReason = "conflict" | "stale" | "no-evidence" | "other"

export type EnrichmentConflictCandidate = {
  value: unknown
  sources: EnrichmentSource[]
}

export type EnrichmentSource = {
  url: string
  title: string
  snippet: string
  domainType: SourceDomainType
  /** ISO date from retrieval (e.g. Tavily published_date) when available. */
  publishedAt?: string
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
  /** One reason per unresolved field (required when unresolvedFields is non-empty). */
  unresolvedReasons: Record<string, UnresolvedReason>
  /** Present when unresolvedReasons[field] is conflict — competing values with sources. */
  conflicts?: Record<string, EnrichmentConflictCandidate[]>
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
  publishedAt?: string
}

export type RetrievalChunk = {
  query: string
  url: string
  title: string
  snippet: string
  domainType: SourceDomainType
  authorityWeight: number
  publishedAt?: string
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
