# Feature-first core/shell/modules layout, delivered in two streams

Gabriel moves from a **type-first** layout (`components/`, `services/`, `hooks/`, `store/`, `types/`, `utils/` — where one capability like enrichment is smeared across five folders) to a **feature-first** layout in three tiers:

- **`core/`** — the deep, shared spine every module reuses: `entity/` (Entity, Profile union, `hierarchy.ts`), `provenance/` (ledger storage), `persistence/` (a store-agnostic port; `geopackage/` is one adapter), `coordinates/`, `map/` (Leaflet substrate + position engine + selection dispatch).
- **`shell/`** — the application frame: `AppShell`, `MainLayout`, settings.
- **`modules/`** — one feature per folder, everything co-located (`ui/`, `hooks/`, `store/`, `services/`): `orbat/`, `enrichment/`, `osm/`.

The migration is deliberately split into **two streams** so the build stays green (`npm run verify`) at every commit and the risky work is isolated:

- **Stream 1 — the mechanical reorg (this effort, zero features).** File moves into `core/shell/modules`; the `MapEntity → Entity` rename as a flat tagged union behind an alias (ADR 0004); peeling three *peripheral* store slices; splitting `provenance-ledger.ts`; extracting duplicated inspector sub-components. Every step is an independently revertible commit.
- **Stream 2 — deferred semantic epics (later, each its own PR, gated by a round-trip test).** In order: (E1) collapse `Organisation` into a Corporate Profile — the pilot that validates ADR 0004; (E2) first-class `Source`/`Claim` model (ADR 0006); (E3) `core/identity` cross-module entity resolution; (E4) the capability port + module registry + command palette (the "VS Code-style" shell).

## Why

Three independent reviews converged: the type-first smear is the real obstacle to modularity and debuggability, and the direction (feature-first core/shell/modules) is right. But they surfaced two corrections and one hard risk that shape *how* it is done:

1. **The real coupler is the store, and it cannot be shattered per-module.** `useProjectStore` is one flat store with ~12 concerns referenced across 33 files — but `removeLayer` / `deleteEntity` / `updateEntity` mutate layers + entities + organisations + geometries + selection in a *single* `set`, and `selectPersistableSnapshot` has an inter-slice dependency (entities filtered by layer ids). The entity graph is legitimately *one* transactional concern. So: peel the three genuinely-independent slices (map-prefs, osm-view, source-cache) and keep the graph quintet welded. Decompose, do not pulverise.
2. **Several roadmap-critical pieces are data-model changes, not folder moves** — and each is a schema migration that must be gated by a round-trip test. Bundling them into the reorg reproduces the big-bang failure mode. Hence Stream 2.

## Considered options

- **One big-bang refactor** (reorg + rename + store split + Organisation collapse + Source/Claim together). Rejected: multiple simultaneous semantic + schema changes cannot be landed green incrementally.
- **Build the module registry / command palette now.** Rejected as premature: with one real module (`orbat`) it is speculative infrastructure and counts as a *feature*. `ProviderBundle` already demonstrates the swappable-capability pattern; the dynamic shell is deferred to E4, once a second real module (Telegram) exists.
- **Create empty reserved `modules/telegram|corporate|maritime` and `sidecars/` dirs now.** Rejected: same speculative-seam objection we applied to the code. Create each when its module lands.

## Consequences

- **Boundary calls (all three reviews aligned):** the Leaflet map is `core` (substrate) with profile-specific *layers* owned by modules; `enrichment` is a `module`, but its accept→ledger-merge logic moves down to `core/provenance` (split `provenance-ledger.ts` along the storage-vs-citation-rating seam); `Organisation` is another Entity profile (E1).
- `core/persistence/` is a store-agnostic port because the roadmap adds stores the `.gpkg` cannot hold (the Telegram `.tgdb`); `geopackage/` is one adapter behind it.
- File moves stay green because the `@/` alias, Storybook/Vitest globs, and (trivially low) coverage thresholds tolerate any move within `src/`. Lockstep obligations: a subject moves with its `./`-importing test and its `@/`-importing story in the same commit; update `components.json` when `ui/` moves.
- The "VS Code-style modular menus" the product wants is delivered by E4 — the reorg is the prerequisite that makes it cheap, not the reorg itself.
