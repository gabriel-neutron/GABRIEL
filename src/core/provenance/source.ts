import type { SourceDomainType } from "@/types/enrichment.types"
import type { AdmiraltyReliability } from "./admiralty"
import { getDomainTypeFromUrl } from "./domainType"

/**
 * ADR 0006: a deduplicated, identity-bearing citation. `id` is stable across saves —
 * once a URL has a `Source` record, later calls to `dedupeSources` must return that
 * same record (not mint a new id), or every load/save cycle would grow the table.
 */
export type Source = {
  id: string
  url: string
  domainType: SourceDomainType | null
  reliability: AdmiraltyReliability | null
}

/**
 * Merges `urls` into `existing`, deduplicating by exact trimmed URL match (ADR 0006's
 * scope note: fuzzy/canonicalized source identity belongs to `core/identity`, E3 — not
 * here). Reuses an existing `Source`'s id/reliability whenever its URL is already known;
 * only mints a new `Source` for a URL that has never been seen before.
 */
export function dedupeSources(urls: string[], existing: Source[]): Source[] {
  const byUrl = new Map(existing.map((s) => [s.url, s]))
  const result = [...existing]
  for (const rawUrl of urls) {
    const url = rawUrl.trim()
    if (!url || byUrl.has(url)) continue
    const created: Source = { id: crypto.randomUUID(), url, domainType: getDomainTypeFromUrl(url), reliability: null }
    byUrl.set(url, created)
    result.push(created)
  }
  return result
}
