# Data licence — CC BY 4.0

The [MIT licence](LICENSE) in this repository covers **code only**. It is a software licence: it
says nothing useful about a dataset, carries no attribution requirement a data reuser would
recognise, and does not describe the thing this project exists to publish.

**The dataset artefacts in this repository are licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).**

## What that covers

| artefact | licence |
|---|---|
| `public/project.gpkg` — entities, hierarchy edges, layers, geometries, integrity records | CC BY 4.0 |
| any exported dataset (CSV, GeoJSON, JSON-LD) produced by the publish path | CC BY 4.0 |
| the thirteen edge-type `publicDefinition` strings, which travel with the data as its schema documentation (`EDGE_VOCABULARY_VERSION` `1.1.0`) | CC BY 4.0 |
| everything under `src/`, `scripts/`, `sidecar/` | MIT |
| `docs/` — including the ADRs, which are the methodology record for the dataset | CC BY 4.0 |

## Attribution

> Gabriel — https://github.com/gabriel-neutron/GABRIEL — CC BY 4.0

Reusers must also preserve the edge-type definitions when redistributing edges. A `subordinate_to`
row without its published definition is a claim stripped of the qualification that makes it
defensible, and the definitions are deliberately phrased to describe **records and observations**
rather than facts about the world (see [ADR 0010](docs/adr/0010-first-class-relationships.md)).

## What a reuser should know before relying on this

Stated plainly, because a licence that hides the limitations of its data is worth less than no
licence at all:

- **`public/project.gpkg` is the live working file, not a gated publication.** What is published
  is what the analysts are working on, including unproven hypotheses. Since 2026-08-04 the export
  gate itself exists as a tested pure predicate (`src/core/export/exportGate.ts`) and its rules are
  published below, but **nothing applies it to this file** — it is the filter for a future release,
  not a description of what you are downloading.
- **It no longer contains named natural persons — but its git history does.** Corrected
  2026-08-04. The whole file was probed for every surface a person could be named on: 1,027 entity
  names, 151 notes, every alias, every source URL. The only such surface was the `research_sources`
  fetch cache, which held a head of state and several named foreign officers extracted from a US
  Government publication, in five entries that no unit or organisation cited. That cache is now
  empty (`scripts/strip-research-cache.mjs`), and no entity of kind `person` has ever existed in
  this dataset. **Every commit up to `9f0387e` still carries the pre-strip file**, so the names
  remain retrievable from this repository's history until that history is rewritten.
- **Hierarchy edges are undated and largely unsourced.** All 1,012 migrated edges carry no start or
  end date, so each asserts a present-tense subordination with no observation date; 742 of the 999
  parented units carry no source at all. Measured 2026-08-04.
- **`parentId` is derived, not recorded** — but not yet in this file. Relationships are the record
  of who sits under whom and the legacy column is a rendering of them
  ([ADR 0011](docs/adr/0011-relationships-are-the-hierarchy.md)). **Corrected 2026-08-04:** this
  read as though the file carried a `relationships` table. It does not. The file on disk holds five
  tables — `units`, `organisations`, `layers`, `geometries`, `research_sources` — and still records
  the hierarchy in the legacy `parent_id` column. All 1,012 edges are minted in memory by the
  one-shot migration on every load and have never been written down, which is also why the file
  carries no `provenance_sources`, `claims` or `integrity_events` table: those 249 sources, 413
  claims and 1 integrity event are derived at load time too.
- **Assessment-tier edges are a different kind of claim from record-tier ones**, and are gated
  ([ADR 0009](docs/adr/0009-machine-never-confirms.md)). Do not flatten the two tiers together.

## What the export gate withholds, when a release is cut

Published here because a reuser who cannot read what was filtered out cannot tell the absence of a
row from an absence of evidence — for a hierarchy dataset, the difference between "not subordinate"
and "we did not publish the subordination". The rules are `EXPORT_GATE_RULES` in
[`src/core/export/exportGate.ts`](src/core/export/exportGate.ts); this table is their prose form.

| withheld | rule |
|---|---|
| natural persons | Entities of kind `person` are never published, however well sourced. |
| relationships naming one | An edge with an excluded entity at either end goes too, so a name cannot survive in the edge table after its entity row is gone. |
| dangling relationships | An edge pointing at an entity outside the dataset, which a reuser cannot resolve. |
| unsourced relationships | An edge ships only when **both** endpoint entities carry at least one citation. |
| assessment-tier relationships | Analyst judgement, withheld unless the edge carries a two-person export override naming a proposer and a different confirmer. |

ADMIRALTY reliability and credibility ratings **are** published; they are the point of the dataset.
The research fetch cache never is.

**Read the unsourced rule carefully.** Gabriel attaches sources to *entities*, not to edges, so
"both endpoints are cited" is a **proxy** for edge-level sourcing and not a claim that any
particular subordination was itself cited. Applied to this project on 2026-08-04 it would publish
all 1,027 entities and **252 of the 1,012 edges**, withholding 760 for want of a citation — a
figure pinned by test so that loosening the gate cannot pass unremarked.
