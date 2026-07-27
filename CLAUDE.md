# Gabriel
Windows. Docs in `docs/` (read `docs/CONSTRAINTS.md` before new files/refactors; ADRs in `docs/adr/`).
Rules: local-first zero-leak (data never leaves device except user-keyed AI calls); `core/`/`services/`/`utils/` stay React-free outside `ui/`; only EditPage/ViewPage call `loadGeoPackage`/`saveGeoPackage`; commits imperative present-tense; `npm run verify` must pass before calling work done.
