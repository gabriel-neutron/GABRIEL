# Product Requirements Document — Gabriel

## Problem Statement

Military analysts, OSINT practitioners, and military historians need to build, visualise, and
annotate hierarchical military unit structures (ORBATs — Orders of Battle) on a map without
relying on a cloud service that could expose sensitive research or require expensive GIS licences.

Existing options either leak data to third-party servers, lack AI-assisted enrichment from public
sources, or require desktop GIS software not suited to web publishing. Gabriel is a local-first
browser application: all project data stays on the user's machine (a `.gpkg` file on disk, plus an
IndexedDB session cache). AI enrichment calls go directly from the browser to OpenAI and Tavily
using API keys the user supplies themselves — no Gabriel server ever touches the data.

## Target Users

**Primary — OSINT analysts and military researchers**
Build open-source ORBATs from public evidence (e.g. tracking ground forces, documenting historical
orders of battle). Need: fast entity creation, hierarchy visualisation, source citation tracking,
AI-assisted enrichment from web sources, and export to a portable GIS format.

**Secondary — Wargame designers and educators**
Build illustrative ORBAT scenarios for games, training, or teaching. Need the map canvas and
entity editor; do not require AI enrichment.

**Read-only audience — Published viewers**
Analysts who want to share a snapshot of their work. They access the deployed read-only view
(`ViewPage`) — no editing, no API keys needed.

## Core Features (current state)

1. **Map canvas** — Leaflet map, selectable base tiles (OSM, satellite, topo). Entities rendered
   as NATO MIL-STD-2525 symbols via milsymbol.
2. **ORBAT editor** — Create, rename, delete entities. Assign echelon, type, affiliation, domain.
   Link parent/child relationships to build a command hierarchy.
3. **Layers panel** — Echelon layers (auto-generated), custom layers, OSM overlay layers.
   Per-layer visibility toggle, rename, reorder, delete.
4. **GeoPackage I/O** — Open and save `.gpkg` files (NGA standard). Session auto-restored from
   IndexedDB on reload.
5. **OSM integration** — Query Overpass API to load OSM features as overlay layers. Inspect
   nodes/ways/relations. Fetch relation boundaries for military bases linked to entities.
6. **AI enrichment (single entity)** — Send the selected entity to OpenAI + Tavily; receive
   structured field proposals (name, notes, sources, osmRelationId, militaryUnitId); accept,
   reject, or ignore each proposal before applying.
7. **Layered batch research** — BFS traversal of the command tree; enrich all entities in
   parent-first order; incremental review queue for accepting results.
8. **Read-only view mode** — The deployed app always serves a read-only map loaded from
   `public/project.gpkg`. Required to remain accessible in the deployed build.

## User Stories

- As an analyst, I can open a `.gpkg` file to continue a previous session so I never lose work.
- As an analyst, I can save a `.gpkg` file with all entities, geometries, and source cache so I
  can share a snapshot with colleagues.
- As an analyst, I can draw a point on the map to immediately create an entity and assign it to
  the selected parent so the hierarchy is built spatially.
- As an analyst, I can run "Research all" to enrich all entities in BFS order and step through
  each proposal without leaving the app.
- As a viewer, I can see the deployed read-only map without an account or API key so I can
  inspect shared findings publicly.
- As an analyst, I can enter my own OpenAI and Tavily API keys so the app never sends my keys
  to any server other than those two providers.

## Success Criteria

- 1 000+ entities render on the map canvas without perceptible jank (target: < 16 ms per frame).
- GeoPackage save and reload round-trips losslessly for all domain fields (coordinates, names,
  hierarchy, sources, enrichment timestamps).
- AI enrichment proposals apply to the correct entity field in 100 % of accepted proposals.
- View mode loads `public/project.gpkg` and renders the map within 5 s on a warm network.
- No entity, geometry, or source data is transmitted to any server other than OpenAI and Tavily
  (and only when the user explicitly triggers enrichment).

## Out of Scope (current version)

- User authentication or multi-user collaboration.
- Backend server or database.
- Mobile / touch-optimised UI.
- Export to formats other than GeoPackage (KMZ, Shapefile, GeoJSON bulk export are future work).
- Offline-first PWA service worker.
- Real-time map sharing or synchronisation.

## Open Questions

- Should view mode become a distinct deployment route (e.g. `/view` or a separate Vite entry
  point) to make permalink sharing easier, rather than an in-app toggle?
- Should the enrichment country/region focus (currently implicit in the OpenAI system prompt)
  become a per-project setting exposed in the UI?
- Should `reactflow` (currently in `package.json`) be wired into any user-facing feature, or
  should it be removed to reduce bundle size?
