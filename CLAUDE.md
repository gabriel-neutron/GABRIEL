# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Identity

**Gabriel** — local-first, browser-only ORBAT (Order of Battle) editor. Military analysts build and annotate hierarchical unit structures on a map; all data stays on-device in `.gpkg` files.

## WHY

Military researchers and OSINT analysts need to build hierarchical military unit maps without leaking data to third-party servers or requiring GIS licences. Gabriel runs entirely in the browser: project data lives in a GeoPackage file on disk (plus an IndexedDB cache), and AI enrichment calls go directly from the browser to OpenAI/Tavily using user-supplied API keys — no Gabriel server ever touches the data.

## WHAT

```
src/
  pages/        EditPage (full I/O), ViewPage (read-only demo)
  components/   UI components — map/, inspector/, enrichment/, shared/, tree/, ui/
  store/        useProjectStore (Zustand), enrichment.store (pure reducer)
  services/     GeoPackage I/O, enrichment pipeline, Overpass/Tavily/OpenAI adapters
  hooks/        Custom React hooks (useEnrichment, useLayeredResearch, …)
  types/        Domain type definitions (MapEntity, LatLng/LngLat, …)
  utils/        Pure functions — no React imports
docs/           Architecture, constraints, PRD, tech stack, timeline
```

## HOW

```bash
npm install
npm run dev           # Vite dev server (localhost:5173)
npm run build         # tsc + Vite production build
npm run test          # Vitest single pass
npx vitest run src/services/enrichment/enrichment.service.test.ts  # single file
npm run test:coverage # Vitest with coverage (thresholds in vitest.config.ts)
npm run lint          # ESLint
npm run verify        # lint + test:coverage + build  ← run before claiming done
npm run storybook     # Storybook on port 6006
```

Path alias `@/` → `src/`. CI runs `npm run verify` on push/PR to `main` (`.github/workflows/ci.yml`).

## Doc index

| File | Covers |
|---|---|
| `docs/PRD.md` | Product requirements, user stories, success criteria |
| `docs/ARCHITECTURE.md` | Component tree, data flows, coordinate contract, enrichment pipeline |
| `docs/CONSTRAINTS.md` | Naming, file structure, code style, testing, error handling, git conventions |
| `docs/TECH_STACK.md` | Approved libraries, versions, and rationale |
| `docs/TIMELINE.md` | Phase roadmap and acceptance criteria |
| `docs/TELEGRAM_OSINT_PRD.md` | Telegram OSINT module PRD — WIP, exclude from generic phase commands |

## Workflow

- `/phase-start` — read PRD + CONSTRAINTS + ARCHITECTURE + TIMELINE, then plan the next phase
- `/phase-review` — verify `npm run verify` passes, check acceptance criteria in TIMELINE.md

## Operating rules

1. Read `docs/CONSTRAINTS.md` before writing any new file or refactoring existing structure.
2. Never modify files in `docs/` without confirming the change is in scope for the current task.
3. Only `EditPage` and `ViewPage` may call `loadGeoPackage` / `saveGeoPackage`.
4. `services/` and `utils/` must not import from React.
5. Commit messages: imperative mood, present tense. Each phase ends with `npm run verify` passing.
