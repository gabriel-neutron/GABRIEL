# Coding Constraints & Conventions — Gabriel

## File & Folder Structure

Gabriel uses a **feature-first** `core / shell / modules` layout
(ADR [0005](adr/0005-feature-first-modular-architecture.md)). New code goes in this layout.

**Target layout:**
```
src/
  core/                 # deep shared spine — no domain-specific code leaks in
    entity/             # Entity, Profile (flat typed union), hierarchy.ts (generic parent/child)
    provenance/         # Provenance Ledger storage (source rating → Source/Claim, ADR 0006)
    persistence/        # store-agnostic port; geopackage/ is one adapter
    coordinates/        # branded LatLng / LngLat
    map/                # Leaflet substrate + position engine + selection dispatch
  shell/                # app frame: AppShell, MainLayout, settings
  modules/              # one feature per folder, co-located ui/ hooks/ store/ services/
    orbat/              # military view: TreeView, EntityInspector, NATO symbols, network links
    enrichment/         # AI pipeline + drawer + hook + research + citation rating
    osm/                # Overpass / Nominatim + OSM layers
  ui/                   # shadcn / Radix primitives
  pages/                # EditPage, ViewPage (the only files that trigger persistence I/O —
                        #   EditPage via its useProjectIO hook, ViewPage inline)
```
Heavy per-module pipelines live as self-contained projects under `sidecars/<name>/` behind the
capability port (created when the module lands, not before).

Nothing in `core/` (except `core/map`, which is React) or in a module's `services/` may import
from React outside its `ui/` — the shared spine and service layers are pure functions / async
functions with no React coupling. `core/entity` must not import any single Profile's field set;
profile-specific descriptors, symbol renderers, and schemas register from the profile's module.

## Naming Conventions

- **Files**: `kebab-case.ts` for utilities and services; `PascalCase.tsx` for React components.
- **Hooks**: prefix `use`; filename matches the exported hook name (e.g. `useEnrichment.ts`).
- **Stores**: `use<Domain>Store.ts` (e.g. `useProjectStore.ts`). Zustand stores live with the
  code they serve (`core/entity`, or a module); pure reducer modules keep the `.store.ts` suffix.
- **Types**: PascalCase for interfaces and type aliases.
- **Domain boundary**: `Entity` (UI / runtime — `MapEntity` is the current name, aliased through
  the rename in ADR [0004](adr/0004-entity-profile-tagged-union.md)) vs `GpkgEntity` (persistence,
  a thin alias). Use the runtime type everywhere except inside the persistence layer.
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **No default exports** for named components. Use named exports.

## Architecture Patterns

**Coordinate convention** — canonical spec in [`ARCHITECTURE.md`](ARCHITECTURE.md) (Coordinate
Contract). In short: `[lat, lng]` everywhere in the app (components, hooks, utils, store);
`[lng, lat]` only inside the persistence layer; conversion happens only at the read/write
boundary, enforced by branded `LatLng` / `LngLat` types.

**Pure reducers**
- State transitions for enrichment live in `modules/enrichment/store/enrichment.store.ts` as pure functions with
  no React imports and no side effects. They are tested in isolation.

**No prop drilling past one level**
- Components read data directly from the Zustand project store.
- Props are used only for component-specific configuration (`readOnly`, callbacks specific to
  that component's context) or for hook outputs (`enrichment`, `layeredResearch`).

**GeoPackage I/O stays at the page boundary**
- `EditPage` owns all GeoPackage open/save logic and IndexedDB session management,
  encapsulated in its `useProjectIO` hook — the hook is EditPage's private I/O seam,
  not shared infrastructure, and is the single sanctioned caller of `loadGeoPackage` /
  `saveGeoPackage` on the edit path.
- `ViewPage` owns the demo project fetch (inline).
- No component or hook other than `EditPage`/`useProjectIO` and `ViewPage` may call
  `loadGeoPackage` or `saveGeoPackage`.

**Zustand selectors must be granular**
- Never select the entire store root in a leaf component.
- Subscribe only to the slice the component uses. Use `shallow` equality for object selectors.

## Error Handling

- Async functions in pages catch errors and surface them via a local `useState<string | null>`
  that feeds the error banner in `AppShell`.
- Service functions throw typed errors with a message prefix (e.g. `"geopackage: ..."`,
  `"enrichment: ..."`).
- IndexedDB/session-storage failures must be explicit (`projectStorage: ...`) and surfaced in UI;
  do not swallow persistence/load errors with silent fallback values.
- `AbortError` from cancelled fetch / enrichment runs is caught and handled silently.
- Overpass failures are non-fatal: log to console and push a toast via `ToastStack`. Never
  set a ref that silently suppresses all future Overpass calls — reset the flag on cleanup.
- Enrichment synthesis failure fails the entire run (no partial recovery); the error message
  is surfaced in the EnrichDrawer status bar.

## Testing Requirements

- **Enrichment store** (`modules/enrichment/store/enrichment.store.ts`): 100 % branch coverage.
- **Research progress store** (`modules/enrichment/store/researchProgress.store.ts`): 100 % branch coverage.
- **Enrichment services** (`services/enrichment/`): unit tests for all public functions.
- **Layered research** (`services/research/`): unit tests for BFS ordering and skip logic.
- **GeoPackage round-trip**: the persistence integration test is the gate for any schema
  migration — every migration must round-trip existing `.gpkg` files.
- **Test runner**: Vitest only. No Jest.
- **Storybook stories** required for: `EntityInspector`, `EnrichDrawer`, `OsmObjectInspector`,
  `GeometryActionMenu`, `NetworkLinksLayer` (with 500-entity fixture for performance testing).
- No mocking of the GeoPackage library in integration tests — use real WASM execution.

## CI and local verification

- **Canonical check:** `npm run verify` runs `lint` → `test:coverage` → `build` (see root `package.json`).
- **CI:** GitHub Actions workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the same on `push` / `pull_request` to `main` or `master`.
- **Coverage thresholds** live in [`vitest.config.ts`](../vitest.config.ts) (global baseline; raise as more of `src/` is covered). HTML/LCOV output is written to `coverage/` (gitignored).
- **Agent entry point:** [`AGENTS.md`](../AGENTS.md) — keep commands and stop-ship rules in sync when changing tooling.

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
- Persistence (`localStorage` round-trip) and no-leak guarantees (no key in error messages or
  request URLs for OpenAI) are enforced by `settings.service.test.ts` and the provider adapter
  tests (`openai.adapter.test.ts`, `tavily.adapter.test.ts`).
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
- `SymbolsLayer` keeps a stable Leaflet `L.Icon` map in state, refreshed in `useLayoutEffect`
  from visible markers so icons are not recreated every pan; prune happens when marker keys change.
- Zustand selectors in map components must return stable references.
  Use `shallow` equality for object/array selectors to avoid spurious re-renders.
- OSM GeoJSON layer features should only re-render when `layer.osmData` reference changes
  (ensured by store `immutable update` pattern — always return new objects from actions).

## Git Conventions

- Commit message: imperative mood, present tense. Example: `"Add Zustand project store"` not
  `"Added project store"`.
- Branch naming: `phase/<N>-<short-description>` for refactoring work
  (e.g. `phase/1-zustand-store`, `phase/8-coordinate-safety`).
- Each phase ends with a working build (`npm run build` passes) and passing tests
  (`npm run verify` passes). No half-finished phases committed to `main`.

## Documentation Rules

- Update the relevant `/docs/` file whenever an architectural decision changes.
- Do not duplicate content across docs files (the hook enforces this).
- For agent planning commands, treat `docs/README.md` as the canonical list of planning docs.
- Exclude `docs/TELEGRAM_OSINT_PRD.md` from generic phase commands unless the phase explicitly targets Telegram OSINT work.
- JSDoc on exported functions is required only when the type signature alone does not convey
  intent (e.g. non-obvious parameter constraints, side-effect warnings).
