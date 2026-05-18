import type { EnrichmentOutputSchema } from "@/types/enrichment.types"

export const DEFAULT_ENRICHMENT_OUTPUT_SCHEMA: EnrichmentOutputSchema = {
  type: "object",
  properties: {
    notes: { type: ["string", "null"] },
    sources: { type: ["string", "null"] },
    militaryUnitId: { type: ["string", "null"] },
    osmRelationId: { type: ["number", "null"] },
  },
  required: [],
  additionalProperties: false,
}

/**
 * Returns an output schema that includes the `sources` field only when the entity's
 * provenance ledger is empty. When sources already exist, the ledger is populated
 * automatically via accepted-proposal citation accumulation and no independent proposal is needed.
 */
export function buildEnrichmentOutputSchema(hasExistingSources: boolean): EnrichmentOutputSchema {
  if (hasExistingSources) {
    return {
      type: "object",
      properties: {
        notes: { type: ["string", "null"] },
        militaryUnitId: { type: ["string", "null"] },
        osmRelationId: { type: ["number", "null"] },
      },
      required: [],
      additionalProperties: false,
    }
  }
  return DEFAULT_ENRICHMENT_OUTPUT_SCHEMA
}

export const ENRICHMENT_MAX_DEPTH_DEFAULT = 2
export const ENRICHMENT_MAX_DEPTH_HARD_LIMIT = 3
export const ENRICHMENT_MAX_ELAPSED_MS = 55_000
export const ENRICHMENT_MAX_ESTIMATED_TOKENS = 24_000

