# Gabriel

Local-first, self-hosted OSINT data-fusion environment. Analysts build source-rated, geolocated entity graphs — hierarchical military ORBATs today, adjacent accountability domains (corporate, maritime, financial) next — with every claim traceable to its sources. All **producer** data stays on-device (`.gpkg` on disk + IndexedDB cache); the deployed build serves a read-only public map to **consumers**. No third-party SaaS ever touches the data; heavier pipelines run as local sidecars the analyst launches.

## Language

### Entities and structure

**Entity** (code: `MapEntity` today → generalises to `Entity`):
The core node of any Gabriel map — something **sourced, source-rated, geolocated, and hierarchable**. Carries a common core (id, `kind` discriminant, name, geometry/position, Provenance Ledger, source rating, `parentId`) plus a kind-specific **Profile**. Only the Unit and Corporate profiles carry fields today; `vessel`, `person` and `equipment_class` exist as **field-less profiles** — declared so the edge vocabulary can name them as endpoint kinds, with their fields deferred (ADR 0010).
_Was_: `MapEntity`, defined as "a military unit." That definition is now the **Unit Profile**, not the whole Entity.

**Profile**:
The kind-specific payload attached to an Entity, selected by its `kind` discriminant. `ENTITY_KINDS` is the closed list: `unit`, `corporate`, `vessel`, `person`, `equipment_class`. The **Unit Profile** (military: echelon, affiliation, NATO symbol, unit IDs) and the **Corporate Profile** are the only two that carry fields; the other three are bare. Profiles are a **typed discriminated union**, never an open attribute bag — this preserves strong typing and the column-by-column GeoPackage round-trip.
_Note_: `Entity` is a hand-mirrored flattening of core + profile, not `EntityCore & Profile`, so adding a field to a profile does **not** make it readable on `Entity` until the mirror is edited too. That is why the three new profiles are bare.

**Hierarchy**:
The parent/child relation between Entities — not a military one (a corporate control chain and a shipowner chain are also trees). Traversed by the shared Hierarchy index.
_Superseded in part by [ADR 0010](docs/adr/0010-first-class-relationships.md)_: Hierarchy is no longer the **core** relation, but **one derived view** over typed edges — `subordinate_to` and `corporate_parent`. The `relationships` records are the source of truth; `parentId` becomes derived and non-authoritative.

**ORBAT** (Order of Battle):
The **military view** of the generic Hierarchy — the presentation of Unit-Profile Entities as a command tree. One module's lens on a core capability; no longer Gabriel's only structure.

**Hierarchy index** (`src/utils/orbat.ts` → `hierarchy.ts`, `buildOrbat`):
The single shared parent/child traversal index for every Entity profile and `Organisation` hierarchy —
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

### Typed relationships (edges)

**Relationship** (`core/relationship`, one record per edge):
A first-class **directed, typed edge between two Entities** — the general form of which Hierarchy is one derived view. Carries its own id, a type from the closed vocabulary, optional start/end dates (an edge with no end date is active), and a per-type metadata bag. It is the unit the export gate acts on. See [ADR 0010](docs/adr/0010-first-class-relationships.md).
_Direction_: every type reads as "A *type* B", so `fromId` is always A — `subordinate_to` runs child → formation, `owned_by` runs asset → owner. No type is symmetric.
_Avoid_: "link" and "association" as the domain term. A **network link** is the line the map draws; a Relationship is the record it may be drawn from.

**Edge vocabulary** (`EDGE_TYPES`, `EDGE_VOCABULARY_VERSION`):
The **closed** set of thirteen relationship types — twelve Record tier, one Assessment tier — each with a fixed direction, an **Edge layer**, advisory endpoint kinds, and a `publicDefinition` that ships **verbatim** in the CC-BY dataset. Closed means a type outside it is a validation violation, not an extension point; amending it edits the vocabulary and its lock test together and bumps the version.

**Record tier**:
The twelve types asserting something a source **documents** — an order of battle, a registry filing, a bill of lading, an insurance cover. Publishable under the ordinary rules (sourcing, and the natural-person clause that gates `owned_by`), with no extra ceremony.

**Assessment tier**:
Gabriel's own **analytical judgement** about a relation, not a documentary record — today the single type `acts_for`. Excluded from the public dataset by default, and labelled inside its own `publicDefinition` ("ASSESSMENT — not a documentary record"), so the caveat travels with the data into a reuser's tooling instead of living in our UI.

**Edge layer** (`EdgeLayer`):
The investigative surface a record-tier type belongs to — `orbat`, `military-industrial`, `industrial`, `financial`, `logistics`, `shipping`. It groups and filters edges for the analyst; it constrains nothing. Assessment-tier types are not confined to one layer and carry `null`.

**ExportOverride**:
Per-edge authorisation to publish **one** assessment-tier edge under CC-BY. Records a proposer, a **different** confirmer, a date, and a rationale. The two-person rule is **ceremony and attribution, not authentication** — Gabriel has no identity system, so the names are free text and git history carries the real attribution. Absent means excluded (the gate fails closed); present on a Record-tier edge it is a violation, because there it authorises nothing while reading as if it did.

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
A 0–1 score assigned to a Research Citation based on its domain type: official/gov (0.95) > OSINT reports (0.8) > Wikipedia (0.75) > news (0.7) > social (0.55) > forum (0.45) > general web (0.4). Used to rank citations when selecting the top-2 for the Provenance Ledger — Wikipedia and non-article aggregate URLs (feeds, author/tag/category pages) are excluded from ledger selection entirely, regardless of weight.
_Relationship to Source Reliability_: Authority Weight is the **domain-type prior** that seeds a Source's Admiralty reliability. It is not a second, independent rating axis — reliability (A–F) is the promoted, per-source, AI-explainable form of the same "what kind of source is this" judgement.

### Source rating (ADMIRALTY / NATO STANAG 2511)

**Source Reliability** (`Source.reliability`, `A`–`F`):
A per-**Source** rating of how trustworthy the source *type/provenance* is — a **prior**, not an accuracy posterior. Gabriel assigns it deterministically (zero-AI) from source character (domain type, official-ness, OSINT-org reputation), *not* from observed historical accuracy. Because `A`/`B` doctrinally assert an *observed track record* the tool does not have, **the type prior is capped at `C`** and leans on `F` ("cannot be judged" — honest abstention, *not* `E` "unreliable") for unknown/social/web sources. `A`/`B` are reachable only by a human override, or by the future actor-level posterior (v2). Shared across every entity that cites the source (a property of the source, not of any one claim). See [ADR 0008](docs/adr/0008-reliability-as-capped-type-prior.md).
**Interested-party flag** (on a Source): marks a source that is a party to the conflict/subject it reports (state media, a belligerent MoD). It lowers the reliability prior *and* bars the source from counting as an independent corroborating origin for claims about its own conflict (see Information Credibility).
_Design note (not STANAG)_: doctrine defines A–F on track record and would rate a fresh, untracked source `F`; Gabriel's capped type-prior is a deliberate, UI-flagged deviation ("type-based / provisional"), never presented as a doctrinal assessment.

**Information Credibility** (`Claim.credibility`, `1`–`6`):
A per-**Claim** rating of how believable the *asserted information* is, judged **independently of the source** — chiefly by corroboration, contradiction, and plausibility. Credibility `1` ("Confirmed") requires corroboration by **independent** sources; independence is measured as distinct **corroboration clusters** (near-duplicate text and interested-party sources are collapsed to one origin), **not** distinct URLs — 40 wire-syndication reposts are one cluster, not 40 confirmations. **The AI may never assign `1`** — its ceiling is `2` ("corroboration found, not verified"); promotion to `1`/"Confirmed" is a human act. `6` ("truth cannot be judged") is a first-class abstention output, never collapsed into a low number. See [ADR 0009](docs/adr/0009-machine-never-confirms.md).
_Avoid_: conflating credibility with reliability — a completely reliable source can report a doubtful claim (`A4`), and an unreliable source can report a confirmed one (`E1`). The two axes are rated separately. (Doctrine warns of the "diagonal collapse" — Baker et al. 1968 found 87% of NATO ratings land on A1/B2/C3 because raters let reliability leak into credibility; Gabriel assesses the two axes in separate AI passes to resist this.)

**Rating** (the materialized value + its metadata):
The current reliability/credibility scalar lives **on the row** (`Source.reliability`, `Claim.credibility`) as the source of truth — not derived by replaying a log (event-sourcing was considered and rejected as gold-plating at single-user, single-file scale). Alongside each scalar sits a **rating-meta** blob (`reliability_meta` / `credibility_meta`): confidence, rationale, evidence refs, corroboration clusters, dates, and the **Rating Assessor**. Full history/audit is a v1.5 append-only `rating_events` table; the current value stays materialized regardless.

**Rating Assessor**:
Who produced the current rating — either an AI run (model id, model version, prompt version) or a named human analyst. A **human override** overwrites the scalar and sets `overridden: true` with `assessor: analyst`; it always wins over an AI value, and AI re-assessment runs **skip overridden targets** rather than clobbering them.

### Notes

**Notes** (`MapEntity.notes`):
Free-text analyst annotation containing only: (1) recent organisational changes to the unit — reform, rename, re-subordination — or (2) Epistemic Caveats. Never restates data already present in structured fields.

**Epistemic Caveat**:
A note flagging uncertainty or contradiction: "identity unconfirmed," "conflicting sources on HQ location," "possibly a placeholder unit." Lives inside Notes.
_Avoid_: comment, remark, observation

## Model invariants

Sentences that always hold between the concepts above. Not to be confused with **Relationship**,
the domain term for a typed edge between two Entities — this section was called `## Relationships`
until that term was defined, and was renamed to free the word.

- An **Enrichment Run** produces zero or more **Enrichment Proposals**
- Each **Enrichment Proposal** is backed by one or more **Research Citations**
- Accepting an **Enrichment Proposal** merges the top-2 **Research Citations** (by Authority Weight) into the **MapEntity**'s **Provenance Ledger**
- A **MapEntity** has exactly one **Provenance Ledger** (possibly empty)
- **Notes** on a **MapEntity** may contain zero or more **Epistemic Caveats**

## Flagged ambiguities

- **"sources"** was used to mean both the Provenance Ledger (entity field) and Research Citations (enrichment evidence). Resolved: "sources" in user-facing language always means the Provenance Ledger; evidence backing proposals is called Research Citations. In code, `EnrichmentProposal.sources` should be renamed to `EnrichmentProposal.citations`.
- **"relationship"** carried two senses in this file: the domain term above (a typed edge between two Entities) and a `## Relationships` section listing sentences about how the model's *concepts* relate. Resolved 2026-07-29: that section is now `## Model invariants`, and **Relationship** means the typed edge and nothing else.
- **"notes"** was used loosely for any free text. Resolved: Notes is a constrained field — only organisational changes and Epistemic Caveats; battle history and operational movements are excluded.
