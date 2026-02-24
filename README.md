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

## Build

```bash
npm run build
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

## License

See repository.
