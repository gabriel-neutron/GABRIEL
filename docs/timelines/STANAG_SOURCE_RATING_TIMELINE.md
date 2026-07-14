# Implementation Timeline — STANAG 2511 Source Rating & Auto-Tagging

This timeline covers the ADMIRALTY / NATO STANAG 2511 source-evaluation and auto-tagging feature: deterministic **Source Reliability** (A–F), AI-assisted **Information Credibility** (1–6), the **conversion (backfill) of the current database** as of today, and **real-time auto-tagging of new sources**.

Governing decisions:
- [`CONTEXT.md`](../../CONTEXT.md) — Source Reliability, Information Credibility, Interested-party flag, Rating, Rating Assessor.
- ADR [0006](../adr/0006-source-claim-first-class-model.md) — first-class `Source`/`Claim` (already landed; the two tables and `reliability`/`credibility` columns exist).
- ADR [0008](../adr/0008-reliability-as-capped-type-prior.md) — reliability is a capped, deterministic type-prior (never `A`/`B` from type; `F` for unknowns).
- ADR [0009](../adr/0009-machine-never-confirms.md) — the AI may never assign credibility `1`; independence is measured by corroboration clusters, not URLs.

## Interpretation note

"Conversion of today's data using ADMIRALTY" is implemented as **Phase 2's backfill**: a one-pass, zero-AI conversion of every existing Source in the current `.gpkg`/store that lacks a reliability letter. It rates the *sources already in the database as of today* — it does not re-rate sources that already carry a human or prior rating. Confirm this reading; the rest of the plan follows from it.

## Principles

- **Right-size to scale** — single-user, single-file, local-first. No new tables where an additive column serves; no event-sourcing (ADR-rejected); no maintained affiliation platform. See memory *right-size-to-project-scale*.
- **Deterministic where cheap, AI only for the fuzzy residual** — reliability and independence-clustering are code; the AI judges only credibility, with hard caps it cannot exceed.
- **The machine surfaces, the human confirms** — no rating is presented as authority the machine did not earn; credibility `1` and reliability `A`/`B` are human-only.
- **Honest labeling ships *with* the rating** — a phase that makes a rating visible also ships the UI that marks it provisional. No misleading badge is ever shipped, even briefly.
- **Additive, backward-compatible persistence** — new columns are `optional` + `fallbackSql`; old `.gpkg` files must round-trip unchanged. Each phase ends with `npm run verify` green.
- **Backfill is null-fill only, versioned** — re-tuning the reliability table never silently re-rates existing files.

---

## Phase 1 — Foundations, Migration & Guardrails

**Status:** not started
**Est. effort:** S–M
**Goal:** Make the persistence layer ready to carry rating metadata and fix two latent correctness traps *before* any rating is written. No user-visible change.

**Scope**
Schema-only groundwork plus the two bugs surfaced in review. Nothing rates anything yet.

**Primary Targets**
- `src/core/persistence/geopackage/provenanceSources.table.ts` (+`reliability_meta` column)
- `src/core/persistence/geopackage/provenanceClaims.table.ts` (+`credibility_meta` column)
- `src/core/persistence/geopackage/columnDescriptor.ts` (confirm `optional`/`fallbackSql`/`ensureOptionalColumns` path)
- `src/core/provenance/ratingMeta.ts` (new — the meta shape + encode/decode)
- `src/core/persistence/geopackage/*fixture*.test.ts` (round-trip + pre-feature file)

**Tasks**
- [ ] Define `RatingMeta` type: `{ confidence, rationale, assessor: { kind: "ai"|"analyst"|"type-table", model?, promptVersion?, analystId? }, mappingVersion?, updatedAt, overridden }`; credibility adds `evidenceRefs, corroborationClusters, statedAttribution, dates`.
- [ ] Add `reliability_meta TEXT` (JSON) to `provenance_sources` and `credibility_meta TEXT` (JSON) to `provenance_claims`, both `optional` with `fallbackSql: 'NULL'`.
- [ ] **Fix the insert-only write path**: `writeProvenanceSources`/`writeProvenanceClaims` must upsert (or clear-before-write) so a save that reuses a connection cannot violate `PRIMARY KEY`/`UNIQUE`. Add a test that saves twice into one connection.
- [ ] **Remove the `rowid`-ordering dependency** in `readProvenanceClaims`/`ledgerProjection`: order by an explicit `timestamp` (fall back to insertion order only when null), so re-assessment can't scramble first-seen logic.
- [ ] Extend the GeoPackage fixture test: open a **pre-feature** `.gpkg`, save, reload; assert the new columns appear via `ensureOptionalColumns` and old files still load.

**Exit Criteria**
- [ ] `npm run verify` green.
- [ ] A pre-feature `.gpkg` opens, migrates additively, and round-trips with no data loss.
- [ ] Saving the same store into one connection twice does not error or duplicate rows.
- [ ] Claim read order is deterministic under out-of-order timestamps.

---

## Phase 2 — Deterministic Reliability + Backfill of the Current Database ("conversion of today's data")

**Status:** not started
**Est. effort:** M
**Prerequisite:** Phase 1 exit criteria passed.
**Goal:** Assign every Source a capped, deterministic Admiralty reliability letter; **convert the existing database as of today** by null-filling ratings; surface reliability with an honest, provisional badge; allow human override.

**Scope**
Zero AI. The reliability table (ADR 0008), the interested-party flag, the null-fill backfill of current data, the override path, and the reliability badge — shipped together so nothing misleading is displayed.

**Primary Targets**
- `src/core/provenance/reliabilityTable.ts` (new — `domainType`/character → capped letter, `mappingVersion`)
- `src/core/provenance/interestedParty.ts` (new — small curated flag list + predicate)
- `src/core/provenance/admiralty.ts` (extend `setSourceReliability` to write meta + `overridden`)
- `src/modules/enrichment/services/*` or a `provenance` service (backfill pass over existing sources)
- `src/components/shared/InspectorFields` + a `ReliabilityBadge` component
- Tests alongside each

**Tasks**
- [ ] Implement the capped table (illustrative): `official→C`, `osint→C`, `news→D`, `wikipedia→D`, `social/forum/web/unknown→F`; **never `A`/`B`**. Stamp `mappingVersion`.
- [ ] Implement the interested-party flag (state media, belligerent MoD): lowers the prior and is recorded on the Source meta (its independence effect is consumed in Phase 3).
- [ ] Implement `backfillReliability(sources)`: fill **only** `reliability == null`, set `assessor: "type-table vX"`, `mappingVersion`, `updatedAt`. Never touch human or already-rated sources.
- [ ] Wire backfill to run once on project load / import for the current database; make it idempotent and re-runnable.
- [ ] Implement human override: sets letter (may be `A`/`B`), `assessor: analyst`, `overridden: true`.
- [ ] Build `ReliabilityBadge`: letter styled as a **neutral "type-based / provisional"** tag; `F` renders as neutral "cannot be judged" (never red/bottom-sorted); a human-assessed letter is visually distinct (earned vs provisional); tooltip states it is a source-type prior, not a track-record assessment.
- [ ] Ensure reliability is never combined with credibility into a single sortable "trust score."

**Exit Criteria**
- [ ] `npm run verify` green.
- [ ] Opening a database of existing bare sources yields a reliability letter on every source, capped at `C`, backfilled only where null.
- [ ] Re-running the backfill changes nothing; changing `mappingVersion` is required to re-rate (a deliberate, explicit action).
- [ ] An analyst can override any letter; the override survives save/reload and is marked as human-assessed in the UI.
- [ ] `F` and provisional letters are visually un-confusable with human-confirmed ratings.

---

## Phase 3 — AI Credibility Auto-Tagging of New Sources ("auto tagging of new sources")

**Status:** not started
**Est. effort:** M–L
**Prerequisite:** Phase 2 exit criteria passed.
**Goal:** During enrichment, assess information credibility (1–6) per claim with one batched AI call, **capped at `2`**, with the minimum honest safeguards, and surface it without implying confirmation.

**Scope**
The real-time path: new sources/claims created by an enrichment run get an AI credibility rating. v1 safeguards only (interested-party collapse, cheap near-duplicate clustering over retrieved snippets, dates, stated-attribution extraction). MinHash and the review queue are later phases.

**Primary Targets**
- `src/modules/enrichment/services/credibility.service.ts` (new — batched per-entity assessment)
- `src/modules/enrichment/services/independenceClusters.ts` (new — snippet near-dup + interested-party collapse; count clusters, not URLs)
- `src/modules/enrichment/services/promptTemplate.ts` (credibility prompt; reliability letter **absent** from prompt)
- `src/modules/enrichment/services/enrichmentApply.ts` (write `credibility` + `credibility_meta`; **skip overridden targets**; idempotent)
- `src/core/provenance/admiralty.ts` (enforce caps in code)
- A `CredibilityBadge` component
- Tests alongside each

**Tasks**
- [ ] Implement independence clustering: collapse near-duplicate snippet text and interested-party sources on the same side to one origin; attach `corroborationClusters` to meta.
- [ ] Implement the credibility prompt: one call per entity, all its citations side-by-side; asks for `{ credibility: 2–6, cluster assignment, statedAttribution, staleness, rationale, confidence }`. Reliability is not provided.
- [ ] **Enforce caps in code** (not prompt trust): AI output clamped to `2..6`; single cluster → `≤2`; contradiction → `≤4` (`5` if positively contradicted); no basis → `6`. The model can never emit `1`.
- [ ] Capture dates: per-citation `publishedAt` (from Tavily where present) + retrieval date + rating `as-of`; feed staleness into the prompt.
- [ ] Write path: set `credibility` + `credibility_meta` (`assessor: ai, model, promptVersion, evidenceRefs, clusters, dates`). **Skip any target with `overridden: true`**; do not spam identical rows on re-run.
- [ ] Build `CredibilityBadge`: number styled as an **estimate**; cluster count on the face ("2 clusters" vs "1"); persistent **"estimated by model — not verified"** (not a dismissable dialog); `6` neutral. Vocabulary: *corroboration found / single-origin / interested party / unverified* — never *confirmed/verified/trusted*.
- [ ] Store the LLM free-text as **"model narrative (not verified)"**, demoted below the structured evidence (citations, clusters, query, model+prompt version).

**Exit Criteria**
- [ ] `npm run verify` green.
- [ ] A new enrichment run tags each new claim with a credibility `2..6` and full meta; no output is ever `1`.
- [ ] A single-origin cluster and a contradiction both correctly cap the number; `6` is emitted for no-basis cases.
- [ ] Re-running enrichment does not overwrite a human override and does not duplicate meta.
- [ ] The credibility badge shows cluster count and an un-dismissable "not verified" label.

---

## Phase 4 — Human Review Workflow & the "Confirm" Gate (v1.5)

**Status:** not started
**Est. effort:** M
**Prerequisite:** Phase 3 exit criteria passed.
**Goal:** Give the analyst a review queue and the *only* path to credibility `1` / reliability `A`/`B`, plus a full append-only audit trail.

**Primary Targets**
- `src/core/persistence/geopackage/ratingEvents.table.ts` (new — append-only audit table)
- A review-queue store + `ReviewQueue` panel
- `src/components/shared/…` promote/override affordances

**Tasks**
- [ ] Add the append-only `rating_events` table (written on every rating change); the current value stays materialized on the row (no replay). Guard with `tableExists`; extend the round-trip test.
- [ ] Implement review triggers: flag when confidence low OR reliability ≥ `D` OR single-cluster corroboration OR interested-party sole origin OR contradiction present.
- [ ] Build the review queue UI: shows each flagged rating with its cluster/date/attribution evidence.
- [ ] Implement the human **Confirm** affordance — promotes `2 → 1` (or sets `A`/`B`) — available **only** in review, and only when ≥2 distinct clusters with dates are present. Records a human `rating_event`.
- [ ] Surface override provenance everywhere: a human-superseded AI value is visibly marked, never silently replaced.

**Exit Criteria**
- [ ] `npm run verify` green.
- [ ] Every rating change appends a `rating_events` row; history is queryable; old files still load.
- [ ] `1` and `A`/`B` are reachable only through the review workflow; the machine path still cannot produce them.
- [ ] Flagged ratings appear in the queue with their evidence; confirming one records a human event and updates the badge styling to "confirmed."

---

## Phase 5 — Safeguard Hardening & Rating Eval (v1.5)

**Status:** not started
**Est. effort:** M
**Prerequisite:** Phase 3 (and ideally 4) passed.
**Goal:** Strengthen circular-reporting detection and prove the ratings aren't decoration.

**Tasks**
- [ ] Add MinHash / shingling over full article bodies (not just snippets) to catch wire syndication across many domains; feed cluster counts into the credibility pass.
- [ ] Expand the interested-party list from real observed sources; keep it small and curated.
- [ ] Build a **diagonal-collapse eval fixture**: a small labeled set (e.g. Oryx-confirmed vs debunked-MoD vs known-recycled-footage); run the pipeline and assert the A–F × 1–6 distribution does **not** cluster on A1/B2/C3.
- [ ] Add stated-attribution-chain extraction quality checks.

**Exit Criteria**
- [ ] `npm run verify` green.
- [ ] Wire-syndicated reposts across N domains collapse to one cluster and do not inflate credibility.
- [ ] The eval fixture passes its non-diagonal assertion and runs in CI.

---

## Phase 6 — Actor Posterior & Per-Field Claims (v2, exploratory)

**Status:** not started
**Est. effort:** L
**Prerequisite:** Phases 1–5 in production; enough human confirmations to matter.
**Goal:** Turn reliability from a prior into a real posterior — the doctrinally-correct evolution.

**Tasks**
- [ ] Introduce an `Actor` (URL → channel / domain / byline); `Source` references an Actor. Reuse `core/identity` (E3) machinery.
- [ ] Compute a per-Actor reliability posterior from that actor's human-confirmed vs human-refuted claims; let it nudge (never silently overwrite) the letter, human-overridable, and now able to justify `A`/`B` on earned track record.
- [ ] Emit per-field `Claim`s (`value != null`) so credibility attaches to a specific reported item (doctrine's true unit) instead of the per-(source,entity) approximation.

**Exit Criteria**
- [ ] An actor with a strong confirmed-claim history rises above its type-prior letter, with the change auditable in `rating_events`.
- [ ] Per-field claims carry their own credibility without breaking the general-citation path.

---

## Ongoing Cadence (post v1.5)

- On any model or prompt change: bump `promptVersion`/`model` stamp; queue AI-assessed ratings produced under the old version for re-assessment (they are findable by their stamp).
- On reliability-table tuning: bump `mappingVersion`; re-rate is an explicit, logged action, never automatic on load.
- Periodically re-run the diagonal-collapse eval as the prompt evolves.
- Review the interested-party list against newly-observed state-media / belligerent sources.

---

## Risk Register

| Risk | Phase at Risk | Signal to Watch | Response |
|---|---|---|---|
| Old `.gpkg` files fail to migrate | Phase 1 | Pre-feature fixture fails to load | Confirm `optional`/`fallbackSql`; never make new columns `NOT NULL` |
| Insert-only write path corrupts on connection reuse | Phase 1 | PK/UNIQUE violation or duplicate rows on second save | Upsert / clear-before-write (Phase 1 task) |
| Analysts over-trust the badge | Phase 2 → 3 | Users treat `C2` as verified truth | Provisional/neutral styling, un-dismissable "not verified", human-only Confirm |
| Circular reporting still reads as corroboration | Phase 3 → 5 | Wire-syndicated claim rated highly-corroborated | Cluster (not URL) counting; interested-party collapse; MinHash in Phase 5; machine capped at `2` |
| Diagonal collapse (A1/B2/C3) reappears | Phase 3 → 5 | Eval fixture shows >~50% on diagonal | Reliability absent from credibility prompt; caps in code; tune prompt |
| Reliability re-rates silently on table tweak | Phase 2 | Existing letters change after a table edit | Null-fill only + `mappingVersion` gate |
| AI credibility cost per run too high | Phase 3 | Token cost per entity above budget | Batch per entity (already); cache; gate to changed claims |
| Human override clobbered by re-run | Phase 3 | Overridden value reverts after enrichment | `overridden` skip enforced at write time + test |
