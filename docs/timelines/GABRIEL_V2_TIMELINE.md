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
| 1 | Foundation — model + Proposal spine | §1–5 | per-slice: [`GABRIEL_V2_SLICE_0_1_BUILD.md`](GABRIEL_V2_SLICE_0_1_BUILD.md), [`SLICE_2A_CRITERIA.md`](SLICE_2A_CRITERIA.md), [`GABRIEL_V2_SLICE_2B_BUILD.md`](GABRIEL_V2_SLICE_2B_BUILD.md) | **Slices 0–1 shipped; 2A next** |
| 2 | Search & table | §8, §10 (table) | not written | Not started |
| 3 | Connectors & sync | §6, §7 | not written | Not started |
| 4 | Documents & weak signals | §9 | not written | Not started |
| 5 | Visualisation | §10 | not written | Not started |
| 6 | Publication | §11 | not written | Not started |

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
frozen, **next to build**. Slice 2B: [`GABRIEL_V2_SLICE_2B_BUILD.md`](GABRIEL_V2_SLICE_2B_BUILD.md).

**Gate for the whole stage:** the real demo project opens, its parent-child links become
`subordinate_to` and `corporate_parent` Relationships, it saves, and it reopens with an identical
hierarchy — **1,012 edges, not 2,024** — and an identical *rendered position map*. Every existing
view behaves as before.

**`parentId` is kept**, as a derived, non-authoritative field, and is never deleted; the
`relationships` table is the source of truth on disk. This paragraph previously stated the
opposite — "with `parentId` gone from the type and from the file" — which was the pre-review plan
the expert panel revised away on 2026-07-29. Corrected here because a stage gate that contradicts
the shipped decision is the kind of line an agent builds against.

| Slice | Status |
|---|---|
| 0 — Vocabulary and Relationship type (+ ADR 0010) | Not started |
| 1 — External Ids | Not started |
| 2 — Relationships table, load/save, parentId migration | Not started |
| 3 — Hierarchy index seam | Not started |
| 4 — Write path, `parentId` deleted | Not started |
| 5 — New entity kinds | Not started |
| 6 — Claims on Relationships | Not started |
| 7 — Proposal spine core | Not started |

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
- **6 — Publication.** CSV / GeoJSON / JSON-LD through a single export gate, preflight report,
  versioned releases with changelogs assembled from sync diffs.

---

## Standing obligations

Running from now, not gated on any stage.

- **Baton discipline.** One canonical project file. Pull before opening, push at end of session; a
  rejected push *is* the collision detector. The first silent overwrite will happen on a tired
  evening — the rule is only as good as the reflex.
- **Private repository backup.** The canonical `.gpkg` and the documents folder live in a private
  repo, never the public code repo. It is simultaneously the baton, the backup, and the audit
  trail.
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
| Person data leaks into the CC-BY release | 6 | Preflight shows person entities in the export set | Gate is a single pure predicate applied to every format; no natural persons in v1 by policy |
| Telegram corpus too sparse to corroborate | 0 | Collection plateaus well below useful volume | Already fired once at depth 3 — see the owed Stage 0 item |

---

## Document map

- [`../GABRIEL_V2_PRD.md`](../GABRIEL_V2_PRD.md) — the master PRD: problem, stories, decisions. Stable.
- **This file** — stage status and order. Changes often.
- `GABRIEL_V2_*_SPEC.md` — one per stage, build detail. Written when the stage starts.
- [`../adr/`](../adr/) — decisions that outlive the stage that made them. ADR 0010 (first-class
  Relationships) lands with Stage 1 Slice 0.
- [`../../CONTEXT.md`](../../CONTEXT.md) — the glossary. Updated per slice, not at the end.
