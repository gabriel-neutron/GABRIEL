# CLAUDE.md

This file provides guidance to **Claude Code** (claude.ai/code) when working in this repository.

**Start here for commands, CI gates, and agent workflow:** [AGENTS.md](AGENTS.md)  
**For planning-doc scope:** use [docs/README.md](docs/README.md) as the canonical index (Telegram PRD is opt-in only).

## Commands

```bash
npm run dev          # Start Vite dev server
npm run verify       # lint + test (with coverage) + build — use before claiming done
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run test         # Vitest, single pass
npm run test:coverage # Vitest with coverage (thresholds in vitest.config.ts)
npm run test:watch   # Vitest in watch mode
npm run storybook    # Storybook on port 6006
```

Path alias `@/` maps to `src/` (configured in `vite.config.ts`).

## Architecture (summary)

This is a React + Vite SPA for military map editing (ORBAT). Projects are stored as **GeoPackage** (`.gpkg`) files, loaded and saved in-browser using `@ngageoint/geopackage` (WASM-backed SQLite).

### Data model

Three persisted tables inside every GeoPackage:

| Table | Type alias | Description |
|---|---|---|
| `units` | `MapEntity` / `GpkgEntity` | Entities (military units) with symbol, affiliation, notes, sources |
| `layers` | `Layer` / `GpkgLayer` | Display layers (echelon, custom, or OSM overlay) |
| `geometries` | `DrawnGeometry` / `GpkgGeometry` | Points, lines, polygons linked to a layer and optionally an entity |

`MapEntity` uses camelCase (UI), `GpkgEntity` uses snake_case (DB). `sources` is a newline-delimited string of URLs. `osmRelationId` links to an OSM multipolygon; `militaryUnitId` stores a military unit number/code.

### State management

Runtime project state (layers, entities, drawn geometries, selection, OSM overlays, etc.) lives in the Zustand store **`useProjectStore`** ([`src/store/useProjectStore.ts`](src/store/useProjectStore.ts)). GeoPackage load/save and IndexedDB session persistence stay in [`src/pages/EditPage.tsx`](src/pages/EditPage.tsx) and [`src/pages/ViewPage.tsx`](src/pages/ViewPage.tsx); components read/write the store directly per [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Enrichment UI state uses a pure reducer in [`src/store/enrichment.store.ts`](src/store/enrichment.store.ts) with [`src/hooks/useEnrichment.ts`](src/hooks/useEnrichment.ts).

### Enrichment pipeline

See [AGENTS.md](AGENTS.md) for paths. Implemented providers: **OpenAI** (queries + synthesis), **Tavily** (web search), **CachedContentAdapter** (layered research), **Overpass** (OSM lookup from layered research). Default bundle wiring: [`src/services/enrichment/providers/index.ts`](src/services/enrichment/providers/index.ts).

### Map rendering

`react-leaflet` with `leaflet.markercluster`. Military symbols via milsymbol (NATO SIDC). `SymbolsLayer` and `NetworkLinksLayer` consume a `positionMap` from `drawnGeometries`. Coordinate order: internal [`LatLng`](src/types/coordinates.ts); GeoPackage storage [`LngLat`](src/types/coordinates.ts); conversion in [`src/services/geopackage.service.ts`](src/services/geopackage.service.ts). OSM relation geometries: [`src/hooks/useOsmRelationGeometries.ts`](src/hooks/useOsmRelationGeometries.ts).

### Terminology

Use **entity** in UI code, not **unit**. **Unit** appears only in GeoPackage schema (`units` table, `GpkgEntity`).
