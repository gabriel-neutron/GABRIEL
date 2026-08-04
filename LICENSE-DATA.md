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

- **`public/project.gpkg` is the live working file, not a gated publication.** The export gate the
  PRD describes — the filter between working data and a public release — **does not exist yet**.
  What is published is what the analysts are working on, including unproven hypotheses.
- **It contains named natural persons.** The `research_sources` cache holds an extract from a US
  Government publication naming individual officers with roles and dates. The project's own
  publication rule excludes natural persons from released datasets; that rule is not yet enforced
  by anything.
- **Hierarchy edges are undated and largely unsourced.** All 1,012 migrated edges carry no start or
  end date, so each asserts a present-tense subordination with no observation date; 742 of the 999
  parented units carry no source at all. Measured 2026-08-04.
- **`parentId` is derived, not recorded.** The `relationships` table is the only record of who sits
  under whom; the retained legacy column is a rendering of it
  ([ADR 0011](docs/adr/0011-relationships-are-the-hierarchy.md)).
- **Assessment-tier edges are a different kind of claim from record-tier ones**, and are gated
  ([ADR 0009](docs/adr/0009-machine-never-confirms.md)). Do not flatten the two tiers together.
