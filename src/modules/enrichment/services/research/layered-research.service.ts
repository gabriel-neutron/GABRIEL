import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import { buildOrbat } from "@/core/entity/hierarchy"
import { hierarchyIndex, type ParentLinkSource } from "@/core/relationship/hierarchyIndex"
import type { Relationship } from "@/core/relationship/relationship"
import type {
  EnrichmentResponse,
  EnrichmentUsage,
} from "@/types/enrichment.types"
import { runEnrichment } from "@/modules/enrichment/services/enrichment.service"
import { buildEnrichmentRequest } from "@/modules/enrichment/services/request-builder"
import type { Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"
import {
  createLayeredResearchProviderBundle,
  type ProviderBundle,
} from "@/modules/enrichment/services/providers"
import { OverpassAdapter } from "@/modules/enrichment/services/providers/overpass.adapter"
import { shouldSkipEntity, DEFAULT_RICHNESS_THRESHOLD } from "./entity-richness"

export type LayeredResearchResult = {
  results: Record<string, EnrichmentResponse>
  cacheAdditions: Array<{ url: string; content: string }>
  /** Entity IDs skipped because a run was aborted or batch-capped before reaching them. */
  skippedEntityIds: string[]
  /** Entity IDs that were attempted but failed. */
  failedEntityIds: string[]
  /** Non-fatal and fatal issues captured per entity, for UI diagnostics. */
  warnings: Array<{
    entityId: string
    name: string
    source: "enrichment" | "overpass"
    message: string
  }>
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
  /** This project's provenance claims (ADR 0006, E2.6) — used for richness scoring and pool hints. */
  claims?: Claim[]
  /** This project's provenance sources (ADR 0006, E2.6) — used to resolve claims to URLs. */
  sources?: Source[]
  /** This project's edge set (ADR 0011) — the authority for who sits under whom. Omitted,
   *  the run falls back to the derived `parentId` field and cannot see a contest. */
  relationships?: Relationship[]
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
 * Builds BFS layers from a flat entity list, via the shared Orbat traversal module.
 * layer[0] = roots (no parent, orphaned, CONTESTED, or a disconnected cycle's entry point)
 * layer[N] = entities whose parent is in layer[N-1]
 *
 * A contested entity is enriched in the first layer rather than skipped: it is a real
 * entity with a real research question, and the contest is about its parent, not about it.
 * What must not travel downstream is the claim that it has none — see `toEnrichmentContext`.
 */
export function buildBfsLayers(
  entities: MapEntity[],
  maxLayers?: number,
  index?: ParentLinkSource,
): MapEntity[][] {
  return buildOrbat(entities, index).layers(maxLayers)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Ids of every entity not yet reached when a run stops early: the rest of the
 * current layer from `startIdx` onward, plus all entities in deeper layers.
 * Used by both the abort and the `maxEntities` cap so no entity is silently lost —
 * they land in `skippedEntityIds` for the next batch to pick up.
 */
function remainingFrom(
  bfsLayers: MapEntity[][],
  layerIdx: number,
  startIdx: number,
): string[] {
  const ids = bfsLayers[layerIdx].slice(startIdx).map((e) => e.id)
  for (let li = layerIdx + 1; li < bfsLayers.length; li++) {
    ids.push(...bfsLayers[li].map((e) => e.id))
  }
  return ids
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

function groupClaimsByEntityId(claims: Claim[]): Map<string, Claim[]> {
  const byEntityId = new Map<string, Claim[]>()
  for (const claim of claims) {
    const list = byEntityId.get(claim.entityId)
    if (list) list.push(claim)
    else byEntityId.set(claim.entityId, [claim])
  }
  return byEntityId
}

/**
 * Same dedup-by-URL semantics as `core/provenance/ledgerProjection.ts::projectEntityLedger`,
 * but takes claims already pre-filtered to one entity and a pre-built `sourceById` map —
 * both computed once outside the BFS loop below rather than re-scanned per entity, which
 * would otherwise make every batch O(entities x claims) + O(entities x sources) on the
 * main thread between each entity's (awaited) network call.
 */
function projectLedgerUrls(entityClaims: Claim[], sourceById: Map<string, Source>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const claim of entityClaims) {
    const source = sourceById.get(claim.sourceId)
    if (!source || seen.has(source.url)) continue
    seen.add(source.url)
    urls.push(source.url)
  }
  return urls
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
  const claims = options.claims ?? []
  const sources = options.sources ?? []
  const claimsByEntityId = groupClaimsByEntityId(claims)
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const delayMs = options.delayBetweenEntitiesMs ?? 500
  const richnessThreshold = options.richnessThreshold ?? DEFAULT_RICHNESS_THRESHOLD
  const maxEntities = options.maxEntities ?? Infinity
  const startedAtMs = Date.now()

  const results: Record<string, EnrichmentResponse> = {}
  const usageByEntityId: Record<string, EnrichmentUsage> = {}
  const cacheAdditions: Array<{ url: string; content: string }> = []
  const skippedEntityIds: string[] = []
  const failedEntityIds: string[] = []
  const warnings: Array<{
    entityId: string
    name: string
    source: "enrichment" | "overpass"
    message: string
  }> = []
  const skippedRichEntityIds: string[] = []
  let sourcesFromCache = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const index = options.relationships == null
    ? undefined
    : hierarchyIndex(options.relationships, { entities })
  const bfsLayers = buildBfsLayers(entities, options.maxLayers, index)
  const allEntities = bfsLayers.flat()
  const totalEntities = allEntities.length
  let done = 0

  const overpassAdapter = new OverpassAdapter()
  const bundle = providers ?? createLayeredResearchProviderBundle(sourceCache)

  outer: for (let layerIdx = 0; layerIdx < bfsLayers.length; layerIdx++) {
    const layer = bfsLayers[layerIdx]

    for (const entity of layer) {
      // Abort check
      if (options.signal?.aborted) {
        skippedEntityIds.push(...remainingFrom(bfsLayers, layerIdx, layer.indexOf(entity)))
        break outer
      }

      // Skip already-processed entities from a previous batch
      if (options.skipEntityIds?.has(entity.id)) {
        continue
      }

      const entityClaims = claimsByEntityId.get(entity.id) ?? []

      // Skip richly-sourced entities
      if (shouldSkipEntity(entity, entityClaims, richnessThreshold)) {
        skippedRichEntityIds.push(entity.id)
        continue
      }

      // Batch size limit — remaining entities are not processed this run
      if (done >= maxEntities) {
        skippedEntityIds.push(...remainingFrom(bfsLayers, layerIdx, layer.indexOf(entity)))
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
        const poolHintUrls = projectLedgerUrls(entityClaims, sourceById)

        const { response, usage } = await runEnrichment(
          buildEnrichmentRequest(entity, entities, drawnGeometries, {
            poolHintUrls, claims: entityClaims, parentLink: index?.linkFor(entity.id),
          }),
          { providers: bundle, signal: options.signal },
        )

        // Collect cache entries and count hits
        for (const proposal of response.proposals) {
          for (const source of proposal.citations) {
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
          } catch (error) {
            // Overpass failure is non-fatal, but we surface it to the UI.
            const message =
              error instanceof Error
                ? `Overpass lookup failed: ${error.message}`
                : "Overpass lookup failed while enriching this entity."
            warnings.push({
              entityId: entity.id,
              name: entity.name,
              source: "overpass",
              message,
            })
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
        failedEntityIds.push(entity.id)
        warnings.push({
          entityId: entity.id,
          name: entity.name,
          source: "enrichment",
          message: error instanceof Error ? error.message : "Unknown enrichment error",
        })
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
    failedEntityIds,
    warnings,
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
