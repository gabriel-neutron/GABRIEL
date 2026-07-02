# Gabriel

Local-first browser ORBAT editor. Analysts build and annotate hierarchical military unit structures on a map; all data stays on-device in `.gpkg` files.

## Language

### Entities and structure

**MapEntity**:
A single node in the ORBAT hierarchy — a military unit, HQ, or formation. Holds structured fields (name, echelon, affiliation, position) plus three enrichable fields: Notes, Provenance Ledger, and unit IDs.
_Avoid_: entity, feature, unit (use MapEntity when precision matters)

**ORBAT** (Order of Battle):
The hierarchical structure of military units and their relationships. Gabriel's primary artefact.

**Orbat module** (`src/utils/orbat.ts`, `buildOrbat`):
The single shared parent/child traversal index for `MapEntity` and `Organisation` hierarchies —
`childrenOf`, `ancestors`, `descendants`, `roots`, `layers`, `depthOf`. Built once per items array
(e.g. inside a `useMemo`) and consumed by every module that walks the tree (`TreeView`,
`OrganisationTreeView`, `HierarchyPanel`, `NetworkLinksLayer`, `geometry.ts`,
`layered-research.service.ts`), instead of each reimplementing its own `childrenByParent` map.
_Orphan policy_: an item whose `parentId` points to a missing id is treated as a root — visible
in trees and eligible for enrichment, rather than silently vanishing. The map is the one
exception: an orphan without its own geometry has no anchored ancestor to orbit, so it stays off
the map until pinned or re-parented.
_Cycle policy_: a fully disconnected cyclic component gets a synthetic root at its
lexicographically smallest id, so it renders and ancestor/depth walks can't infinite-loop.
`src/utils/treeLayout.ts` (`computeTreeXIndex`) builds on the Orbat module to give `TreeView` and
`OrganisationTreeView` an identical horizontal-layout algorithm.

### Enrichment pipeline

**Enrichment Run**:
One execution of the AI pipeline for a single MapEntity — generates queries, retrieves web evidence, synthesises proposals.

**Enrichment Proposal**:
A suggested change to a single entity field, backed by Research Citations, which the analyst can accept or reject.
_Avoid_: suggestion, recommendation

**Research Citations**:
Ephemeral evidence objects (`EnrichmentProposal.sources` in code) that justify a specific Enrichment Proposal. Each citation carries url, title, snippet, domain type, and optional publication date. They are discarded after the run unless promoted to the Provenance Ledger via proposal acceptance.
_Avoid_: "sources" when referring to evidence (reserved for the Provenance Ledger)

**Provenance Ledger** (`MapEntity.sources` in code):
The persistent set of cited URLs stored on a MapEntity that back its accepted claims. Populated in two ways: (1) when an Enrichment Proposal is accepted, the top-2 Research Citations by authority weight are merged in automatically; (2) for entities with an empty Provenance Ledger, the pipeline can independently propose citations proving the entity's existing data.
_Avoid_: bibliography, source list, references

**Authority Weight**:
A 0–1 score assigned to a Research Citation based on its domain type: official/gov (0.95) > OSINT reports (0.8) > news (0.7) > social (0.55) > forum (0.45) > general web (0.4). Used to rank citations when selecting the top-2 for the Provenance Ledger.

### Notes

**Notes** (`MapEntity.notes`):
Free-text analyst annotation containing only: (1) recent organisational changes to the unit — reform, rename, re-subordination — or (2) Epistemic Caveats. Never restates data already present in structured fields.

**Epistemic Caveat**:
A note flagging uncertainty or contradiction: "identity unconfirmed," "conflicting sources on HQ location," "possibly a placeholder unit." Lives inside Notes.
_Avoid_: comment, remark, observation

## Relationships

- An **Enrichment Run** produces zero or more **Enrichment Proposals**
- Each **Enrichment Proposal** is backed by one or more **Research Citations**
- Accepting an **Enrichment Proposal** merges the top-2 **Research Citations** (by Authority Weight) into the **MapEntity**'s **Provenance Ledger**
- A **MapEntity** has exactly one **Provenance Ledger** (possibly empty)
- **Notes** on a **MapEntity** may contain zero or more **Epistemic Caveats**

## Flagged ambiguities

- **"sources"** was used to mean both the Provenance Ledger (entity field) and Research Citations (enrichment evidence). Resolved: "sources" in user-facing language always means the Provenance Ledger; evidence backing proposals is called Research Citations. In code, `EnrichmentProposal.sources` should be renamed to `EnrichmentProposal.citations`.
- **"notes"** was used loosely for any free text. Resolved: Notes is a constrained field — only organisational changes and Epistemic Caveats; battle history and operational movements are excluded.
