import type {
  EnrichmentOutputSchema,
  EnrichmentProposal,
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentSource,
  SourceDomainType,
} from "@/types/enrichment.types"
import { ENRICHMENT_DOMAIN_TYPES } from "@/types/enrichment.types"
import { ENRICHMENT_MAX_DEPTH_HARD_LIMIT } from "./schema.fixtures"

const SOURCE_BLOCKLIST = new Set([
  "example-tabloid.invalid",
  "fake-news.invalid",
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isValidAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function getDomainTypeFromUrl(url: string): SourceDomainType {
  let hostname = ""
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return "web"
  }

  if (hostname.endsWith("wikipedia.org")) return "wikipedia"
  if (hostname.endsWith("mil.ru") || hostname.endsWith(".gov") || hostname.endsWith(".mil")) return "official"
  if (
    hostname.endsWith("bellingcat.com") ||
    hostname.endsWith("oryxspioenkop.com") ||
    hostname.endsWith("uawardata.com")
  ) {
    return "osint"
  }
  if (hostname.endsWith("vk.com") || hostname.includes("telegram")) return "social"
  if (hostname.includes("reddit.com") || hostname.includes("forum")) return "forum"
  if (
    hostname.endsWith("bbc.com") ||
    hostname.endsWith("rferl.org") ||
    hostname.endsWith("meduza.io")
  ) {
    return "news"
  }
  return "web"
}

export function getAuthorityWeight(domainType: SourceDomainType): number {
  switch (domainType) {
    case "wikipedia":
      return 0.95
    case "official":
      return 0.95
    case "osint":
      return 0.8
    case "news":
      return 0.7
    case "social":
      return 0.55
    case "forum":
      return 0.45
    default:
      return 0.4
  }
}

export function validateOutputSchema(schema: EnrichmentOutputSchema): string[] {
  const errors: string[] = []
  if (!isObject(schema)) {
    return ["outputSchema must be an object"]
  }
  if (schema.type !== "object") {
    errors.push("outputSchema.type must be \"object\"")
  }
  if (schema.additionalProperties !== false) {
    errors.push("outputSchema.additionalProperties must be false")
  }
  if (!isObject(schema.properties) || Object.keys(schema.properties).length === 0) {
    errors.push("outputSchema.properties must contain at least one field")
  }
  return errors
}

export function validateEnrichmentRequest(request: EnrichmentRequest): string[] {
  const errors: string[] = []
  const promptLength = request.prompt.trim().length
  if (promptLength < 10 || promptLength > 2000) {
    errors.push("prompt length must be between 10 and 2000 characters")
  }

  if (request.feature.type !== "Feature") {
    errors.push("feature.type must equal Feature")
  }

  const name = request.feature.properties?.name
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push("feature.properties.name is required")
  }

  if (request.maxDepth < 1 || request.maxDepth > ENRICHMENT_MAX_DEPTH_HARD_LIMIT) {
    errors.push(`maxDepth must be in range [1, ${ENRICHMENT_MAX_DEPTH_HARD_LIMIT}]`)
  }

  if (request.context.parent !== null && !isObject(request.context.parent)) {
    errors.push("context.parent must be an object or null")
  }
  if (!Array.isArray(request.context.children)) {
    errors.push("context.children must be an array")
  }

  errors.push(...validateOutputSchema(request.outputSchema))
  return errors
}

export function validateSource(source: EnrichmentSource): string[] {
  const errors: string[] = []

  if (!isValidAbsoluteUrl(source.url)) {
    errors.push("source.url must be an absolute URL")
  }

  if (source.snippet.trim().length < 20) {
    errors.push("source.snippet must be at least 20 characters")
  }

  if (source.title.trim().length === 0) {
    errors.push("source.title is required")
  }

  if (!ENRICHMENT_DOMAIN_TYPES.includes(source.domainType)) {
    errors.push("source.domainType is invalid")
  }

  if (isValidAbsoluteUrl(source.url)) {
    const hostname = new URL(source.url).hostname.toLowerCase()
    if (SOURCE_BLOCKLIST.has(hostname)) {
      errors.push("source domain is blocklisted")
    }
  }

  return errors
}

export function validateProposal(proposal: EnrichmentProposal): string[] {
  const errors: string[] = []
  if (proposal.field.trim().length === 0) errors.push("proposal.field is required")
  if (proposal.reasoning.trim().length === 0) errors.push("proposal.reasoning is required")
  if (!Array.isArray(proposal.sources) || proposal.sources.length === 0) {
    errors.push("proposal must contain at least one source")
    return errors
  }
  for (const source of proposal.sources) {
    errors.push(...validateSource(source).map((err) => `${proposal.field}: ${err}`))
  }
  return errors
}

export function validateEnrichmentResponse(response: EnrichmentResponse): string[] {
  const errors: string[] = []
  if (!["success", "partial", "failed"].includes(response.status)) {
    errors.push("status must be success, partial, or failed")
  }
  if (response.featureId.trim().length === 0) errors.push("featureId is required")
  if (!Array.isArray(response.proposals)) errors.push("proposals must be an array")
  if (!Array.isArray(response.unresolvedFields)) errors.push("unresolvedFields must be an array")
  if (!Array.isArray(response.queryTrace)) errors.push("queryTrace must be an array")
  if (response.processingTimeMs < 0) errors.push("processingTimeMs must be >= 0")
  for (const proposal of response.proposals) {
    errors.push(...validateProposal(proposal))
  }
  return errors
}

