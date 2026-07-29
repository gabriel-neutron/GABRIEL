# Spec — Gabriel v2.0, Foundation Stage

> **⚠ PARTIALLY SUPERSEDED — 2026-07-29.** An adversarial review revised this plan. Do not
> implement from this document without reading the corrections first.
>
> - **Slices 0 and 1:** superseded entirely by
>   [`GABRIEL_V2_SLICE_0_1_BUILD.md`](GABRIEL_V2_SLICE_0_1_BUILD.md). Build from that.
> - **`Entity.parentId` is never deleted.** It becomes a derived, non-authoritative field;
>   the `parent_id` column keeps being written as a redundant backup. Every passage below
>   describing its removal — Scope (:43, :55–56), Slice 3, Slice 4, the Consumer Migration
>   Inventory — is void. Slice 3 collapses into Slice 2; Slice 4 becomes the write path only.
> - **Stage 1 is slices 0–6.** The Proposal spine (Slice 7) moves to the top of Stage 2 with
>   the unified review surface.
> - **Stage 1.5** (export gate + CSV/GeoJSON serializers + preflight) lands immediately after
>   Stage 1, not at Stage 6. JSON-LD stays at Stage 6.
> - **`query.ts` is not built**; `activeAt` is dropped; `isActive` lives in `validate.ts`.
> - **Nine violation codes, not seven** (adds `invalid-date` and `invalid-export-override`).
> - **`MetadataSpec` and `RelationshipViolation` are referenced here but never defined.** Both
>   are defined in the Slice 0/1 build spec.
> - **The "1,010 units" figure is wrong for every purpose it is used for.** Measured:
>   1010 `units` rows, 999 with a parent, 1027 entities after the legacy fold, 1012 with a
>   parent. Do not assert 1,010.
> - **ADR 0004 does not stand unchanged** (:895). ADR 0010 supersedes its clause that
>   "Hierarchy is a core property of any Entity".

**Covers:** `GABRIEL_V2_PRD.md` sections 1–5 (Relationship model, Edge Type Vocabulary, entity kinds
and External Ids, hierarchy index seam, Proposal spine) plus the section 14 documentation
obligations for those decisions.
**Status:** Specified — 2026-07-28. Not started.
**Why this stage first:** the PRD's build order — "then the model and Proposal spine (everything
else attaches to them)". Search, table, connectors, sync, documents, visualisation and publication
all read the Relationship and Proposal types this stage defines. Nothing else in v2 can be built
against a moving target.

Later stages (search/table, sidecar connectors, sync, documents, visualisation, publication) get
their own specs when their turn comes. This document does not describe them.

---

## Contents

- [Scope](#scope)
- [Design decisions taken here](#design-decisions-taken-here)
- [Module layout](#module-layout)
- [F1 — Relationship type](#f1--relationship-type)
- [F2 — Edge Type Vocabulary](#f2--edge-type-vocabulary)
- [F3 — External Ids](#f3--external-ids)
- [F4 — New entity kinds](#f4--new-entity-kinds)
- [F5 — Hierarchy index seam](#f5--hierarchy-index-seam)
- [F6 — Claims on Relationships](#f6--claims-on-relationships)
- [F7 — Persistence and migration](#f7--persistence-and-migration)
- [F8 — Editing layer and invariants](#f8--editing-layer-and-invariants)
- [F9 — Proposal spine core](#f9--proposal-spine-core)
- [Slices](#slices)
- [Test plan](#test-plan)
- [Consumer migration inventory](#consumer-migration-inventory)
- [Documentation obligations](#documentation-obligations)
- [Risks and deviations from the PRD](#risks-and-deviations-from-the-prd)

---

## Scope

**In:** first-class `Relationship`; the closed twelve-type two-tier vocabulary as a versioned file;
External Ids on the Entity core; the `vessel` / `person` / `equipment_class` profiles; the hierarchy
index rebuilt over `subordinate_to` edges; removal of `Entity.parentId` and its persisted column;
Claims that can target a Relationship; the Proposal core types with resolution and rejection
memory, validated by adapting one existing producer.

**Out (later stages):** the unified review surface; registry connectors and the sidecar registries
module; sync sessions; search index and Claim-value pivot; table view; entity graph view; document
ingestion; weak-signal engines; export gate and publication. Also out: any change to ADMIRALTY
doctrine (ADRs 0008/0009 stand unchanged), and any UI for creating edge types (the vocabulary is
closed — the UI only ever renders what the file declares).

**Definition of done for the stage:** the real 1,010-unit demo project opens, its parent-child
links become `subordinate_to` Relationships, it saves, reopens with an identical hierarchy, and
every existing view (TreeView, HierarchyPanel, NetworkLinksLayer, map positioning, layered
research) behaves as it did before — with `parentId` gone from the type and from the file.
`npm run verify` passes.

---

## Design decisions taken here

These resolve ambiguities the PRD left open. Each is a decision, not a question.

1. **`owned_by`'s as-of date is `startDate`, not a metadata field.** The PRD says "percentage and
   as-of date in metadata". Two date representations for one concept would disagree, and the
   "graph as of date" filter (Stage 6) has to read exactly one of them. `percent` lives in
   metadata; the as-of date is the edge's `startDate`. Applies by the same reasoning to every
   type: dates live on the edge, never in metadata.
2. **Kind pairs are advisory, not enforced.** The vocabulary declares `fromKinds`/`toKinds`, used
   to order and filter the target picker and to raise a preflight warning. It does not reject.
   A plant recorded as `corporate` must be able to `produces` an `equipment_class` without the
   analyst first re-kinding it mid-investigation.
3. **The legacy `parentId` load path keeps today's strict behaviour; the new relationships path is
   lenient with reporting.** A cross-kind or dangling `parent_id` still throws `Unsupported
   schema` (no regression on existing files). A dangling or unknown-type row in the new
   `relationships` table is dropped, counted, and surfaced — an edge is not a node, and a
   partially corrupt edge table must not brick a 1,000-entity investigation file.
4. **Migration ids are deterministic:** `hier:<childId>`. Makes re-migration idempotent, makes the
   fixture test assertable, and is collision-free because at most one active hierarchical edge
   exists per child.
5. **`Claim.entityId` becomes nullable in TS, with `""` as the on-disk sentinel.** SQLite cannot
   drop `NOT NULL` via `ALTER`, and `ensureOptionalColumns` only adds columns — so the physical
   `entity_id TEXT NOT NULL` stays and encodes `null` as `""`. Entity ids are UUIDs, so `""` is
   never a real id and no equality check can collide.
6. **Relationship state transitions are pure functions in a `.store.ts` reducer, not inline Zustand
   actions.** `useProjectStore.ts` is already 343 lines against the 300-line limit in
   `CONSTRAINTS.md`; adding six relationship actions inline would push it well past. The reducer
   also gets the same 100 %-branch-coverage treatment as `enrichment.store.ts`.

---

## Module layout

New code, following the feature-first layout in `CONSTRAINTS.md`. All of it is React-free.

```
src/core/relationship/
  relationship.ts          # Relationship, RelationshipMetadata, drafts
  vocabulary.ts            # EDGE_TYPES, EDGE_VOCABULARY_VERSION — the versioned closed list
  validate.ts              # validateRelationships, RelationshipViolation
  edit.ts                  # pure edit operations (setHierarchicalParent, resubordinate, ...)
  hierarchyIndex.ts        # buildHierarchy(items, relationships) over subordinate_to
  relationships.store.ts   # pure reducers, consumed by useProjectStore
  query.ts                 # edgesOf, neighbours, activeAt(date)

src/core/entity/
  externalId.ts            # ExternalId, EXTERNAL_ID_SCHEMES, normalize/validate

src/core/proposal/
  proposal.ts              # Proposal, ProposalOp, Resolution, ProducerRef
  resolve.ts               # the identity chain: external id -> alias -> fuzzy name
  fingerprint.ts           # proposalFingerprint — stable rejection memory key
  proposals.store.ts       # pure reducers for the pending/decided queue

src/core/persistence/geopackage/
  relationships.table.ts   # new table
  rejectedProposals.table.ts
```

Modified: `core/entity/entity.ts`, `core/entity/hierarchy.ts`, `core/identity/merge.ts`,
`core/persistence/geopackage/{load,save,types,applyResult,units.table,provenanceClaims.table}.ts`,
`store/useProjectStore.ts`, `hooks/useProjectIO.ts`, and the consumers listed in the
[migration inventory](#consumer-migration-inventory).

---

## F1 — Relationship type

```ts
// core/relationship/relationship.ts
export type RelationshipTier = "record" | "assessment"

export type RelationshipType =
  | "subordinate_to" | "fields" | "produces" | "owned_by"
  | "beneficially_owned_by" | "officer_of" | "supplies" | "shipped_to"
  | "operated_by" | "insured_by" | "successor_of"   // record tier — 11
  | "acts_for"                                       // assessment tier — 1

/** Closed enums and scalars only — never an open attribute bag (ADR 0004's reasoning). */
export type RelationshipMetadata = {
  /** subordinate_to. Absent decodes to "organic": the ORBAT tree is the organic subgraph. */
  attachment?: "organic" | "attached"
  /** officer_of */
  role?: "director" | "secretary" | "registered_agent"
  /** operated_by */
  operatorRole?: "technical" | "commercial" | "ISM" | "charterer"
  /** acts_for */
  basis?: "control" | "intermediary" | "proxy"
  /** owned_by — registered equity percentage, 0-100. No minimum threshold; reusers filter. */
  percent?: number
}

export type Relationship = {
  id: string
  fromId: string
  toId: string
  type: RelationshipType
  /** ISO 8601 date (YYYY-MM-DD) or null. An edge with no end date is *active*. */
  startDate: string | null
  endDate: string | null
  metadata: RelationshipMetadata
}

export type RelationshipDraft = Omit<Relationship, "id">
```

**Direction** is fixed by the naming rule: every type reads as the English sentence
"A *type* B", so `fromId` is always A. No type is symmetric; there is no undirected edge.

**Dates.** Only `shipped_to` requires `startDate` (the PRD's one bolded mandate). `fields` and
`insured_by` are *expected* to carry dates and the UI prompts for them, but an undated edge is
valid — an observation whose date is not yet recovered is still a recorded observation. When both
are present, `startDate <= endDate` is enforced.

**Unsourced edges** are legal (user story 7): a Relationship with no Claims is a working
hypothesis. It is marked visually (story 8) and is excluded by the export gate in Stage 7.
"Unsourced" is defined as: no Claim whose `relationshipId` is this edge.

**Metadata validity** is per type. `validateRelationships` rejects a metadata key that the
declaring type does not own (an `officer_of` carrying `percent`), and rejects an enum value outside
the declared set. Metadata is never free text.

**Query helpers** (`query.ts`) — the read surface every later stage builds on:

```ts
export function edgesOf(rels: Relationship[], entityId: string): Relationship[]      // either endpoint
export function outgoing(rels: Relationship[], entityId: string, type?: RelationshipType): Relationship[]
export function incoming(rels: Relationship[], entityId: string, type?: RelationshipType): Relationship[]
export function isActive(rel: Relationship, onDate?: string): boolean
export function activeAt(rels: Relationship[], isoDate: string): Relationship[]
export function isUnsourced(rel: Relationship, claims: Claim[]): boolean
```

`isActive(rel)` with no date means `endDate == null`. `isActive(rel, d)` means
`(startDate == null || startDate <= d) && (endDate == null || endDate > d)` — the half-open
interval, so an edge ended on D is absent from the graph as of D. `activeAt` is what Stage 6's
"graph as of date" reads; it ships here so the semantics are settled and tested once.

---

## F2 — Edge Type Vocabulary

`core/relationship/vocabulary.ts` is the versioned file the PRD's amendment procedure refers to.
It is the single source of truth for the UI (which renders only what it declares), for
`validateRelationships`, and — from Stage 7 — for the JSON-LD context and the definitions shipped
with the dataset.

```ts
export const EDGE_VOCABULARY_VERSION = "1.0.0"

export type EdgeTypeDefinition = {
  type: RelationshipType
  tier: RelationshipTier
  layer: "orbat" | "military-industrial" | "industrial" | "financial" | "logistics" | "shipping"
  /** UI labels for the two endpoints, e.g. "unit" -> "formation". */
  fromLabel: string
  toLabel: string
  /** Advisory kind hints — order and filter the target picker; never reject. */
  fromKinds: EntityKind[]
  toKinds: EntityKind[]
  /** Ships with the published dataset. Verbatim from the PRD's vocabulary tables. */
  publicDefinition: string
  /** "start" when a start date is mandatory; null otherwise. */
  dateRequired: "start" | null
  /** Metadata keys this type owns, with their closed value sets. */
  metadata: MetadataSpec
}

export const EDGE_TYPES: Record<RelationshipType, EdgeTypeDefinition>
export const RECORD_TIER_TYPES: RelationshipType[]
export const ASSESSMENT_TIER_TYPES: RelationshipType[]
```

Definitions are transcribed verbatim from `GABRIEL_V2_PRD.md` section 2 — the PRD tables are the
source text, this file is the machine-readable copy. Summary of what each entry must carry:

| type | tier | A → B | layer | date | metadata |
|---|---|---|---|---|---|
| `subordinate_to` | record | unit → formation | orbat | — | `attachment: organic \| attached` |
| `fields` | record | unit → equipment class | military-industrial | expected | — |
| `produces` | record | facility → equipment class | industrial | — | — |
| `owned_by` | record | entity → holder | financial | — | `percent: 0–100` |
| `beneficially_owned_by` | record | entity → person/org | financial | — | — |
| `officer_of` | record | person/org → org | financial | expected | `role: director \| secretary \| registered_agent` |
| `supplies` | record | supplier → customer | industrial | — | — |
| `shipped_to` | record | consignor → consignee | logistics | **required** | — |
| `operated_by` | record | asset → operator | shipping | — | `operatorRole: technical \| commercial \| ISM \| charterer` |
| `insured_by` | record | vessel/org → insurer | shipping | expected | — |
| `successor_of` | record | entity → predecessor | financial | — | — |
| `acts_for` | assessment | instrument → principal | — | — | `basis: control \| intermediary \| proxy` |

**Closed means closed.** No UI path produces a `type` outside this record. A persisted row with an
unknown type is dropped at load and reported (decision 3). A test asserts the record has exactly
twelve entries, eleven record tier and one assessment tier, so an accidental addition fails CI —
the amendment procedure is a two-person decision that edits this file *and* the test together, and
bumps `EDGE_VOCABULARY_VERSION`.

**`associate_of` is not in this file.** It is the documented first candidate for amendment; until
then, person-to-person ties are rated Claims on the person (PRD, Out of Scope).

---

## F3 — External Ids

The identity backbone: exact deduplication instead of fuzzy, and the reason every connector in
Stage 3 can be idempotent.

```ts
// core/entity/externalId.ts
export type ExternalIdScheme =
  | "imo" | "inn" | "ogrn" | "lei"          // hard registry identifiers
  | "ofac" | "eu_fsf" | "uk_hmt"            // sanctions list ids
  | "opensanctions"                          // aggregator id — Stage 3's first connector
  | "registry"                               // generic corporate registry id

export type ExternalId = { scheme: ExternalIdScheme; value: string }
```

Added to `EntityCore` as `externalIds?: ExternalId[]` — optional, absent means none, following the
`aliases` precedent exactly.

Each scheme declares a **normalizer** and a **validator** in one table:

```ts
export const EXTERNAL_ID_SCHEMES: Record<ExternalIdScheme, {
  label: string
  /** Canonical form used for equality. Strips prefixes, spaces, punctuation; case-folds. */
  normalize: (raw: string) => string
  /** Structural check only — never a network call. */
  isValid: (normalized: string) => boolean
}>
```

- `imo` — strip a leading `IMO` and whitespace; 7 digits; **check-digit verified** (digits 1–6
  weighted 7,6,5,4,3,2, sum mod 10 equals digit 7). This is what makes vessel identity exact.
- `inn` — digits only; 10 (legal entity) or 12 (individual).
- `ogrn` — digits only; 13 or 15.
- `lei` — 20 alphanumerics, upper-cased.
- `ofac` / `eu_fsf` / `uk_hmt` / `opensanctions` / `registry` — trimmed, upper-cased, no structural
  check (upstream formats vary and are not ours to police).

`normalize` is what equality compares. Two entities carrying `IMO 9074729` and `9074729` are the
same vessel; the raw string the analyst typed is preserved in `value`, the normalized form is what
the resolution chain and the (Stage 2) search index key on.

**Scheme list growth.** This list is seeded from the schemes the PRD names. Stage 3's connectors
will need more (per-jurisdiction registries). Adding one follows the vocabulary's amendment rule:
edit the file, edit the test, two-person decision. The `registry` catch-all exists so a connector
is never blocked mid-run, not as a licence to skip the amendment.

**Persistence:** one optional `external_ids TEXT` column on `units`, JSON-encoded, `fallbackSql:
"NULL"` — the same shape as `aliases`. Not a separate table: at 1,010 entities the lookup index is
built in memory in microseconds, and a JSON column costs one column descriptor instead of a table,
a reader, a writer, and a cascade.

---

## F4 — New entity kinds

Three new Profiles under ADR 0004's flat tagged union. They are authored **minimally** — the ADR's
rule that a profile's fields are a modelling exercise deferred to the investigation that needs them
still holds; what has changed is that the investigation now needs the *nodes*.

```ts
export type VesselProfile = {
  kind: "vessel"
  /** Broad hull class for iconography and filtering. Not the IMO type code. */
  vesselType?: "tanker" | "bulk" | "cargo" | "lng" | "other"
}
export type PersonProfile = { kind: "person" }
export type EquipmentClassProfile = { kind: "equipment_class" }

export type Profile = UnitProfile | CorporateProfile | VesselProfile | PersonProfile | EquipmentClassProfile
export type EntityKind = Profile["kind"]
```

Everything else these kinds carry is already core or already an edge:
IMO/INN → `externalIds`; flag state, jurisdiction, registered address, nationality, sanctions status
→ **rated Claims** (PRD section 2: never edges, discoverable through the Stage 2 Claim-value pivot);
officer roles → `officer_of` edges; management → `operated_by` edges.

`equipment_class` covers **classes only** — a model designation such as `T-90M`. Never a serial
number, hull, or airframe. Enforced by review, not by code.

**Positioning.** `person` and `equipment_class` default to `positionMode: "none"` and carry no
geometry. Combined with the hierarchy index's map exception (an unpinned entity with no anchored
ancestor stays off the map), they are correctly invisible on the map and visible in the inspector
and hierarchy panel. `vessel` may carry a static point (last known position, home port) via ordinary
drawn geometry with `positionMode: "own"`. **AIS tracks are not stored** — movement is dated
`shipped_to` edges.

**Synthetic layers.** Every entity needs a `layerId`, and `applyGeoPackageResult` rebuilds the layer
list from a fixed recipe (echelon + custom + osm + industry) rather than passing the file's list
through. Three fixed synthetic layers join `industry` under the same pattern:

```ts
export const VESSEL_LAYER_ID = "vessels"
export const PERSON_LAYER_ID = "persons"
export const EQUIPMENT_LAYER_ID = "equipment"
```

They are back-filled in `applyGeoPackageResult` (so a pre-v2 file gains them on open), in
`useProjectStore`'s `initialState()`, and in `useProjectIO.handleNew`. Without the back-fill,
creating a vessel in a project opened from a v1 file would produce an entity referencing a layer
that does not exist, and the next `loadGeoPackage` would throw `Unsupported schema: entity
references missing layer`.

**Symbol rendering.** `symbol.service.ts` derives NATO symbols from unit fields. The three new
kinds have no SIDC. `SymbolsLayer` renders `vessel` with a plain marker icon; `person` and
`equipment_class` never reach the map. No milsymbol change.

---

## F5 — Hierarchy index seam

This is the single seam that protects every existing consumer. The migration strategy is: **keep
the tested algorithm byte-identical and change only where the parent comes from.**

`core/entity/hierarchy.ts` keeps `buildOrbat<T extends OrbatNode>(items)` exactly as it is —
including its orphan policy, its cycle policy, and its 29 tests, which must pass unchanged.
The new module derives the parent map from edges and delegates:

```ts
// core/relationship/hierarchyIndex.ts
/** childId -> parentId, from ACTIVE ORGANIC subordinate_to edges only. */
export function activeParentMap(relationships: Relationship[]): Map<string, string>

export function buildHierarchy<T extends { id: string }>(
  items: T[],
  relationships: Relationship[],
): Orbat<T>
```

`activeParentMap` selects `type === "subordinate_to"` && `endDate == null` &&
`(metadata.attachment ?? "organic") === "organic"`. The PRD is explicit: *the ORBAT tree derives
from `organic` edges only*. An `attached` edge is a real, queryable relation (story 10:
resubordination without corrupting the command tree) that simply is not the tree. A dated,
ended hierarchical edge is history and is likewise not the tree.

If two active organic edges exist for one child — which the editing layer prevents but a corrupt
file or a merge could produce — `activeParentMap` takes the lexicographically smallest edge id and
`validateRelationships` reports a `multiple-active-hierarchy` violation. Deterministic, never a
throw.

`Orbat<T>` gains **one** method:

```ts
parentOf(id: string): string | null
```

Every consumer that reads `entity.parentId` today reads `orbat.parentOf(entity.id)` after the
migration. That is the whole consumer-side change — `childrenOf`, `ancestors`, `descendants`,
`roots`, `layers`, `depthOf`, `isRoot` keep their signatures and their behaviour.

**Corporate and unit hierarchies stay separate views.** `HierarchyPanel` builds two indexes today
(`buildOrbat(units)` and `buildOrbat(corporateEntities)`); after the migration it builds two
`buildHierarchy(subset, relationships)` calls over the same edge array. Because the edge set is
filtered by the item list, a `subordinate_to` edge between a unit and a corporate entity simply
does not appear in either tree — which preserves today's same-kind rule as an emergent property
rather than a second enforcement point.

---

## F6 — Claims on Relationships

An edge must be as auditable as a field (story 3).

```ts
export type Claim = {
  id: string
  /** Non-null when this Claim is about an Entity field. Null for a Relationship Claim. */
  entityId: string | null
  /** Non-null when this Claim is about a Relationship. Exactly one of the two is non-null. */
  relationshipId?: string | null
  field: string
  value: string | null
  sourceId: string
  credibility: AdmiraltyCredibility | null
  timestamp: string | null
  credibilityMeta?: CredibilityMeta
}
```

The "exactly one non-null" rule is an invariant enforced by the constructors and asserted by a
test, not by the type — mirroring the D1-loose precedent in `entity.ts`.

New constructors alongside `createFieldClaim` / `createCitationClaim`:

```ts
export function createRelationshipClaim(relationshipId: string, sourceId: string, field: string, value: string | null): Claim
export function filterRelationshipClaims(claims: Claim[], relationshipId: string): Claim[]
```

`GENERAL_CITATION_FIELD` (`"sources"`) works identically on a relationship — a general citation for
the edge as a whole is the common case.

**Guards to add.** `filterCitationClaims` and `groupCitationClaimsByEntityId` currently compare
`c.entityId` unconditionally; both gain an `entityId != null` skip so relationship claims are
invisible to the entity-citation path by construction.

**Persistence.** `provenance_claims` gains one optional column `relationship_id TEXT`
(`fallbackSql: "NULL"`). `entity_id TEXT NOT NULL` is unchanged on disk: `encode` writes `""` for
null, `decode` reads `""` back as null (decision 5). A pre-v2 file has no `relationship_id` column
and no empty `entity_id`, so it decodes to entity claims exactly as today — feature-detected,
like `aliases` and `credibility_meta` before it.

**Cascades.** Three places must learn about relationship claims:

- `useProjectStore.deleteEntity` — deletes edges touching the entity **and** their claims, not just
  the entity's own claims.
- `useProjectStore.removeLayer` — same, for every entity on the removed layer.
- `selectPersistableSnapshot` — currently keeps only claims whose `entityId` survives; must also
  keep claims whose `relationshipId` survives, and must drop edges whose endpoints were filtered
  out (an OSM-layer entity), otherwise the next load reports a dangling endpoint.

**ADMIRALTY is unchanged.** Reliability stays a capped type prior (ADR 0008); the machine still
cannot assign credibility 1 (ADR 0009); human overrides still win and are still skipped by
re-assessment. A Relationship Claim is a Claim — `reviewQueue.ts`, `ratingPipeline.ts` and
`assignCredibility` need no doctrine change, only the null-guard above.

---

## F7 — Persistence and migration

### New table

`core/persistence/geopackage/relationships.table.ts`, following the existing descriptor pattern:

```sql
CREATE TABLE IF NOT EXISTS relationships (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  type       TEXT NOT NULL,
  start_date TEXT,
  end_date   TEXT,
  metadata   TEXT
)
```

`metadata` is JSON of `RelationshipMetadata`; a corrupt value decodes to `{}` and never throws
(the `decodeAliases` precedent). `readRelationships` returns `[]` when the table is absent
(`tableExists`), which is every pre-v2 file. `writeRelationships` clears the table first, mirroring
`writeProvenanceClaims`.

`GeoPackageLoadResult` gains `relationships: Relationship[]` and `warnings: string[]`.
`saveGeoPackage` gains a trailing optional `relationships?: Relationship[]` parameter — the same
additive-trailing-param pattern used for `sources`, `claims` and `ratingEvents`, so every existing
call site stays green. `ProjectSaveInput` / `ProjectSaveDeps` in `useProjectIO.ts` thread it
through; `selectPersistableSnapshot` returns it.

### Migration

Runs inside `loadGeoPackage`, after entities and relationships are read, before validation:

```ts
export function migrateParentIdsToRelationships(
  entities: Array<{ id: string; kind: EntityKind; parentId: string | null }>,
  existing: Relationship[],
): Relationship[]
```

- For each entity with a non-null `parentId`, mint
  `{ id: "hier:" + child.id, fromId: child.id, toId: parentId, type: "subordinate_to",
     startDate: null, endDate: null, metadata: { attachment: "organic" } }`.
- Skip if `existing` already holds any `subordinate_to` edge with `fromId === child.id` — the
  relationships table wins, so a partially migrated file cannot double-migrate.
- The legacy same-kind and existence checks in `load.ts` stay exactly where they are and still
  throw `Unsupported schema` (decision 3). They run against the raw `parentId` values before
  migration, so the 1,010-unit fixture's behaviour is bit-for-bit what it is today.

Migration **must** run inside `loadGeoPackage` and be part of the returned result. If it ran in a
consumer instead, a save between load and migration would write the entities without their
`parent_id` descriptor and destroy the hierarchy. The fixture test asserts this ordering.

`parentId` is removed from `unitColumns` in Slice 4. The physical `parent_id` column survives on
reopened files but receives NULL on every insert, so the legacy hierarchy is gone from the column
after the first v2 save and lives only in `relationships`. This satisfies the PRD's "the column is
not written back on save" without an unsupported `DROP COLUMN`.

### Validation at load

```ts
validateRelationships(relationships, entityIds) => RelationshipViolation[]
```

Codes: `unknown-type`, `dangling-endpoint`, `self-loop`, `date-order`, `missing-required-date`,
`invalid-metadata`, `multiple-active-hierarchy`.

At load, every violation except `multiple-active-hierarchy` drops the offending row; the count and
reason join `result.warnings`, which `EditPage` surfaces through the existing `AppShell` banner.
`multiple-active-hierarchy` keeps both rows (dropping one would silently rewrite the command tree)
and reports.

---

## F8 — Editing layer and invariants

The PRD's invariant — *at most one active hierarchical Relationship per Entity; historical dated
hierarchical edges unconstrained* — is enforced here, in pure functions, not in the type system.

```ts
// core/relationship/edit.ts
export type EditResult = { relationships: Relationship[]; rejected?: EditRejection }
export type EditRejection = { code: "would-cycle" | "unknown-type" | "invalid-metadata" | "missing-required-date"; detail: string }

/** Correction: the child was always under this parent and the old record was wrong.
 *  Removes the existing active organic edge; does not create history. */
export function setHierarchicalParent(rels: Relationship[], childId: string, parentId: string | null): EditResult

/** History: the child moved, on a date. Ends the existing active edge at `effectiveDate`
 *  and creates a new one starting there. Story 2 and story 10. */
export function resubordinate(rels: Relationship[], childId: string, newParentId: string, effectiveDate: string, attachment?: "organic" | "attached"): EditResult

export function addRelationship(rels: Relationship[], draft: RelationshipDraft): EditResult
export function endRelationship(rels: Relationship[], id: string, endDate: string): EditResult
export function removeRelationship(rels: Relationship[], id: string): Relationship[]
```

The correction/history split is deliberate and user-visible. The inspector's parent dropdown is a
*correction* — an analyst fixing a typo must not manufacture a fake resubordination event. Recording
a real move is a separate, dated action. Conflating them would poison the "graph as of date" filter
with edges whose dates mean "when I noticed" rather than "when it happened".

**Cycle guard.** `setHierarchicalParent` and `resubordinate` reject when `parentId` is `childId` or
a descendant of `childId` under the current active organic tree, returning `would-cycle` and leaving
the array unchanged. The `EntityInspector` parent picker disables those options rather than
offering a choice that will be refused. `buildOrbat`'s cycle policy stays as the defence against
cycles that arrive from a file, not as a licence to create them.

**Merge.** `IdentityGraph` gains `relationships`, and `mergeEntities` gains an edge pass that
faithfully ports today's `resolveParent` semantics onto edges:

1. Rewrite every edge's `fromId`/`toId`: `secondaryId` becomes `primaryId`.
2. Drop edges that became self-loops.
3. Dedupe edges identical on `(fromId, toId, type, startDate, endDate)`, keeping populated
   metadata; re-point the dropped edge's claims onto the survivor.
4. Hierarchical resolution, mirroring today: if the primary has an active organic edge it wins and
   the secondary's rewritten one is dropped; if it has none, the secondary's survives. If the
   primary sat inside the secondary's subtree, the primary is first promoted into the secondary's
   slot, exactly as `resolveParent` does now, so re-parenting the secondary's children cannot form
   a cycle.
5. Report `droppedRelationshipIds` and `droppedClaimIds` in the result so the store can surface
   what a merge cost.

**Store surface.** `relationships.store.ts` holds the pure reducers; `useProjectStore` gains
`relationships: Relationship[]` in `ProjectState` and thin actions delegating to them
(`addRelationship`, `updateRelationship`, `endRelationship`, `removeRelationship`,
`setHierarchicalParent`, `resubordinate`). Actions stay one-liners so `useProjectStore.ts` does not
grow further past the 300-line limit; the branching lives in the tested reducer.

---

## F9 — Proposal spine core

The convergence point every later producer attaches to. This stage delivers the **core**: types,
the resolution chain, rejection memory, and one adapted producer proving the shape. The unified
review surface and the remaining producers are Stage 2 and later.

```ts
// core/proposal/proposal.ts
export type ProducerKind = "enrichment" | "telegram-oob" | "connector" | "document" | "sync" | "weak-signal"
export type ProducerRef = { kind: ProducerKind; name: string; runId: string }

export type ProposalOp =
  | { op: "create-entity"; draft: EntityDraft }
  | { op: "update-entity-field"; entityId: string; field: string; currentValue: string | null; proposedValue: string | null }
  | { op: "create-relationship"; draft: RelationshipDraft }
  | { op: "end-relationship"; relationshipId: string; endDate: string }
  | { op: "add-claim"; target: { entityId: string } | { relationshipId: string }; field: string; value: string | null }
  | { op: "merge-entities"; primaryId: string; secondaryId: string }

export type Resolution = {
  /** The existing Entity this proposal was resolved onto, or null for a genuinely new one. */
  targetEntityId: string | null
  basis: "external-id" | "alias" | "fuzzy-name" | "none"
  score: number
  /** Human-readable, shown in review: "matches Uralvagonzavod (INN 6623000679)". */
  detail: string
}

export type EvidenceRef = { sourceId: string | null; url: string | null; quote: string | null; locator: string | null }

export type Proposal = {
  id: string
  producer: ProducerRef
  createdAt: string
  sourceId: string | null
  regime: "batch" | "per-item"
  op: ProposalOp
  resolution: Resolution
  evidence: EvidenceRef[]
  status: "pending" | "accepted" | "rejected"
  decidedAt: string | null
}
```

**Resolution happens before display** (story 21). `core/proposal/resolve.ts`:

```ts
export function resolveTarget(
  candidate: { name: string; aliases?: string[]; externalIds?: ExternalId[]; kind: EntityKind },
  entities: Entity[],
): Resolution
```

Strict ordering, and this ordering is a hard-gate test:

1. **Exact External Id** — any normalized `{scheme, value}` shared with an existing entity of the
   same kind. `score: 1`, `basis: "external-id"`. Wins outright.
2. **Alias / transliteration** — an exact match on a `normalizeForMatch` key (which already handles
   Latin↔Cyrillic via `core/identity/transliterate.ts`) against name or aliases. `score: 1`,
   `basis: "alias"`.
3. **Fuzzy name** — `matchesForEntity` above `DEFAULT_MATCH_THRESHOLD` (0.85).
   `basis: "fuzzy-name"`, score from `nameSimilarity`.
4. Otherwise `{ targetEntityId: null, basis: "none", score: 0 }`.

This reuses `core/identity` rather than reimplementing matching; the only new step is (1), which
is why External Ids are a prerequisite slice.

**Rejection memory** (story 25). A rejected proposal's *identity* is not its id — the next run
mints a new one. `core/proposal/fingerprint.ts`:

```ts
export function proposalFingerprint(p: Proposal): string
```

A canonical, order-stable string over `{producer.kind, op discriminant, resolved target id or
normalized candidate name, field, normalized value}` — deliberately excluding `runId`, timestamps
and evidence. Persisted in a `rejected_proposals` table
(`fingerprint TEXT PRIMARY KEY, rejected_at TEXT, producer TEXT, summary TEXT`) and consulted by
producers before display, so a rejected suggestion does not return on every run.

**Acceptance regimes.** `batch` for reference data — one human decision covering many items, with
per-item provenance preserved (each accepted item still mints its own Claim carrying its own
`sourceId`). `per-item` for investigation signal. The reducer enforces that a batch acceptance
records a decision on every member, not a single aggregate row.

**The browser remains the only writer.** Nothing in this module touches the sidecar, and the
sidecar never gains a path to the `.gpkg`. Proposals cross the boundary as JSON over localhost;
acceptance is a browser-side store mutation and a browser-side save.

**Tracer bullet.** The existing enrichment producer is adapted to emit spine `Proposal`s behind
`modules/enrichment/services/toSpineProposal.ts`, with resolution attached, while `EnrichDrawer`
keeps rendering from its current `EnrichmentProposal` shape via a thin projection. This validates
the spine against real producer data without rewriting a working review flow. Migrating the
Telegram OOB producer and building the unified review surface are Stage 2.

---

## Slices

Tracer-bullet vertical slices. Each ends with a working build, passing tests, and its own
documentation updates — `npm run verify` green before the slice is claimed done.

### Slice 0 — Vocabulary and Relationship type
`core/relationship/{relationship,vocabulary,validate,query}.ts`, all pure, no consumers.
ADR 0010 (first-class Relationships, `parentId` removal, closed two-tier vocabulary) lands here —
it records a decision already taken, so it should not trail the code.
**Done when:** the twelve types are declared with verbatim public definitions, `validateRelationships`
covers all seven violation codes, `activeAt` half-open semantics are tested, and a test locks the
vocabulary at 12 = 11 record + 1 assessment.

### Slice 1 — External Ids
`core/entity/externalId.ts`, `externalIds` on `EntityCore`, the `external_ids` optional column,
scheme normalizers and the IMO check digit.
**Done when:** the real demo fixture reopens with `external_ids` added via `ensureOptionalColumns`
and an id set on one entity survives a save/reload while every other row stays `undefined` — the
same assertion shape as the existing `aliases` fixture test.

### Slice 2 — Relationships table, load/save, and the parentId migration
`relationships.table.ts`, `migrateParentIdsToRelationships`, `warnings` on the load result,
threading through `save.ts` / `useProjectIO` / `selectPersistableSnapshot`.
`Entity.parentId` **stays**, but becomes *derived*: `applyGeoPackageResult` populates it from the
active organic edges and it is no longer persisted from this point. Every consumer keeps working
untouched.
**Hard gate:** the real 1,010-unit `public/project.gpkg` opens, converts parent-child links to
Relationships, saves, and reopens with an identical hierarchy. Pre-migration and post-migration
files both load.

### Slice 3 — Hierarchy index seam
`core/relationship/hierarchyIndex.ts`, `Orbat.parentOf`, and the nine read consumers moved off
`entity.parentId` onto the index (see the [inventory](#consumer-migration-inventory)).
**Done when:** every existing `hierarchy.test.ts` case passes unchanged, `buildHierarchy` reproduces
them over edges, and no read consumer references `entity.parentId`.

### Slice 4 — Write path, and `parentId` deleted
`core/relationship/edit.ts`, `relationships.store.ts`, the store actions, the inspector's parent
picker writing edges, `merge.ts` rewriting relationships, `parentId` removed from `EntityCore` and
from `unitColumns`. The point of no return — small, because slices 2 and 3 did the work.
**Done when:** the fixture hard gate still passes with the column gone, the one-active-hierarchical-edge
invariant and the cycle guard are tested, and merge is tested for edge rewrite, dedupe, dropped-claim
re-pointing and the promote-out-of-subtree case.

### Slice 5 — New entity kinds
`vessel`, `person`, `equipment_class` profiles; the three synthetic layers back-filled in
`applyGeoPackageResult`, `initialState()` and `handleNew`; kind-aware target ordering in the
relationship picker; `SymbolsLayer` marker for vessels.
**Done when:** a project opened from a pre-v2 file gains the three layers, an entity of each new
kind round-trips, and no new kind can be created onto a missing layer.

### Slice 6 — Claims on Relationships
`relationshipId` on `Claim`, the `""` sentinel encode/decode, the null-guards on the citation
helpers, the three cascades, relationship claims rendered in the inspector's relationship list with
their ADMIRALTY ratings.
**Done when:** a relationship claim round-trips, a pre-v2 file's claims still decode as entity
claims, deleting an entity leaves no dangling relationship or claim, and `isUnsourced` drives the
visual marking of hypothesis edges (story 8).

### Slice 7 — Proposal spine core
`core/proposal/*`, the `rejected_proposals` table, and the enrichment adapter.
**Done when:** resolution ordering is proved (external id beats alias beats fuzzy), a rejected
fingerprint suppresses the same suggestion on a second run, batch acceptance preserves per-item
provenance, and enrichment output round-trips through the spine types without changing what
`EnrichDrawer` shows.

---

## Test plan

Vitest only. The rule from the PRD holds throughout: given a project state and an input, assert the
observable outcome — the resulting graph, the emitted Proposals, the serialized output. Never assert
on internal call order or intermediate shapes.

**Pure core**
- Vocabulary: exactly twelve types, tier split, every definition non-empty, every declared metadata
  key owned by exactly the types that declare it.
- Relationship invariants: out-of-vocabulary type rejected; `shipped_to` without `startDate`
  rejected; `startDate > endDate` rejected; metadata key not owned by the type rejected; self-loop
  rejected; at most one active hierarchical edge.
- Graph index: adjacency both directions, type filtering, and the as-of-date filter — an edge dated
  before/after the query date appears/disappears, with the half-open boundary asserted explicitly
  (an edge ended on D is absent on D).
- Hierarchy index over Relationships: `childrenOf`, `ancestors`, `descendants`, `roots`, `layers`,
  `depthOf`, `parentOf`, plus the existing orphan and cycle policies, behaving identically after
  migration. The existing `hierarchy.test.ts` is the oracle.
- Attached-versus-organic: an `attached` edge is queryable but absent from the tree; an ended
  organic edge is absent from the tree and present in `activeAt` for a date inside its interval.
- Merge over relationships: rewrite, self-loop drop, dedupe with claim re-pointing, primary-wins
  hierarchy, promote-out-of-subtree, reported drops.
- External Ids: IMO check digit accepts a real IMO and rejects a transposition; normalization makes
  `IMO 9074729` and `9074729` equal; INN/OGRN/LEI length rules.

**Persistence — hard gate**
- The real `public/project.gpkg` (1,010 units, pre-E1 shape) opens, converts parent-child links to
  Relationships, saves, and reopens with an **identical hierarchy** — asserted as an
  `activeParentMap` equality, not a row count.
- Pre-migration and post-migration files both load.
- Double round-trip does not duplicate relationships (deterministic `hier:` ids).
- `relationships` / `external_ids` / `relationship_id` are added to a reopened pre-feature file via
  `ensureOptionalColumns`, and a value in each survives; every other row stays clean.
- A later save that omits relationships wipes the table (the Fix 6 regression shape).
- Corrupt-row handling: an unknown type, a dangling endpoint and a self-loop are each dropped with
  a warning rather than throwing; a legacy cross-kind `parent_id` still throws.

**Proposal spine and identity**
- Resolution ordering, hard gate: External Id exact beats alias, which beats fuzzy name.
- Rejection memory: the same op from a second run is suppressed by fingerprint; a *different* value
  for the same field is not suppressed.
- Batch versus per-item: batch acceptance records a decision per member and preserves each item's
  `sourceId`.
- ADMIRALTY on Relationship Claims: the machine cannot emit credibility 1; human-overridden ratings
  survive re-assessment.
- Existing identity tests extended to External Id matching and to Cyrillic/Latin transliteration on
  the three new kinds.

**Out of scope for tests** (owner's decision, carried from the PRD): UI and integration tests for
new views. Storybook stories may be added where they aid development. Existing UI-adjacent tests
continue to run unchanged.

---

## Consumer migration inventory

Every site that reads or writes `entity.parentId` today, with its slice. This list is the
completeness check for Slices 3 and 4 — the field cannot be deleted while any entry is open.

**Read consumers → `orbat.parentOf(id)` (Slice 3)**

| File | What it does |
|---|---|
| `core/map/geometry.ts:40,73–98` | `Positionable` type and the orbital BFS parent lookup |
| `modules/orbat/ui/NetworkLinksLayer.tsx:49–54` | parent-child polylines and their keys |
| `modules/orbat/ui/TreeView.tsx:51–54` | tree edges |
| `modules/orbat/ui/HierarchyPanel.tsx:59` | hidden-parent check |
| `modules/orbat/store/useEntityVisibilityStore.ts:27` | descendant visibility cascade |
| `modules/orbat/services/symbol.service.ts:186` | `parent_id` in the enrichment feature properties |
| `components/shared/LayersPanel.tsx:140` | has-children flag |
| `modules/enrichment/services/research/layered-research.service.ts` | BFS layer ordering |
| `modules/enrichment/services/{enrichmentAdapters,request-builder}.ts` | parent context for prompts |

**Write consumers → `edit.ts` operations (Slice 4)**

| File | What it does |
|---|---|
| `modules/orbat/hooks/useEntityInspector.ts:95–96,204–207` | parent name display and `handleParentChange` |
| `modules/orbat/ui/EntityInspector.tsx:311,502` | has-parent flag and the parent `Select` |
| `shell/MainLayout.tsx:30,39` and `pages/EditPage.tsx:32` | `addEntity` signature carrying `parentId` |
| `core/identity/merge.ts:49,88,113–133` | `resolveParent`, `isDescendant`, child re-parenting |

**Persistence (Slices 2 and 4)**

| File | What it does |
|---|---|
| `core/persistence/geopackage/units.table.ts:31` | the `parent_id` descriptor — removed in Slice 4 |
| `core/persistence/geopackage/organisations.table.ts:34,76` | legacy table read path — feeds migration, kept |
| `core/persistence/geopackage/load.ts:51–66` | same-kind parent validation — kept for the legacy path |
| `core/persistence/geopackage/applyResult.ts` | derives `parentId` in Slice 2, stops in Slice 4 |

Story fixtures across `*.stories.tsx` and the `parentId` assertions in `units.table.test.ts`,
`project-gpkg-fixture.test.ts`, `merge.test.ts`, `hierarchy.test.ts`,
`layered-research.service.test.ts` and `enrichmentApply.test.ts` are updated with their slice.

---

## Documentation obligations

Per `CONSTRAINTS.md` ("update the relevant `/docs/` file whenever an architectural decision
changes") these land **with their slice**, not as a trailing cleanup.

- **ADR 0010 — First-class Relationships** (Slice 0): the graph migration, the removal of
  `parentId`, the closed two-tier vocabulary, and the amendment procedure. Records why the
  hierarchy index seam was chosen over per-consumer rewrites.
- **`CONTEXT.md` glossary** (per slice): **Hierarchy** is redefined — no longer a core Entity
  property but a derived view over active organic `subordinate_to` Relationships. New entries:
  Relationship, Edge Type Vocabulary, record tier / assessment tier, External Id, Proposal
  (generalising Enrichment Proposal), Anchored expansion, Sync session, Diff report, Latent link,
  Attribute collision, Criticality badge, Export gate, Dataset release — the last seven defined here
  as forward vocabulary, implemented in later stages.
- **`docs/ARCHITECTURE.md`** (Slices 2, 4, 6): the GeoPackage I/O boundary gains the `relationships`
  table; Key Invariants gains "the hierarchy is derived from active organic `subordinate_to` edges,
  never from a field".
- **`docs/README.md`**: this spec added to the index.
- **ADRs 0004, 0006, 0008, 0009 stand unchanged.** The Profile tagged union governs the three new
  kinds; Source/Claim stays the provenance model; the capped reliability prior and the
  machine-never-confirms rule apply to Relationship Claims as written; Notes stay restricted to
  organisational change and Epistemic Caveats.

---

## Risks and deviations from the PRD

**Deviations, with reasons.** `owned_by`'s as-of date is the edge's `startDate` rather than a
metadata field (decision 1). Kind pairs are advisory rather than enforced (decision 2). Both are
narrow readings of PRD section 2 that avoid a downstream defect; neither changes what the
vocabulary asserts.

**The `parentId` deletion is irreversible mid-flight.** Slice 4 is the point of no return. It is
sequenced last among the model slices precisely so that the migration (Slice 2) and the consumer
seam (Slice 3) are both proven against the real fixture before the field disappears. If Slice 4
must be reverted, Slices 0–3 stand on their own.

**`person` and `equipment_class` have no home view in this stage.** They are creatable, editable,
and edge-connectable from the inspector, but they never render on the map and the table and graph
views that would list them are Stage 2 and Stage 6. Between this stage and those, the only way to
reach a person is through an edge on another entity's dossier. Acceptable — the entities exist so
that connectors and documents have something to resolve onto — but it is a real gap and should not
be discovered as a surprise.

**`useProjectStore.ts` is already at 343 lines**, over the 300-line limit in `CONSTRAINTS.md`.
This stage must not worsen it: relationship logic goes in `relationships.store.ts` and the store
actions stay one-line delegations. Splitting the existing store is out of scope here.

**Review capacity is the structural bottleneck of the whole design** (PRD, Further Notes). This
stage builds the funnel every later producer feeds. Its shape — resolution before display,
fingerprinted rejection memory, batch versus per-item — is what keeps that queue survivable for two
analysts. Getting the spine's ergonomics wrong here is more expensive than getting any single
connector wrong later.
