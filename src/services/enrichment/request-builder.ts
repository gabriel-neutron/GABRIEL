import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentRequest } from "@/types/enrichment.types"
import { toEnrichmentFeature, toEnrichmentContext } from "@/utils/enrichmentAdapters"
import { buildDefaultEnrichmentPrompt } from "./promptTemplate"
import { buildEnrichmentOutputSchema } from "./schema.fixtures"
import { ENRICHMENT_MAX_DEPTH_DEFAULT } from "./enrichment.constants"

export type BuildEnrichmentRequestOptions = {
  /** Pre-built prompt (e.g. a user-edited draft). Falls back to the default prompt when omitted. */
  prompt?: string
  /** Existing ledger URLs to surface as "already known" hints in the default prompt. */
  poolHintUrls?: string[]
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
  return {
    prompt,
    feature,
    context,
    outputSchema: buildEnrichmentOutputSchema(entity.sources),
    maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
  }
}
