# Gabriel

Local-first military mapping app: annotate units and geometries on a map, link to OSM, and export to GeoPackage.

## Stack

React 19, TypeScript, Vite, Leaflet, React Flow, shadcn/ui. GeoPackage via `@ngageoint/geopackage` (browser). NATO symbols via milsymbol.

## Run

```bash
npm install
npm run dev
```

Open the URL shown (e.g. http://localhost:5173). No backend; everything runs in the browser.

## AI enrichment setup (v2.1)

AI enrichment runs inside the frontend app (no local API server, no `.env` required).

Use the `AI keys` button in the top bar to store provider keys in browser local storage:
- OpenAI API key
- Gemini API key
- Brave API key

Notes:
- Keys are persisted per browser/domain and survive page changes and multi-day sessions (Netlify compatible).
- If keys are missing, enrichment runs in degraded mode with deterministic fallback behavior.
- Retrieval providers can fail due to CORS/rate limits. The UI shows explicit errors and unresolved fields.
- Accepting proposals updates session overlay state only; authoritative GeoPackage data changes only when you use the existing Save flow.

## Build

```bash
npm run build
```

## Tests

```bash
npm run test
```

Output in `dist/`. Serve with any static host.

## Features

- Load/save project as GeoPackage; optional IndexedDB auto-save.
- Echelon + custom + OSM layers; draw points, lines, polygons.
- Units (entities) with hierarchy; MIL-STD-2525 symbols; link to OSM relations.
- Read-only hierarchy tree; search (Nominatim) and Overpass OSM layer.

## Project layout

- `src/components/` — map, inspector, tree, shared, ui (shadcn).
- `src/services/` — geopackage, symbol, overpass, nominatim, projectStorage.
- `src/types/` — domain and symbol types (including echelon options).
- `src/lib/` — `cn()` and tooling; `src/utils/` — pure helpers (e.g. geometry).
