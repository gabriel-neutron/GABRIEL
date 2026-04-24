# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run test         # Run all tests (Vitest, single pass)
npm run test:watch   # Vitest in watch mode
npm run storybook    # Storybook on port 6006
```

Path alias `@/` maps to `src/` (configured in `vite.config.ts`).

## Architecture

This is a React + Vite SPA for military map editing (ORBAT / order of battle). Projects are stored as **GeoPackage** (`.gpkg`) files, loaded and saved in-browser using `@ngageoint/geopackage` (WASM-backed SQLite).

### Data model

Three persisted tables inside every GeoPackage:

| Table | Type alias | Description |
|---|---|---|
| `units` | `MapEntity` / `GpkgEntity` | Entities (military units) with symbol, affiliation, notes, sources |
| `layers` | `Layer` / `GpkgLayer` | Display layers (echelon, custom, or OSM overlay) |
| `geometries` | `DrawnGeometry` / `GpkgGeometry` | Points, lines, polygons linked to a layer and optionally an entity |

`MapEntity` uses camelCase (UI), `GpkgEntity` uses snake_case (DB). `sources` is a newline-delimited string of URLs. `osmRelationId` links to an OSM multipolygon; `militaryUnitId` stores a military unit number/code.

### State management

All project state lives in `useMapProjectState` (layers, entities, geometries, selection, OSM overlays). GeoPackage I/O and mutations stay in the page components (`EditPage`, `ViewPage`). There is no global Redux/Zustand store for project data — it flows via props from the page down to `MainLayout`.

Enrichment UI state is managed by a pure reducer in `src/store/enrichment.store.ts` (no external library), with `useEnrichment` as the hook that ties it to a selected entity.

### Enrichment pipeline

`src/services/enrichment/` is the AI enrichment subsystem:

- **`enrichment.service.ts`** — `runEnrichment(request, options)` orchestrates multi-hop retrieval and synthesis. Returns `{ response: EnrichmentResponse, usage }`. Hard limits: 3 hops, 55 s, ~24k estimated tokens.
- **`providers/openai.adapter.ts`** — `OpenAIModelAdapter` implements `AiModelAdapter`. Calls OpenAI `/v1/responses` for query generation (`gpt-4.1-mini`) and synthesis (same model). Both methods use hardcoded system instructions focused on HQ/garrison evidence.
- **`providers/tavily.adapter.ts`** — `TavilyAdapter` wraps Tavily search API.
- **`providers/overpass.adapter.ts`** — `OverpassAdapter` queries Overpass for OSM military nodes by name.
- **`providers/index.ts`** — `createDefaultProviderBundle()` wires the three adapters together.
- **`promptTemplate.ts`** — `buildDefaultEnrichmentPrompt(feature, context)` builds the user-facing prompt string passed into `runEnrichment`.
- **`schema.fixtures.ts`** — `DEFAULT_ENRICHMENT_OUTPUT_SCHEMA` (four allowed fields: `notes`, `sources`, `militaryUnitId`, `osmRelationId`) and budget constants.

The hook `useEnrichment` (`src/hooks/useEnrichment.ts`) drives the single-entity enrichment flow. It converts a `MapEntity` to an `EnrichmentFeature` (GeoJSON), calls `runEnrichment`, and exposes accept/reject/ignore handlers that mutate `EnrichmentUiState` via store functions. Results land in `state.run`; accepted values are staged in `state.overlay` and applied to the entity on drawer close via `onApplyAccepted`.

### Map rendering

`react-leaflet` with `leaflet.markercluster`. Military symbols are rendered via `milsymbol` (NATO SIDC). `SymbolsLayer` and `NetworkLinksLayer` consume a `positionMap` (entityId → lat/lng) derived from `drawnGeometries`. OSM relation geometries are fetched lazily in `useMapProjectState` via `fetchRelationGeometry`.

### Terminology

Use "entity" in UI code, not "unit". "Unit" appears only in GeoPackage schema (`units` table, `GpkgEntity`) for database compatibility.
