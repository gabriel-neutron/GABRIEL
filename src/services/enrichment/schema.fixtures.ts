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

export const ENRICHMENT_MAX_DEPTH_DEFAULT = 2
export const ENRICHMENT_MAX_DEPTH_HARD_LIMIT = 3
export const ENRICHMENT_MAX_ELAPSED_MS = 55_000
export const ENRICHMENT_MAX_ESTIMATED_TOKENS = 24_000

