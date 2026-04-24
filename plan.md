# Layered Research System — Revised Plan



## Context



The existing enrichment pipeline (`runEnrichment`) already handles one entity at a time: generates queries (OpenAI), retrieves results (Tavily + Overpass), synthesizes (OpenAI), and proposes updates to `notes`, `sources`, `militaryUnitId`, `osmRelationId` on a `MapEntity`. Sources are stored as a newline-delimited URL string in `MapEntity.sources`.



The goal is a **one-use batch system** that walks the entity hierarchy top-down, avoids re-fetching already-seen URLs (simple cache), reuses the existing enrichment pipeline + UI components as-is, and improves source quality by enforcing a strict source hierarchy (official > OSINT/articles > social media > Wikipedia).



User answers:

- Schema: one new cache table only (`research_sources(id, url, content)`)

- Entity sources: keep existing `MapEntity.sources` string field

- Run mode: batch run → then review entity by entity using the existing drawer

- Entity creation: not in scope for this revision (dropped)



---



## What Changes



```

                  existing                         new / modified

┌──────────────────────────────┐    ┌────────────────────────────────────────────┐

│  runEnrichment()             │    │  runLayeredResearch()                       │

│  • one entity                │◄───│  • BFS order (parent → children)           │

│  • Tavily + Overpass         │    │  • checks research_sources cache first     │

│  • OpenAI synthesis          │    │  • passes pool-hint URLs in prompt         │

│  • returns EnrichmentResponse│    │  • OSM unit-ID lookup after enrichment     │

└──────────────────────────────┘    │  • returns Record<entityId, Response>      │

                                    └────────────────────────────────────────────┘

                                                         │

┌──────────────────────────────┐    ┌────────────────────▼───────────────────────┐

│  useEnrichment hook (reused) │◄───│  useLayeredResearch hook                   │

│  • drawer open/close         │    │  • run(), cancel(), reviewQueue            │

│  • accept/reject proposals   │    │  • loadResultIntoEnrichment(entityId)      │

│  • applyAccepted             │    │  • steps user through queue one at a time  │

└──────────────────────────────┘    └────────────────────────────────────────────┘

```



---



## Schema Change (minimal)



One new table in GeoPackage — a URL-keyed content cache to avoid re-fetching:



```sql

CREATE TABLE IF NOT EXISTS research_sources (

  id         TEXT PRIMARY KEY,

  url        TEXT UNIQUE NOT NULL,

  content    TEXT,          -- cached snippet/full text

  fetched_at TEXT

);

```



This table is loaded on project open and checked before each web retrieval. If a URL is already cached, its stored `content` is injected as a retrieval chunk directly, skipping the Tavily call.



**No changes** to the `units`, `geometries`, or `layers` tables.  

`MapEntity.sources` remains a newline-delimited URL string.



---



## Source Hierarchy



Both the query-generation and synthesis prompts must encode this priority:



| Priority | Source type | Examples |

|---|---|---|

| 1 — Highest | Official Russian military / gov | `mil.ru`, `kremlin.ru`, `.gov.ru`, CSTO |

| 2 | OSINT reports / news | Bellingcat, RFE/RL, ISW, Meduza, BBC |

| 3 | Social media | Telegram channels (rybar, etc.), VK |

| 4 — Lowest | Wikipedia | Use only if nothing else; follow its citations to primary source |



Synthesis instruction: _"If Wikipedia is the only available source for a claim, note it but also report any primary source it cites. Never use Wikipedia as the sole citation."_



Garrison-only instruction (add to both query generation and synthesis):  

_"Focus exclusively on permanent garrison locations, military bases, training grounds, and headquarters (voennyy gorodok / voennaya baza). Ignore deployment areas, front-line positions, and operational movements. If evidence is found but its relevance to garrison is uncertain, include the source URL and append a brief note rather than discarding it."_



---



## Model Upgrade



The synthesis step currently uses `gpt-4.1-mini`. For the layered research, upgrade to `gpt-4o` (significantly better at extracting structured facts from noisy OSINT snippets). Query generation can stay on `gpt-4.1-mini` (it only formats search strings).



Add a `synthesisModel` option to `OpenAIModelAdapter`:



```typescript

// openai.adapter.ts

constructor(apiKey: string | null, synthesisModel = "gpt-4.1-mini") {

  this.synthesisModel = synthesisModel

}

```



`createDefaultProviderBundle()` continues to use `gpt-4.1-mini` for both (preserving existing behaviour). The layered research service creates its own bundle with `synthesisModel: "gpt-4o"`.



---



## OSM Unit-ID Matching



The existing `OverpassAdapter` queries OSM by name. Military unit IDs are sometimes stored in OSM `ref`, `name`, or tag keys like `military:unit`. Add a second search method to the adapter:



```typescript

// overpass.adapter.ts — new method alongside search()

async searchByUnitId(unitId: string, signal?: AbortSignal): Promise<ProviderSearchResult[]>

```



Overpass query: search `way` and `relation` elements where any tag value contains the `unitId` string and `military` tag is present:



```

[out:json][timeout:10];

(

  way["military"]["ref"~"${unitId}",i];

  relation["military"]["ref"~"${unitId}",i];

  way["military"]["name"~"${unitId}",i];

  relation["military"]["name"~"${unitId}",i];

);

out body 3;

```



If matches found: format as a note appended to `entity.notes`:

```

[OSM suggestion] relation/12345 "Kapino Training Ground" matched unit ID ${unitId} — https://osm.org/relation/12345

```



`osmRelationId` is **never** set automatically. The user must do it manually after reviewing the note.



---



## Layered Research Service



`src/services/research/layered-research.service.ts` (new file)



```typescript

export type LayeredResearchResult = {

  results: Record<string, EnrichmentResponse>  // entityId → response

  cacheAdditions: Array<{ url: string; content: string }>  // new URLs to persist

  skippedEntityIds: string[]  // entities that failed or were aborted

  stats: {

    entitiesProcessed: number

    sourcesFromCache: number

    layersTraversed: number

    processingTimeMs: number

  }

}



export type LayeredResearchOptions = {

  sourceCache?: Map<string, string>    // url → cached content (loaded from DB)

  maxLayers?: number                   // default: unlimited

  delayBetweenEntitiesMs?: number      // default: 500ms (rate limiting)

  signal?: AbortSignal

  onProgress?: (current: { entityId: string; name: string; layer: number; done: number; total: number }) => void

}



export async function runLayeredResearch(

  entities: MapEntity[],

  options: LayeredResearchOptions = {},

  providers?: ProviderBundle,           // defaults to createDefaultProviderBundle() with gpt-4o synthesis

): Promise<LayeredResearchResult>

```



### BFS queue



```typescript

function buildBfsLayers(entities: MapEntity[], maxLayers?: number): MapEntity[][] {

  // layer[0] = entities with parentId === null

  // layer[N] = entities whose parentId is in layer[N-1]

  // Handles orphans (parentId set but parent missing): treat as roots

}

```



### Per-entity loop



For each BFS layer, for each entity:



1. **Pool-hint URLs**: collect URLs already in `entity.sources` (split on newlines) → pass to prompt so LLM searches beyond known ones.

2. **Build prompt**: `buildDefaultEnrichmentPrompt(feature, context)` + pool-hint suffix + garrison instruction.

3. **Cache injection**: for each Tavily query result whose URL is already in `sourceCache` → replace the live fetch with a synthetic `RetrievalChunk` from cached content (avoid network call). *This requires a thin wrapper around `TavilyAdapter` that intercepts known URLs.*

4. **Run enrichment**: `await runEnrichment(request, { providers, signal })`.

5. **Collect new cache entries**: for each returned source URL not in `sourceCache` → add `{ url, content: snippet }` to `cacheAdditions`.

6. **OSM unit-ID lookup**: if `entity.militaryUnitId` is set, call `overpassAdapter.searchByUnitId(entity.militaryUnitId, signal)`. If results exist, append note to the proposal's `notes` field (or prepend to `response.notes`).

7. **Delay**: `await sleep(delayBetweenEntitiesMs)` before next entity.

8. Store `results[entity.id] = response`.



---



## Cache-Aware Retrieval



Rather than modifying `TavilyAdapter` (which doesn't know about the cache), wrap retrieval at the orchestrator level:



When `retrieveParallel` returns chunks, check each `chunk.url` against `sourceCache`. If hit: replace `chunk.snippet` with the longer cached `content`. This gives the synthesizer richer text without an extra API call.



The implementation is in `layered-research.service.ts` — it pre-processes chunks before passing them to synthesis. No changes to `TavilyAdapter` or `enrichment.service.ts`.



---



## Hook



`src/hooks/useLayeredResearch.ts` (new file)



```typescript

export function useLayeredResearch(entities: MapEntity[], drawnGeometries: DrawnGeometry[]) {

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')

  const [progress, setProgress] = useState<{...} | null>(null)

  const [batchResults, setBatchResults] = useState<Record<string, EnrichmentResponse>>({})

  const [reviewQueue, setReviewQueue] = useState<string[]>([])   // entityIds with proposals

  const [cacheAdditions, setCacheAdditions] = useState<Array<{url: string; content: string}>>([])

  const abortRef = useRef<AbortController | null>(null)



  const run = useCallback(async (sourceCache: Map<string, string>) => { ... })

  const cancel = useCallback(() => { abortRef.current?.abort() })



  // Returns the EnrichmentResponse for a given entity, so the caller can load it

  // into the existing useEnrichment hook via loadBatchResult()

  const getResult = (entityId: string): EnrichmentResponse | null => batchResults[entityId] ?? null



  // Advance through the review queue

  const nextInQueue = reviewQueue[0] ?? null

  const advanceQueue = () => setReviewQueue(q => q.slice(1))



  return { status, progress, reviewQueue, nextInQueue, getResult, advanceQueue, run, cancel, cacheAdditions }

}

```



### Integration with existing `useEnrichment`



Add one new function to `useEnrichment.ts`:



```typescript

// Loads a pre-computed EnrichmentResponse directly into the enrichment UI state

// (skips the actual runEnrichment call). Used by layered research review flow.

const loadBatchResult = useCallback((response: EnrichmentResponse) => {

  setState(current => completeEnrichmentRun(current, response))

  setIsDrawerOpen(true)

}, [])

```



The review flow in the parent component:

1. `layeredResearch.nextInQueue` → `selectEntity(entityId)` → `enrichmentHook.loadBatchResult(layeredResearch.getResult(entityId))` → drawer opens with proposals

2. User accepts/rejects → closes drawer → `layeredResearch.advanceQueue()` → repeat



No new drawer component or proposal component needed.



---



## Files to Create / Modify



### New files

| File | Purpose |

|---|---|

| `src/services/research/layered-research.service.ts` | BFS orchestrator, cache logic, OSM unit-ID lookup |

| `src/hooks/useLayeredResearch.ts` | Batch run state, review queue |



### Modified files

| File | Change |

|---|---|

| `src/services/geopackage.service.ts` | Add `research_sources` table to `loadGeoPackage` (optional read) and `saveGeoPackage`; extend `GeoPackageLoadResult` with `sourceCache: Map<string, string>` |

| `src/services/enrichment/providers/openai.adapter.ts` | Add optional `synthesisModel` constructor param; update query-gen + synthesis system prompts (garrison only, source hierarchy) |

| `src/services/enrichment/providers/overpass.adapter.ts` | Add `searchByUnitId(unitId)` method |

| `src/services/enrichment/promptTemplate.ts` | Add garrison-only instruction + optional `poolHintUrls: string[]` param |

| `src/services/enrichment/providers/index.ts` | Export helper `createLayeredResearchProviderBundle()` that wires `gpt-4o` as synthesis model |

| `src/hooks/useEnrichment.ts` | Add `loadBatchResult(response)` method |



---



## Implementation Order



```

1. openai.adapter.ts         — add synthesisModel param + update prompts

2. overpass.adapter.ts       — add searchByUnitId()

3. promptTemplate.ts         — garrison focus + poolHintUrls

4. providers/index.ts        — createLayeredResearchProviderBundle()

5. geopackage.service.ts     — research_sources table

6. layered-research.service.ts — orchestrator (depends on 1-5)

7. useEnrichment.ts          — add loadBatchResult()

8. useLayeredResearch.ts     — hook (depends on 6-7)

```



Steps 1-5 are independent of each other and can be done in any order (or in parallel).



---



## Verification



1. **Prompt correctness**: After step 1, write a quick test (`openai.adapter.test.ts`) that asserts the synthesis system instructions contain "garrison" and "Wikipedia" and that the model string matches `gpt-4o`.



2. **Overpass unit-ID query**: After step 2, call `searchByUnitId("12345")` against the live Overpass sandbox and confirm no crash; a mock test can assert query shape.



3. **BFS order**: Unit test for `buildBfsLayers` — a 3-level entity tree should produce 3 layers in the correct parent-before-child order.



4. **Cache hit**: Unit test — pre-populate `sourceCache` with a URL that Tavily would return; assert the orchestrator uses cached content and `cacheAdditions` does not include that URL.



5. **End-to-end smoke**: Load `public/project.gpkg`, call `runLayeredResearch` with mocked providers (return 1 fixed response per entity), assert `results` has one entry per entity and `reviewQueue.length > 0` in the hook.



6. **Review flow**: Manually trigger layered research on a 2-entity project, confirm the existing drawer opens with proposals for each entity in parent-first order without code changes to the drawer component itself.

