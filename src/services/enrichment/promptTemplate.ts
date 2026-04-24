import type { EnrichmentContext, EnrichmentFeature } from "@/types/enrichment.types"

export function buildDefaultEnrichmentPrompt(
  feature: EnrichmentFeature,
  context: EnrichmentContext,
  poolHintUrls?: string[],
): string {
  const name = String(feature.properties?.name ?? "Unknown")
  const echelon = String(feature.properties?.echelon ?? "unknown")
  const country = String(feature.properties?.country ?? "unknown")
  const parentName = context.parent?.name ?? "none"
  const children = context.children.map((child) => child.name).join(", ") || "none"

  const lines = [
    `Find verified headquarters and garrison information for ${name} (${echelon}, ${country}).`,
    `Context: parent=${parentName}; known children=${children}. Focus only on HQ/garrison evidence and existing entity fields.`,
    "Prioritize evidence from 2023 onward and include both English and Russian sources.",
  ]

  if (poolHintUrls && poolHintUrls.length > 0) {
    lines.push(
      `Already known sources (search for additional evidence beyond these): ${poolHintUrls.join(", ")}.`,
    )
  }

  return lines.join("\n")
}

