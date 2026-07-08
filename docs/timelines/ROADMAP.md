# Gabriel Roadmap

Master roadmap **and execution log** for Gabriel's evolution into the v2.0 project-agnostic OSINT
data-fusion environment. This file is the single place an executing agent reads to know *what to do
next*, *where the technical detail lives*, and *what has been done, deferred, or flagged*.

This file supersedes the old multi-phase quality timeline. The Telegram OSINT module keeps its own
detailed phase plan in [`TELEGRAM_TIMELINE.md`](./TELEGRAM_TIMELINE.md).

Decisions are recorded as ADRs in [`../adr/`](../adr/):
[0003](../adr/0003-local-first-self-hosted.md) ·
[0004](../adr/0004-entity-profile-tagged-union.md) ·
[0005](../adr/0005-feature-first-modular-architecture.md) ·
[0006](../adr/0006-source-claim-first-class-model.md).

---

## How to use this file (execution protocol)

An agent executing this roadmap **must** follow this loop:

1. **Work top to bottom, one item at a time.** Do the lowest unchecked `[ ]` item in the current phase.
2. **Read the 📎 reference first.** Each item links to the doc that holds the *how* and *why*. Do not
   invent behaviour that contradicts an ADR or `CONSTRAINTS.md`.
3. **Keep the build green.** `npm run verify` must pass at every commit. One item ≈ one revertible commit.
4. **Check the box and annotate.** When an item is done, set it to `[x]` and, if anything is
   non-obvious, add a `> note:` line under it (what you chose, what you skipped, what to revisit).
5. **Stop at every 🔒 Phase Gate. Do not self-certify.** A gate is crossed only after a **separate
   validation agent** (fresh context, not the agent that did the work) verifies the ✅ success
   criteria against the real repo + git diff, runs `npm run verify`, and records a verdict in the
   **Validation Log**. Proceed only on `PASS`. On `FAIL`, address the feedback and re-request validation.
6. **Log the load-bearing stuff, not everything.** Use the **Execution Ledger** at the bottom for:
   points intentionally *not* done, things to validate later, and anything that could bite later.
   Skip blow-by-blow detail — record only what a future reader would need to avoid a mistake.

**Status markers:** `[ ]` todo · `[x]` done · `[~]` partial/in-progress · `[!]` blocked
**Icons:** 📎 technical reference · ✅ success criteria · 🔒 phase gate (separate-agent validation)

---

## North star (Gabriel v2.0, FNF deliverable)

An open-source, **project-agnostic** data-fusion environment holding *entities, sources, ADMIRALTY
ratings, and geometries in a single auditable structure*, that any team can point at an adjacent
accountability domain. v2.0 grows these producer modules on top of today's ORBAT editor: Telegram
graph, corporate/sanctions graph (ETL), maritime (AIS/ADS-B), GEOINT (satellite change-detection) —
each behind an abstract capability interface, run as a local sidecar first. The deployed read-only
public map for consumers is a permanent, separate requirement, unaffected by any of this.

**Sequencing principle:** the foundation (Streams 1 & 2) comes *before* new modules. We do not build
the second module on the type-first, string-provenance foundation.

---

## Stream 1 — Mechanical reorg · zero features · green at every commit

📎 Governing decision: ADR [0005](../adr/0005-feature-first-modular-architecture.md).
📎 Target folder layout: [`../CONSTRAINTS.md`](../CONSTRAINTS.md) → *File & Folder Structure*.
Rule: a subject moves **with** its `./`-importing test and its `@/`-importing story in the same commit.

### Phase A — pure file moves (safe; smallest blast radius first)

- [ ] **A1** — `utils/orbat.ts → core/entity/hierarchy.ts`, leave a re-export shim. 📎 `CONTEXT.md` → *Hierarchy index*.
- [ ] **A2** — `services/geopackage/* → core/persistence/geopackage/*`. 📎 ADR 0005 (persistence port); `ARCHITECTURE.md` → *GeoPackage I/O Boundary*.
- [ ] **A3** — `provenance-ledger.ts → core/provenance/` **and split it**: ledger storage (`parse`/`serialize`/`merge`/`shouldPropose`) → core; citation rating (`rankCitations`/authority weight/`isSpecificArticleUrl`) → `modules/enrichment`. 📎 ADR [0001](../adr/0001-provenance-ledger-accumulation.md), ADR 0005.
- [ ] **A4** — `types/coordinates.ts → core/coordinates/`. 📎 `ARCHITECTURE.md` → *Coordinate Contract*.
- [ ] **A5** — `modules/enrichment/` ← `services/enrichment` + `hooks/useEnrichment` + `components/enrichment` + `services/research`. 📎 `ARCHITECTURE.md` → *AI Enrichment Pipeline*.
- [ ] **A6** — `modules/orbat/` ← `components/tree` + `EntityInspector` + `HierarchyPanel` + symbol code + `SymbolsLayer` + `NetworkLinksLayer`.
- [ ] **A7** — `modules/osm/` ← OSM components/services/hooks.
- [ ] **A8** — `core/map/` ← Leaflet substrate (`MapView`, position engine, selection dispatch); profile layers stay with their modules. **Heaviest churn — do last.**
- [ ] **A9** — `shell/` ← `AppShell`, `MainLayout`, settings; `ui/` ← shadcn primitives (**update `components.json` aliases in the same commit**).
- [ ] **A10** — Remove `reactflow` (unused). 📎 `PRD.md` → *Open Questions* (resolved), `TECH_STACK.md`.
- [ ] **A11** — Extract inspector sub-components duplicated between `EntityInspector` / `OrganisationInspector` (`SourcesList`, `LinkedGeometriesList`, `ReadOnlyField`) to a shared location. *(The no-schema-risk 80 % of the Organisation win.)*

✅ **Phase A success criteria**
- Every file sits in the target `core/shell/modules/ui` layout; no source imports an old path except intentional shims.
- `npm run verify` green (lint + test:coverage + build). Storybook builds.
- No behavioural change: the app opens, edits, enriches, and saves a `.gpkg` exactly as before.
- `reactflow` gone from `package.json` and lockfile.

🔒 **Gate A** — separate validation agent confirms the ✅ above against the git diff + a running app, records verdict in the Validation Log. Do not start Phase B before `PASS`.

### Phase B — type rename (low-risk semantic, shimmed)

- [ ] **B1** — `MapEntity → Entity` behind `export type MapEntity = Entity`; add `kind: "unit"` discriminant. 📎 ADR [0004](../adr/0004-entity-profile-tagged-union.md).
- [ ] **B2** — Introduce `Profile` as a **flat** tagged union at the type level only (no storage change). 📎 ADR 0004 (*flat, not nested* — non-negotiable).

✅ **Phase B success criteria**
- `Entity` is the canonical runtime type; `MapEntity` remains a working alias; `GpkgEntity` unchanged.
- `Profile` is a flat discriminated union on `kind`; **no** field is physically nested (`entity.echelon`, never `entity.profile.echelon`).
- Zero behavioural or on-disk change; GeoPackage round-trip test unchanged and green. `npm run verify` green.

🔒 **Gate B** — separate agent verifies the union is flat, the alias holds, and nothing regressed. `PASS` required before Phase C.

### Phase C — store peel (one slice per PR; keep the transactional graph welded)

- [ ] **C1** — Extract `useMapPrefsStore` (`baseMap`, `showNetworks`).
- [ ] **C2** — Extract `useOsmViewStore` (`entityOsmGeometries`, `osmUnavailable`, `selectedOsmObject`).
- [ ] **C3** — Extract `useSourceCacheStore` (`sourceCache`, `lastSavedAt`).
- [ ] **C4** — **Stop.** `layers + entities + organisations + drawnGeometries + selection` stay one store. 📎 ADR 0005 (*decompose, do not pulverise*).

✅ **Phase C success criteria**
- Three peripheral stores extracted; the transactional quintet remains a single store with single-`set` atomicity intact.
- `selectPersistableSnapshot` is still the single source of truth for save and still passes its test.
- Granular-selector invariant preserved (no leaf selects the whole root). `npm run verify` green.

🔒 **Gate C** — separate agent verifies atomicity + snapshot integrity, then declares **Stream 1 complete**.

---

## Stream 2 — Deferred semantic epics · each its own PR · gated by a `.gpkg` round-trip test

📎 Do not start until Gate C = `PASS`. Ordered. Each epic ends with its own 🔒 gate.

- [ ] **E1 — Collapse `Organisation` into a Corporate Profile.** The pilot validating ADR 0004; a GeoPackage schema migration (separate `organisations` table → `units` + `kind`). Removes ~400 lines of duplication. 📎 ADR 0004, ADR 0005.
  - ✅ Existing `.gpkg` files round-trip losslessly; parallel inspector/tree/node/store-slice/selection-id deleted; `npm run verify` green.
  - 🔒 Gate E1 — separate agent runs the round-trip test on real fixtures + confirms the deletions.
- [ ] **E2 — First-class `Source` / `Claim` model.** Replace `MapEntity.sources: string` with normalized records. Unlocks per-source/per-claim ADMIRALTY, the `.tgdb ↔ .gpkg` bridge, cross-module identity. 📎 ADR [0006](../adr/0006-source-claim-first-class-model.md).
  - ✅ Schema migration round-trips; UI still renders the same citations; ADMIRALTY can attach to a `Source`; `npm run verify` green.
  - 🔒 Gate E2.
- [ ] **E3 — `core/identity`.** Cross-module entity resolution (canonical ids, match candidates, merge/split, Latin↔Cyrillic aliases). Design with E2. 📎 ADR 0006 (*same machinery as `Source` dedup*).
  - ✅ Two records for one real-world entity can be proposed → confirmed → merged without data loss; `npm run verify` green.
  - 🔒 Gate E3.
- [ ] **E4 — Capability port + module registry + command palette** (the "VS Code-style" shell). Unify three-way selection into one `selectedRef {kind,id}`, then a narrow module registration interface. Build only once a second real module (Telegram) exists. 📎 ADR 0005.
  - ✅ Existing modules register through the interface with no shell-side per-module branching; selection is unified; `npm run verify` green.
  - 🔒 Gate E4.

---

## Module roadmap (FNF v2.0 · after the foundation)

Each module = a `modules/<name>/` folder + (where heavy) a `sidecars/<name>/` self-contained project
behind the capability port. Create each seam when the module lands, not before.

| Module | Store / feed | Sidecar | Detailed plan |
|---|---|---|---|
| **Telegram graph** | `.tgdb` (SQLite) | FastAPI + Telethon | [`TELEGRAM_TIMELINE.md`](./TELEGRAM_TIMELINE.md) |
| **Corporate / sanctions** | ETL → entities | connectors (OpenCorporates, OpenSanctions, Aleph) | _tbd_ |
| **Maritime** | AIS/ADS-B feed | Datalastic adapter | _tbd_ |
| **GEOINT** | satellite tiles | Sentinel-2 / SkyFi change-detection | _tbd_ |

ADMIRALTY scoring (STANAG 2511) on every entity and claim is delivered by E2, then surfaced per-module.

---

## Execution Ledger

> Running log kept by executing agents. Not a changelog — record only load-bearing items: what was
> deferred, what must be revisited, what could bite later, and non-obvious decisions and their reason.
> Newest entries on top. Stamp each with the phase/item and a date.

### Validation Log (separate-agent gate verdicts)

| Date | Gate | Verdict | Validator feedback (summary) |
|---|---|---|---|
| _(pending)_ | A | — | — |

### Deferred / to revisit later

- _(none yet)_

### Risks / watch

- **Sidecar reads `.gpkg` out-of-process** (Telegram): a known future violation of the "I/O only in
  page components" invariant — needs an explicit read-replica / cache-coherence seam when that module
  lands. 📎 ADR 0003. *(Logged at planning time; not a Stream-1 concern.)*

### Decisions taken during execution

- _(none yet)_
