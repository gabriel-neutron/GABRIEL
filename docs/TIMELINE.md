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

**Status:** complete (local Phase 3 scope complete; branch protection enforcement explicitly deferred by user decision).

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
- [x] Add at least one real GeoPackage WASM round-trip integration test.
- [x] Add integration tests for open/save/session-restore path.
- [x] Enable coverage output and define minimum baseline for critical modules.

**Exit Criteria**
- [ ] PRs cannot merge without passing CI checks. *(Skipped for now by user request; enforce in repo settings later.)*
- [x] GeoPackage persistence boundary has real integration coverage.
- [x] Coverage is reported in CI and enforced for agreed critical paths.

---

## Phase 4 — OSINT Evidence Quality Gate (Weeks 5-7)

**Status:** complete (citation contract, AI-driven contradiction/staleness policy, client validation, drawer UX).

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
- [x] Enforce field-level citation binding (proposal field -> concrete retrieved URL(s); `MIN_SOURCES_PER_PROPOSAL`).
- [x] Add contradiction detection for conflicting candidate values (`unresolvedReasons` / `conflicts`, AI + normalization).
- [x] Add stale-evidence policy (Tavily `publishedAt` on sources; invalid ISO rejected; **Stale** UI when published date is more than 365 days old; synthesize instructions).
- [x] Ensure unresolved/contradictory fields are explicit in UI and not silently accepted.

**Exit Criteria**
- [x] Each accepted enrichment field has verifiable source linkage (≥1 URL per proposal; validated before apply).
- [x] Contradictions are surfaced as unresolved, not flattened into single "confident" output (drawer + `conflict` candidates or downgrade when empty).
- [x] Evidence freshness is enforced in validation/UI and model instructions (full scoring pipeline extension deferred if not required).

---

## Phase 5 — Security and Privacy Hardening (Weeks 7-8)

**Status:** complete (security baseline verified: `localStorage` key persistence + no secret echo in adapter errors/URLs; broader hardening items below remain deferred).

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
- [x] Ensure no secrets appear in logs/errors (baseline: adapter error paths covered by tests).
- [ ] Document security assumptions and threat boundaries in docs.

**Exit Criteria**
- [x] Key persistence behavior is explicit, user-controlled, and documented (`settings.service` + tests + `docs/CONSTRAINTS.md`).
- [ ] Policy checks can reject disallowed sources deterministically.
- [x] No secrets leak in known error/log paths (OpenAI/Tavily adapter tests).

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

## Phase 7 — Legacy & Compatibility Cleanup (Weeks 10-11)

**Goal**: Remove unnecessary backward-compatibility layers, silent fallbacks, and obsolete abstractions in file management and persistence paths for a single-user workflow.

**Scope**
- File open/save and export code paths.
- GeoPackage schema compatibility logic and migration handling.
- IndexedDB persistence error semantics and versioning policy.
- Read-only adapters and no-op wrappers.
- Docs/comments alignment with actual runtime behavior.

**Primary Targets**
- `src/services/geopackage.service.ts`
- `src/pages/EditPage.tsx`
- `src/components/shared/AppShell.tsx`
- `src/pages/ViewPage.tsx`
- `src/services/projectStorage.service.ts`
- `src/store/useProjectStore.ts`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CONSTRAINTS.md`

**Tasks**
- [ ] Replace implicit schema fallbacks with explicit version/migration strategy (or documented hard fail).
- [ ] Remove no-op compatibility adapters in read-only UI contracts.
- [ ] Decide and document single browser/file-export strategy; remove extra branches if out of scope.
- [ ] Eliminate dead state and unused compatibility fields.
- [ ] Replace silent catches in persistence/load flows with explicit, typed handling.
- [ ] Run a targeted docs drift pass on file-management and persistence behavior.

**Exit Criteria**
- [ ] No silent fallback masks corruption/version issues in file/persistence paths.
- [ ] No compatibility wrapper remains without an explicit documented requirement.
- [ ] File import/export behavior is single-path or intentionally dual-path with documented rationale.
- [ ] Docs and inline comments match current implementation for the targeted modules.

---

## Phase 8 — Enrichment Simplification Review & Refactor (Weeks 11-12)

**Goal**: Reduce enrichment complexity and coupling while preserving current behavior, evidence integrity, and validation guarantees.

**Scope**
- Orchestration complexity in `runEnrichment` and related helper logic.
- Hook-level lifecycle and cancellation flow in `useEnrichment`.
- Layered-research orchestration overlap and provider bundle usage.
- Prompt/provider boundary normalization and fallback behavior.
- UI contract simplification between enrichment state and drawer rendering.

**Primary Targets**
- `src/services/enrichment/enrichment.service.ts`
- `src/hooks/useEnrichment.ts`
- `src/services/research/layered-research.service.ts`
- `src/store/enrichment.store.ts`
- `src/services/enrichment/providers/openai.adapter.ts`
- `src/services/enrichment/providers/provider.types.ts`
- `src/components/enrichment/EnrichDrawer.tsx`
- `src/types/enrichment.types.ts`
- `src/services/enrichment/enrichment.service.test.ts`
- `src/services/enrichment/providers/openai.adapter.test.ts`

**Tasks**
- [ ] Split `runEnrichment` into focused modules (validation, retrieval loop, synthesis normalization, response assembly).
- [ ] Replace stringly diagnostics and stop-reason assembly with typed internal structures.
- [ ] Consolidate relevance/confidence/source-mapping heuristics into a single shared scoring layer.
- [ ] Extract async run/cancel/epoch logic from `useEnrichment` into a dedicated runner hook/service.
- [ ] Reduce no-op/stale UI API surface in enrichment drawer contracts.
- [ ] Align layered and single-entity enrichment orchestration semantics and error statuses.
- [ ] Keep or improve current validation/citation/conflict guarantees with explicit tests.

**Exit Criteria**
- [ ] Enrichment orchestration files are materially smaller and single-responsibility.
- [ ] Public enrichment behavior remains stable (no regression in proposal, unresolved, and conflict handling).
- [ ] Cancellation/close flow is deterministic and easier to reason about.
- [ ] Test coverage for enrichment critical paths is maintained or improved.
- [ ] No new fallback/compatibility branch is introduced without explicit rationale.

---

## Phase 9 — Performance and Scalability Baseline (Weeks 10-11)

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

## Phase 10 — Release Excellence and Team Scale (Weeks 11-12)

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

## Ongoing Cadence (Post Phase 10)

- Weekly: triage lint/test/build/CI drift.
- Bi-weekly: architecture/doc drift review.
- Monthly: OSINT quality gate review with sample audits.
- Quarterly: dependency refresh + performance baseline re-check.

This cadence prevents quality decay while the feature surface grows.
