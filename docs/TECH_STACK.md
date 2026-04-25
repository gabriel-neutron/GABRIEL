# Technology Stack — Gabriel

## Frontend

| Concern | Library | Version |
|---|---|---|
| Framework | React | ^19.2 |
| Build tool | Vite | ^7.3 |
| Language | TypeScript (strict) | ~5.9 |
| Styling | Tailwind CSS v4 | ^4.1 |
| Component primitives | Radix UI | ^1.4 |
| Icons | Lucide React | ^0.568 |
| Map engine | Leaflet | ^1.9 |
| Map React bindings | react-leaflet | ^5.0 |
| Marker clustering | react-leaflet-cluster | ^4.1 |
| Draw tools | leaflet-draw | ^1.0 |
| Military symbols | milsymbol (NATO MIL-STD-2525) | ^3.0 |
| Geospatial utils | @turf/turf | ^7.3 |
| Flow diagrams | reactflow | ^11.11 (currently unused in UI) |
| Class utilities | clsx + tailwind-merge | ^2.1 / ^3.4 |

## State Management

**Current:** `useState` in `useMapProjectState` hook, passed via 30+ props to `MainLayout`.

**Target (Phase 1–6):** Zustand.

### Rationale

Three options were evaluated:

| Option | Re-render behaviour at 1 000+ entities | Verdict |
|---|---|---|
| React Context | Every context consumer re-renders on any state change. With entities, layers, and selection in one context this means `LayersPanel`, `HierarchyPanel`, `SymbolsLayer`, and `NetworkLinksLayer` all re-render together on a simple selection click. | Rejected |
| Zustand | Selector-based subscriptions: each component re-renders only when its subscribed slice changes. Shallow equality built in. DevTools via middleware. 1 kB. | **Chosen** |
| Redux Toolkit | Mature and debuggable, but adds 15 kB + createSlice / thunk boilerplate with no additional benefit for a single-page local app. | Rejected |

Zustand's API maps directly to the existing `useState` pattern, making migration incremental
(one action at a time). The existing pure-reducer pattern in `enrichment.store.ts` maps cleanly
to a Zustand action.

## GeoPackage / Data

| Concern | Choice |
|---|---|
| GeoPackage read/write | `@ngageoint/geopackage` ^4.2.6 — WASM-backed SQLite, runs entirely in the browser |
| Session persistence | Browser IndexedDB via `projectStorage.service.ts` |
| Internal coordinate order | `[lat, lng]` — Leaflet convention |
| GeoJSON / storage coordinate order | `[lng, lat]` — GeoJSON / WGS-84 convention |
| Coordinate conversion | Only in `geopackage.service.ts` at the read/write boundary |
| OSM geometry parsing | `osmtogeojson` ^3.0.0-beta.5 |

## AI / Enrichment

| Concern | Provider | Auth |
|---|---|---|
| LLM (query generation + synthesis) | OpenAI API (`gpt-4.1-mini` / `gpt-4o`) | User-supplied key in `localStorage` |
| Web search | Tavily API | User-supplied key in `localStorage` |
| OSM military lookup | Overpass API | Public — no key required |

Keys are stored **only** in `localStorage`, keyed by domain. They are read at enrichment
runtime and never transmitted to any Gabriel server.

## Dev Tools

| Tool | Purpose | Version |
|---|---|---|
| Vitest | Unit and integration tests | ^4.1 |
| Storybook | Component isolation and visual testing | ^10.2 |
| ESLint + typescript-eslint | Static analysis | ^9.39 / ^8.48 |
| shadcn CLI | Scaffold Radix-based UI components | ^3.8 |
| Vite preview | Local preview of production build | (via Vite) |

## Infrastructure

- Deployed as a fully static site (`vite build` → `dist/`).
- `public/project.gpkg` is a bundled demo file that `ViewPage` fetches at runtime.
- No server-side code, no environment variables in the production build.
- All configuration (API keys, last-seen flags) is stored in `localStorage`.

## Alternatives Considered

**Mapbox GL JS** — Rejected. Requires a billable API key for tile serving, larger bundle, and
a licence less suited to local-first OSINT use.

**SWR / React Query** — Rejected. The app has no remote data fetching beyond direct API calls
in the enrichment pipeline. No need for a caching layer.

**Electron / Tauri** — Considered for native file access. Rejected for now — the File System
Access API covers the save use case, and a browser-only deployment is simpler to share.
