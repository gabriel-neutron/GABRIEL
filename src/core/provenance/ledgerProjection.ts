import type { Claim } from "./claim"
import type { Source } from "./source"

/**
 * Projects an entity's claims back into the ordered URL list the pre-E2 string ledger
 * used to hold — first-seen order, deduplicated by URL. Existing-first order matters:
 * `ledger.ts`'s `merge` preserved it, and UI (`SourcesList`) still expects it.
 */
export function projectEntityLedger(entityId: string, claims: Claim[], sources: Source[]): string[] {
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const urls: string[] = []
  for (const claim of claims) {
    if (claim.entityId !== entityId) continue
    const source = sourceById.get(claim.sourceId)
    if (!source || seen.has(source.url)) continue
    seen.add(source.url)
    urls.push(source.url)
  }
  return urls
}
