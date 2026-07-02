import type { EnrichmentSource } from "@/types/enrichment.types"
import { getAuthorityWeight } from "./validators"

const SOURCES_DELIMITER = "\n"

const AGGREGATE_URL_PATTERNS = ["/feed/", "/author/", "/tag/", "/category/"]

export function isSpecificArticleUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return !AGGREGATE_URL_PATTERNS.some((pattern) => lower.includes(pattern))
}

/** Parses the Provenance Ledger's newline-delimited URL string (`MapEntity.sources`). */
export function parse(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(SOURCES_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function serialize(urls: string[]): string | null {
  const cleaned = urls.map((u) => u.trim()).filter((u) => u.length > 0)
  return cleaned.length > 0 ? cleaned.join(SOURCES_DELIMITER) : null
}

/** True when the Provenance Ledger is empty — the ADR-0001 gate for independent proposals. */
export function shouldPropose(raw?: string | null): boolean {
  return parse(raw).length === 0
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

/** Merges new URLs into the existing ledger, deduplicating and preserving existing-first order. */
export function merge(existingRaw: string | null | undefined, newUrls: string[]): string | null {
  const merged = [...new Set([...parse(existingRaw), ...newUrls.map((u) => u.trim()).filter(Boolean)])]
  return serialize(merged)
}
