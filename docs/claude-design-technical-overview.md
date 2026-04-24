# Technical Overview (for Claude Design)

## Project Intent and Operating Model
- Client-side cartographic platform to map military order of battle entities and linked geometries.
- Two operating modes:
  - `View` mode (guest/read-only): loads a bundled demo GeoPackage (`/project.gpkg`) and disables all mutations.
  - `Edit` mode (contributor): allows project load/save, layer/entity/geometry editing, and research/enrichment workflows.
- Persistence model:
  - Authoritative project data is stored in GeoPackage (`.gpkg`).
  - Last opened project is also cached in browser storage for session restore.

## Runtime Architecture (inferred from code)
- Frontend stack:
  - React + TypeScript + Vite SPA.
  - Leaflet (`react-leaflet`) for map rendering.
  - React Flow-based tree visualization for hierarchy browsing.
- Core architectural split:
  - UI components: map, hierarchy/tree, inspectors, dialogs.
  - State hook: shared project state (`layers`, `entities`, `drawnGeometries`, selection, map options).
  - Data service: GeoPackage read/write and schema mapping.
  - Domain services: symbol generation + OSM query helpers + enrichment/research pipeline.
- No backend is required for core map editing/storage; project files are read/written in browser.

## Data Model and Persistence
- Primary logical objects:
  - `layers`: display grouping and visibility control (`echelon`, `custom`, optional `osm` overlay layer).
  - `units` (UI term: entities): military entities with parent-child hierarchy.
  - `geometries`: point/line/polygon geometries linked to layers and optionally to entities.
- Key unit/entity attributes in schema:
  - Identity/name, `layer_id`, `parent_id` (hierarchy), military descriptors (`type`, `echelon`, `affiliation`, `domain`),
  - optional references (`osm_relation_id`, `military_unit_id`),
  - notes/sources, and position confidence flags (`position_mode`, `is_exact_position`).
- GeoPackage integration:
  - Reads/writes `layers`, `units`, and spatial `geometries` tables.
  - Also stores `research_sources` cache table (URL -> content snippet + timestamp).
  - Enforces referential consistency checks on load (missing parent/layer references trigger schema errors).

## UI Logic and Interaction Model
- Main UI areas:
  - Map view for geometry visualization/editing.
  - Left panel with tabs:
    - layer management,
    - hierarchy panel ("Army") with visibility toggling across descendants.
  - Right inspector:
    - entity inspector or selected OSM object inspector.
- Selection behavior:
  - Selecting entity clears OSM selection, and vice versa.
  - Detail panels reflect current selection.
- Edit-mode capabilities:
  - Create/remove/rename/reorder layers (with restrictions on echelon base layers),
  - create entities from geometries,
  - link/unlink/delete geometries and entities,
  - save/open/new project operations.
- View-mode constraints:
  - All mutation handlers replaced by no-op handlers.
  - File actions disabled; map and inspectors used for exploration only.

## Method Used to Build and Maintain Order of Battle (inferred)
- Structural methodology:
  - Order of battle represented as explicit parent-child graph (`parent_id`) and visualized as hierarchy/tree.
  - Supports top-down military echelons (army -> division/brigade -> regiment/group -> battalion and below).
- Spatial methodology:
  - Entities can have direct geometries (own position) or inherited/uncertain positioning (`position_mode`).
  - OSM relation links can anchor entity context to known military objects.
- Layer methodology:
  - Echelon layers provide baseline categorization.
  - Additional OSM overlay layer(s) can cache external GeoJSON for context.

## Data Collection, Processing, and Integration Workflow
- Manual/editor-driven capture:
  - Contributors can enter/update entity metadata, sources, notes, hierarchy links, and map geometries.
  - Sources are stored per entity as newline-delimited citations.
- Assisted/automated enrichment (available in app):
  - Single-entity "Enrich with AI" workflow proposes updates for selected fields (notes, sources, military unit ID, OSM relation ID).
  - Batch "Research all" workflow processes entities by BFS layers (parents before children), with skip rules for already-rich entities.
  - Uses retrieval + synthesis adapters (OpenAI + Tavily + Overpass) and tracks estimated token usage/caching.
  - Proposed changes require user acceptance/rejection in UI before being applied.
- Integration principle:
  - Enrichment outputs are staged as proposals; final authoritative data only updates after explicit review actions.

## Automation vs Manual Work Split (only what is observable)
- Manual:
  - Core ORBAT modeling decisions (entity creation, hierarchy structure, geometry editing, final acceptance of proposed edits).
  - Layer organization and selective visibility decisions.
- Automated / semi-automated:
  - Query generation and retrieval for enrichment.
  - Batch traversal order (BFS), progress tracking, source cache reuse.
  - Optional OSM lookup suggestions from unit IDs.
- Not observable from repository alone:
  - Exact external source corpus used for initial dataset curation.
  - Team workflow/roles and any process outside the application UI.

## Known Constraints and Caveats
- Context here is limited to repository code and bundled dataset structure.
- Source reliability scoring model is implied by enrichment prompts/prioritization rules, but no explicit quantitative confidence model is persisted in schema.
- External APIs (OpenAI/Tavily/Overpass) are used for enrichment assistance, not required to view the packaged dataset.
