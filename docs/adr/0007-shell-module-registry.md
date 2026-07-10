# Shell module registry: static manifests, four registry slots, selectedRef split

E4 ("capability port + module registry + command palette") was gated by ADR 0005 behind a second real module existing, to avoid designing an interface against one real consumer (`orbat`) and a guess. Telegram's build is starting soon, so we're designing E4 now, ahead of Telegram's code landing, on the strength of that concrete near-term driver — not as a speculative exercise.

## What forces this

`shell/MainLayout.tsx` hardcodes per-module branching in four places: the `rightSlot` ternary (`selectedOsmObject ? <OsmObjectInspector/> : <EntityInspector/>`), the left-sidebar `Tabs` (`"layers" | "hierarchy"` → `LayersPanel`/`HierarchyPanel`), `treeSlot={<TreeView />}`, and `headerMenuSlot` fixed to `OsmQueryMenu`. `core/map/MapView.tsx` has the same disease one level down: it imports `SymbolsLayer`/`OrganisationsLayer`/`NetworkLinksLayer` from `modules/orbat` by name — `core` reaching into a `module`, backwards per this codebase's own layering rule.

`TELEGRAM_TIMELINE.md`'s existing Phase 6 plan sidesteps all of this by making Telegram a wholly separate `TelegramPage` (own store, own Sigma.js graph, reached by switching away from `EditPage` entirely) — which trivially has zero shell branching by not sharing the shell at all. We're rejecting that shape: Telegram integrates into the shared `AppShell`/`MainLayout` as a real module, which is the only way "no shell-side per-module branching" is a meaningful test rather than one the separate-page plan passes by default.

## Decision

**Module manifest, composed statically.** Each module (`orbat`, `osm`, eventually `telegram`) exports one manifest object with up to six optional fields:

- `views?: { id, label, content }[]` — whole standalone top-level views (replaces `AppShell`'s hardcoded `"map" | "tree"` `Tabs`; Telegram's graph becomes a third entry). The map itself is *not* a module view — it's a fixed core view.
- `detailRenderer?: (id: string) => ReactNode`, keyed by the `selectedRef.kind` the module owns — replaces the `rightSlot` ternary.
- `leftPanels?: { id, label, content }[]` — replaces the hardcoded Layers/Army `Tabs`.
- `headerContribution?: ReactNode` — replaces the fixed `OsmQueryMenu` slot. A module's own async status UI (e.g. a future Telegram sidecar health dot) is just a component here doing its own polling — no special registry support needed for out-of-process concerns.
- `mapLayers?: ReactNode[]` — `core/map/MapView.tsx` renders `modules.flatMap(m => m.mapLayers ?? [])` instead of naming orbat's layer components directly, fixing the core→module import.
- `commands?: { id, label, run(ctx), when?(ctx) }[]` — feeds the command palette (Ctrl/Cmd+K, additive; the existing header "..." dropdown is unchanged, a separate surface for settings/chrome).

`shell/moduleRegistry.ts` imports each module's manifest and composes a plain array (`const modules = [orbatModule, osmModule]`) — no dynamic `registerModule()` side-effecting registration. This is a single-bundle, local-first app; nothing loads modules independently or out of order, so a mutable global registry would solve a problem this app doesn't have.

**The `ModuleManifest` type is defined at `src/types/module.types.ts`** (validated by a 7-agent workshop — 3 advocates for `core/`/`shell/`/`src/types/`, 3 adversarial verifiers, 1 synthesizer — run 2026-07-10). `CONSTRAINTS.md:30` states the core React-import ban precisely and names `core/map` as its *one* sanctioned exception — a second file there (`core/moduleManifest.types.ts`), even a type-only `import type { ReactNode }`, would be a second, textually unsanctioned carve-out, not a reading of an existing one. `shell/moduleRegistry.types.ts` was rejected for the opposite reason: every existing shell↔module edge runs shell→modules (`MainLayout.tsx` imports `EntityInspector`, `TreeView`, `OsmQueryMenu` from `modules/*`); modules importing a type from `shell/` would introduce the one dependency direction that appears nowhere else in this codebase — the same inverted-arrow shape this ADR is already fixing for `core/map → modules/orbat`. `src/types/module.types.ts` is the only option with zero violated written rule and zero novel dependency direction: `src/types/layout.types.ts` already proves the folder holds React-shaped contract types both `shell/` and modules read from, with neither tier reaching into the other's territory. It's an imperfect precedent — `layout.types.ts` is a 1:1 producer→consumer bridge, `ModuleManifest` is an N-producer/1-consumer port — but that's a cardinality mismatch, not a rule violation.

**Selection stays split, deliberately.** `selectedEntityId` remains in `useProjectStore`'s transactional quintet, because `deleteEntity`/`removeLayer` clear it atomically in the same `set` call as entity/geometry removal — a tested invariant from Gate C that a separate selection store would break (deleting an entity would need a second, non-atomic `set` on a different store to clear its own selection). A new peripheral `useSelectionStore` holds every *other* selection kind (osm today, telegram-channel later) and derives the unified view: entity selection wins when present, otherwise the peripheral store's ref. Every consumer reads the derived `selectedRef`, not the two source fields directly.

## Considered and rejected

- **Dynamic self-registration** (`registerModule()` called at each module's import time into a singleton). Rejected: adds import-order dependency and indirection this single-bundle app has no use for.
- **`selectedRef` in one dedicated store, entity included.** Rejected: breaks `deleteEntity`'s atomic selection-clear, reintroducing a two-step, can-desync state class Phase C's "decompose, do not pulverise" principle exists to prevent.
- **Command palette absorbing the header "..." dropdown.** Rejected for now: that dropdown is settings/chrome (AI keys, view mode, about), not palette-searchable actions. Revisit once the palette exists and proves itself.
- **Registry scoped to `rightSlot` only**, leaving `views`/`leftPanels`/`headerContribution`/`mapLayers` as hand-added branches. Rejected: leaving any of them hardcoded means "no shell-side per-module branching" is only partly true — the same disease survives in the parts left alone.
- **`ModuleManifest` type in `core/`.** Structurally the best analogy to `core/persistence`'s port pattern, but disqualified by `CONSTRAINTS.md:30`'s explicit, textual React-import ban on `core/` with `core/map` named as the *only* exception; adopting it would mean silently adding an unwritten second exception.
- **`ModuleManifest` type in `shell/`.** Best locality-of-consumption (the registry composer lives there), but it forces `modules/orbat/index.ts`/`modules/osm/index.ts` to import from `shell/`, inverting the only dependency direction shell↔modules has ever had in this codebase.

## Consequences

- `shell/MainLayout.tsx` stops importing `orbat`/`osm` UI components by name; it composes `modules` generically.
- `core/map/MapView.tsx` stops importing `modules/orbat` directly.
- Telegram's build (per the revised `TELEGRAM_TIMELINE.md` Phase 6) targets this manifest shape from its first shell-integration commit instead of a separate `TelegramPage`.
- A future module with a data store the `.gpkg` can't hold (e.g. Telegram's `.tgdb`) still goes through `core/persistence`'s existing store-agnostic port (ADR 0005) for *data* — this ADR only covers the *shell UI* registration surface, a distinct axis.
