import {
  CORE_ENRICHMENT_FIELDS,
} from "@/types/enrichment.types"
import type {
  EnrichmentConflictCandidate,
  EnrichmentError,
  EnrichmentOutputSchema,
  EnrichmentProposal,
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentSource,
  EnrichmentUsage,
  RetrievalChunk,
  UnresolvedReason,
} from "@/types/enrichment.types"
import { createDefaultProviderBundle, type ProviderBundle } from "./providers"
import {
  getAuthorityWeight,
  getDomainTypeFromUrl,
  validateEnrichmentRequest,
  validateEnrichmentResponse,
  validateSource,
} from "./validators"
import {
  ENRICHMENT_MAX_DEPTH_HARD_LIMIT,
  ENRICHMENT_MAX_ELAPSED_MS,
  ENRICHMENT_MAX_ESTIMATED_TOKENS,
} from "./schema.fixtures"

type ServiceProgress = {
  depthUsed: number
  queryTrace: string[]
}
type StopReason = "max-depth" | "time-budget" | "token-budget" | "confidence-threshold"
type BudgetStop = { stopReason: StopReason; note: string } | null
type RetrievalLoopResult = {
  depthUsed: number
  queryTrace: string[]
  allChunks: RetrievalChunk[]
  unresolvedFields: string[]
  notes: string[]
  stopReason: StopReason
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
const ALLOWED_ENRICHMENT_FIELDS = new Set<string>(CORE_ENRICHMENT_FIELDS)

const UNRESOLVED_REASON_VALUES = new Set<UnresolvedReason>(["conflict", "stale", "no-evidence", "other"])

function isUnresolvedReason(value: unknown): value is UnresolvedReason {
  return typeof value === "string" && UNRESOLVED_REASON_VALUES.has(value as UnresolvedReason)
}

function unresolvedReasonsForFields(
  fields: string[],
  aiReasons: Record<string, UnresolvedReason>,
): Record<string, UnresolvedReason> {
  const out: Record<string, UnresolvedReason> = {}
  for (const field of fields) {
    const fromAi = aiReasons[field]
    out[field] = fromAi ?? "no-evidence"
  }
  return out
}

function parseAiUnresolvedReasons(raw: unknown): Record<string, UnresolvedReason> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, UnresolvedReason> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isUnresolvedReason(value)) out[key] = value
  }
  return out
}

function parseConflictSource(raw: Record<string, unknown>): EnrichmentSource | null {
  const url = typeof raw.url === "string" ? raw.url.trim() : ""
  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  const snippet = typeof raw.snippet === "string" ? raw.snippet.trim() : ""
  const domainType = getDomainTypeFromUrl(url)
  const publishedAt =
    typeof raw.publishedAt === "string" && raw.publishedAt.trim().length > 0 ? raw.publishedAt.trim() : undefined
  const source: EnrichmentSource = { url, title, snippet, domainType, ...(publishedAt != null ? { publishedAt } : {}) }
  if (validateSource(source).length > 0) return null
  return source
}

function parseAiConflicts(raw: unknown): Record<string, EnrichmentConflictCandidate[]> | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const out: Record<string, EnrichmentConflictCandidate[]> = {}
  for (const [field, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    const candidates: EnrichmentConflictCandidate[] = []
    for (const item of list) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const sourcesRaw = row.sources
      if (!Array.isArray(sourcesRaw)) continue
      const sources: EnrichmentSource[] = []
      for (const s of sourcesRaw) {
        if (s === null || typeof s !== "object" || Array.isArray(s)) continue
        const parsed = parseConflictSource(s as Record<string, unknown>)
        if (parsed) sources.push(parsed)
      }
      candidates.push({ value: row.value ?? null, sources })
    }
    if (candidates.length > 0) out[field] = candidates
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeConflictsAndReasons(
  unresolvedFields: string[],
  rawSynthesis: Record<string, unknown>,
): {
  unresolvedReasons: Record<string, UnresolvedReason>
  conflicts: Record<string, EnrichmentConflictCandidate[]> | undefined
} {
  const aiReasons = parseAiUnresolvedReasons(rawSynthesis.unresolvedReasons)
  let unresolvedReasons = unresolvedReasonsForFields(unresolvedFields, aiReasons)
  let conflicts = parseAiConflicts(rawSynthesis.conflicts)

  for (const field of unresolvedFields) {
    if (unresolvedReasons[field] === "conflict" && (!conflicts?.[field] || conflicts[field].length === 0)) {
      unresolvedReasons = { ...unresolvedReasons, [field]: "no-evidence" }
    }
  }
  if (conflicts) {
    const pruned: Record<string, EnrichmentConflictCandidate[]> = {}
    for (const field of unresolvedFields) {
      if (unresolvedReasons[field] !== "conflict") continue
      const list = conflicts[field]
      if (list != null && list.length > 0) pruned[field] = list
    }
    conflicts = Object.keys(pruned).length > 0 ? pruned : undefined
  }

  return { unresolvedReasons, conflicts }
}

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

function withStopReason(notes: string, stopReason: StopReason): string {
  return notes === "" ? `stop=${stopReason}` : `stop=${stopReason} | ${notes}`
}

function getBudgetStop(elapsedMs: number, estimatedTokens: number): BudgetStop {
  if (elapsedMs >= ENRICHMENT_MAX_ELAPSED_MS) {
    return {
      stopReason: "time-budget",
      note: `Stopped early: time budget reached (${elapsedMs}ms).`,
    }
  }
  if (estimatedTokens >= ENRICHMENT_MAX_ESTIMATED_TOKENS) {
    return {
      stopReason: "token-budget",
      note: `Stopped early: token budget reached (${estimatedTokens} est.).`,
    }
  }
  return null
}

function getStopReasonFromConfidence(confidence: number): StopReason {
  return confidence >= CONFIDENCE_THRESHOLD ? "confidence-threshold" : "max-depth"
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

function getAllowedSchemaFields(schema: EnrichmentOutputSchema): string[] {
  return Object.keys(schema.properties).filter((field) => ALLOWED_ENRICHMENT_FIELDS.has(field))
}

/**
 * Normalizes a raw synthesis value for a known field.
 * Models sometimes return string fields as arrays (of strings or objects),
 * or number fields as strings.  We coerce to the expected types so downstream
 * code never sees unexpected types.
 */
function normalizeSynthesisValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (field === "sources" || field === "notes" || field === "militaryUnitId") {
    if (Array.isArray(value)) {
      // Each item may be a plain string or an object with a `url` property
      // (e.g. [{url:"https://...", title:"..."}] — a common GPT-4o response shape).
      const lines = value
        .map((item) => {
          if (typeof item === "string") return item.trim()
          if (item !== null && typeof item === "object" && "url" in item) {
            return String((item as Record<string, unknown>).url).trim()
          }
          return String(item)
        })
        .filter(Boolean)
      return lines.join("\n")
    }
    if (typeof value !== "string") return String(value)
    return value
  }
  if (field === "osmRelationId") {
    const n = typeof value === "number" ? value : Number(value)
    return Number.isFinite(n) ? n : null
  }
  return value
}

function sanitizeSynthesisObject(
  synthesisObject: Record<string, unknown>,
  allowedFields: string[],
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in synthesisObject) {
      sanitized[field] = normalizeSynthesisValue(field, synthesisObject[field])
    }
  }
  return sanitized
}

function normalizeProviderResult(
  query: string,
  result: { url: string; title: string; snippet: string; publishedAt?: string },
): RetrievalChunk {
  const domainType = getDomainTypeFromUrl(result.url)
  const chunk: RetrievalChunk = {
    query,
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    domainType,
    authorityWeight: getAuthorityWeight(domainType),
  }
  if (result.publishedAt != null && result.publishedAt.trim().length > 0) {
    chunk.publishedAt = result.publishedAt.trim()
  }
  return chunk
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
  const mapped = matching.map((chunk) => {
    const base: EnrichmentSource = {
      url: chunk.url,
      title: chunk.title,
      snippet: chunk.snippet,
      domainType: chunk.domainType,
    }
    if (chunk.publishedAt != null && chunk.publishedAt.trim().length > 0) {
      return { ...base, publishedAt: chunk.publishedAt.trim() }
    }
    return base
  })
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
      ...(chunk.publishedAt != null && chunk.publishedAt.trim().length > 0
        ? { publishedAt: chunk.publishedAt.trim() }
        : {}),
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
  rawSynthesis: Record<string, unknown>,
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

  const { unresolvedReasons, conflicts } = normalizeConflictsAndReasons(unresolvedFields, rawSynthesis)

  return {
    status,
    featureId: String(request.feature.id ?? request.feature.properties?.id ?? "unknown-feature"),
    depthUsed,
    proposals,
    unresolvedFields,
    unresolvedReasons,
    ...(conflicts != null ? { conflicts } : {}),
    notes: notes.join(" | "),
    queryTrace,
    processingTimeMs: Date.now() - startedAtMs,
  }
}

async function runRetrievalLoop(
  args: {
    request: EnrichmentRequest
    fields: string[]
    hopBudget: number
    providers: ProviderBundle
    usage: EnrichmentUsage
    startedAtMs: number
    onProgress?: (progress: ServiceProgress) => void
    signal?: AbortSignal
  },
): Promise<RetrievalLoopResult> {
  let depthUsed = 0
  let queryTrace: string[] = []
  let allChunks: RetrievalChunk[] = []
  const notes: string[] = []
  let unresolvedFields = [...args.fields]
  let stopReason: StopReason = "max-depth"

  for (let hop = 0; hop < args.hopBudget; hop += 1) {
    throwIfAborted(args.signal)
    const elapsedMs = Date.now() - args.startedAtMs
    const estimatedTokens = args.usage.estimatedInputTokens + args.usage.estimatedOutputTokens
    const budgetStop = getBudgetStop(elapsedMs, estimatedTokens)
    if (budgetStop != null) {
      stopReason = budgetStop.stopReason
      notes.push(budgetStop.note)
      break
    }

    depthUsed = hop + 1
    args.usage.providerCalls.openai_query_generation =
      (args.usage.providerCalls.openai_query_generation ?? 0) + 1
    const generated = await args.providers.model.generateQueries(
      {
        feature: args.request.feature,
        context: args.request.context,
        prompt: args.request.prompt,
        unresolvedFields,
      },
      args.signal,
    )
    const queries = dedupeQueries(generated).slice(0, 6)
    queryTrace = [...queryTrace, ...queries]
    args.usage.estimatedInputTokens += estimateTokens(JSON.stringify(queries))
    args.onProgress?.({ depthUsed, queryTrace })

    const retrieval = await retrieveParallel(queries, args.providers.retrieval, args.usage, args.signal)
    notes.push(...retrieval.notes)
    allChunks = dedupeChunks([...allChunks, ...retrieval.chunks])

    const { confidence, coveredFields } = computeConfidence(allChunks, args.fields)
    unresolvedFields = args.fields.filter((field) => !coveredFields.includes(field))
    const shouldStop = confidence >= CONFIDENCE_THRESHOLD || hop === args.hopBudget - 1
    if (shouldStop) {
      stopReason = getStopReasonFromConfidence(confidence)
      break
    }
  }

  return { depthUsed, queryTrace, allChunks, unresolvedFields, notes, stopReason }
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
  const retrievalLoop = await runRetrievalLoop({
    request,
    fields,
    hopBudget,
    providers,
    usage,
    startedAtMs,
    onProgress: options.onProgress,
    signal: options.signal,
  })

  const synthesisObject =
    retrievalLoop.allChunks.length === 0
      ? {}
      : await synthesizeWithSingleModel(
          request,
          fields,
          retrievalLoop.allChunks,
          providers,
          usage,
          options.signal,
        )
  const response = buildResponse(
    request,
    fields,
    retrievalLoop.depthUsed,
    retrievalLoop.queryTrace,
    retrievalLoop.allChunks,
    sanitizeSynthesisObject(synthesisObject, fields),
    synthesisObject,
    retrievalLoop.notes,
    startedAtMs,
  )
  response.notes = withStopReason(response.notes, retrievalLoop.stopReason)
  const responseErrors = validateEnrichmentResponse(response)
  if (responseErrors.length > 0) {
    throw createError("VALIDATION_ERROR", "Response contract validation failed", responseErrors.join("; "))
  }

  return { response, usage }
}

