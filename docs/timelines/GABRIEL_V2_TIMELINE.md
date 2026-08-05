# Timeline — Gabriel v2.0

Master execution tracker for [`GABRIEL_V2_PRD.md`](../GABRIEL_V2_PRD.md). This file holds **stage
status, order, and what is owed**. It deliberately holds no design detail: each stage gets its own
spec in this folder, written when the stage starts.

**Driver:** FNF OSINT+ Investigation Competition 2026. Gabriel v2.0 is a co-deliverable alongside
the investigative report, the CC-BY dataset, and the public map.

---

## Stage map

Order follows the PRD's rule — *dependencies, not estimates*. Stage 0 runs continuously alongside
everything else.

| # | Stage | Covers (PRD §) | Spec | Status |
|---|---|---|---|---|
| 0 | Wall-clock & continuous | Further Notes, §13 | — | **Running** |
| 1 | Foundation — model + Proposal spine | §1–5 | per-slice: [`GABRIEL_V2_SLICE_0_1_BUILD.md`](GABRIEL_V2_SLICE_0_1_BUILD.md), [`SLICE_2A_CRITERIA.md`](SLICE_2A_CRITERIA.md), [`GABRIEL_V2_SLICE_2B_BUILD.md`](GABRIEL_V2_SLICE_2B_BUILD.md) | **Model shipped (slices 0–3, 5); Proposal spine and Claims-on-Relationships not started** |
| 2 | Search & table | §8, §10 (table) | not written | Not started |
| 3 | Connectors & sync | §6, §7 | not written | Not started |
| 4 | Documents & weak signals | §9 | not written | Not started |
| 5 | Visualisation | §10 | not written | Not started |
| 6 | Publication | §11 | not written | **Gate and serialisers shipped 2026-08-04; preflight and versioned releases not** |

### Where this actually stands — read before planning anything

**Corrected 2026-08-04**, against the code rather than against this file. Every status above had
drifted: Stage 1 read "slices 0–1 shipped, 2A next" when 0–3 and 5 had shipped, and Stage 6 read
"Not started" when its gate and three serialisers were in `src/core/export/`. This file's own
warning applies to itself — *a stage gate that contradicts the shipped decision is the kind of
line an agent builds against.*

Two of the PRD's six problems are answered in code: **"I cannot store what I am investigating"**
(the twelve-type vocabulary, tiers, dates, validation, persistence and the hierarchy index) and
**"I cannot publish what the proposal promised"** (a single gate feeding CSV, GeoJSON and JSON-LD,
with attribution and a withheld-counts report).

**But the v2 thesis is not yet demonstrable, and this is the one thing to fix next.** No UI can
author any edge type. Every relationship write in the app goes through `withActiveParent` — the
parent picker — so eleven of the twelve types are modelled, validated, persisted, exported and
documented while being unreachable to an analyst. The real project file proves it: its 1,012 edges
are 999 `subordinate_to` plus 13 `corporate_parent`, and those 13 arrived through the legacy
migration, not through anyone recording them.

So the PRD's central sentence — *"I can catalogue the nodes of the backbone; I cannot record the
backbone"* — remains literally true of the interface. A demo today shows a better v1 ORBAT tree.

**Shortest path to a demonstrable v2**, in dependency order and ahead of the stage order below,
because a demo needs one recorded chain rather than a complete capability:

1. **A Relationship editor.** A form over machinery that is already finished — `EDGE_TYPES` carries
   per-type endpoint kinds and metadata rules, `validateRelationships` enforces them, the index
   derives from the result and the export gate publishes it. Roughly twenty edges along one real
   chain is enough to tell the investigative story.
2. **The entity graph view.** The Sigma/WebGL stack is built and perf-proven but wired to the
   sidecar's *channel* graph; `TelegramGraphView` already accepts a `SigmaGraphData` prop, so this
   is an adapter plus edge-type and tier filters. Highest visual payoff per hour.
3. **Search (Stage 2).** Still `name.toLowerCase().includes(q)` in `UnifiedSearch.tsx:69` — the
   "six results" failure the PRD calls the most humiliating in the project. Partly needed by (1)
   anyway, since authoring an edge means finding both endpoints.

Collaboration and continuity (§12 — baton pass, private repo backup) is a **protocol, not a
stage**: it starts before Stage 1 and runs forever. See [Standing obligations](#standing-obligations).

**Why this order.** Everything attaches to the Relationship and Proposal types, so Stage 1 is
first. Search and table are small and pay off immediately during cataloguing, so they precede the
ingestion machinery that will fill the catalogue. Connectors and sync produce the volume that
documents and weak signals then correlate. Visualisation reads a graph that must exist first.
Publication is gated by construction and ships last, when there is something gated to ship.

---

## Stage 0 — Wall-clock & continuous

These cannot be compressed by development speed, so they start before code and run underneath
every other stage.

- [ ] **File the corporate registry access application.** Days to weeks of lead time; the
      connector is fourth in build order but the application cannot wait for it.
- [ ] **File the leak/registry aggregator access application.** Same reasoning; fifth in build
      order.
- [ ] **Seed Telegram military-industrial and recruitment channels** relevant to the target
      facilities, and let the governed crawler collect in the background throughout the
      investigation window. Collection is governed and slow *by design* — it must start early and
      run long. See [`TELEGRAM_TIMELINE.md`](TELEGRAM_TIMELINE.md).
- [ ] **Owed from the Telegram Slice 8 crawl:** its Risk Register prescribed "add forward-chain
      edge type in v2; document gap" for the `< 200 channels at depth 3` signal that actually
      fired (37 channels from 13 seeds). Neither the gap entry nor an ADR has been filed. Decide
      here whether forward-chain discovery enters v2 scope or is formally declined.

---

## Stage 1 — Foundation

**Specs, per slice.** The single eight-slice Foundation Spec was deleted on 2026-07-29 (superseded,
and wrong in six measured places). Slices 0–1: [`GABRIEL_V2_SLICE_0_1_BUILD.md`](GABRIEL_V2_SLICE_0_1_BUILD.md)
— **shipped** (`507f425`, `cfaf80b`). Slice 2A: [`SLICE_2A_CRITERIA.md`](SLICE_2A_CRITERIA.md),
frozen, **shipped** (`65ddc11`). Slice 2B: [`GABRIEL_V2_SLICE_2B_BUILD.md`](GABRIEL_V2_SLICE_2B_BUILD.md),
**shipped** (`8527d44`). Slice 3 has no frozen criteria file; its record is the
[`SLICE_RUN_LOG.md`](SLICE_RUN_LOG.md) entry for 2026-08-04.

**Gate for the whole stage:** the real demo project opens, its parent-child links become
`subordinate_to` and `corporate_parent` Relationships, it saves, and it reopens with an identical
hierarchy — **1,012 edges, not 2,024** — and an identical *rendered position map*. Every existing
view behaves as before.

**Met, 2026-08-04**, and held by test rather than by inspection: `hierarchy.fingerprint.test.ts`
pins the parent map, the rendered position map and the tree shape over the real 1,027-entity file,
two of the three hashes measured against pre-Slice-3 code. The migration produces exactly 1,012
edges — 999 `subordinate_to` and 13 `corporate_parent`.

One caveat the gate's wording hides: the migration still runs **in memory on every load**. The
file on disk carries no `relationships` table — it holds `units`, `organisations`, `layers`,
`geometries` and `research_sources`, and records the hierarchy in the legacy `parent_id` column.
Nothing has been persisted because §10 steps 17–28, the first write of the derived model, are
unrun and are the owner's call.

**`parentId` is kept**, as a derived, non-authoritative field, and is never deleted; the
`relationships` table is the source of truth on disk. This paragraph previously stated the
opposite — "with `parentId` gone from the type and from the file" — which was the pre-review plan
the expert panel revised away on 2026-07-29. Corrected here because a stage gate that contradicts
the shipped decision is the kind of line an agent builds against.

| Slice | Status |
|---|---|
| 0 — Vocabulary and Relationship type (+ ADR 0010) | **Shipped** — `EDGE_TYPES`, twelve record + one assessment tier, `EDGE_VOCABULARY_VERSION` now `1.1.0` |
| 1 — External Ids | **Shipped** — `core/entity/externalId.ts`, round-tripped in `units.table` |
| 2 — Relationships table, load/save, parentId migration | **Shipped** — 2A `65ddc11`, 2B `8527d44` |
| 3 — Hierarchy index seam | **Shipped** — `df40b61`, plus the cross-kind fix `52e3b19` the code review caught |
| 4 — Write path, `parentId` deleted | **Superseded, not skipped.** `parentId` is kept as a derived non-authoritative field (see the correction above). The write path did move onto edges; what remains is that `updateEntity` still accepts a `parentId` patch (`useProjectStore.ts`), which should be closed structurally with `Omit<MapEntity, "parentId">` |
| 5 — New entity kinds | **Shipped** — `vessel`, `person`, `equipment_class` declared as field-less profiles |
| 6 — Claims on Relationships | **Not started.** Load-bearing beyond its slice: because an edge carries no provenance, the export gate cannot ask whether a relationship is sourced and falls back to a documented **endpoint proxy** — both endpoint entities must carry a claim. On the real corpus that publishes 252 of 1,012 edges. Closing this slice is what would let the PRD's literal rule ("unsourced Relationships never ship") be applied as written |
| 7 — Proposal spine core | **Not started.** Only the enrichment-specific `ProposalDecision` exists; there is no generic `Proposal` type, so connectors and document extraction have nothing to emit into |

---

## Stages 2–6

Not specified yet. Each gets a `GABRIEL_V2_<STAGE>_SPEC.md` in this folder when it starts, written
against the code as it stands at that point rather than against the code as it is today. Recorded
here only as scope reminders:

- **2 — Search & table.** Instant index (names, aliases, Notes, Claim values, External Ids, Source
  titles), Claim-value pivot, deep scan over cached page text; sortable facetted table with bulk
  operations. Also the natural home for the unified review surface Stage 1 defers.
- **3 — Connectors & sync.** The Telegram sidecar generalises into the Gabriel sidecar with a
  registries module. Anchored expansion is a hard rule: anchors plus one hop, never a mirror.
  Build order: OpenSanctions bulk → KSE tracker parsers → vessel-record paste-parser → aggregator
  lookup → corporate registry → commercial AIS (only if the maritime track activates).
- **4 — Documents & weak signals.** Six stages (read, fuse, co-occurrence, attribute collisions,
  second look, temporal rules). Only read and second-look consume AI. Originals stay outside the
  project file with an integrity hash inside it; extracted text goes in, which is what brings
  documents into deep search — and what would finally make full-body MinHash clustering possible
  (see [ADR 0009](../adr/0009-machine-never-confirms.md)).
- **5 — Visualisation.** Entity graph on the existing WebGL stack, filtered by edge type, tier and
  time window; per-entity timeline; criticality badge; the inspector becomes the entity dossier.
- **6 — Publication.** **Partly shipped 2026-08-04, out of stage order**, because the working file
  was being served publicly and the gate was the thing that made a release describable. Done:
  `applyExportGate` as a single pure predicate feeding all three formats, CSV / GeoJSON / JSON-LD
  serialisers, attribution and licence, the edge-type definitions travelling with the edges, and a
  README reporting what was withheld *in numbers*. Two rules are worth knowing before building on
  it: relationships are gated by the **endpoint proxy** (Slice 6 above), and GeoJSON publishes
  **recorded geometry only** — 275 of 1,027 entities have one, and the other 752 are exported with
  `"geometry": null` rather than the position Gabriel derives for the map, because a derived
  position is a rendering and not an observation. Still owed: the preflight report, versioned
  releases with changelogs, and applying the gate to what `ViewPage` serves.

---

## Standing obligations

Running from now, not gated on any stage.

- **Baton discipline.** One canonical project file. Pull before opening, push at end of session; a
  rejected push *is* the collision detector. The first silent overwrite will happen on a tired
  evening — the rule is only as good as the reflex.
- **Repository backup.** The canonical `.gpkg` and the documents folder live in the repository. It
  is simultaneously the baton, the backup, and the audit trail. **Amended 2026-08-04:** read
  "private repo, never the public code repo" until the owner ruled code and data both public. The
  repo is `github.com/gabriel-neutron/GABRIEL`, public since 2026-05-05, verified against the API.
- **AI budget stays frugal.** Deterministic indexes first; model calls scoped, cached, manually
  triggered. No background agents.
- **Review capacity is the real bottleneck.** If a queue structurally exceeds two analysts, narrow
  the ingestion scope — never lower the review bar.
- **`npm run verify` green before any slice or stage is claimed done.**

---

## Risk register

| Risk | Stage at risk | Signal to watch | Response |
|---|---|---|---|
| `parentId` removal breaks a hierarchy consumer | 1 | A tree, layout or map link renders differently after Slice 4 | Slices 2 and 3 prove migration and the seam against the real fixture first; Slice 4 is small and revertible on its own |
| Real `.gpkg` fails the migration gate | 1 | The 1,010-unit fixture test fails | Deterministic `hier:` ids and additive columns only; legacy load path keeps today's strict behaviour |
| Review queue outgrows two analysts | 3 → 4 | Pending proposals rise faster than they are decided | Narrow anchored expansion; batch regime for reference data; never relax per-item review for signal |
| Registry access never granted | 0 → 3 | No response weeks after filing | Connectors 4 and 5 are dropped; OpenSanctions + KSE + paste-parser carry the corporate layer |
| Vocabulary proves too narrow mid-investigation | 1 → 4 | Analysts want a label that does not exist | Versioned file + two-person amendment; `associate_of` is the identified first candidate |
| Person data leaks into the CC-BY release | 6 | Preflight shows person entities in the export set | Gate is a single pure predicate applied to every format; no natural persons in v1 by policy. **Fired 2026-08-04, and not where this row was watching.** The project holds no `person` entity at all, so the watched signal could never trigger — the names were in the `research_sources` fetch cache, five uncited entries naming a head of state and several foreign officers, published in every commit since February. Stripped from the working file (`scripts/strip-research-cache.mjs`); still in git history by owner ruling, and disclosed in `LICENSE-DATA.md`. Lesson for this register: watch the surfaces nobody modelled, not only the ones the model names |
| Telegram corpus too sparse to corroborate | 0 | Collection plateaus well below useful volume | Already fired once at depth 3 — see the owed Stage 0 item |

---

## Document map

- [`../GABRIEL_V2_PRD.md`](../GABRIEL_V2_PRD.md) — the master PRD: problem, stories, decisions. Stable.
- **This file** — stage status and order. Changes often.
- `GABRIEL_V2_*_SPEC.md` — one per stage, build detail. Written when the stage starts.
- [`../adr/`](../adr/) — decisions that outlive the stage that made them. ADR 0010 (first-class
  Relationships) lands with Stage 1 Slice 0.
- [`../../CONTEXT.md`](../../CONTEXT.md) — the glossary. Updated per slice, not at the end.
