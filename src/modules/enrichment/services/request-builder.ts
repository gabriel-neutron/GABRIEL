import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentRequest } from "@/types/enrichment.types"
import type { Claim } from "@/core/provenance/claim"
import { GENERAL_CITATION_FIELD } from "@/core/provenance/claim"
import { toEnrichmentFeature, toEnrichmentContext } from "./enrichmentAdapters"
import { buildDefaultEnrichmentPrompt } from "./promptTemplate"
import { buildEnrichmentOutputSchema } from "./schema.fixtures"
import { ENRICHMENT_MAX_DEPTH_DEFAULT } from "./enrichment.constants"

export type BuildEnrichmentRequestOptions = {
  /** Pre-built prompt (e.g. a user-edited draft). Falls back to the default prompt when omitted. */
  prompt?: string
  /** Existing ledger URLs to surface as "already known" hints in the default prompt. */
  poolHintUrls?: string[]
  /** This project's provenance claims (ADR 0006, E2.6) — gates whether "sources" is proposed. */
  claims?: Claim[]
}

export function buildEnrichmentRequest(
  entity: MapEntity,
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  opts?: BuildEnrichmentRequestOptions,
): EnrichmentRequest {
  const feature = toEnrichmentFeature(entity, drawnGeometries)
  const context = toEnrichmentContext(entity, entities)
  const prompt = opts?.prompt ?? buildDefaultEnrichmentPrompt(feature, context, opts?.poolHintUrls)
  const hasExistingSources = (opts?.claims ?? []).some(
    (c) => c.entityId === entity.id && c.field === GENERAL_CITATION_FIELD,
  )
  return {
    prompt,
    feature,
    context,
    outputSchema: buildEnrichmentOutputSchema(hasExistingSources),
    maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
  }
}
