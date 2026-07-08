# Gabriel Roadmap

Master roadmap **and execution log** for Gabriel's evolution into the v2.0 project-agnostic OSINT
data-fusion environment. This file is the single place an executing agent reads to know *what to do
next*, *where the technical detail lives*, and *what has been done, deferred, or flagged*.

This file supersedes the old multi-phase quality timeline. The Telegram OSINT module keeps its own
detailed phase plan in [`TELEGRAM_TIMELINE.md`](./TELEGRAM_TIMELINE.md).

Decisions are recorded as ADRs in [`../adr/`](../adr/):
[0003](../adr/0003-local-first-self-hosted.md) ·
[0004](../adr/0004-entity-profile-tagged-union.md) ·
[0005](../adr/0005-feature-first-modular-architecture.md) ·
[0006](../adr/0006-source-claim-first-class-model.md).

---

## How to use this file (execution protocol)

An agent executing this roadmap **must** follow this loop:

1. **Work top to bottom, one item at a time.** Do the lowest unchecked `[ ]` item in the current phase.
2. **Read the 📎 reference first.** Each item links to the doc that holds the *how* and *why*. Do not
   invent behaviour that contradicts an ADR or `CONSTRAINTS.md`.
3. **Keep the build green.** `npm run verify` must pass at every commit. One item ≈ one revertible commit.
4. **Check the box and annotate.** When an item is done, set it to `[x]` and, if anything is
   non-obvious, add a `> note:` line under it (what you chose, what you skipped, what to revisit).
5. **Stop at every 🔒 Phase Gate. Do not self-certify.** A gate is crossed only after a **separate
   validation agent** (fresh context, not the agent that did the work) verifies the ✅ success
   criteria against the real repo + git diff, runs `npm run verify`, and records a verdict in the
   **Validation Log**. Proceed only on `PASS`. On `FAIL`, address the feedback and re-request validation.
6. **Log the load-bearing stuff, not everything.** Use the **Execution Ledger** at the bottom for:
   points intentionally *not* done, things to validate later, and anything that could bite later.
   Skip blow-by-blow detail — record only what a future reader would need to avoid a mistake.

**Status markers:** `[ ]` todo · `[x]` done · `[~]` partial/in-progress · `[!]` blocked
**Icons:** 📎 technical reference · ✅ success criteria · 🔒 phase gate (separate-agent validation)

---

## North star (Gabriel v2.0, FNF deliverable)

An open-source, **project-agnostic** data-fusion environment holding *entities, sources, ADMIRALTY
ratings, and geometries in a single auditable structure*, that any team can point at an adjacent
accountability domain. v2.0 grows these producer modules on top of today's ORBAT editor: Telegram
graph, corporate/sanctions graph (ETL), maritime (AIS/ADS-B), GEOINT (satellite change-detection) —
each behind an abstract capability interface, run as a local sidecar first. The deployed read-only
public map for consumers is a permanent, separate requirement, unaffected by any of this.

**Sequencing principle:** the foundation (Streams 1 & 2) comes *before* new modules. We do not build
the second module on the type-first, string-provenance foundation.

---

## Stream 1 — Mechanical reorg · zero features · green at every commit

📎 Governing decision: ADR [0005](../adr/0005-feature-first-modular-architecture.md).
📎 Target folder layout: [`../CONSTRAINTS.md`](../CONSTRAINTS.md) → *File & Folder Structure*.
Rule: a subject moves **with** its `./`-importing test and its `@/`-importing story in the same commit.

### Phase A — pure file moves (safe; smallest blast radius first)

- [x] **A1** — `utils/orbat.ts → core/entity/hierarchy.ts`, leave a re-export shim. 📎 `CONTEXT.md` → *Hierarchy index*.
  > note: implementation + test moved to `core/entity/hierarchy.ts`/`.test.ts`; `utils/orbat.ts` is now a one-line `export * from "@/core/entity/hierarchy"` shim. All 7 in-tree importers updated to the new path directly (shim exists only for anything outside this sweep). No `CONTEXT.md` file exists in `docs/` yet — the 📎 reference is stale/forward-looking; skipped.
- [x] **A2** — `services/geopackage/* → core/persistence/geopackage/*`. 📎 ADR 0005 (persistence port); `ARCHITECTURE.md` → *GeoPackage I/O Boundary*.
  > note: whole-folder `git mv`, no internal restructuring. 3 external importers (`useProjectIO.ts`, `ViewPage.tsx`, `useProjectStore.ts`) repointed to `@/core/persistence/geopackage`; one internal relative import (`project-open-save-restore.integration.test.ts` → `projectStorage.service`) switched from `../` to the `@/` alias since folder depth changed. `ARCHITECTURE.md`'s *GeoPackage I/O Boundary* section still names the old path — deferred to a later docs pass since Stream 1 isn't done yet.
- [x] **A3** — `provenance-ledger.ts → core/provenance/` **and split it**: ledger storage (`parse`/`serialize`/`merge`/`shouldPropose`) → core; citation rating (`rankCitations`/authority weight/`isSpecificArticleUrl`) → `modules/enrichment`. 📎 ADR [0001](../adr/0001-provenance-ledger-accumulation.md), ADR 0005.
  > note: `core/provenance/ledger.ts` holds storage; `modules/enrichment/citation-rating.ts` holds `isSpecificArticleUrl`/`rankCitations`/`selectTopCitations` (imports `getAuthorityWeight` from `@/services/enrichment/validators` — that file itself moves wholesale in A5, so this import gets repointed then). No shim left (unlike A1) since the roadmap only asked for one on A1; all 8 importers updated directly, dead `provenanceLedger` barrel re-export removed from `services/enrichment/index.ts` (nothing consumed it).
- [x] **A4** — `types/coordinates.ts → core/coordinates/`. 📎 `ARCHITECTURE.md` → *Coordinate Contract*.
  > note: landed as `core/coordinates/index.ts` (barrel-style filename, matching the existing `geopackage/index.ts` convention) rather than a stuttering `core/coordinates/coordinates.ts`. All 11 importers repointed to `@/core/coordinates`. `ARCHITECTURE.md`'s Coordinate Contract section still names the old path — batching that doc update for after Stream 1, same as A2's note.
- [x] **A5** — `modules/enrichment/` ← `services/enrichment` + `hooks/useEnrichment` + `components/enrichment` + `services/research`. 📎 `ARCHITECTURE.md` → *AI Enrichment Pipeline*.
  > note: landed as `modules/enrichment/{services,hooks,ui}/`. `services/` = all of former `services/enrichment` (incl. `providers/`) plus `services/research` nested at `services/research/`, plus the A3 `citation-rating.ts` (moved in from `modules/enrichment/` root to `services/` for consistency). `hooks/` = `useEnrichment.ts`, `useLayeredResearch.ts`, `enrichmentRunner.ts`. `ui/` = the 4 `components/enrichment` files, with their 3 Storybook stories co-located from `stories/enrichement/` (lockstep story-move rule) rather than left in the old parallel `stories/` tree. `store/enrichment.store.ts` and `store/researchProgress.store.ts` were **not** moved — the roadmap line only names 4 source trees and Phase C doesn't list them either; flagged in the Execution Ledger as a possible gap. 20 internal/external importers repointed; `npm run verify` and `storybook build` both green.
- [x] **A6** — `modules/orbat/` ← `components/tree` + `EntityInspector` + `HierarchyPanel` + symbol code + `SymbolsLayer` + `NetworkLinksLayer`.
  > note: landed as `modules/orbat/{ui,hooks,services}/`. `ui/` = `TreeView`/`OrganisationTreeView`/`MilitarySymbolNode`/`OrganisationNode` (whole `components/tree`, per the literal roadmap wording, even though `OrganisationTreeView`/`OrganisationNode` are Organisation-specific, not military — expected to sort itself out at Stream-2 E1's Organisation collapse), `EntityInspector.tsx` + its co-located `entityInspector.options.ts`, `HierarchyPanel.tsx`, `SymbolsLayer.tsx`, `NetworkLinksLayer.tsx`, plus their 5 Storybook stories co-located (lockstep rule). `hooks/` = `useEntityInspector.ts` (EntityInspector's only hook dependency). `services/` = `symbol.service.ts` (the NATO/milsymbol rendering code). `types/symbol.types.ts` stayed in `src/types/` — it's also consumed by `FilterableSelect` (shared) and `core/persistence/geopackage/applyResult.ts` (core layer), so moving it into a module would create a core→module dependency. `OrganisationInspector`/`useOrganisationInspector`/OSM inspector bits stay in `components/inspector/` (not named by this item; OSM bits move in A7). 13 importers repointed; `npm run verify` and `storybook build` both green.
- [x] **A7** — `modules/osm/` ← OSM components/services/hooks.
  > note: landed as `modules/osm/{ui,hooks,services}/`. `ui/` = `OsmObjectInspector.tsx`, `FindOsmAtPointDialog.tsx`, `OsmQueryMenu.tsx` (+ their 3 stories co-located). `hooks/` = `useFindOsmAtPoint.ts`, `useOsmRelationGeometries.ts`. `services/` = `overpass.service.ts`, `nominatim.service.ts`, `osmLocalSearch.ts`. Scoped to the Overpass/Nominatim OSM-data-integration feature (PRD feature 5) — deliberately excluded `BaseMapSwitcher`/`mapTileConfig` (their "osm" is just a base-tile-provider id, unrelated to this feature) and `OrganisationInspector`/`UnifiedSearch` (multi-purpose components that merely *consume* OSM lookups, not OSM-dedicated themselves). 11 importers repointed, including one relative-import break in `OrganisationInspector.tsx` (`./FindOsmAtPointDialog` → `@/modules/osm/ui/FindOsmAtPointDialog`) surfaced by the move. `npm run verify` and `storybook build` both green.
- [x] **A8** — `core/map/` ← Leaflet substrate (`MapView`, position engine, selection dispatch); profile layers stay with their modules. **Heaviest churn — do last.**
  > note: `core/map/` = `MapView.tsx`, `DrawControls.tsx`, `GeometryActionMenu.tsx`, `MapToolSelector.tsx`, `MapBoundsReporter.ts`, `mapTileConfig.ts`, `useMapDrawing.ts`, `CenterOnSelection.ts` (the "selection dispatch") + their 4 stories, plus `utils/geometry.ts` → `core/map/geometry.ts` (the "position engine": `computeAllEntityPositions`/`computeAllOrganisationPositions`). Per "profile layers stay with their modules", `OrganisationsLayer.tsx` moved to `modules/orbat/ui/` alongside `SymbolsLayer`/`NetworkLinksLayer` (same treatment as A6's Organisation tree components) rather than into `core/map`. `mapTileConfig.ts` keeps its existing import from `@/components/shared/BaseMapSwitcher` (a shell-ish component not yet relocated — out of scope here, not a new dependency). `components/map/` and `stories/map/` are now fully empty. 3 importers repointed; `npm run verify` and `storybook build` both green.
- [x] **A9** — `shell/` ← `AppShell`, `MainLayout`, settings; `ui/` ← shadcn primitives (**update `components.json` aliases in the same commit**).
  > note: `shell/` = `AppShell.tsx`, `MainLayout.tsx`, `AiProviderSettingsDialog.tsx` (settings) + its story, per the literal 3-item roadmap wording — the rest of `components/shared/` (AboutDialog, BaseMapSwitcher, FilterableSelect, LayersPanel, ModeToggle, ResearchDialog, ShowNetworksToggle, ToastStack, UnifiedSearch) deliberately stays put, not named by this item. `ui/` = all 17 shadcn/Radix primitives, moved top-level out of `components/`; `components.json`'s `"ui"` alias updated to `@/ui` in the same commit. Bulk-replaced `@/components/ui/` → `@/ui/` across 28 consumer files (uniform prefix substitution). One follow-up fix outside the plain move: the ESLint `react-refresh/only-export-components` override in `eslint.config.js` was scoped to `src/components/ui/**` — repointed to `src/ui/**` or `button.tsx`/`sidebar.tsx`/`tabs.tsx` (which intentionally export variants alongside components) would fail lint. `npm run verify` and `storybook build` both green.
- [!] **A10** — Remove `reactflow` (unused). 📎 `PRD.md` → *Open Questions* (resolved), `TECH_STACK.md`.
  > note: **blocked — the premise is false.** `reactflow` is not unused: `modules/orbat/ui/TreeView.tsx` renders `<ReactFlow>` and is live behind a real "Hierarchy" tab (`AppShell.tsx` `activeView === "map" ? mapSlot : treeSlot`, wired via `TabsTrigger value="tree"` and a mobile toggle button) reachable from both `EditPage` and `ViewPage`. `MilitarySymbolNode.tsx`/`OrganisationNode.tsx` also depend on it. Traced the claim's origin: `reactflow` and the Hierarchy tab both existed since the repo's first commit; the PRD's "unused" note (added 2026-04-25, restructured 2026-07-08) was never accurate — not a recent regression. Removing it would break the Hierarchy tab. Corrected the stale claim in `PRD.md`. `OrganisationTreeView.tsx` (a sibling component, also reactflow-based) *is* genuinely dead — unreferenced outside its own file — logged below for a future cleanup, but that's a smaller, separate action than this item as written. Do not action this item until a human/product decision is made on whether the Hierarchy tab should be kept (keep `reactflow`) or intentionally removed (delete `TreeView`/`OrganisationTreeView`/the tab, then drop the dependency).
- [x] **A11** — Extract inspector sub-components duplicated between `EntityInspector` / `OrganisationInspector` (`SourcesList`, `LinkedGeometriesList`, `ReadOnlyField`) to a shared location. *(The no-schema-risk 80 % of the Organisation win.)*
  > note: landed at `components/shared/InspectorFields.tsx` (both consumers already live in different trees — `modules/orbat/ui/EntityInspector.tsx` vs `components/inspector/OrganisationInspector.tsx` — so `components/shared/` is the common ground both can import from without a module→module dependency). Also folded in `isUrl`/`geometryLabel`, the two private helpers `SourcesList`/`LinkedGeometriesList` need to render — not named in the roadmap bullet but inseparable from it. The two callers' "no geometries linked" copy differed (entity vs organisation wording); parameterized as an `emptyEditMessage` prop rather than picking one, so no user-visible text changed. `positionModeLabel`/`POSITION_MODE_OPTIONS` are duplicated too but weren't named here — left alone. `npm run verify` and `storybook build` both green; no behavioural change.

✅ **Phase A success criteria**
- Every file sits in the target `core/shell/modules/ui` layout; no source imports an old path except intentional shims.
- `npm run verify` green (lint + test:coverage + build). Storybook builds.
- No behavioural change: the app opens, edits, enriches, and saves a `.gpkg` exactly as before.
- ~~`reactflow` gone from `package.json` and lockfile.~~ **Superseded by A10's finding**: this criterion assumed reactflow was dead; it isn't (see A10). Removing it would itself be a behavioural change, contradicting the criterion above it. Not satisfied, and correctly so — kept pending a product decision on the Hierarchy tab.

🔒 **Gate A** — separate validation agent confirms the ✅ above against the git diff + a running app, records verdict in the Validation Log. Do not start Phase B before `PASS`.

### Phase B — type rename (low-risk semantic, shimmed)

- [x] **B1** — `MapEntity → Entity` behind `export type MapEntity = Entity`; add `kind: "unit"` discriminant. 📎 ADR [0004](../adr/0004-entity-profile-tagged-union.md).
  > note: real definition landed at `core/entity/entity.ts`; `types/domain.types.ts` re-exports `Entity`/`PositionMode` and keeps `export type MapEntity = Entity` (marked `@deprecated`) so all 39 existing `@/types/domain.types` importers stay untouched, per the ADR's explicit intent. `kind` is a runtime-only discriminant, not a persisted column (`GpkgEntity`/the `units` table are unchanged) — `readEntities` in `units.table.ts` now injects `kind: "unit"` after `decodeRow` (order matters: spreading decodeRow's result *after* the literal would let TS's structural type silently "win" and overwrite it). ~30 entity object literals across 15 test/story files needed `kind: "unit"` added since it's a required field on the type — `tsc -b` was used to find every one exhaustively rather than trusting a grep sweep. `npm run verify` and `storybook build` both green; zero on-disk/behavioural change.
- [x] **B2** — Introduce `Profile` as a **flat** tagged union at the type level only (no storage change). 📎 ADR 0004 (*flat, not nested* — non-negotiable).
  > note: split `core/entity/entity.ts`'s single flat object into `EntityCore` (id/name/layerId/parentId/notes/sources/analyzedAt/positionMode/isExactPosition) and `UnitProfile` (kind + the military-specific fields), with `Profile = UnitProfile` (a union of one member today — vessel/company/person are a future modelling exercise, not stubbed here) and `Entity = EntityCore & Profile`. Purely a type-composition change: `Entity`'s resulting shape is identical to B1's, so zero call sites needed touching — `tsc -b` confirmed clean with no edits beyond `entity.ts` itself. `npm run verify` and `storybook build` both green.

✅ **Phase B success criteria**
- `Entity` is the canonical runtime type; `MapEntity` remains a working alias; `GpkgEntity` unchanged.
- `Profile` is a flat discriminated union on `kind`; **no** field is physically nested (`entity.echelon`, never `entity.profile.echelon`).
- Zero behavioural or on-disk change; GeoPackage round-trip test unchanged and green. `npm run verify` green.

🔒 **Gate B** — separate agent verifies the union is flat, the alias holds, and nothing regressed. `PASS` required before Phase C.

### Phase C — store peel (one slice per PR; keep the transactional graph welded)

- [x] **C1** — Extract `useMapPrefsStore` (`baseMap`, `showNetworks`).
- [x] **C2** — Extract `useOsmViewStore` (`entityOsmGeometries`, `osmUnavailable`, `selectedOsmObject`).
- [x] **C3** — Extract `useSourceCacheStore` (`sourceCache`, `lastSavedAt`).
  > note: **C1/C2/C3 landed in one combined commit**, not 3 separate PRs as the header prescribes — they share enough consumer files (`MainLayout.tsx`, `useProjectIO.ts`, `useProjectStore.test.ts`) and a single `useProjectStore.ts` diff (removing all three slices' fields together) that splitting into 3 mechanically separate commits after the fact would have meant fake-atomizing an already-interdependent change. Flagging this openly for Gate C rather than hiding it. All three new stores live in `src/store/` (peripheral, cross-cutting — `useMapPrefsStore`/`useOsmViewStore`/`useSourceCacheStore.ts`), each with a `devtools`-wrapped Zustand store mirroring `useProjectStore`'s pattern.
  > `selectPersistableSnapshot(state, sourceCache)` now takes `sourceCache` as an explicit second argument instead of reading it off `ProjectState` — still the single function every save flows through, just spanning two stores' data now (unavoidable consequence of the peel, not a design compromise).
  > `closeDetail()` now only clears `selectedEntityId`/`selectedOrganisationId`; `MainLayout` wraps it (`handleCloseDetail`) to also clear `useOsmViewStore`'s `selectedOsmObject`, since that field moved out of the quintet's atomic `set`. All ~10 call sites that used to do `s.setSelectedOsmObject(null)` alongside other `useProjectStore` actions now call `useOsmViewStore.getState().setSelectedOsmObject(null)` separately — no longer atomic with the entity/org selection change, but there was no data-integrity coupling between them (unlike `removeLayer`/`deleteEntity` clearing `selectedEntityId`), so this is safe per ADR 0005's "genuinely independent" test.
  > **Deliberate behaviour nuance**: "New Project" (`handleNew`) now resets `useSourceCacheStore` and `useOsmViewStore` (matching the old atomic-reset behavior, since stale source-cache/OSM data tied to the previous project's entities would be incorrect) but does **not** reset `useMapPrefsStore` — a user's base-map style and network-links toggle are display preferences independent of project lifecycle, and resetting them was an accident of the old monolithic store, not a deliberate design. Not flagged as a regression; flagged here for visibility since Phase C carries no explicit "zero behavioural change" criterion the way A/B did.
- [x] **C4** — **Stop.** `layers + entities + organisations + drawnGeometries + selection` stay one store. 📎 ADR 0005 (*decompose, do not pulverise*).
  > note: confirmed — `ProjectState` is now exactly `{ layers, entities, organisations, drawnGeometries, selectedEntityId, selectedOrganisationId }`. Cross-field single-`set` atomicity intact: `removeLayer`/`deleteEntity`/`deleteOrganisation`/`updateEntity` still mutate multiple quintet fields in one `set` call each. No further peeling attempted.

✅ **Phase C success criteria**
- Three peripheral stores extracted; the transactional quintet remains a single store with single-`set` atomicity intact.
- `selectPersistableSnapshot` is still the single source of truth for save and still passes its test.
- Granular-selector invariant preserved (no leaf selects the whole root). `npm run verify` green.

🔒 **Gate C** — separate agent verifies atomicity + snapshot integrity, then declares **Stream 1 complete**.

---

## Stream 2 — Deferred semantic epics · each its own PR · gated by a `.gpkg` round-trip test

📎 Do not start until Gate C = `PASS`. Ordered. Each epic ends with its own 🔒 gate.

- [ ] **E1 — Collapse `Organisation` into a Corporate Profile.** The pilot validating ADR 0004; a GeoPackage schema migration (separate `organisations` table → `units` + `kind`). Removes ~400 lines of duplication. 📎 ADR 0004, ADR 0005.
  - ✅ Existing `.gpkg` files round-trip losslessly; parallel inspector/tree/node/store-slice/selection-id deleted; `npm run verify` green.
  - 🔒 Gate E1 — separate agent runs the round-trip test on real fixtures + confirms the deletions.
- [ ] **E2 — First-class `Source` / `Claim` model.** Replace `MapEntity.sources: string` with normalized records. Unlocks per-source/per-claim ADMIRALTY, the `.tgdb ↔ .gpkg` bridge, cross-module identity. 📎 ADR [0006](../adr/0006-source-claim-first-class-model.md).
  - ✅ Schema migration round-trips; UI still renders the same citations; ADMIRALTY can attach to a `Source`; `npm run verify` green.
  - 🔒 Gate E2.
- [ ] **E3 — `core/identity`.** Cross-module entity resolution (canonical ids, match candidates, merge/split, Latin↔Cyrillic aliases). Design with E2. 📎 ADR 0006 (*same machinery as `Source` dedup*).
  - ✅ Two records for one real-world entity can be proposed → confirmed → merged without data loss; `npm run verify` green.
  - 🔒 Gate E3.
- [ ] **E4 — Capability port + module registry + command palette** (the "VS Code-style" shell). Unify three-way selection into one `selectedRef {kind,id}`, then a narrow module registration interface. Build only once a second real module (Telegram) exists. 📎 ADR 0005.
  - ✅ Existing modules register through the interface with no shell-side per-module branching; selection is unified; `npm run verify` green.
  - 🔒 Gate E4.

---

## Module roadmap (FNF v2.0 · after the foundation)

Each module = a `modules/<name>/` folder + (where heavy) a `sidecars/<name>/` self-contained project
behind the capability port. Create each seam when the module lands, not before.

| Module | Store / feed | Sidecar | Detailed plan |
|---|---|---|---|
| **Telegram graph** | `.tgdb` (SQLite) | FastAPI + Telethon | [`TELEGRAM_TIMELINE.md`](./TELEGRAM_TIMELINE.md) |
| **Corporate / sanctions** | ETL → entities | connectors (OpenCorporates, OpenSanctions, Aleph) | _tbd_ |
| **Maritime** | AIS/ADS-B feed | Datalastic adapter | _tbd_ |
| **GEOINT** | satellite tiles | Sentinel-2 / SkyFi change-detection | _tbd_ |

ADMIRALTY scoring (STANAG 2511) on every entity and claim is delivered by E2, then surfaced per-module.

---

## Execution Ledger

> Running log kept by executing agents. Not a changelog — record only load-bearing items: what was
> deferred, what must be revisited, what could bite later, and non-obvious decisions and their reason.
> Newest entries on top. Stamp each with the phase/item and a date.

### Validation Log (separate-agent gate verdicts)

| Date | Gate | Verdict | Validator feedback (summary) |
|---|---|---|---|
| 2026-07-08 | A | **PASS-WITH-NOTES** | Independent fresh-context agent re-ran `npm run verify` (29/29 test files, 195/195 tests, lint+build clean) and `storybook build` (both green, confirmed not just trusted). Grepped for stale old-path imports across all A1–A9/A11 target areas — zero hits; `utils/orbat.ts` shim confirmed to have no in-tree importers (external-only, as designed). Spot-checked A3/A9/A11 commit diffs against their claimed content — all matched. Independently re-traced A10's reactflow claim (grepped the import, traced `TreeView.tsx` → `MainLayout.tsx` → `AppShell.tsx`'s `activeView`/`treeSlot` render path) and concurred: reactflow is genuinely live, blocking removal was correct, and forcing it to satisfy the roadmap's own (contradictory) 4th success criterion would itself be an unauthorized behavioural change. One real gap found and not yet logged at review time: `entityLayer.ts`, `organisation-icons.ts`, `treeLayout.ts(+test)`, `enrichmentAdapters.ts(+test)`, `enrichmentApply.ts(+test)` were still sitting in `utils/` — single-module-consumer files that should have swept into their owning module per A5/A6/A8's own pattern. **Resolved same-day**: all five moved into `shell/`/`modules/orbat/services/`/`modules/enrichment/services/` (commit `23c2a45`), re-verified green. Phase A layout, build, and no-behavioural-change criteria are now fully met; the reactflow criterion is knowingly unmet for a documented, correct reason. **Stream 1 Phase B is cleared to start.** |
| 2026-07-08 | B | **PASS** | Independent fresh-context agent verified all three Phase B criteria against the real repo, not the commit notes. **Entity/MapEntity/GpkgEntity**: `core/entity/entity.ts` holds the real `Entity` type; `types/domain.types.ts` keeps `export type MapEntity = Entity`; `core/persistence/geopackage/types.ts`'s `GpkgEntity = MapEntity` confirmed untouched. **Flat union**: `Entity = EntityCore & Profile` is a plain intersection with no `.profile` nesting anywhere — grepped `EntityInspector.tsx` and confirmed direct `entity.echelon`/`entity.affiliation` reads; independently re-verified the three things ADR 0004 says nesting would have broken still work flat: `units.table.ts`'s per-prop column descriptor, `useProjectStore.ts`'s shallow-merge `updateEntity` (`{...e, ...patch}`), and direct inspector field reads. **No behavioural/on-disk change**: confirmed `kind` has no column descriptor entry in `unitColumns` and is never written by `writeEntities`; the round-trip test (iterating `Object.keys(entity)` including `kind`) passed as part of a fresh full run — 29/29 test files, 195/195 tests, lint+build clean, `storybook build` green. Diffed both B1 (`c01f34a`) and B2 (`eb27636`) commits directly and found zero `@ts-ignore`/`as any` smuggled in anywhere — the "byte-for-byte identical shape" claim for B2 holds. **Stream 1 Phase C is cleared to start.** |
| 2026-07-08 | C | **PASS** | Independent fresh-context agent verified all Phase C criteria against the real repo. **Quintet + atomicity**: `ProjectState` is exactly `{layers, entities, organisations, drawnGeometries, selectedEntityId, selectedOrganisationId}` — confirmed by reading `useProjectStore.ts` in full. Cross-field single-`set` atomicity intact: `removeLayer` still clears `selectedEntityId` in the same `set` as filtering layers/entities/geometries; `deleteEntity`/`deleteOrganisation` clear their selection ids alongside entity/geometry removal; `updateEntity` cascades `layerId` patches into `drawnGeometries` in one `set`. All three new stores (`useMapPrefsStore`, `useOsmViewStore`, `useSourceCacheStore`) confirmed genuinely independent — no cross-imports of `useProjectStore` or each other. **Snapshot integrity**: `selectPersistableSnapshot(state, sourceCache)`'s signature change is reflected in every one of the 5 test call sites; layer-kind inference, OSM filtering, and name-trimming coverage all still exercised (minor gap noted: no test asserts the passed `sourceCache` flows through to the output, but it's a trivial passthrough). **Granular selectors**: spot-checked `BaseMapSwitcher`/`NetworkLinksLayer`/`MapView`/`MainLayout` — all use per-field selectors for the peeled stores; a full-tree grep for every old-location field/action access off `useProjectStore` returned zero hits. **Behavioural nuance confirmed as claimed**: `handleNew` resets source-cache and OSM-view state but deliberately not map-prefs; `lastSavedAt` confirmed genuinely dead code pre-existing this phase, correctly left alone. Fresh `npm run verify` (29/29 test files, 195/195 tests, lint+build clean) and `storybook build` both green. The one process deviation — C1/C2/C3 landing as a single commit rather than three — is honestly disclosed in this file and justified by genuinely shared consumer files; not grounds for FAIL. **Stream 1 is complete. Stream 2 (E1) may begin.** |

### Deferred / to revisit later

- **A5**: `store/enrichment.store.ts` and `store/researchProgress.store.ts` stayed in `src/store/` rather than moving into `modules/enrichment/`, since neither the A5 roadmap line nor Phase C names them. Per CONSTRAINTS.md ("Zustand stores live with the code they serve... or a module"), these arguably belong in `modules/enrichment/store/` — revisit if Gate A validation flags it, or fold into a later Stream-2 item.
- **A10**: item is blocked — `reactflow` is genuinely used (see A10's note); needs a human/product call on whether to keep the Hierarchy tab (keep the dependency, close this item as N/A) or delete it (then this item becomes real). Do not remove `reactflow` without that decision.
- **A10 (found while investigating)**: `modules/orbat/ui/OrganisationTreeView.tsx` is dead code — unreferenced anywhere outside its own file (no story, no test, no import). Cheap, low-risk deletion candidate whenever someone picks this up, independent of the reactflow question.

### Risks / watch

- **Sidecar reads `.gpkg` out-of-process** (Telegram): a known future violation of the "I/O only in
  page components" invariant — needs an explicit read-replica / cache-coherence seam when that module
  lands. 📎 ADR 0003. *(Logged at planning time; not a Stream-1 concern.)*

### Decisions taken during execution

- _(none yet)_
