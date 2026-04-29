# AGENTS.md — Gabriel

Canonical entry point for **AI coding agents** (Cursor, Claude Code, Codex, etc.) and humans automating changes. Tool-specific hints live in [CLAUDE.md](CLAUDE.md) and [.cursor/rules/](.cursor/rules/); **commands and quality gates are defined here** to avoid drift.

## Project

**Gabriel** is a local-first React + TypeScript SPA for military map editing (ORBAT). GeoPackage (`.gpkg`) is the persistent source of truth; there is **no backend** in this repo.

## Stack (short)

- React 19, Vite 7, TypeScript (strict), Tailwind v4, shadcn/Radix UI  
- Leaflet + react-leaflet, milsymbol, GeoPackage via `@ngageoint/geopackage` (browser / WASM)  
- Zustand: [`src/store/useProjectStore.ts`](src/store/useProjectStore.ts) holds runtime project state (layers, entities, geometries, selection, OSM overlay cache)  
- Enrichment / OSINT: [`src/services/enrichment/`](src/services/enrichment/) (OpenAI + Tavily + optional cached snippets; Overpass used from layered research)

## Where to start (code map)

| Area | Path |
|------|------|
| Edit / save / session | [`src/pages/EditPage.tsx`](src/pages/EditPage.tsx) |
| Read-only demo | [`src/pages/ViewPage.tsx`](src/pages/ViewPage.tsx) |
| Project store | [`src/store/useProjectStore.ts`](src/store/useProjectStore.ts) |
| GeoPackage I/O | [`src/services/geopackage.service.ts`](src/services/geopackage.service.ts) |
| Enrichment orchestration | [`src/services/enrichment/enrichment.service.ts`](src/services/enrichment/enrichment.service.ts) |
| Enrichment UI hook | [`src/hooks/useEnrichment.ts`](src/hooks/useEnrichment.ts) |
| Architecture narrative | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Conventions & tests | [`docs/CONSTRAINTS.md`](docs/CONSTRAINTS.md) |
| Quality roadmap | [`docs/TIMELINE.md`](docs/TIMELINE.md) |

Path alias: `@/` → `src/` (see [`vite.config.ts`](vite.config.ts)).

## Verification (required before claiming “done”)

Run from repo root:

```bash
npm run verify
```

This runs **ESLint** → **Vitest with coverage** (thresholds in [`vitest.config.ts`](vitest.config.ts)) → **Typecheck + production build**.

Individual steps:

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci` and `npm run verify` on pushes/PRs to `main` / `master`. CI uploads the `coverage/` artifact when present.

## Quality gates (do not bypass)

- Do not merge or ship if `npm run verify` fails locally or in CI.  
- Do not lower coverage thresholds in [`vitest.config.ts`](vitest.config.ts) to hide missing tests; raise coverage or narrow `coverage.include` only with team agreement and doc updates.  
- Current global thresholds are a **low baseline** (~12% statements) reflecting only exercised modules; tighten over time per [`docs/TIMELINE.md`](docs/TIMELINE.md).  
- ESLint: `react-hooks/set-state-in-effect` is **off** intentionally (data-fetching / dialog sync patterns); still avoid unnecessary effect-only state when a derived value or event handler is clearer (see [React docs](https://react.dev/learn/you-might-not-need-an-effect)).  
- Follow [Cursor guidance on large changes](https://docs.cursor.com/guides/advanced/large-codebases): prefer a short written plan and explicit file list before big edits.

## OSINT / enrichment integrity (agent rules)

- Treat enrichment as **assistive**: outputs are proposals until the human accepts them; GeoPackage truth updates only through the normal Save flow.  
- Do not weaken validation in [`src/services/enrichment/validators.ts`](src/services/enrichment/validators.ts) without replacing with stronger checks.  
- API keys: [`src/services/enrichment/settings.service.ts`](src/services/enrichment/settings.service.ts) — never log keys, never put them in thrown errors or user-visible strings.  
- Prefer evidence traceability: when changing synthesis or `buildResponse`, preserve or improve URL grounding (see audit / timeline Phase 4).

## Stop-ship triggers (pause feature work until fixed)

- `npm run verify` fails on default branch.  
- CI missing or not required for merge.  
- Docs that describe state, providers, or commands contradict this file or the code.  
- Secrets or API keys logged or exposed.  
- GeoPackage or enrichment public APIs changed without tests or doc updates agreed in [`docs/CONSTRAINTS.md`](docs/CONSTRAINTS.md).

## Human / Anthropic-style workflow hints

- Use **Ask / plan mode** for ambiguous or cross-cutting work; paste ticket + `@` relevant files ([Cursor: large codebases](https://docs.cursor.com/guides/advanced/large-codebases)).  
- Use **Rules** as long-term memory: project rules live under [`.cursor/rules/`](.cursor/rules/); keep them short and link here instead of duplicating commands ([Cursor: rules](https://docs.cursor.com/guides#rules)).  
- Provide **explicit context** in prompts: which tables, which store fields, which services must not be bypassed ([Cursor: context](https://docs.cursor.com/guides#providing-context-in-cursor)).

## Contributing checklist (PRs)

- [ ] `npm run verify` passes  
- [ ] Docs updated if architecture, providers, or verification commands changed (`AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/*` as appropriate)  
- [ ] New logic in `services/enrichment` or `geopackage.service.ts` has or extends tests  
