# Gabriel
Local-first, browser-only ORBAT (Order of Battle) editor.
Military analysts build and annotate hierarchical unit structures on a map — all data stays on-device in `.gpkg` files. AI enrichment calls go browser→OpenAI/Tavily with user keys; no Gabriel server ever touches the data.

## Map
Feature-first, layered per ADR [0005](docs/adr/0005-feature-first-modular-architecture.md) (Stream 1 reorg — a few `git mv` tails remain; see ROADMAP).
`src/pages/` routes — EditPage (full I/O), ViewPage (read-only demo)
`src/core/` framework-agnostic core — `entity/`, `coordinates/`, `map/` (Leaflet substrate), `persistence/geopackage/` (GeoPackage I/O), `provenance/` (Source/Claim), `identity/` (entity resolution)
`src/modules/` feature modules, each `ui/` + `hooks/` + `services/` — `enrichment/` (AI pipeline + adapters), `orbat/` (tree/inspector/symbols), `osm/` (Overpass/Nominatim)
`src/shell/` app shell — AppShell, MainLayout, AI-provider settings
`src/ui/` shadcn/Radix primitives  ·  `src/components/shared/` cross-feature UI (dialogs, panels, InspectorFields)
`src/store/` useProjectStore (Zustand) + peripheral stores, enrichment.store (pure reducer)
`src/services/` projectStorage (IndexedDB session cache)  ·  `src/hooks/` cross-cutting hooks (useProjectIO)
`src/types/` domain types (Entity, LatLng/LngLat, …)  ·  `src/utils/` pure functions — no React
`docs/` architecture, constraints, PRD, tech stack, timeline; ADRs in `docs/adr/`

Path alias `@/` → `src/`.

## Docs
[PRD](docs/PRD.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [CONSTRAINTS](docs/CONSTRAINTS.md) · [TECH_STACK](docs/TECH_STACK.md) · [ROADMAP](docs/timelines/ROADMAP.md) · [TELEGRAM_OSINT_PRD](docs/TELEGRAM_OSINT_PRD.md) _(WIP — exclude from generic phase commands)_

## Commands
`npm run dev` · `npm run build` · `npm run test` · `npm run storybook`
`npm run verify` — lint + test:coverage + build ← run before claiming done
`npx vitest run <file>` — single test file
CI runs `npm run verify` on push/PR to `main`.

## Workflow
- `/phase-start` — read PRD + CONSTRAINTS + ARCHITECTURE + TIMELINE, then plan the next phase
- `/phase-review` — verify `npm run verify` passes, check TIMELINE acceptance criteria

## Principles
- **Local-first, zero-leak** — project data lives in a `.gpkg` on disk + IndexedDB cache; nothing leaves the device except user-keyed enrichment calls
- **Read CONSTRAINTS first** — consult `docs/CONSTRAINTS.md` before writing any new file or refactoring structure
- **Pure core** — `core/` (except `core/map`, which is React), `services/`, and `utils/` must not import from React outside `ui/`
- **I/O is gated** — only `EditPage` (via its private `useProjectIO` hook) and `ViewPage` may call `loadGeoPackage` / `saveGeoPackage`
- **Docs are load-bearing** — never modify `docs/` without confirming it's in scope for the current task
- **Commits** — imperative mood, present tense; each phase ends with `npm run verify` passing
