# Coding Constraints & Conventions — Gabriel

## File & Folder Structure

```
src/
  components/
    inspector/          # EntityInspector, OsmObjectInspector, enrichment drawer
    enrichment/       # EnrichDrawer, ProposalCard, SourceTag
    map/                # MapView, SymbolsLayer, NetworkLinksLayer, draw tools
    shared/             # AppShell, MainLayout, LayersPanel, HierarchyPanel, dialogs
    tree/               # TreeView, MilitarySymbolNode
    ui/                 # Primitive shadcn/Radix components (button, input, tabs…)
  hooks/                # Custom React hooks
  pages/                # EditPage, ViewPage (the only files that do GeoPackage I/O)
  services/
    enrichment/         # AI enrichment pipeline (adapters, validators, prompts, schema)
      providers/        # openai.adapter, tavily.adapter, overpass.adapter, cached-content.adapter
    research/           # Layered batch research service
  store/                # Pure reducer functions (enrichment.store.ts); Zustand stores after Phase 1
  types/                # TypeScript domain type definitions
  utils/                # Pure utility functions (geometry, entityLayer, osmLocalSearch)
```

No file in `services/` or `utils/` may import from React. These are pure functions / async
functions with no side effects.

## Naming Conventions

- **Files**: `kebab-case.ts` for utilities and services; `PascalCase.tsx` for React components.
- **Hooks**: prefix `use`; filename matches the exported hook name (e.g. `useEnrichment.ts`).
- **Stores (after Phase 1)**: `use<Domain>Store.ts` in `src/store/`
  (e.g. `useProjectStore.ts`, `useEnrichmentStore.ts`).
- **Types**: PascalCase for interfaces and type aliases.
- **Domain boundary**: `MapEntity` (UI / runtime) vs `GpkgEntity` (GeoPackage / DB).
  Use `MapEntity` everywhere except inside `geopackage.service.ts`.
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **No default exports** for named components. Use named exports.

## Architecture Patterns

**Coordinate convention**
- Internal app: `[lat, lng]` — Leaflet convention. This is the only coordinate order used in
  components, hooks, utilities, and the Zustand store.
- GeoJSON / GeoPackage: `[lng, lat]` — WGS-84 / GeoJSON standard.
- Conversion happens **only** in `geopackage.service.ts` at the read/write boundary.
- After Phase 8: enforce with branded types (`LatLng` vs `LngLat`) from `src/types/coordinates.ts`.

**Pure reducers**
- State transitions for enrichment live in `store/enrichment.store.ts` as pure functions with
  no React imports and no side effects. They are tested in isolation.

**No prop drilling past one level**
- After Phase 4: components read data directly from the Zustand project store.
- Props are used only for component-specific configuration (`readOnly`, callbacks specific to
  that component's context) or for hook outputs (`enrichment`, `layeredResearch`).

**GeoPackage I/O stays in page components**
- `EditPage` owns all GeoPackage open/save logic and IndexedDB session management.
- `ViewPage` owns the demo project fetch.
- No component below the page level may call `loadGeoPackage` or `saveGeoPackage`.

**Zustand selectors must be granular**
- Never select the entire store root in a leaf component.
- Subscribe only to the slice the component uses. Use `shallow` equality for object selectors.

## Error Handling

- Async functions in pages catch errors and surface them via a local `useState<string | null>`
  that feeds the error banner in `AppShell`.
- Service functions throw typed errors with a message prefix (e.g. `"geopackage: ..."`,
  `"enrichment: ..."`).
- `AbortError` from cancelled fetch / enrichment runs is caught and handled silently.
- Overpass failures are non-fatal: log to console and push a toast via `ToastStack`. Never
  set a ref that silently suppresses all future Overpass calls — reset the flag on cleanup.
- Enrichment synthesis failure fails the entire run (no partial recovery); the error message
  is surfaced in the EnrichDrawer status bar.

## Testing Requirements

- **Enrichment store** (`store/enrichment.store.ts`): 100 % branch coverage.
- **Enrichment services** (`services/enrichment/`): unit tests for all public functions.
- **Layered research** (`services/research/`): unit tests for BFS ordering and skip logic.
- **GeoPackage round-trip**: integration test in `services/geopackage.service.test.ts`
  (required before Phase 8 coordinate changes).
- **Test runner**: Vitest only. No Jest.
- **Storybook stories** required for: `EntityInspector`, `EnrichDrawer`, `OsmObjectInspector`,
  `GeometryActionMenu`, `NetworkLinksLayer` (with 500-entity fixture for performance testing).
- No mocking of the GeoPackage library in integration tests — use real WASM execution.

## Code Style

- Max **300 lines** per file. Files approaching this limit should be split by concern.
- No `any` type. Use `unknown` + type narrowing.
- Exported functions must have explicit return types.
- `useCallback` and `useMemo` are required when the result is:
  - passed as a prop to a memoised child, or
  - used as a `useEffect` dependency.
- Import order (enforced by ESLint): React → third-party → `@/` alias → relative.
- No comments explaining *what* the code does. Comments explain *why* (a hidden constraint,
  a workaround, a non-obvious invariant).

## Security Rules

- API keys (OpenAI, Tavily) stored only in `localStorage`. Never log them. Never include them
  in error messages or thrown errors.
- No `eval`. No `dangerouslySetInnerHTML` except for pre-computed SVG strings from milsymbol
  (which generates its own sanitised output).
- GeoPackage files are parsed entirely in the browser. No file contents are transmitted to
  any server.
- The `window.confirm` / `window.alert` pattern is acceptable for destructive action
  confirmation (delete entity, delete layer) — do not replace with custom modals unless it
  adds clear UX value.

## Performance Guidelines

- `computeAllEntityPositions` (orbital BFS) must be called inside a `useMemo` keyed on
  `[entities, drawnGeometries]`. Never move it into render-time logic.
- `NetworkLinksLayer` BFS traversal must be inside `useMemo([entities, selectedEntityId])`.
- `SymbolsLayer` icon cache (`useRef<Map>`) prevents re-creating Leaflet `DivIcon` objects.
  Keep stale key cleanup on every render.
- After Phase 5/6: Zustand selectors in map components must return stable references.
  Use `shallow` equality for object/array selectors to avoid spurious re-renders.
- OSM GeoJSON layer features should only re-render when `layer.osmData` reference changes
  (ensured by store `immutable update` pattern — always return new objects from actions).

## Git Conventions

- Commit message: imperative mood, present tense. Example: `"Add Zustand project store"` not
  `"Added project store"`.
- Branch naming: `phase/<N>-<short-description>` for refactoring work
  (e.g. `phase/1-zustand-store`, `phase/8-coordinate-safety`).
- Each phase ends with a working build (`npm run build` passes) and passing tests
  (`npm test` passes). No half-finished phases committed to `main`.

## Documentation Rules

- Update the relevant `/docs/` file whenever an architectural decision changes.
- Do not duplicate content across docs files (the hook enforces this).
- JSDoc on exported functions is required only when the type signature alone does not convey
  intent (e.g. non-obvious parameter constraints, side-effect warnings).
