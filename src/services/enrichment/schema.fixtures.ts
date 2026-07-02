import type { EnrichmentOutputSchema } from "@/types/enrichment.types"
import * as provenanceLedger from "./provenance-ledger"

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
 * provenance ledger (`sources`, the raw newline-delimited value) is empty. When sources
 * already exist, the ledger is populated automatically via accepted-proposal citation
 * accumulation and no independent proposal is needed.
 */
export function buildEnrichmentOutputSchema(sources?: string | null): EnrichmentOutputSchema {
  if (!provenanceLedger.shouldPropose(sources)) {
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

export * from "./enrichment.constants"

