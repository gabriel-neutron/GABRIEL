# Best-Practices Timeline — Gabriel

This timeline replaces migration-history tracking with a forward-looking, multi-phase quality plan.
Its goal is to make this repository a concrete example of production-grade frontend engineering for
a local-first GIS + OSINT workflow.

## Principles

- Keep scope practical: fix what blocks safe feature delivery first.
- Prefer measurable outcomes over broad intentions.
- Enforce standards in tooling, not in memory.
- Keep architecture simple and explicit.
- Strengthen reliability without introducing unnecessary dependencies.

---

## Phase 1 — Baseline Integrity (Weeks 1-2)

**Status:** complete (CI + `npm run verify`; ESLint errors/warnings cleared; generated folders excluded).

**Goal**: Restore trust in local and CI quality signals.

**Scope**
- Resolve current lint failures and warnings that indicate correctness risks.
- Ensure generated artifacts are excluded from source linting.
- Standardize "green" baseline: lint, test, build.

**Primary Targets**
- `eslint.config.js`
- `src/App.tsx`
- `src/pages/ViewPage.tsx`
- `src/components/map/MapView.tsx`
- `src/components/map/SymbolsLayer.tsx`
- `src/components/map/DrawControls.tsx`
- `src/components/inspector/OsmObjectInspector.tsx`

**Tasks**
- [x] Fix all ESLint errors in `src/` and `docs`-owned source files.
- [x] Add explicit ignores for build/generated folders (for example `dist`, `storybook-static`).
- [x] Resolve React hooks/ref anti-patterns flagged by current rules (remaining `exhaustive-deps` warnings tracked separately).
- [x] Keep story files aligned with Storybook framework lint rules.

**Exit Criteria**
- [x] `npm run lint` returns 0 errors.
- [x] `npm run test` passes.
- [x] `npm run build` passes without new warnings introduced by project code.

---

## Phase 2 — Docs and Architectural Truth (Weeks 2-3)

**Status:** complete (core docs aligned to current architecture; planning doc scope standardized).

**Goal**: Make docs fully trustworthy for onboarding and day-to-day decisions.

**Scope**
- Remove contradictions between architecture docs and implementation.
- Define one source of truth per topic (state, enrichment providers, testing rules).
- Establish a lightweight docs update rule for future PRs.

**Primary Targets**
- `README.md`
- `CLAUDE.md`
- `docs/TECH_STACK.md`
- `docs/ARCHITECTURE.md`
- `docs/CONSTRAINTS.md`

**Tasks**
- [x] Update state-management documentation to match `useProjectStore`.
- [x] Correct AI provider docs to match implemented provider set.
- [x] Mark historical sections clearly as historical or remove them.
- [x] Add a short "docs updated?" checklist item to contribution workflow docs.

**Exit Criteria**
- [x] No known docs-vs-code contradictions in core project docs.
- [x] New contributor can run app + understand current architecture from docs only.

---

## Phase 3 — Testing and Release Gates (Weeks 3-5)

**Status:** in progress (CI + coverage gate + `npm run verify`; GeoPackage WASM integration and page-level tests still open).

**Goal**: Move from "tests exist" to "critical workflows are defended."

**Scope**
- Add missing enforcement (CI).
- Add integration coverage where failures are most expensive.
- Start tracking coverage for critical modules.

**Primary Targets**
- `.github/workflows/` (new)
- `package.json`
- `src/services/geopackage.service.test.ts`
- `src/pages/EditPage.tsx` (integration tests around key flows)
- `src/hooks/useEnrichment.ts` / `src/hooks/useLayeredResearch.ts` (behavior tests)

**Tasks**
- [x] Add CI pipeline running lint, test, and build on PRs.
- [ ] Add at least one real GeoPackage WASM round-trip integration test.
- [ ] Add integration tests for open/save/session-restore path.
- [x] Enable coverage output and define minimum baseline for critical modules.

**Exit Criteria**
- [ ] PRs cannot merge without passing CI checks.
- [ ] GeoPackage persistence boundary has real integration coverage.
- [x] Coverage is reported in CI and enforced for agreed critical paths.

---

## Phase 4 — OSINT Evidence Quality Gate (Weeks 5-7)

**Goal**: Ensure enrichment outputs are auditable, not just plausible.

**Scope**
- Strengthen claim-to-source reliability.
- Add contradiction handling.
- Add stale evidence controls.

**Primary Targets**
- `src/services/enrichment/enrichment.service.ts`
- `src/services/enrichment/validators.ts`
- `src/services/enrichment/promptTemplate.ts`
- `src/types/enrichment.types.ts`
- `src/components/enrichment/` (presentation of conflict/unresolved states)

**Tasks**
- [ ] Enforce field-level citation binding (proposal field -> concrete retrieved URL(s)).
- [ ] Add contradiction detection for conflicting candidate values.
- [ ] Add stale-evidence policy (date metadata where available + scoring penalty/rules).
- [ ] Ensure unresolved/contradictory fields are explicit in UI and not silently accepted.

**Exit Criteria**
- [ ] Each accepted enrichment field has verifiable source linkage.
- [ ] Contradictions are surfaced as unresolved, not flattened into single "confident" output.
- [ ] Evidence freshness policy is enforced in scoring/selection, not prompt text alone.

---

## Phase 5 — Security and Privacy Hardening (Weeks 7-8)

**Goal**: Reduce avoidable local-first operational risk.

**Scope**
- Improve API key handling behavior.
- Introduce retrieval policy enforcement.
- Keep local-first guarantees explicit and testable.

**Primary Targets**
- `src/services/enrichment/settings.service.ts`
- `src/components/shared/AiProviderSettingsDialog.tsx`
- `src/services/enrichment/providers/*`
- `src/services/enrichment/validators.ts`

**Tasks**
- [ ] Add session-only key mode and clear persistence UX warnings.
- [ ] Add source-domain policy checks before evidence acceptance.
- [ ] Ensure no secrets appear in logs/errors.
- [ ] Document security assumptions and threat boundaries in docs.

**Exit Criteria**
- [ ] Key persistence behavior is explicit, user-controlled, and documented.
- [ ] Policy checks can reject disallowed sources deterministically.
- [ ] No secrets leak in known error/log paths.

---

## Phase 6 — Maintainability Refactor (Weeks 8-10)

**Goal**: Lower change risk by reducing orchestration complexity.

**Scope**
- Split oversized files by responsibility.
- Keep behavior unchanged while clarifying boundaries.
- Improve testability of orchestration logic.

**Primary Targets**
- `src/pages/EditPage.tsx`
- `src/hooks/useEnrichment.ts`
- `src/services/enrichment/enrichment.service.ts`
- `src/components/inspector/EntityInspector.tsx`

**Tasks**
- [ ] Extract page orchestration concerns into focused hooks/services.
- [ ] Split enrichment orchestration into retrieval/scoring/synthesis modules.
- [ ] Keep component files under team-agreed limits where feasible.
- [ ] Add tests around extracted units before/with refactors.

**Exit Criteria**
- [ ] Core orchestration files are materially smaller and single-purpose.
- [ ] Refactor introduces no behavior regressions (tests + manual smoke checks pass).
- [ ] New feature work in these areas no longer requires broad cross-file edits.

---

## Phase 7 — Performance and Scalability Baseline (Weeks 10-11)

**Goal**: Make performance regressions visible before users feel them.

**Scope**
- Add practical performance checks for map-heavy flows.
- Start controlling bundle growth.

**Primary Targets**
- `src/components/map/MapView.tsx`
- `src/components/map/NetworkLinksLayer.tsx`
- `src/components/map/SymbolsLayer.tsx`
- `src/stories/map/` (performance stories/fixtures)
- `vite.config.ts`

**Tasks**
- [ ] Add/restore performance story for `NetworkLinksLayer` with large fixture.
- [ ] Verify memoization/selectors under realistic entity counts.
- [ ] Add bundle-size tracking and define warning/error budgets.
- [ ] Introduce code-splitting only where it reduces critical-path cost.

**Exit Criteria**
- [ ] Performance story exists and is used for regression checks.
- [ ] Bundle budget is measurable and tracked in CI or release checklist.
- [ ] No major map interaction regressions at target dataset size.

---

## Phase 8 — Release Excellence and Team Scale (Weeks 11-12)

**Goal**: Make high-quality delivery repeatable with minimal heroics.

**Scope**
- Formalize release checklist.
- Add stop-ship rules for quality/security/OSINT integrity.
- Improve onboarding and contribution workflow.

**Primary Targets**
- `docs/CONSTRAINTS.md`
- `docs/ARCHITECTURE.md`
- `docs/TIMELINE.md`
- `README.md`
- CI workflow and PR template docs

**Tasks**
- [ ] Add explicit stop-shipping triggers to release docs.
- [ ] Add PR checklist sections: docs sync, risk level, test evidence.
- [ ] Add onboarding quickstart for architecture + quality gates.
- [ ] Define quarterly maintenance cadence for docs/tooling rules.

**Exit Criteria**
- [ ] Release checklist is actively used and versioned.
- [ ] Contributors can ship safely through documented workflow only.
- [ ] "Best-practice" expectations are enforced by process and tooling.

---

## Ongoing Cadence (Post Phase 8)

- Weekly: triage lint/test/build/CI drift.
- Bi-weekly: architecture/doc drift review.
- Monthly: OSINT quality gate review with sample audits.
- Quarterly: dependency refresh + performance baseline re-check.

This cadence prevents quality decay while the feature surface grows.
