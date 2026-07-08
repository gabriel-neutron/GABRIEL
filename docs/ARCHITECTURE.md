# Architecture — Gabriel

> **Scope:** this document describes the code **as it is today** (the type-first layout, mid-reorg).
> The *target* architecture — `core / shell / modules`, generic `Entity` + `Profile`, first-class
> `Source` / `Claim` — lives in the ADRs ([0003](adr/0003-local-first-self-hosted.md)–[0006](adr/0006-source-claim-first-class-model.md))
> and the migration sequence in [`timelines/ROADMAP.md`](timelines/ROADMAP.md). Update this file as
> each Stream-1 step lands, so it never describes an architecture the code does not have.

## Component Tree

```
App
├── AboutDialog
├── ViewPage                (read-only; fetches /public/project.gpkg)
│   └── MainLayout (readOnly=true)
└── EditPage                (full editing; GeoPackage I/O, enrichment orchestration)
    └── MainLayout (readOnly=false)
        ├── AppShell
        │   ├── header slot
        │   │   ├── ShowNetworksToggle
        │   │   ├── BaseMapSwitcher
        │   │   ├── OsmQueryMenu
        │   │   └── "Research all" button
        │   ├── left slot (tab-switched)
        │   │   ├── LayersPanel
        │   │   └── HierarchyPanel
        │   ├── map slot
        │   │   └── MapView
        │   │       ├── SymbolsLayer       (NATO symbols, icon cache)
        │   │       ├── NetworkLinksLayer  (parent-child polylines, BFS)
        │   │       ├── CenterOnSelection  (flyTo + popup on select)
        │   │       ├── DrawControls       (leaflet-draw toolbar)
        │   │       └── OSM GeoJSON layers (entity relation boundaries)
        │   ├── tree slot
        │   │   └── TreeView
        │   └── right slot
        │       ├── EntityInspector
        │       └── OsmObjectInspector
        ├── EnrichDrawer    (fixed overlay; controlled by useEnrichment)
        └── ResearchDialog  (modal; controlled by useLayeredResearch)
```

---

## Current Data Flow

```
useProjectStore (Zustand)
  ← EditPage: bulk load on file open / session restore
  ← ViewPage: bulk load on demo file fetch
  ← Components: direct action calls (updateEntity, deleteGeometry, layer visibility, selection)

MainLayout props
  readOnly, onOpenAbout, onSwitchToEdit/View, projectFileActions (edit mode only), busy, error,
  enrichment (hook output), layeredResearch (hook output)

Child components subscribe directly to store slices:
  MapView, LayersPanel, HierarchyPanel, TreeView, EntityInspector,
  ShowNetworksToggle, BaseMapSwitcher
```

---

## GeoPackage I/O Boundary

```
File on disk (.gpkg)
  ↓  useProjectIO.handleOpen()     →  loadGeoPackage(ArrayBuffer)
  ↓  applyGeoPackageResult(result) →  { layers, entities, drawnGeometries }
  ↓  store.setProject(...)         →  Zustand project store

  ↑  useProjectIO.handleSave()     →  selectPersistableSnapshot(store) → reads non-OSM data
  ↑  saveGeoPackage(layers, entities, organisations, geometries, sourceCache)
  ↑  writeGeoPackageToFile(bytes)  →  File System Access API / <a download>

Session cache (IndexedDB)
  ↓  loadProject()                 →  ArrayBuffer  →  same load path as above (restoreSession)
  ↑  saveProject(buffer)           →  called after every successful save
  ↑  clearProject()                →  called on "New project"
```

GeoPackage I/O lives only in `useProjectIO` (used by `EditPage`) and inline in `ViewPage`
(read-only fetch of `/project.gpkg`). No component or hook below these may trigger
GeoPackage I/O.

`selectPersistableSnapshot` (in `useProjectStore.ts`) is the single source of truth for what
data gets written to disk: non-OSM entities and geometries, with names trimmed, and layer
`kind` normalized (inferred as `"osm"` when unset but `osmData` is cached).

---

## Coordinate Contract

| Context | Order | Type (after Phase 8) |
|---|---|---|
| Internal app, Leaflet, Zustand store | `[lat, lng]` | `LatLng` (branded) |
| GeoJSON, GeoPackage storage | `[lng, lat]` | `LngLat` (branded) |

Conversion happens **only** in `src/core/persistence/geopackage/` (specifically `geometries.table.ts`):
- `readGeometries` → wraps parsed GeoJSON coordinates in `toLeafletCoord([lng, lat]): LatLng`
- `saveGeoPackage` → converts before write with `toGeoJsonCoord(pos: LatLng): LngLat`

File: `src/core/coordinates/index.ts` (created in Phase 8):
```ts
export type LatLng  = [number, number] & { readonly [__lat_lng_brand]: true }
export type LngLat  = [number, number] & { readonly [__lng_lat_brand]: true }
export function toLeafletCoord(c: [number, number]): LatLng   // [lng,lat] → [lat,lng]
export function toGeoJsonCoord(c: LatLng): LngLat              // [lat,lng] → [lng,lat]
export function asLatLng(lat: number, lng: number): LatLng
```

---

## Entity Positioning

`computeAllEntityPositions` (in `src/core/map/geometry.ts`) derives a `Map<entityId, LatLng>`
from `entities` and `drawnGeometries`:

1. **Pinned entities** (`positionMode === "own"`): position = first geometry's representative
   point (point coords, line first vertex, polygon first ring first vertex).
2. **Orbiting entities** (`positionMode === "none"` or unset): BFS from pinned ancestors.
   Children circle their parent at `BASE_RADIUS × CHILD_SCALE^(depth-1)`, corrected for
   latitude distortion. Angle = `2π × siblingIndex / siblingCount`.

This function is always called inside `useMemo([entities, drawnGeometries])` in `MapView`.
Never call it at render time.

---

## Session Persistence

- **Auto-save**: `saveProject(ArrayBuffer)` is called by `EditPage.handleSaveProject` after
  every explicit user save. Writes the `.gpkg` bytes to IndexedDB.
- **Restore**: `loadProject()` is called once on `EditPage` mount. If bytes exist, they are
  passed through `loadGeoPackage` and hydrate the store; IndexedDB failures are surfaced to the
  page error banner instead of being silently ignored.
- **Reset**: `clearProject()` is called by `handleNewProject` to wipe the IndexedDB entry.
- The IndexedDB cache and the `.gpkg` file on disk are kept in sync by the save flow —
  there is no background auto-save that could diverge from the user's explicit save.

---

## AI Enrichment Pipeline

```
User clicks "Enrich with AI"
  → useEnrichment.openDrawer()
  → buildDefaultEnrichmentPrompt(entity, context)   [promptTemplate.ts]
  → useEnrichment.run()
    → runEnrichment(request, options)                [enrichment.service.ts]
        For each hop (max 3, budget 55 s / 24 k tokens):
          → OpenAIModelAdapter.generateQueries()     [openai.adapter.ts, gpt-4.1-mini]
          → TavilyAdapter.search() (parallel)        [tavily.adapter.ts]
          → CachedContentAdapter.fetch() (parallel)  [cached-content.adapter.ts]
          If confidence >= 0.5 OR last hop:
            → OpenAIModelAdapter.synthesize()        [openai.adapter.ts, gpt-4.1-mini]
        → EnrichmentResponse { proposals[], unresolvedFields[], queryTrace[] }
  → enrichment.store reducers update EnrichmentUiState
  → EnrichDrawer renders proposals
  → User accepts / rejects / ignores each proposal
  → useEnrichment.closeDrawer() → onApplyAccepted() → store.updateEntity()
```

**Batch flow** (`useLayeredResearch`):
```
User clicks "Research all" → ResearchDialog → run()
  → runLayeredResearch(entities, options)            [layered-research.service.ts]
      buildBfsLayers(entities) → [[roots], [depth-1 children], …]
      For each entity (BFS order):
        Skip if: already processed | rich enough | recently analyzed
        → runEnrichment(entity, …)
        → onEntityComplete(entityId, result) → researchProgress.store markEntityCompleted(...)
        → reviewQueue.push(entityId) if has proposals
  → User steps through reviewQueue via EnrichDrawer
```

All status/queue/usage writes for the batch flow through `researchProgress.store.ts` pure transition functions.

---

## Key Invariants

1. GeoPackage I/O lives only in `useProjectIO` (called by `EditPage`) and inline in `ViewPage`. No component or hook below these may trigger GeoPackage I/O.
2. API keys (OpenAI, Tavily) never appear in logs, error messages, or thrown strings.
3. `enrichment.store.ts` pure reducer functions have no React imports.
4. `computeAllEntityPositions` is always inside a `useMemo`.
5. `NetworkLinksLayer` BFS is always inside a `useMemo`.
6. Coordinate order `[lat, lng]` is the only representation in the Zustand store,
   components, and utility functions.
7. `[lng, lat]` appears only inside `src/core/persistence/geopackage/`.
8. `researchProgress.store.ts` pure transition functions have no React imports.
