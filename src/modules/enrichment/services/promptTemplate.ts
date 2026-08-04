import type { EnrichmentContext, EnrichmentFeature } from "@/types/enrichment.types"

export function buildDefaultEnrichmentPrompt(
  feature: EnrichmentFeature,
  context: EnrichmentContext,
  poolHintUrls?: string[],
): string {
  const name = String(feature.properties?.name ?? "Unknown")
  const echelon = String(feature.properties?.echelon ?? "unknown")
  const country = String(feature.properties?.country ?? "unknown")
  // "none" is a claim, not a blank. For an entity recorded under two parents at once it is
  // the wrong claim, so the unresolved contest is stated instead of asserted away.
  const contested = context.contestedParents ?? []
  const parentName = contested.length > 0
    ? `disputed — recorded under ${contested.map((p) => p.name).join(" and ")} at once, unresolved`
    : context.parent?.name ?? "none"
  const children = context.children.map((child) => child.name).join(", ") || "none"

  const lines = [
    `Find verified headquarters and garrison information for ${name} (${echelon}, ${country}).`,
    `Context: parent=${parentName}; known children=${children}. Focus only on HQ/garrison evidence and existing entity fields.`,
    "Prioritize evidence from 2023 onward and include both English and Russian sources.",
    "Evidence contract: each accepted claim needs at least one cited URL from retrieval; flag contradictions (conflict) or old-only evidence (stale) rather than guessing; allow evolution only when timelines clearly explain change.",
  ]

  if (poolHintUrls && poolHintUrls.length > 0) {
    lines.push(
      `Already known sources (search for additional evidence beyond these): ${poolHintUrls.join(", ")}.`,
    )
  }

  return lines.join("\n")
}

export const CREDIBILITY_PROMPT_VERSION = "v1"

export type CredibilityCitationInput = {
  url: string
  title: string
  snippet: string
  publishedAt?: string
}

export type CredibilityAssessmentInput = {
  entityName: string
  field: string
  value: string | null
  citations: CredibilityCitationInput[]
}

/**
 * ADR 0009: reliability is deliberately never mentioned, so credibility stays blind to
 * it (resisting the "diagonal collapse" pathology where reliability leaks into
 * credibility). The model is told outright it cannot output `1` — corroboration
 * clustering is computed independently in code (`independenceClusters.ts`) and used to
 * cap the response server-side, never trusted from the model's own judgment of
 * independence.
 */
export function buildCredibilityInstructions(): string {
  return [
    "Assess NATO STANAG 2511 Information Credibility (2-6) for the given claim, based only on the provided citations.",
    "You are assessing corroboration and contradiction signals only. You may NEVER output 1 (\"Confirmed\") — that grade is reserved for a human review action and is not available to you; the caller enforces this cap regardless of what you return.",
    "Identify: whether any citations contradict each other, and if so, whether a clear timeline shows one side is favored (positively contradicted) rather than an unresolved disagreement; any explicitly stated attribution (e.g. \"according to X\"); and your best-guess credibility (2-6) reflecting corroboration strength, before any caps are applied.",
    "Return strict JSON only in this shape: {\"credibility\": 2-6, \"contradicted\": boolean, \"positivelyContradicted\": boolean, \"statedAttribution\": string|null, \"confidence\": 0-1, \"rationale\": string}.",
  ].join("\n")
}

export function buildCredibilityPayload(input: CredibilityAssessmentInput): Record<string, unknown> {
  return {
    entityName: input.entityName,
    field: input.field,
    value: input.value,
    citations: input.citations.map((c, index) => ({
      index,
      url: c.url,
      title: c.title,
      snippet: c.snippet,
      publishedAt: c.publishedAt ?? null,
    })),
  }
}

