import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type {
  EnrichmentContext,
  EnrichmentFeature,
  EnrichmentResponse,
  EnrichmentUsage,
} from "@/types/enrichment.types"
import { runEnrichment } from "@/services/enrichment/enrichment.service"
import { buildDefaultEnrichmentPrompt } from "@/services/enrichment/promptTemplate"
import {
  DEFAULT_ENRICHMENT_OUTPUT_SCHEMA,
  ENRICHMENT_MAX_DEPTH_DEFAULT,
} from "@/services/enrichment/schema.fixtures"
import {
  createLayeredResearchProviderBundle,
  type ProviderBundle,
} from "@/services/enrichment/providers"
import { OverpassAdapter } from "@/services/enrichment/providers/overpass.adapter"
import { shouldSkipEntity, DEFAULT_RICHNESS_THRESHOLD } from "./entity-richness"

export type LayeredResearchResult = {
  results: Record<string, EnrichmentResponse>
  cacheAdditions: Array<{ url: string; content: string }>
  /** Entity IDs skipped due to abort or error. */
  skippedEntityIds: string[]
  /** Entity IDs skipped because they already exceed the richness threshold. */
  skippedRichEntityIds: string[]
  /** Per-entity token usage for cost tracking. */
  usageByEntityId: Record<string, EnrichmentUsage>
  stats: {
    entitiesProcessed: number
    sourcesFromCache: number
    layersTraversed: number
    processingTimeMs: number
    totalEstimatedInputTokens: number
    totalEstimatedOutputTokens: number
  }
}

export type LayeredResearchOptions = {
  /** URL → cached snippet. Mutated in-place as new sources are discovered. */
  sourceCache?: Map<string, string>
  /** Stop after this many BFS layers. Default: unlimited. */
  maxLayers?: number
  /** Stop after processing this many entities total. Default: unlimited. */
  maxEntities?: number
  /** Entity IDs to skip (already processed in a previous batch). */
  skipEntityIds?: Set<string>
  /**
   * Richness score threshold — entities scoring >= this are skipped.
   * Score: 2 pts per source URL + 1 pt each for notes/militaryUnitId/osmRelationId.
   * Default 6 ≈ skip if 3+ source URLs already present. Set to 0 to disable.
   */
  richnessThreshold?: number
  /** Milliseconds to wait between entities. Default: 500. */
  delayBetweenEntitiesMs?: number
  signal?: AbortSignal
  onProgress?: (current: {
    entityId: string
    name: string
    layer: number
    done: number
    total: number
  }) => void
  /** Fires immediately when each entity completes, before the full run resolves. */
  onEntityComplete?: (
    entityId: string,
    response: EnrichmentResponse,
    usage: EnrichmentUsage,
  ) => void
}

/**
 * Builds BFS layers from a flat entity list.
 * layer[0] = roots (parentId null or parent not in set)
 * layer[N] = entities whose parentId is in layer[N-1]
 * Orphans (parentId set but parent absent) are treated as roots.
 */
export function buildBfsLayers(entities: MapEntity[], maxLayers?: number): MapEntity[][] {
  const entityIds = new Set(entities.map((e) => e.id))
  const layers: MapEntity[][] = []

  const roots = entities.filter((e) => e.parentId === null || !entityIds.has(e.parentId))
  if (roots.length === 0) return []
  layers.push(roots)

  const limit = maxLayers ?? Infinity
  let currentIds = new Set(roots.map((e) => e.id))

  while (layers.length < limit) {
    const next = entities.filter((e) => e.parentId !== null && currentIds.has(e.parentId))
    if (next.length === 0) break
    layers.push(next)
    currentIds = new Set(next.map((e) => e.id))
  }

  return layers
}

function toEnrichmentFeature(entity: MapEntity, geometries: DrawnGeometry[]): EnrichmentFeature {
  const point = geometries.find((g) => g.entityId === entity.id && g.type === "point")
  const lng = point?.type === "point" ? point.lng : 0
  const lat = point?.type === "point" ? point.lat : 0
  return {
    type: "Feature",
    id: entity.id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: entity.id,
      name: entity.name,
      echelon: entity.echelon ?? null,
      country: "RU",
      parentId: entity.parentId,
      natoSymbolCode: entity.natoSymbolCode ?? null,
      status: "active",
    },
  }
}

function toEnrichmentContext(entity: MapEntity, entities: MapEntity[]): EnrichmentContext {
  const parent = entity.parentId
    ? (entities.find((e) => e.id === entity.parentId) ?? null)
    : null
  const children = entities.filter((e) => e.parentId === entity.id)
  return {
    parent: parent
      ? { id: parent.id, name: parent.name, echelon: parent.echelon ?? "unknown", hq_location: undefined }
      : null,
    children: children.map((c) => ({ id: c.id, name: c.name, echelon: c.echelon ?? "unknown" })),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

/**
 * Runs enrichment for all entities in BFS order (parent → children).
 *
 * Key behaviours:
 * - Entities in `skipEntityIds` are silently skipped (already processed in a prior batch).
 * - Entities above `richnessThreshold` are recorded in `skippedRichEntityIds`.
 * - `onEntityComplete` fires immediately after each entity so the UI can update incrementally.
 * - `maxEntities` caps how many entities are processed; remaining ones are not lost — they
 *   stay in `skippedEntityIds` so the next batch can pick them up.
 */
export async function runLayeredResearch(
  entities: MapEntity[],
  drawnGeometries: DrawnGeometry[],
  options: LayeredResearchOptions = {},
  providers?: ProviderBundle,
): Promise<LayeredResearchResult> {
  const sourceCache = options.sourceCache ?? new Map<string, string>()
  const delayMs = options.delayBetweenEntitiesMs ?? 500
  const richnessThreshold = options.richnessThreshold ?? DEFAULT_RICHNESS_THRESHOLD
  const maxEntities = options.maxEntities ?? Infinity
  const startedAtMs = Date.now()

  const results: Record<string, EnrichmentResponse> = {}
  const usageByEntityId: Record<string, EnrichmentUsage> = {}
  const cacheAdditions: Array<{ url: string; content: string }> = []
  const skippedEntityIds: string[] = []
  const skippedRichEntityIds: string[] = []
  let sourcesFromCache = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const bfsLayers = buildBfsLayers(entities, options.maxLayers)
  const allEntities = bfsLayers.flat()
  const totalEntities = allEntities.length
  let done = 0

  const overpassAdapter = new OverpassAdapter()

  outer: for (let layerIdx = 0; layerIdx < bfsLayers.length; layerIdx++) {
    const layer = bfsLayers[layerIdx]

    for (const entity of layer) {
      // Abort check
      if (options.signal?.aborted) {
        skippedEntityIds.push(...layer.slice(layer.indexOf(entity)).map((e) => e.id))
        break outer
      }

      // Skip already-processed entities from a previous batch
      if (options.skipEntityIds?.has(entity.id)) {
        continue
      }

      // Skip richly-sourced entities
      if (shouldSkipEntity(entity, richnessThreshold)) {
        skippedRichEntityIds.push(entity.id)
        continue
      }

      // Batch size limit — remaining entities are not processed this run
      if (done >= maxEntities) {
        skippedEntityIds.push(...layer.slice(layer.indexOf(entity)).map((e) => e.id))
        // Also push all remaining layers
        for (let li = layerIdx + 1; li < bfsLayers.length; li++) {
          skippedEntityIds.push(...bfsLayers[li].map((e) => e.id))
        }
        break outer
      }

      options.onProgress?.({
        entityId: entity.id,
        name: entity.name,
        layer: layerIdx,
        done,
        total: totalEntities,
      })

      try {
        const poolHintUrls = entity.sources
          ? entity.sources.split("\n").map((u) => u.trim()).filter(Boolean)
          : []

        const feature = toEnrichmentFeature(entity, drawnGeometries)
        const context = toEnrichmentContext(entity, entities)
        const prompt = buildDefaultEnrichmentPrompt(feature, context, poolHintUrls)

        const bundle = providers ?? createLayeredResearchProviderBundle(sourceCache)

        const { response, usage } = await runEnrichment(
          {
            prompt,
            feature,
            context,
            outputSchema: DEFAULT_ENRICHMENT_OUTPUT_SCHEMA,
            maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
          },
          { providers: bundle, signal: options.signal },
        )

        // Collect cache entries and count hits
        for (const proposal of response.proposals) {
          for (const source of proposal.sources) {
            if (sourceCache.has(source.url)) {
              sourcesFromCache += 1
            } else {
              cacheAdditions.push({ url: source.url, content: source.snippet })
              sourceCache.set(source.url, source.snippet)
            }
          }
        }

        // Aggregate token usage
        usageByEntityId[entity.id] = usage
        totalInputTokens += usage.estimatedInputTokens
        totalOutputTokens += usage.estimatedOutputTokens

        // OSM unit-ID lookup — non-fatal; cap at 8 s so a TCP hang never blocks the batch
        if (entity.militaryUnitId) {
          try {
            const osmSignal = options.signal
              ? AbortSignal.any([AbortSignal.timeout(8_000), options.signal])
              : AbortSignal.timeout(8_000)
            const osmResults = await overpassAdapter.searchByUnitId(
              entity.militaryUnitId,
              osmSignal,
            )
            if (osmResults.length > 0) {
              const osmNotes = osmResults
                .map(
                  (r) =>
                    `[OSM suggestion] ${r.url.replace("https://www.openstreetmap.org/", "")} "${r.title}" matched unit ID ${entity.militaryUnitId} — ${r.url}`,
                )
                .join("\n")
              response.notes = response.notes ? `${response.notes}\n${osmNotes}` : osmNotes
            }
          } catch {
            // Overpass failure is non-fatal
          }
        }

        results[entity.id] = response
        // Notify hook immediately so UI updates without waiting for the full run
        options.onEntityComplete?.(entity.id, response, usage)
      } catch (error) {
        if (isAbortError(error)) {
          skippedEntityIds.push(entity.id)
          break outer
        }
        skippedEntityIds.push(entity.id)
      }

      done += 1

      if (done < totalEntities && !options.signal?.aborted) {
        await sleep(delayMs)
      }
    }
  }

  return {
    results,
    cacheAdditions,
    skippedEntityIds,
    skippedRichEntityIds,
    usageByEntityId,
    stats: {
      entitiesProcessed: done,
      sourcesFromCache,
      layersTraversed: bfsLayers.length,
      processingTimeMs: Date.now() - startedAtMs,
      totalEstimatedInputTokens: totalInputTokens,
      totalEstimatedOutputTokens: totalOutputTokens,
    },
  }
}
