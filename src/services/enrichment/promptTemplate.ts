import type { EnrichmentContext, EnrichmentFeature } from "@/types/enrichment.types"

export function buildDefaultEnrichmentPrompt(
  feature: EnrichmentFeature,
  context: EnrichmentContext,
): string {
  const name = String(feature.properties?.name ?? "Unknown")
  const echelon = String(feature.properties?.echelon ?? "unknown")
  const country = String(feature.properties?.country ?? "unknown")
  const parentName = context.parent?.name ?? "none"
  const children = context.children.map((child) => child.name).join(", ") || "none"

  return [
    `Find verified headquarters and garrison information for ${name} (${echelon}, ${country}).`,
    `Context: parent=${parentName}; known children=${children}. Focus only on HQ/garrison evidence and existing entity fields.`,
    "Prioritize evidence from 2023 onward and include both English and Russian sources.",
  ].join("\n")
}

