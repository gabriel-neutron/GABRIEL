# Gabriel
Local-first, browser-only ORBAT (Order of Battle) editor.
Military analysts build and annotate hierarchical unit structures on a map — all data stays on-device in `.gpkg` files. AI enrichment calls go browser→OpenAI/Tavily with user keys; no Gabriel server ever touches the data.

## Map
`src/pages/` routes — EditPage (full I/O), ViewPage (read-only demo)
`src/components/` UI — map/, inspector/, enrichment/, shared/, tree/, ui/
`src/store/` useProjectStore (Zustand), enrichment.store (pure reducer)
`src/services/` GeoPackage I/O, enrichment pipeline, Overpass/Tavily/OpenAI adapters
`src/hooks/` React hooks (useEnrichment, useLayeredResearch, …)
`src/types/` domain types (MapEntity, LatLng/LngLat, …)
`src/utils/` pure functions — no React
`docs/` architecture, constraints, PRD, tech stack, timeline

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
- **Pure core** — `services/` and `utils/` must not import from React
- **I/O is gated** — only `EditPage` and `ViewPage` may call `loadGeoPackage` / `saveGeoPackage`
- **Docs are load-bearing** — never modify `docs/` without confirming it's in scope for the current task
- **Commits** — imperative mood, present tense; each phase ends with `npm run verify` passing
