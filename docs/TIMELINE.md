# Development Timeline — Gabriel

## Phase 0 — Documentation Foundation [X]

**Scope**: Populate all `/docs/` template stubs with real project content. Create `ARCHITECTURE.md`.
**Dependencies**: None.
**Milestones**
- [X] `docs/PRD.md` — problem statement, users, features, user stories, success criteria
- [X] `docs/TECH_STACK.md` — full dependency table, Zustand rationale, coordinate contract
- [X] `docs/CONSTRAINTS.md` — file structure, naming, patterns, error handling, performance, git
- [X] `docs/TIMELINE.md` — all phases with scope, milestones, and acceptance criteria
- [X] `docs/ARCHITECTURE.md` — component tree, data flows, coordinate contract, enrichment pipeline
- [X] `docs/README.md` — project name updated, `ARCHITECTURE.md` added to index
**Acceptance Criteria**: No placeholder text in any `/docs/` file. `npm run build` and `npm test` pass.

---

## Phase 1 — Zustand Store Creation [X]

**Scope**: Install Zustand. Create `src/store/useProjectStore.ts` with the full state + actions
interface. No component migration yet — the store exists alongside the current `useMapProjectState`.
**Dependencies**: Phase 0
**Milestones**
- [X] `zustand` added to `package.json` dependencies (`npm install zustand`)
- [X] `src/store/useProjectStore.ts` created with state shape:
  `layers, entities, drawnGeometries, sourceCache, selectedEntityId, selectedOsmObject,
  showNetworks, baseMap, entityOsmGeometries, osmUnavailable, lastSavedAt`
- [X] Actions implemented: `setProject, resetProject, addLayer, addNewLayer, renameLayer,
  removeLayer, moveLayer, setLayerVisible, addEntity, updateEntity, deleteEntity, addGeometry,
  deleteGeometry, setSelectedEntityId, setSelectedOsmObject, closeDetail, setShowNetworks,
  setBaseMap, setEntityOsmGeometries, setOsmUnavailable, mergeSourceCache, setLastSavedAt`
- [X] `devtools` middleware applied (enabled only in `import.meta.env.DEV`)
- [X] Store is exported as `useProjectStore`
- [X] `npm run build` passes, `npm test` passes (store is unused but must not break the build)
**Acceptance Criteria**: `useProjectStore` can be imported and returns the expected shape.
The existing app is completely unchanged in behaviour.

---

## Phase 2 — EditPage Migration [X]

**Scope**: Migrate `EditPage` from `useMapProjectState` to `useProjectStore`. EditPage becomes an
I/O orchestrator (~180 lines) with no state management responsibilities.
**Dependencies**: Phase 1
**Key file**: `src/pages/EditPage.tsx` (505 → ~180 lines)
**Milestones**
- [X] `useMapProjectState` import removed from `EditPage`
- [X] All `setState` calls replaced with store action calls (e.g. `store.addNewLayer()`,
  `store.updateEntity(id, patch)`, `store.deleteEntity(id)`)
- [X] `handleCreateNewEntity` and `handleLinkGeometryToEntity` remain as `useCallback` wrappers
  (they call two store actions: `addEntity` + `addGeometry`)
- [X] Session restore effect calls `store.setProject(result)` after `loadGeoPackage`
- [X] `handleSaveProject` reads state via `useProjectStore.getState()` (not reactive)
- [X] `sourceCache` moved into the store; `mergeSourceCache` used for batch research additions
- [X] `MainLayout` still receives all current props (prop reduction is Phase 4)
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Open a `.gpkg` file → entities appear on map. Draw a geometry → entity
created, survives IndexedDB restore. No observable behaviour change.

---

## Phase 3 — ViewPage Migration [X]

**Scope**: Migrate `ViewPage` to use `useProjectStore`. Remove `useMapProjectState` and all
`READ_ONLY_HANDLERS` stubs.
**Dependencies**: Phase 2
**Key file**: `src/pages/ViewPage.tsx`
**Milestones**
- [X] `useMapProjectState` import removed from `ViewPage`
- [X] After `applyGeoPackageResult`, call `useProjectStore.getState().setProject(result)`
- [X] `READ_ONLY_HANDLERS` object deleted
- [X] `READ_ONLY_FILE_ACTIONS` kept (AppShell still renders file buttons, disabled in readOnly mode)
- [X] `useMapProjectState.ts` deleted (no remaining callers)
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: View mode loads `public/project.gpkg` and renders entities correctly.
Switching from view to edit mode and back works without errors.

---

## Phase 4 — MainLayout Prop Reduction [X]

**Scope**: Shrink `MainLayoutProps` from 30+ members to ≤ 10. Remove all data props; keep only
`readOnly`, mode switch callbacks, I/O actions, and the two hook output objects.
**Dependencies**: Phase 3
**Key file**: `src/components/shared/MainLayout.tsx`
**Target `MainLayoutProps`**:
```ts
{
  readOnly: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
  projectFileActions: ProjectFileActions
  busy: boolean
  error: string | null
  enrichment: EnrichmentControls
  layeredResearch?: LayeredResearchControls
}
```
**Milestones**
- [X] All data props (`layers, entities, drawnGeometries, selectedEntityId,` etc.) removed from
  `MainLayoutProps`
- [X] All handler props (`handleDeleteEntity, handleUpdateEntity,` etc.) removed
- [X] `hiddenEntityIds` + `handleToggleEntityVisible` stay as local `useState` in `MainLayout`
  (view-only, not persisted)
- [X] Children that previously read data from props are temporarily given `useProjectStore` calls
  inline (individual component migrations follow in Phase 5–7)
- [X] `EditPage` JSX call to `MainLayout` updated to match reduced props
- [X] `ViewPage` JSX call to `MainLayout` updated
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: `MainLayoutProps` has ≤ 10 members. Removing a data prop from the
`MainLayout` call in `EditPage` produces no TypeScript error in children.

---

## Phase 5 — MapView + Map Layer Components [X]

**Scope**: Migrate `MapView`, `NetworkLinksLayer`, and `SymbolsLayer` to read from the store
directly. Extract `useOsmRelationGeometries` to fix the overpass never-reset bug.
**Dependencies**: Phase 4
**Key files**: `src/components/map/MapView.tsx`, `NetworkLinksLayer.tsx`, `SymbolsLayer.tsx`
**Milestones**
- [X] `src/hooks/useOsmRelationGeometries.ts` created — extracts the OSM relation fetch effect
  from `useMapProjectState`. On fetch failure: calls `store.setOsmUnavailable(true)` AND
  pushes a toast. On cleanup (`return () => {...}`): calls `store.setOsmUnavailable(false)`
  (fixes the silent never-reset bug).
- [X] `MapView` reads `layers, entities, drawnGeometries, entityOsmGeometries, selectedEntityId,
  showNetworks, baseMap` from store. Calls `useOsmRelationGeometries()` internally.
- [X] `MapView` props reduced to: `readOnly, onCreateNewEntity, onLinkGeometryToEntity,
  defaultLayerId, hiddenEntityIds` (behaviour config, not data)
- [X] `NetworkLinksLayer` reads `entities, selectedEntityId` from store. `useMemo` for BFS
  verified intact.
- [X] `SymbolsLayer` reads `entities` from store (or receives via `positionMap` — keep the
  current interface if the cache is local to the component).
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Map renders correctly. Overpass failure shows a toast and resets on next
page load. No BFS computation outside `useMemo`.

---

## Phase 6 — Panels Migration [X]

**Scope**: Migrate `LayersPanel`, `HierarchyPanel`, `TreeView`, `ShowNetworksToggle`, and
`BaseMapSwitcher` to read from/write to the store directly.
**Dependencies**: Phase 4
**Key files**: `src/components/shared/LayersPanel.tsx`, `HierarchyPanel.tsx`,
`src/components/tree/TreeView.tsx`, `ShowNetworksToggle.tsx`, `BaseMapSwitcher.tsx`
**Milestones**
- [X] `LayersPanel` reads `layers, entities, selectedEntityId` from store; calls store actions
  directly (`setLayerVisible, removeLayer, renameLayer, addNewLayer, moveLayer`). Props reduced
  to: `readOnly`.
- [X] `HierarchyPanel` reads `entities, selectedEntityId` from store. Props: `hiddenEntityIds,
  onToggleEntityVisible` (passed from MainLayout local state).
- [X] `TreeView` reads `entities, selectedEntityId` from store; calls
  `store.setSelectedEntityId`. Props removed entirely.
- [X] `ShowNetworksToggle` reads/writes `showNetworks` directly. No props.
- [X] `BaseMapSwitcher` reads/writes `baseMap` directly. No props.
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Layer visibility toggle, entity selection in tree, and base map switch all
work. `LayersPanel` renders without any data props from `MainLayout`.

---

## Phase 7 — EntityInspector Migration [X]

**Scope**: Migrate `EntityInspector` to read from the store and call store actions directly.
**Dependencies**: Phase 4
**Key file**: `src/components/inspector/EntityInspector.tsx`
**Milestones**
- [X] `EntityInspector` reads `selectedEntityId, entities, layers, drawnGeometries` from store
- [X] `onUpdateEntity`, `onDeleteEntity`, `onDeleteGeometry` replaced with direct store calls
- [X] Props reduced to: `readOnly, enrichedOverlay` (overlay comes from `useEnrichment`, not store)
- [X] `OsmObjectInspector` verified: reads its own props from `selectedOsmObject` via store if
  needed, or remains prop-driven (it has no mutation responsibilities)
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Editing entity name/affiliation/echelon in the inspector updates the map
symbol immediately. Deleting an entity removes it from the hierarchy panel and map.

---

## Phase 8 — Coordinate Safety [X]

**Scope**: Introduce branded `LatLng` / `LngLat` types. Enforce the coordinate contract with
the TypeScript type system. Add a round-trip integration test for GeoPackage I/O.
**Dependencies**: Phase 7
**Key files**:
- `src/types/coordinates.ts` (new)
- `src/types/domain.types.ts`
- `src/services/geopackage.service.ts`
- `src/utils/geometry.ts`
- `src/services/geopackage.service.test.ts` (new)
**Milestones**
- [X] `src/types/coordinates.ts` created with `LatLng`, `LngLat`, `toLeafletCoord`,
  `toGeoJsonCoord`, `asLatLng`
- [X] `DrawnGeometry` line `positions` typed as `LatLng[]`; polygon `rings` as `LatLng[][]`
- [X] `geopackage.service.ts` `readGeometries`: wraps parsed coords in `toLeafletCoord`
- [X] `geopackage.service.ts` `saveGeoPackage`: wraps positions in `toGeoJsonCoord` before write
- [X] `geometry.ts` return types annotated with `LatLng`
- [X] No raw `[number, number]` coordinate literals outside `geopackage.service.ts` and
  `geometry.ts` — TypeScript enforces this
- [X] `geopackage.service.test.ts`: round-trip test for project with points, lines, and polygons;
  assert coordinates survive save → reload unchanged
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Passing a raw `[number, number]` where `LatLng` is expected reports a
TypeScript error. A line geometry's coordinates are identical before save and after reload.

---

## Phase 9 — Enrichment Consolidation [X]

**Scope**: Eliminate the duplicated `toFeature` / `toContext` conversion functions. Create a
single entity adapter module.
**Dependencies**: Phase 7
**Key files**:
- `src/utils/enrichmentAdapters.ts` (new)
- `src/hooks/useEnrichment.ts`
- `src/services/research/layered-research.service.ts`
**Milestones**
- [X] `src/utils/enrichmentAdapters.ts` created with:
  `toEnrichmentFeature(entity, geometries): EnrichmentFeature`
  `toEnrichmentContext(entity, entities): EnrichmentContext`
- [X] Local copies in `useEnrichment.ts` removed; import from `enrichmentAdapters`
- [X] Local copies in `layered-research.service.ts` removed; import from `enrichmentAdapters`
- [X] Unit tests added for both functions in `src/utils/enrichmentAdapters.test.ts`
- [X] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: `grep -r "function toFeature\|function toContext" src/` returns 0 results.
Single enrichment of an entity and batch research both produce identical GeoJSON feature shapes.

---

## Phase 10 — Performance Verification [  ]

**Scope**: Audit and verify all memoisation invariants at 1 000+ entity scale. Add a Storybook
story for performance testing.
**Dependencies**: Phase 9
**Key files**: `src/components/map/NetworkLinksLayer.tsx`,
`src/components/map/MapView.tsx`,
`src/stories/NetworkLinksLayer.stories.tsx` (new or update)
**Milestones**
- [ ] `NetworkLinksLayer.stories.tsx` story with 500 synthetic entities + 1 selected entity
  confirms BFS is not recalculated on unrelated state changes (verified via React DevTools
  Profiler or console.count)
- [ ] `computeAllEntityPositions` `useMemo` dependency array confirmed correct after Zustand
  migration — uses `shallow` selector if needed to return stable references
- [ ] Zustand selectors in `MapView`, `LayersPanel`, `NetworkLinksLayer` audited for unnecessary
  object references (use `shallow` where selecting multiple fields)
- [ ] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Adding a toast or changing base map does not trigger a BFS recompute in
`NetworkLinksLayer`. `SymbolsLayer` re-render count on selection change is ≤ 2 in Profiler.

---

## Phase 11 — DX Improvements [  ]

**Scope**: Surface Zustand DevTools, add auto-save indicator, add entity search, fix the silent
overpass error (already fixed in Phase 5 — verify the toast appears).
**Dependencies**: Phase 10
**Key files**:
- `src/store/projectStore.ts` (devtools middleware, already wired in Phase 1)
- `src/components/shared/AppShell.tsx`
- `src/components/shared/EntitySearch.tsx` (new)
**Milestones**
- [ ] Zustand `devtools` middleware confirmed enabled in dev mode; store labelled
  `"GabrielProjectStore"` in Redux DevTools browser extension
- [ ] Auto-save indicator: `AppShell` reads `lastSavedAt` from store; renders
  `"Saved HH:MM"` in header after a successful `handleSaveProject`
- [ ] `EntitySearch.tsx` created: text input (Ctrl+K / Cmd+K to focus, Escape to clear);
  filters entity names; on select calls `store.setSelectedEntityId(id)`;
  `CenterOnSelection` handles the map pan automatically
- [ ] Entity search rendered in header slot of `AppShell` (edit mode only)
- [ ] Overpass failure toast confirmed visible (from Phase 5)
- [ ] `npm run build` passes, `npm test` passes
**Acceptance Criteria**: Open Redux DevTools → "GabrielProjectStore" appears. Save a project →
"Saved HH:MM" appears within 1 s. Type a unit name in search → entity selected and map pans to it.
