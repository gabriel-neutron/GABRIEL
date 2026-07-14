import type { EnrichmentSource, EnrichmentProposal } from "@/types/enrichment.types"
import type { Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"
import { clampCredibility } from "@/core/provenance/admiralty"
import type { CredibilityAssessmentResult } from "@/core/provenance/reviewQueue"
import { isInterestedParty } from "@/core/provenance/interestedParty"
import { countCorroborationClusters, type ClusterableCitation } from "./independenceClusters"
import { buildCredibilityInstructions, buildCredibilityPayload, CREDIBILITY_PROMPT_VERSION, type CredibilityAssessmentInput } from "./promptTemplate"

export type { CredibilityAssessmentResult }

export type CredibilityModelResponse = {
  credibility: number
  contradicted: boolean
  positivelyContradicted: boolean
  statedAttribution: string | null
  confidence: number
  rationale: string
}

export type CredibilityModel = {
  assessCredibility: (
    instructions: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<CredibilityModelResponse>
}

/**
 * ADR 0009: one batched call per entity, all its citations side-by-side — corroboration
 * clustering is computed here in code (`independenceClusters.ts`), independent of the
 * model's own judgment, and used to cap the returned credibility server-side. Returns
 * `null` without calling the model at all when there's nothing to assess.
 */
export async function assessEntityCredibility(
  args: Omit<CredibilityAssessmentInput, "citations"> & { citations: EnrichmentSource[]; model: CredibilityModel; signal?: AbortSignal },
): Promise<CredibilityAssessmentResult | null> {
  const { entityName, field, value, citations, model, signal } = args
  if (citations.length === 0) return null

  const clusterable: ClusterableCitation[] = citations.map((c) => ({
    url: c.url,
    snippet: c.snippet,
    interestedParty: isInterestedParty(c.url),
  }))
  const corroborationClusters = countCorroborationClusters(clusterable)

  const instructions = buildCredibilityInstructions()
  const payload = buildCredibilityPayload({ entityName, field, value, citations })
  const response = await model.assessCredibility(instructions, payload, signal)

  const credibility = clampCredibility(response.credibility, {
    hasBasis: true,
    clusterCount: corroborationClusters,
    contradicted: response.contradicted,
    positivelyContradicted: response.positivelyContradicted,
  })

  return {
    credibility,
    meta: {
      confidence: response.confidence,
      rationale: response.rationale,
      assessor: { kind: "ai", model: "openai", promptVersion: CREDIBILITY_PROMPT_VERSION },
      mappingVersion: CREDIBILITY_PROMPT_VERSION,
      updatedAt: new Date().toISOString(),
      overridden: false,
      evidenceRefs: citations.map((c) => c.url),
      corroborationClusters,
      statedAttribution: response.statedAttribution,
      dates: citations.map((c) => c.publishedAt).filter((d): d is string => d != null && d.trim().length > 0),
    },
  }
}

/**
 * Resolves the actual citations a batch of new claims need assessed: each claim's
 * cited URL (via `sources`, which must cover every claim's `sourceId` — both newly
 * minted and reused-existing Source records, not just the newly-minted ones) matched
 * against every accepted proposal's `citations`. Building this from the claims'
 * actual cited sources (not e.g. only globally-new sources) is what guarantees every
 * claim gets an assessment derived from its own citation.
 */
export function selectCitationsForClaims(
  claims: Claim[],
  sources: Source[],
  proposals: EnrichmentProposal[],
): EnrichmentSource[] {
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const claimUrls = new Set(
    claims.map((c) => sourceById.get(c.sourceId)?.url).filter((u): u is string => u != null),
  )
  const citationsByUrl = new Map<string, EnrichmentSource>()
  for (const proposal of proposals) {
    for (const citation of proposal.citations) {
      if (claimUrls.has(citation.url) && !citationsByUrl.has(citation.url)) {
        citationsByUrl.set(citation.url, citation)
      }
    }
  }
  return [...citationsByUrl.values()]
}
