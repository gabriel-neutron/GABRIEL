import type {
  EnrichmentError,
  EnrichmentOutputSchema,
  EnrichmentProposal,
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentSource,
  EnrichmentUsage,
  ProviderSearchResult,
  RetrievalChunk,
} from "@/types/enrichment.types"
import { createDefaultProviderBundle, type ProviderBundle } from "./providers"
import { getAuthorityWeight, getDomainTypeFromUrl, validateEnrichmentRequest, validateEnrichmentResponse, validateSource } from "./validators"
import {
  ENRICHMENT_MAX_DEPTH_HARD_LIMIT,
  ENRICHMENT_MAX_ELAPSED_MS,
  ENRICHMENT_MAX_ESTIMATED_TOKENS,
} from "./schema.fixtures"

type ServiceProgress = {
  depthUsed: number
  queryTrace: string[]
}

export type RunEnrichmentOptions = {
  providers?: ProviderBundle
  onProgress?: (progress: ServiceProgress) => void
  signal?: AbortSignal
}

export type RunEnrichmentResult = {
  response: EnrichmentResponse
  usage: EnrichmentUsage
}

const CONFIDENCE_THRESHOLD = 0.5
const REQUEST_TIMEOUT_MS = 8000
const ALLOWED_ENRICHMENT_FIELDS = new Set(["notes", "sources", "militaryUnitId", "osmRelationId"])

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4)
}

function createError(
  code: EnrichmentError["code"],
  message: string,
  details?: string,
): EnrichmentError {
  return { code, message, details }
}

function withTimeout(signalMs: number, externalSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(signalMs)
  if (!externalSignal) return timeoutSignal
  return AbortSignal.any([timeoutSignal, externalSignal])
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError")
  }
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const query of queries) {
    const normalized = query.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(query.trim())
  }
  return output
}

function dedupeChunks(chunks: RetrievalChunk[]): RetrievalChunk[] {
  const seen = new Set<string>()
  const output: RetrievalChunk[] = []
  for (const chunk of chunks) {
    if (seen.has(chunk.url)) continue
    seen.add(chunk.url)
    output.push(chunk)
  }
  return output
}

function getSchemaFields(schema: EnrichmentOutputSchema): string[] {
  return Object.keys(schema.properties)
}

function getAllowedSchemaFields(schema: EnrichmentOutputSchema): string[] {
  return getSchemaFields(schema).filter((field) => ALLOWED_ENRICHMENT_FIELDS.has(field))
}

function sanitizeSynthesisObject(
  synthesisObject: Record<string, unknown>,
  allowedFields: string[],
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in synthesisObject) {
      sanitized[field] = synthesisObject[field]
    }
  }
  return sanitized
}

function normalizeProviderResult(query: string, result: ProviderSearchResult): RetrievalChunk {
  const domainType = getDomainTypeFromUrl(result.url)
  return {
    query,
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    domainType,
    authorityWeight: getAuthorityWeight(domainType),
  }
}

function scoreChunkForField(chunk: RetrievalChunk, field: string): number {
  const normalizedField = field.toLowerCase().replaceAll("_", " ")
  const text = `${chunk.title} ${chunk.snippet} ${chunk.query}`.toLowerCase()
  const tokens = normalizedField.split(" ").filter(Boolean)
  if (tokens.length === 0) return 0
  let matches = 0
  for (const token of tokens) {
    if (text.includes(token)) matches += 1
  }
  return matches / tokens.length
}

function computeConfidence(chunks: RetrievalChunk[], fields: string[]): { confidence: number; coveredFields: string[] } {
  if (fields.length === 0 || chunks.length === 0) {
    return { confidence: 0, coveredFields: [] }
  }
  const coveredFields = fields.filter((field) => chunks.some((chunk) => scoreChunkForField(chunk, field) > 0))
  const coverage = coveredFields.length / fields.length
  const authority = chunks.reduce((sum, chunk) => sum + chunk.authorityWeight, 0) / chunks.length
  const confidence = 0.6 * coverage + 0.4 * authority
  return { confidence, coveredFields }
}

async function retrieveParallel(
  queries: string[],
  providers: ProviderBundle["retrieval"],
  usage: EnrichmentUsage,
  signal?: AbortSignal,
): Promise<{ chunks: RetrievalChunk[]; notes: string[] }> {
  const notes: string[] = []
  const tasks = providers.flatMap((provider) =>
    queries.map(async (query) => {
      throwIfAborted(signal)
      usage.providerCalls[provider.name] = (usage.providerCalls[provider.name] ?? 0) + 1
      try {
        const requestSignal = withTimeout(REQUEST_TIMEOUT_MS, signal)
        const results = await provider.search(query, requestSignal)
        return results.map((result) => normalizeProviderResult(query, result))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error
        const message = error instanceof Error ? error.message : "unknown provider failure"
        notes.push(`${provider.name}:${query}: ${message}`)
        return []
      }
    }),
  )
  const nested = await Promise.all(tasks)
  const chunks = dedupeChunks(nested.flat())
  return { chunks, notes }
}

function fieldSourcesFromChunks(field: string, chunks: RetrievalChunk[]): EnrichmentSource[] {
  const matching = chunks.filter((chunk) => scoreChunkForField(chunk, field) > 0)
  const mapped = matching.map((chunk) => ({
    url: chunk.url,
    title: chunk.title,
    snippet: chunk.snippet,
    domainType: chunk.domainType,
  }))
  return mapped.filter((source) => validateSource(source).length === 0)
}

async function synthesizeWithSingleModel(
  request: EnrichmentRequest,
  fields: string[],
  chunks: RetrievalChunk[],
  providers: ProviderBundle,
  usage: EnrichmentUsage,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const synthesisInput = {
    feature: request.feature,
    context: request.context,
    prompt: request.prompt,
    outputSchemaFields: fields,
    chunks: chunks.map((chunk) => ({
      fieldHints: fields.filter((field) => scoreChunkForField(chunk, field) > 0),
      url: chunk.url,
      title: chunk.title,
      snippet: chunk.snippet,
    })),
  }

  const serialized = JSON.stringify(synthesisInput)
  usage.estimatedInputTokens += estimateTokens(serialized)

  try {
    throwIfAborted(signal)
    usage.providerCalls.openai_synthesis = (usage.providerCalls.openai_synthesis ?? 0) + 1
    const result = await providers.model.synthesize(synthesisInput, signal)
    usage.estimatedOutputTokens += estimateTokens(JSON.stringify(result))
    return result
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown"
    throw createError("SYNTHESIS_INVALID", "Synthesis failed with the configured model", details)
  }
}

function buildResponse(
  request: EnrichmentRequest,
  fields: string[],
  depthUsed: number,
  queryTrace: string[],
  chunks: RetrievalChunk[],
  synthesisObject: Record<string, unknown>,
  notes: string[],
  startedAtMs: number,
): EnrichmentResponse {
  const proposals: EnrichmentProposal[] = []
  const unresolvedFields: string[] = []

  for (const field of fields) {
    const proposedValue = synthesisObject[field] ?? null
    const sources = fieldSourcesFromChunks(field, chunks)
    if (
      proposedValue === null ||
      proposedValue === "" ||
      (Array.isArray(proposedValue) && proposedValue.length === 0) ||
      sources.length === 0
    ) {
      unresolvedFields.push(field)
      continue
    }
    proposals.push({
      field,
      currentValue: request.feature.properties?.[field] ?? null,
      proposedValue,
      sources,
      reasoning: `Evidence-backed proposal for ${field} from ${sources.length} source(s).`,
    })
  }

  const status: EnrichmentResponse["status"] =
    proposals.length === 0 ? "failed" : unresolvedFields.length > 0 ? "partial" : "success"

  return {
    status,
    featureId: String(request.feature.id ?? request.feature.properties?.id ?? "unknown-feature"),
    depthUsed,
    proposals,
    unresolvedFields,
    notes: notes.join(" | "),
    queryTrace,
    processingTimeMs: Date.now() - startedAtMs,
  }
}

export async function runEnrichment(
  request: EnrichmentRequest,
  options: RunEnrichmentOptions = {},
): Promise<RunEnrichmentResult> {
  throwIfAborted(options.signal)
  const validationErrors = validateEnrichmentRequest(request)
  if (validationErrors.length > 0) {
    throw createError("INVALID_INPUT", "Invalid enrichment request", validationErrors.join("; "))
  }

  const providers = options.providers ?? createDefaultProviderBundle()
  const usage: EnrichmentUsage = {
    providerCalls: {},
    estimatedInputTokens: estimateTokens(request.prompt),
    estimatedOutputTokens: 0,
  }

  const startedAtMs = Date.now()
  const fields = getAllowedSchemaFields(request.outputSchema)
  if (fields.length === 0) {
    throw createError(
      "INVALID_INPUT",
      "Invalid enrichment request",
      "outputSchema does not contain supported enrichment fields",
    )
  }
  const hopBudget = Math.min(request.maxDepth, ENRICHMENT_MAX_DEPTH_HARD_LIMIT)
  let depthUsed = 0
  let queryTrace: string[] = []
  let allChunks: RetrievalChunk[] = []
  const notes: string[] = []
  let unresolvedFields = [...fields]
  let stopReason = "max-depth"

  for (let hop = 0; hop < hopBudget; hop += 1) {
    throwIfAborted(options.signal)
    const elapsedMs = Date.now() - startedAtMs
    if (elapsedMs >= ENRICHMENT_MAX_ELAPSED_MS) {
      stopReason = "time-budget"
      notes.push(`Stopped early: time budget reached (${elapsedMs}ms).`)
      break
    }
    const estimatedTokens = usage.estimatedInputTokens + usage.estimatedOutputTokens
    if (estimatedTokens >= ENRICHMENT_MAX_ESTIMATED_TOKENS) {
      stopReason = "token-budget"
      notes.push(`Stopped early: token budget reached (${estimatedTokens} est.).`)
      break
    }

    depthUsed = hop + 1
    usage.providerCalls.openai_query_generation =
      (usage.providerCalls.openai_query_generation ?? 0) + 1
    const generated = await providers.model.generateQueries(
      {
        feature: request.feature,
        context: request.context,
        prompt: request.prompt,
        unresolvedFields,
      },
      options.signal,
    )
    const queries = dedupeQueries(generated).slice(0, 6)
    queryTrace = [...queryTrace, ...queries]
    usage.estimatedInputTokens += estimateTokens(JSON.stringify(queries))
    options.onProgress?.({ depthUsed, queryTrace })

    const retrieval = await retrieveParallel(queries, providers.retrieval, usage, options.signal)
    notes.push(...retrieval.notes)
    const merged = dedupeChunks([...allChunks, ...retrieval.chunks])
    allChunks = merged

    const { confidence, coveredFields } = computeConfidence(allChunks, fields)
    unresolvedFields = fields.filter((field) => !coveredFields.includes(field))
    if (confidence >= CONFIDENCE_THRESHOLD || hop === hopBudget - 1) {
      if (confidence >= CONFIDENCE_THRESHOLD) {
        stopReason = "confidence-threshold"
      } else {
        stopReason = "max-depth"
      }
      break
    }
  }

  if (allChunks.length === 0) {
    const response: EnrichmentResponse = {
      status: "failed",
      featureId: String(request.feature.id ?? request.feature.properties?.id ?? "unknown-feature"),
      depthUsed,
      proposals: [],
      unresolvedFields: fields,
      notes:
        notes.length > 0
          ? `stop=${stopReason} | ${notes.join(" | ")}`
          : `stop=${stopReason} | No retrieval results from configured providers.`,
      queryTrace,
      processingTimeMs: Date.now() - startedAtMs,
    }
    return { response, usage }
  }

  const synthesisObject = await synthesizeWithSingleModel(
    request,
    fields,
    allChunks,
    providers,
    usage,
    options.signal,
  )
  const response = buildResponse(
    request,
    fields,
    depthUsed,
    queryTrace,
    allChunks,
    sanitizeSynthesisObject(synthesisObject, fields),
    notes,
    startedAtMs,
  )
  response.notes = response.notes === "" ? `stop=${stopReason}` : `stop=${stopReason} | ${response.notes}`
  const responseErrors = validateEnrichmentResponse(response)
  if (responseErrors.length > 0) {
    throw createError("VALIDATION_ERROR", "Response contract validation failed", responseErrors.join("; "))
  }

  return { response, usage }
}

