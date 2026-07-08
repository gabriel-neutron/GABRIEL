import type { EnrichmentSource } from "@/types/enrichment.types"
import { getAuthorityWeight } from "@/services/enrichment/validators"

const AGGREGATE_URL_PATTERNS = ["/feed/", "/author/", "/tag/", "/category/"]

export function isSpecificArticleUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return !AGGREGATE_URL_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Ranks Research Citations by Authority Weight, excluding Wikipedia and non-article
 * aggregate URLs (feeds, author/tag/category pages) — neither is durable primary
 * evidence for a Provenance Ledger entry.
 */
export function rankCitations(citations: EnrichmentSource[]): EnrichmentSource[] {
  return citations
    .filter((s) => s.domainType !== "wikipedia" && isSpecificArticleUrl(s.url))
    .sort((a, b) => getAuthorityWeight(b.domainType) - getAuthorityWeight(a.domainType))
}

export function selectTopCitations(citations: EnrichmentSource[], n = 2): EnrichmentSource[] {
  return rankCitations(citations).slice(0, n)
}
