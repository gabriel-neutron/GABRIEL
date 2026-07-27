# PRD — Gabriel v2.0: OSINT Data-Fusion Capability Plan

**Type:** Multi-stage capability plan (master PRD — sliced into issues per stage)
**Target:** Gabriel — browser-only core + local Python sidecar
**Owners:** [REDACTED] (SOCINT & data fusion), [REDACTED] (GEOINT)
**Status:** Scoped — 2026-07-25
**Driver:** FNF OSINT+ Investigation Competition 2026 — *Mapping Russia's Sanctions-Evasion Backbone* (proposal accepted). Gabriel v2.0 is a co-deliverable alongside the investigative report, the CC-BY dataset, and the public map.
**Source:** decision session of 2026-07-24/25, twelve decision branches closed; the Edge Type Vocabulary was settled by a three-specialist adversarial debate (military ORBAT / corporate-maritime-financial OSINT / investigative journalist), two rounds, arbitrated by the owner.

---

## Problem Statement

Phase 0 catalogued 1,000+ entities with parent-child relationships and per-entity source records. The investigation those entities exist for now asks questions Gabriel cannot hold, cannot find, and cannot publish.

**I cannot store what I am investigating.** The investigative question is about *chains*: a recovered component leads to a supplier, the supplier to a parent company, the parent to an ultimate beneficial owner, the owner to a bypass vehicle in a third jurisdiction. Gabriel has exactly one inter-entity relation — the parent-child Hierarchy. It has no way to say "this company supplies that plant", "this shell operates that tanker", "this holding acquired that factory three weeks after the designation". I can catalogue the nodes of the backbone; I cannot record the backbone.

**I cannot find what I already collected.** Search matches Entity names by substring and returns six results. Notes, aliases, Claim values, Provenance Ledger URLs, and the full text of every web page the enrichment pipeline has already fetched and cached are all invisible to it. The most humiliating failure mode in this project is re-searching the open web for a fact that is already inside my project file.

**Every registry fact enters by hand.** Sanctions designations, corporate officers, beneficial owners, vessel managers, shipment records — all copy-paste. Nothing dedupes on a stable identifier, so re-checking a source later means either creating duplicates or re-reading everything manually to spot what changed.

**A new document is a manual reading job.** When a RUSI teardown, a registry extract, a court filing, or a Yermak-McFaul working paper lands, there is no way to ask Gabriel what it adds, what it contradicts, and which entities in it I already know about. Everything is read by eye and typed in twice.

**Weak signals stay invisible.** Two shells sharing a registered address, an entity appearing beside another in five independent sources without any recorded link, an ownership transfer dated three weeks after a designation — these are the findings. Today they only surface if a human happens to remember both halves at the same moment.

**I cannot publish what the proposal promised.** The FNF proposal states that every dataset is exported in CSV, GeoJSON, and JSON-LD and remains usable in QGIS. No entity export exists in any format. There is also no filter between the working file — which will contain named natural persons and unproven analyst hypotheses — and a CC-BY 4.0 release that can never be recalled.

**Two analysts, one binary file, no rules.** A GeoPackage does not merge. Nothing defines who holds the file, how the other one's work gets in, or what happens when a laptop dies mid-investigation.

Underneath all of it: the fear of missing information and capability because the time went to manual search.

---

## Solution

Gabriel v2.0 turns the project file from a catalogue of nodes into an auditable, searchable, publishable graph, and turns every producer of facts — registries, documents, teammates, the AI pipeline — into a reviewed proposal stream instead of a typing job.

**Relationships become first class.** Every inter-entity relation, including the military Hierarchy and corporate holding structure, becomes a typed, directed, optionally dated Relationship carrying its own Claims and Sources. The type list is closed — twelve types, chosen against this investigation's four layers — so that two analysts tag consistently and a dataset reuser knows exactly what each label asserts. Dates are not decoration: "ownership transferred after designation while control persisted" is a query, not a paragraph.

**One review funnel.** Registry connectors, document extraction, sync diffs, and the existing Enrichment pipeline all emit **Proposals** — resolved against the existing graph before they are shown, so the analyst sees "matches Uralvagonzavod (INN match)" rather than a stranger. The browser stays the only writer of the project file. Reference data is accepted in batches; investigation signal is accepted item by item. ADMIRALTY doctrine holds throughout: the machine never assigns Information Credibility 1, and human overrides always win.

**Finding beats searching.** An instant index covers names, aliases, Notes, Claim values, external identifiers and Source titles. From any Claim value — an address, a phone number, a registered agent — one click lists every Entity carrying it: the corporate pivot, performed locally. A deliberate deep scan reads the full text of everything archived, including pages fetched months ago and never read.

**Weak signals are computed, not hoped for.** Deterministic indexes maintained on every ingestion surface co-occurrence without a recorded link, attribute collisions across entities, and dated facts falling near a neighbouring designation. The AI reads documents; the indexes correlate them. This is what keeps the AI budget small and the recall high.

**Publication is gated by construction.** CSV, GeoJSON and JSON-LD exports run through a single gate: unsourced hypotheses never ship, assessment-tier relations are off by default, ADMIRALTY ratings do ship, and the v1 dataset contains no natural persons — the dataset publishes structures, the report names people. Each publication is a versioned, changelogged release a researcher can cite.

---

## User Stories

### Model and provenance

1. As an analyst, I want to record that one company supplies another, so that the industrial layer of the backbone is stored rather than remembered.
2. As an analyst, I want every Relationship to carry a start and end date, so that a post-designation ownership transfer is visible as data.
3. As an analyst, I want to attach Sources and Claims to a Relationship exactly as I do to an Entity field, so that an edge is as auditable as a fact.
4. As an analyst, I want the edge type list to be closed, so that my teammate and I never invent divergent labels for the same relation.
5. As an analyst, I want each edge type to carry a one-line public definition, so that I tag consistently and a reuser interprets correctly.
6. As an analyst, I want assessment-grade relations kept in a separate tier from record-grade ones, so that my hypotheses can never be mistaken for registry facts.
7. As an analyst, I want to record an unsourced Relationship as a working hypothesis, so that I can think in the tool instead of in a side document.
8. As an analyst, I want unsourced Relationships marked visually, so that I always know which parts of the graph are unproven.
9. As an analyst, I want the ORBAT tree to keep working exactly as before after the migration, so that the military work built in Phase 0 is not disrupted.
10. As an analyst, I want to record that a unit was temporarily attached to a different formation for a period, so that resubordination is captured without corrupting the command tree.
11. As an analyst, I want to record that a unit fields an equipment class and that a plant produces it, so that a loss record can be walked back to a producing facility.
12. As an analyst, I want equipment classes as entities rather than free text, so that many units and a few plants converge on the same node instead of on a spelling.
13. As an analyst, I want vessels as entities, so that shadow-fleet ownership and management chains attach to something real.
14. As an analyst, I want persons as entities locally, so that officers and beneficial owners can be traced during the investigation.
15. As an analyst, I want to store external identifiers (IMO, INN, OGRN, LEI, sanctions-list ids), so that entities are identified by something that does not change when a name does.
16. As an analyst, I want identity resolution to match on external identifiers before falling back to names and transliteration, so that matching is reliable rather than fuzzy-first.
17. As an analyst, I want sanctions status recorded as a rated Claim on the Entity, so that designation facts carry their own Source and date.
18. As an analyst, I want to open a project file created before the migration and keep every existing parent-child link, so that no Phase 0 work is lost.
19. As a maintainer, I want the vocabulary and its definitions versioned in the repo, so that a change is a reviewable decision rather than a UI accident.

### Proposals and review

20. As an analyst, I want every automated producer to emit Proposals instead of writing to my project, so that nothing enters the file without me.
21. As an analyst, I want a Proposal resolved against my existing graph before I see it, so that I judge "new fact about a known entity" rather than "unknown stranger".
22. As an analyst, I want to accept an entire reference import in one decision while keeping per-item provenance, so that thousands of registry facts do not cost thousands of clicks.
23. As an analyst, I want investigation signal reviewed item by item, so that the things that matter get real attention.
24. As an analyst, I want to see the evidence backing a Proposal in place while reviewing it, so that I do not have to open the source separately to judge it.
25. As an analyst, I want rejected Proposals remembered, so that the same rejected suggestion does not return on every run.
26. As an analyst, I want one review surface for all producers, so that there is a single place where the investigation's inbox lives.
27. As an analyst, I want to see which Source a Proposal came from and when, so that acceptance is traceable after the fact.

### Search and table

28. As an analyst, I want instant search across names, aliases, Notes, Claim values, external identifiers and Source titles, so that I stop losing facts I already have.
29. As an analyst, I want results grouped by what they are — Entity, Claim, Source, document — so that I can tell why something matched.
30. As an analyst, I want to click any Claim value and list every Entity carrying that value, so that shared addresses and agents surface shell clusters.
31. As an analyst, I want an explicit deep search across the full text of archived pages and ingested documents, so that evidence already fetched is never re-fetched by hand.
32. As an analyst, I want to search by external identifier, so that a vessel or company is found by IMO or INN when its name is unknown or transliterated.
33. As an analyst, I want a sortable table of all entities with facets, so that I can work through the catalogue systematically rather than by clicking the map.
34. As an analyst, I want to filter the table by kind, layer, sanctions status, criticality, watch flag, and source coverage, so that I can find the gaps in my own work.
35. As an analyst, I want to filter for entities with unsourced Relationships, so that I can clean the graph before an export.
36. As an analyst, I want bulk operations from the table, so that watch-flagging twenty vessels is one action.

### Ingestion and sync

37. As an analyst, I want to run a registry connector against the entities already in my project, so that ingestion follows my investigation instead of flooding it.
38. As an analyst, I want a connector to pull one relational hop beyond my entities, so that the graph expands breadth-first the way the methodology prescribes.
39. As an analyst, I want a connector run to be idempotent, so that running it twice updates instead of duplicating.
40. As an analyst, I want sanctions designations imported with their dates and list origin, so that the designation timeline is data.
41. As an analyst, I want registered ownership, beneficial ownership and officer records imported as typed Relationships, so that corporate structure arrives as graph and not as prose.
42. As an analyst, I want the KSE oil and shadow-fleet trackers ingested from their published files, so that maritime anchors enter without retyping.
43. As an analyst, I want to paste a vessel record page and have the management chain parsed into Proposals, so that sources without an API still enter cleanly.
44. As an analyst, I want to query a leak/registry aggregator for a specific entity from its dossier, so that deep lookups happen where I am working.
45. As an analyst, I want every imported fact to arrive with its Source already attached, so that provenance is never reconstructed later.
46. As an analyst, I want a connector to tell me what it skipped and why, so that silent truncation never reads as full coverage.
47. As an analyst, I want the connectors to run in a local sidecar, so that network restrictions and rate limits are handled outside the browser without any data leaving my machine.
48. As an analyst, I want to press Sync and get a diff report of what changed since last time, so that "live cartography" means something concrete.
49. As an analyst, I want each change in a diff reviewed as an item, so that a newly ended ownership edge gets my attention rather than being applied silently.
50. As an analyst, I want to see when I last synced, so that staleness is visible instead of assumed.
51. As an analyst, I want AI web re-search restricted to watch-flagged entities, so that recurring cost tracks my own criticality judgement.
52. As an analyst, I want re-search results deduplicated against pages already cached, so that I only read what is new.

### Documents

53. As an analyst, I want to drop a PDF or paste text into Gabriel, so that a report becomes part of the investigation instead of a file on my desktop.
54. As an analyst, I want hard identifiers extracted deterministically before any AI reads the document, so that identifier digits are never hallucinated.
55. As an analyst, I want AI extraction constrained to the closed vocabulary and existing entity kinds, so that a document can never introduce an ontology of its own.
56. As an analyst, I want each extracted Claim to carry a citation anchor with page and exact quote, so that the assertion stays verifiable months later.
57. As an analyst, I want extraction results resolved against my graph, so that a document about known entities enriches them instead of cloning them.
58. As an analyst, I want a document's extracted text searchable, so that a source I ingested is covered by deep search like everything else.
59. As an analyst, I want original files kept outside the project file with an integrity hash recorded inside it, so that the project file stays fast and the originals stay verifiable.
60. As an analyst, I want extraction results cached per document, so that the same document is never paid for twice.
61. As an analyst, I want a Sources manager listing every Source with its reliability, dependent claim count and pending proposals, so that provenance is administrable and not just recorded.
62. As an analyst, I want dead links detected among my Sources, so that a public dataset does not ship citations that no longer resolve.

### Weak signals

63. As an analyst, I want entities that co-occur across independent sources without a recorded Relationship surfaced in a queue, so that missing links find me.
64. As an analyst, I want co-occurrence counted by corroboration cluster rather than by URL, so that syndicated reposts do not manufacture significance.
65. As an analyst, I want an alert when a newly ingested value collides with a value already held by another entity, so that shared addresses and agents are caught at ingestion.
66. As an analyst, I want an alert when a dated fact falls near a neighbouring entity's designation date, so that post-sanctions restructuring patterns surface automatically.
67. As an analyst, I want every weak-signal alert to show its justification, so that I can judge it instead of trusting it.
68. As an analyst, I want a manual, scoped AI second-look over the accumulated corpus for a specific question, so that deep reasoning is available without running continuously.
69. As an analyst, I want weak-signal alerts to become Proposals like everything else, so that acting on one is a reviewed decision.

### Visualisation

70. As an analyst, I want a graph view of entities and their typed Relationships, so that the backbone can actually be seen.
71. As an analyst, I want to filter the graph by edge type, so that I can read the ownership layer without the logistics noise.
72. As an analyst, I want assessment-tier edges rendered distinctly, so that hypothesis and record are never visually equivalent.
73. As an analyst, I want to view the graph as of a chosen date, so that a structure before and after a designation can be compared directly.
74. As an analyst, I want to open an entity's dossier from any view, so that everything known about a node is in one place.
75. As an analyst, I want a per-entity timeline of dated Claims and Relationships with designation markers, so that sequence is readable at a glance.
76. As an analyst, I want a criticality badge computed from the methodology's own rule, so that the in-depth track is selected consistently rather than by memory.
77. As an analyst, I want to filter by criticality in graph and table, so that depth-first work targets the right nodes.

### Publication

78. As an analyst, I want CSV, GeoJSON and JSON-LD exports, so that the promised deliverable exists and the data is usable in other analyst environments.
79. As an analyst, I want the export gate to exclude unsourced Relationships automatically, so that hypotheses cannot leak into a permanent licence.
80. As an analyst, I want assessment-tier relations excluded by default with a deliberate two-person override, so that publishing an assessment is always an explicit act.
81. As an analyst, I want natural persons excluded from the v1 dataset, so that the irreversible legal risk is not taken by default.
82. As an analyst, I want ADMIRALTY ratings included in the export, so that the project's differentiator is in the artefact.
83. As an analyst, I want a preflight report before publishing, so that I see exactly what the gate removed and why.
84. As an analyst, I want each publication to be a versioned release with a changelog, so that a researcher can cite a fixed version of a live dataset.
85. As a public map visitor, I want to browse the published cartography, so that I can explore the findings without any tooling.
86. As a dataset reuser, I want each edge type's definition shipped with the data, so that I know precisely what a label asserts before republishing it.

### Collaboration and continuity

87. As a GEOINT analyst, I want to enter site-activity conclusions as rated Claims, so that imagery findings join the fusion without imagery living in Gabriel.
88. As a two-person team, I want an explicit hand-off protocol for the project file, so that we never silently overwrite each other.
89. As a two-person team, I want the canonical file versioned in a private repository, so that a lost laptop is not a lost investigation.
90. As a two-person team, I want a failed push to reveal a collision, so that concurrent edits are detected rather than discovered later.
91. As an analyst, I want Telegram collection running in the background throughout the window, so that a corpus exists when the corroboration question is finally asked.

---

## Implementation Decisions

### 1. Relationship model — full graph migration ("B-pur")

All inter-entity relations become **Relationships**: typed, directed, optionally dated edges persisted in a new project-file table, carrying Claims exactly as Entity fields do.

- The Entity's `parentId` field and its persisted column are **removed**. Hierarchy is expressed as `subordinate_to` Relationships.
- On opening a pre-migration project file, existing parent-child links are converted to Relationships at load time. The column is not written back on save.
- **Invariant, enforced in the editing layer, not the type system:** an Entity may have at most one *active* (no end date) hierarchical Relationship. Historical, dated hierarchical edges are unconstrained.
- Relationship shape: id, from, to, type, optional start/end date, type-specific metadata (closed enums and scalar values only — never an open attribute bag, consistent with ADR 0004's reasoning about Profiles), and its Claims.
- The existing Claim model gains an optional relationship reference so a Claim can attach to either an Entity field or a Relationship. This is an additive, feature-detected schema change, matching how every previous persistence change was handled.

### 2. Edge Type Vocabulary — closed, twelve types, two tiers

Settled by adversarial debate; the record/assessment split is the mechanism that reconciles investigative power with publication safety.

**Naming rule:** every type must read as the English sentence "A {type} B"; grammar decides direction. No forced uniform suffix.

**Record tier — describes a document, a filing, or a dated observation (publishable):**

| Type | A → B | Layer | Public definition |
|---|---|---|---|
| `subordinate_to` | unit → formation | ORBAT | A sits under B in a documented chain of command; metadata enum `{organic, attached}`; the ORBAT tree derives from `organic` edges only |
| `fields` | unit → equipment class | military/industrial join | A is observed operating equipment class B at a stated date |
| `produces` | facility → equipment class | industrial | A manufactures or refurbishes equipment class B |
| `owned_by` | entity → holder | financial | B holds registered equity in A; percentage and as-of date in metadata; no minimum threshold — reusers filter |
| `beneficially_owned_by` | entity → person/org | financial | B is recorded as a beneficial owner of A in a registry filing, court record, or cited primary document |
| `officer_of` | person/org → org | financial | A holds a recorded role in B; role enum `{director, secretary, registered_agent}`, dated |
| `supplies` | supplier → customer | industrial | A provides goods or services to B on a documented recurring basis (a contract, or at least two transaction records) |
| `shipped_to` | consignor → consignee | logistics | A dated, documented consignment moved from A to B; **date mandatory** |
| `operated_by` | asset → operator | shipping | B is recorded as operator or manager of asset A; role enum `{technical, commercial, ISM, charterer}` |
| `insured_by` | vessel/org → insurer | shipping | B provided insurance cover for A during a stated period |
| `successor_of` | entity → predecessor | financial | A is the documented legal or operational successor of B; published only on a registry or court document |

**Assessment tier — analyst judgement, export-gated:**

| Type | A → B | Public definition |
|---|---|---|
| `acts_for` | instrument → principal | A is assessed to act on behalf of B; basis enum `{control, intermediary, proxy}` |

`acts_for` absorbs de-facto control and bypass-vehicle agency into a single, weakest-defensible-assertion type. The canonical evasion query survives the merge: an `owned_by` edge ending after a designation date while an `acts_for(basis: control)` edge persists.

**Deliberately excluded:** a separate `attached_to` (folded into the `subordinate_to` enum); `agent_of` (a role value inside `officer_of`); `associate_of` (person-to-person; deferred — family and proxy ties are recorded as rated Claims on the person; first candidate for vocabulary amendment); a public `intermediary_for` (the label asserts complicity; the documented hops plus an entity-level assessed-function Claim carry the meaning). Sanctions status is a **Claim on the Entity**, never an edge. Addresses, flag state and jurisdiction are **Claim values**, discoverable through the Claim-value pivot — no `shared_address` edge, which would launder inference into fact.

**Amendment procedure:** closed means no free text in the UI. The vocabulary and its public definitions live in a versioned file; a change requires a two-person decision.

### 3. Entity kinds and external identifiers

- New kinds, added as Profiles under the existing tagged-union pattern (ADR 0004): `vessel`, `person`, `equipment_class`.
- `equipment_class` covers **classes only** (a model designation), never serial numbers or individual airframes/hulls.
- `person` carries no geometry by default. Storing persons locally is unrestricted; the constraint is at export.
- `vessel` may carry a static position (last known, home port). **AIS tracks are not stored in v1** — movement lives in dated `shipped_to` Relationships. Track storage is a separate future decision.
- **External Ids** are added to the Entity core as a list of `{scheme, value}` pairs (IMO, INN, OGRN, LEI, sanctions-list and registry ids). This is the identity backbone: it makes deduplication exact rather than fuzzy, and it is what makes every connector idempotent.

### 4. Hierarchy index seam

The shared Hierarchy index is the single seam that protects every existing consumer (tree views, horizontal layout, network links on the map, parent-anchored geometry positioning, and the layered-research traversal). It is re-implemented to build from `subordinate_to` Relationships instead of `parentId`, keeping its current interface — children, ancestors, descendants, roots, layers, depth — plus its orphan and cycle policies. Consumers move from reading a field to querying the index; no consumer changes behaviour.

### 5. Proposal spine

A single Proposal core becomes the convergence point for every producer: registry connectors, document extraction, sync diffs, weak-signal engines, teammate imports, and — by generalisation — the existing Enrichment Proposals and the Telegram order-of-battle proposals.

- A Proposal is a resolved, source-attributed suggestion to create or modify Entities, Relationships or Claims.
- **Resolution happens before display**, through the identity chain: exact External Id → alias/transliteration → fuzzy name. Every Proposal states what it matched and why.
- Two acceptance regimes: **batch** for reference data (one human decision covering many items; per-item provenance preserved) and **per-item** for investigation signal (diffs, weak signals, inferred relations, identity merges).
- The **browser remains the only writer** of the project file. The sidecar never touches it — the existing hard boundary is preserved and extended.
- ADMIRALTY doctrine is unchanged and applies to Relationship Claims: reliability stays a capped type prior (ADR 0008), the machine never assigns Information Credibility 1 (ADR 0009), human overrides win and are skipped by re-assessment runs.

### 6. Ingestion — generalised sidecar, anchored expansion

The Telegram sidecar generalises into the Gabriel sidecar: the same locally-launched FastAPI process, with the Telegram module beside a new registries module. Rationale: rate limiting, long-running jobs, resumable state and CORS-restricted upstreams are already solved there.

- **Connector contract:** run against a set of anchor entities → stage results locally → expose Proposals over localhost. Connectors never write the project file and never mirror an upstream dataset.
- **Anchored expansion, hard rule:** a connector imports only (a) upstream records matching entities already in the project, and (b) their one-hop relational neighbourhood. This encodes the methodology's breadth-first-from-anchors philosophy and protects both the review queue and the project file's practical size ceiling.
- **Idempotence:** every imported record carries its upstream identifier as an External Id; a second run matches and updates rather than duplicating.
- **Build order:** 1) OpenSanctions bulk (its entity-relation model maps almost one-to-one onto the vocabulary and supplies stable ids and vessel coverage); 2) hardcoded KSE tracker file parsers; 3) vessel-record paste-parser; 4) leak/registry aggregator on-demand lookup from the dossier; 5) corporate registry on-demand lookup; 6) commercial AIS (only when the maritime track is active); 7) no connector for monthly aggregate trackers — cited manually.
- **Imagery is out of Gabriel.** GEOINT work stays in its own tooling; conclusions enter as rated Claims with the image reference as Source.

### 7. Sync sessions

- Sync is **manual** — a button, not a scheduler. A background job on a laptop that is closed does not run, and silent automation manufactures a false sense of freshness.
- A Sync session re-runs connectors over the anchored scope, compares against the previous state, and produces a **diff report** (new designations, ended ownership edges, new officers, changed managers).
- Every diff item enters per-item review: a change *is* investigation signal.
- A staleness indicator shows time since last sync.
- AI web re-search runs only over watch-flagged entities and deduplicates against the existing research-source cache.

### 8. Search

Three tiers, all in the first delivery:

- **Instant index** — an in-memory full-text index over names, aliases, Notes, Claim values, External Ids, Source titles and document titles, wired into the existing command-palette search, with results grouped by object kind. This introduces one small new front-end dependency (a client-side search index library); a persisted full-text index in the project file is not needed at this scale.
- **Claim-value pivot** — an inverted index from Claim value to Entities. From any value, list every Entity carrying it. This is the local equivalent of the corporate-registry pivot and is the reason addresses and agents can stay Claims instead of becoming entities or edges.
- **Deep scan** — an explicit, on-demand full-text pass over cached page content and extracted document text, not permanently resident in memory.

### 9. Document ingestion — six stages

Design principle, stated explicitly because it governs cost and recall: **weak signals come from deterministic indexes; AI is the reader, not the correlator.** Only stages A and E consume AI.

- **A. Read** — a free regex pass first captures hard identifiers (corporate and vessel registration numbers, sanctions list ids); then one or two vocabulary-constrained model calls extract candidate Entities, Relationships and Claims, each with a **citation anchor** (page plus exact quote). Results are cached per document and never silently re-run.
- **B. Fuse** — deterministic resolution against the graph via the identity chain; aliases discovered in a document are merged into the matched Entity. One object per real-world entity, regardless of how many documents mention it.
- **C. Co-occurrence index** — maintained on every ingestion: which entities appear together in which sources. Entities co-occurring across at least N **independent** sources with no recorded Relationship surface in a *latent links* queue. Independence reuses the existing corroboration-cluster logic, so syndicated reposts count once.
- **D. Attribute collisions** — when an ingested value duplicates a value already held by another Entity (address, phone, registered agent, auditor), the collision is raised without anyone searching for it.
- **E. Second look** — an optional, manually triggered, scoped model pass over the accumulated corpus relevant to one entity or one question. Never a background job.
- **F. Temporal rules** — any dated Relationship or Claim falling within a fixed window of a neighbouring Entity's designation date raises a pattern alert. Deterministic, free.

**Storage split (hard constraint):** original files never enter the project file — saving rewrites the whole file, and binary attachments would make it unusable. Originals live in a project folder with an integrity hash recorded in the project file; **extracted text is stored in the project file**, which automatically brings ingested documents into deep search.

**Sources manager:** a dedicated surface listing every Source with its reliability, its dependent Claim count, its pending Proposals, and a dead-link check for URLs — link rot in a published provenance chain is an indefensible claim.

**Scope for v1:** natively digital PDFs and pasted text. OCR runs in the sidecar and is deferred until a real document requires it.

### 10. Visualisation

- **Entity graph** — reuses the existing WebGL graph stack already proven on the Telegram channel graph. Filters by edge type, by tier (assessment-tier edges rendered distinctly), and by **time window** ("graph as of date"), which is what makes a post-designation restructuring directly visible. The measured performance limit is edge count, not node count; type filters keep the rendered graph well inside it.
- **Table view** — sortable, facetted (kind, layer, sanctions status, criticality, watch flag, source coverage, unsourced-edge presence), with bulk operations. Doubles as the pre-export QA surface.
- **Per-entity timeline** — dated Claims and Relationships on an axis inside the entity dossier, with designation dates marked. A global multi-entity timeline is deferred.
- **Criticality badge** — the methodology's own admission rule (at least two of: documented sanctions exposure; documented continued production or throughput in the target window; presence in a cross-jurisdiction bypass routing) computed deterministically from Claims and Relationships, displayed everywhere and filterable. This encodes the published methodology in the tool.
- The existing inspector becomes the **entity dossier**: fields, Relationships, timeline, citing documents, co-occurrences, Claims and ratings in one place.

### 11. Publication

- **Formats:** CSV (entities, relationships, claims as three flat files), GeoJSON (geometries with properties), JSON-LD (the full graph, with the Edge Type Vocabulary as its context).
- **Export gate — a single pure predicate, applied to every format:** unsourced Relationships never ship; assessment-tier Relationships are excluded by default and can only be included per-edge by explicit two-person decision; ADMIRALTY ratings **do** ship; **no natural-person Entities in the v1 dataset**, and no Relationship naming one.
- Rationale for the person exclusion: the dataset publishes structures (companies, vessels, facilities, units, equipment classes — the whole backbone); the report names people, in narrative form with context and review, which is the defensible medium for that. A CC-BY licence cannot be recalled.
- A **preflight report** states exactly what the gate removed, so the analyst can see the delta rather than trust it.
- **Publish** produces a gated dataset that feeds the public read-only map; it never publishes the working file.
- Each publication is a **versioned release with a changelog**; the changelog is assembled from Sync diff reports.

### 12. Collaboration and continuity

- **Baton pass on one canonical file.** Viable because the imagery boundary keeps the GEOINT analyst's Gabriel sessions short and mostly additive.
- **A private repository — not the public code repository — versions the canonical project file and the documents folder, and *is* the baton:** pull before opening, push at end of session; a rejected push is the collision detector (the shorter session replays its work). It doubles as backup and as an audit trail of who changed what when.
- Import-as-Proposals between two project files is **deferred**; the Proposal spine makes it cheap to add if baton-passing proves painful.

### 13. Telegram module

Keep-warm for the investigation window: the canary/human-in-the-loop slice and the channel-id contract defect are both already done (see `timelines/TELEGRAM_TIMELINE.md`, Slice 6, 2026-07-23) — remaining work is seeding military-industrial and recruitment channels relevant to target facilities and letting the governed crawler collect in the background (Slice 8). Its methodological role is unchanged — corroborating signal, never standalone evidence. Message-level search over the collected corpus is a later, small feature on data that will already be warm. The sidecar's order-of-battle proposals migrate onto the Proposal spine.

### 14. Documentation obligations

- A new ADR records first-class Relationships, the removal of `parentId`, and the closed two-tier vocabulary. The domain glossary must be updated: Hierarchy is no longer a core Entity property but a derived view over `subordinate_to` Relationships.
- The glossary gains: Relationship, Edge Type Vocabulary, record tier / assessment tier, External Id, Proposal (generalising Enrichment Proposal), Anchored expansion, Sync session, Diff report, Latent link, Attribute collision, Criticality badge, Export gate, Dataset release.
- Existing ADRs are respected as-is: the Profile tagged union governs the three new kinds; Source/Claim stays the provenance model; the capped reliability prior and the machine-never-confirms rule apply unchanged to Relationship Claims; notes stay restricted to organisational change and Epistemic Caveats.

### 15. Standing constraints

- **AI budget is frugal.** Deterministic indexes first; model calls are scoped, cached, and manually triggered. No background agents, no continuous re-analysis.
- **Investigation beats generic tooling.** When a generic mechanism and a concrete investigative need diverge, build the concrete one and generalise later by extraction.
- **Browser-only core.** Heavy or network-restricted work runs in the locally launched sidecar; nothing leaves the machine except user-keyed AI and registry calls the analyst initiates.
- **Review capacity is the real bottleneck.** If a queue structurally exceeds two analysts, narrow the ingestion scope — never lower the review bar.

---

## Testing Decisions

**What makes a good test here:** given a project state and an input, assert the observable outcome — the resulting graph, the emitted Proposals, the serialized output, the surfaced alert. Never assert on internal call order, private structures, or the shape of intermediate objects. Model and network calls are covered through their adapter seams with recorded fixtures; determinism is required, so no test may depend on a live upstream. The repo's existing test suite is the model: pure logic tested directly, persistence tested by round-trip, adapters tested against fixtures.

**In scope for tests (owner's selection):**

*Pure core*
- Edge Type Vocabulary and Relationship invariants — including the "at most one active hierarchical edge" rule and rejection of out-of-vocabulary types.
- Graph index — adjacency, traversal, and the as-of-date time filter (an edge dated before/after the query date appears/disappears).
- Hierarchy index over Relationships — children, ancestors, descendants, roots, depth, plus the existing orphan and cycle policies, which must behave identically after migration.
- GeoPackage round-trip with migration — **hard gate:** the real 1,010-unit demo file opens, converts parent-child links to Relationships, saves, and reopens with an identical hierarchy; pre-migration and post-migration files both load.
- Export gate — unsourced edges excluded, assessment tier excluded by default and included on explicit override, natural persons and person-naming relations excluded, ratings retained; plus each serializer's output shape.
- Criticality rule — the two-of-three admission rule over Claim and Relationship inputs.
- Temporal rule engine — alerts fire inside the window and stay silent outside it.
- Co-occurrence and attribute-collision indexes — including that corroboration clusters, not URLs, are what count toward independence.
- Search index and Claim-value pivot — a value shared by two entities returns both; deep scan finds text present only in cached page content.

*Proposal spine and identity*
- Resolution ordering — External Id exact match wins over alias match, which wins over fuzzy name match.
- **Idempotence, hard gate:** running the same connector import twice produces zero duplicate entities and zero duplicate relationships.
- Batch versus per-item acceptance — batch acceptance preserves per-item provenance; rejection is remembered across runs.
- ADMIRALTY doctrine on Relationship Claims — the machine cannot emit credibility 1; human-overridden ratings survive re-assessment.
- Extension of the existing identity tests to External Id matching and to Cyrillic/Latin transliteration on the new entity kinds.

*Python connectors (sidecar, pytest — prior art: the existing governor, expander, crawler and DB-migration suites)*
- Upstream-model-to-vocabulary mapper — recorded upstream fixtures produce exactly the expected typed Relationships and Claims, and unmappable records are reported rather than dropped silently.
- Tracker file parsers and the vessel-record paste-parser — fixture in, Proposals out.
- Anchored expansion — expansion is limited to anchors plus one hop; an unbounded upstream cannot flood the output.
- Connector reporting — skipped and truncated records are surfaced.

**Out of scope for tests (owner's decision):** UI and integration tests for the new views (graph filters, review flows, table facets). Storybook stories may be added where they aid development, but no Playwright or component-integration suites are required for this PRD. Existing UI-adjacent tests continue to run unchanged.

**Prior art to follow:** the GeoPackage fixture test over the real demo project and the per-table round-trip tests; the pure hierarchy index tests; the identity tests for candidate matching, transliteration and merging; the provenance tests for ADMIRALTY scales, claims, rating events and the review queue; the pure store-reducer tests from the enrichment module; the batch traversal test for layered research; and the sidecar's pytest suites.

`npm run verify` (lint + coverage + build) must pass before any stage is claimed done, per the project's standing rule.

---

## Out of Scope

- **A hosted synchronisation server or CRDT layer.** Contradicts the local-first principle and would consume the investigation window.
- **A generic importer with a column-mapping UI.** Connectors are written concretely per source; generalisation happens by extraction after the third one.
- **Registry mirroring.** Connectors only ever import anchored matches plus one hop.
- **AIS track storage.** Vessel movement is represented as dated `shipped_to` Relationships in v1.
- **Any imagery platform capability.** Gabriel stores GEOINT conclusions as Claims, not imagery, tiles, or change-detection processing.
- **Scheduled or background synchronisation.** Sync is a manual action.
- **OCR** for scanned documents — sidecar-side, deferred to the first document that requires it.
- **Global multi-entity timeline** — deferred; the per-entity timeline ships.
- **Import-as-Proposals between two project files** — deferred in favour of baton passing.
- **`associate_of` and any person-to-person edge type** — deferred; recorded as Claims meanwhile. First candidate for vocabulary amendment.
- **Natural persons in the published dataset** — excluded from v1 by policy, not by capability.
- **Commercial AIS and monthly aggregate trackers as connectors** — the former only if the maritime track becomes active, the latter cited manually.
- **Telegram message-level entity extraction and message search as features** — collection runs; the features wait for the corpus. Member enumeration remains a documented no-go.
- **Event-sourced ratings.** Current values stay materialised on the row with an append-only audit alongside, as already decided.
- **Any change to the ADMIRALTY doctrine.** The capped reliability prior, the machine-never-confirms ceiling, the abstention value, and human-override precedence are unchanged.

---

## Further Notes

**Wall-clock work starts before code.** Access applications for the corporate registry and leak aggregator take days to weeks and cannot be compressed by development speed; they should be filed immediately, even though those connectors are fourth and fifth in build order. The same logic drives the Telegram keep-warm decision: collection is governed and slow by design, so it must start early and run long.

**Build order follows dependencies, not estimates.** Wall-clock items first; then the model and Proposal spine (everything else attaches to them); then search and table (small, and they pay off immediately during cataloguing); then the sidecar connectors and sync; then documents; then visualisation; then export and publication. Baton discipline, git backup and Telegram collection run continuously throughout.

**The known risks, recorded deliberately.** Baton discipline is a human protocol — the first silent overwrite will happen on a tired evening, and the pull/push rule is only as good as its reflex. Review capacity is the structural bottleneck of the whole design: every automation feeds a queue that two people must read.

**Legal and licensing posture.** Code ships under a permissive licence; the dataset under CC-BY 4.0; the working project file, its documents, and every named natural person stay private. The public code repository must never receive the working project file or the documents folder. Record-tier edge labels are phrased to describe documents and observations, so that the answer to a challenge is "the filing exists" — the only defence a two-person team can sustain.

**Why the vocabulary is closed but amendable.** A closed list is what makes two analysts tag consistently and a reuser interpret correctly; a frozen list is what blocks an investigation mid-flight. The resolution is a versioned vocabulary file amended by two-person decision, with `associate_of` already identified as the first candidate should collection demonstrate the need.
