# Build Spec — Gabriel v2, Slices 0 and 1

**Authority.** For Slices 0 and 1 this document is the authority. `GABRIEL_V2_FOUNDATION_SPEC.md`
was deleted on 2026-07-29: it described the revised-away plan (`parentId` deletion, `query.ts`,
seven violation codes, an eight-slice Stage 1) and was wrong in six further places; git history
has it. **This file's line numbers drifted +9 above line 488 on 2026-07-29 — read the appendix at
the end of this file before trusting any citation into it.**

**Audience.** An autonomous coding agent working unattended. Every open question that
blocked a dry run has been closed below. If you find yourself about to guess, stop and
record the guess in `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` rather than inventing.

**Stop-ship.** `npm run verify` (`lint` → `test:coverage` → `build`) must pass before either
slice is claimed done.

---

## Measured ground truth

Do not trust the "1,010 units" figure repeated in the PRD and Foundation Spec. Measured
directly from `public/project.gpkg`:

| fact | value |
|---|---|
| `units` rows | 1010 |
| `units` with `parent_id NOT NULL` | 999 |
| `organisations` rows | 17 (13 with a parent) |
| entities after `load.ts:27` folds organisations | 1027 |
| entities with a non-null `parentId` | 1012 |

Neither slice here asserts any of these numbers. They are recorded so that a later slice
does not assert the wrong one.

---

## Scope

**Slice 0** — the relationship vocabulary and type, as pure files.
**Slice 1** — External Ids on the Entity core and the `external_ids` column.

**Not in these slices:** the `relationships` table, any migration, any store field, any UI,
the export gate, `Claim.relationshipId`. Slice 0 has no runtime consumer by design.

---

## Slice 0 — Vocabulary and Relationship type

### Files

```
src/core/relationship/relationship.ts     new
src/core/relationship/vocabulary.ts       new
src/core/relationship/validate.ts         new
src/core/entity/entity.ts                 modified — three bare Profile members + EntityKind
src/core/persistence/geopackage/units.table.ts   modified — one line (see Trap T2)
docs/adr/0010-first-class-relationships.md       new
docs/adr/0004-entity-profile-tagged-union.md     modified — one supersession line
CONTEXT.md                                       modified — glossary
```

`query.ts` is **not** created. `activeAt` is **not** implemented. `edgesOf`, `outgoing`,
`incoming` and `isUnsourced` are **not** implemented in this slice — they land in the slice
that first needs them (`isUnsourced` needs `Claim.relationshipId`, which is Slice 6).

### `relationship.ts`

```ts
export type RelationshipTier = "record" | "assessment"

export type RelationshipType =
  | "subordinate_to" | "fields" | "produces" | "corporate_parent" | "owned_by"
  | "beneficially_owned_by" | "officer_of" | "supplies" | "shipped_to"
  | "operated_by" | "insured_by" | "successor_of"   // record tier — 12
  | "acts_for"                                      // assessment tier — 1

/** Flat optional bag. Validity is per type and enforced at runtime by
 *  `validateRelationships`, never by the type system. */
export type RelationshipMetadata = {
  attachment?: "organic" | "attached"                                   // subordinate_to
  role?: "director" | "secretary" | "registered_agent"                  // officer_of
  operatorRole?: "technical" | "commercial" | "ISM" | "charterer"       // operated_by
  basis?: "control" | "intermediary" | "proxy"                          // acts_for
  percent?: number                                                      // corporate_parent, owned_by — 0–100
}

/** Per-edge authorisation to publish one assessment-tier edge under CC-BY (story 80).
 *  Deliberately not in RelationshipMetadata: metadata keys are owned by exactly one
 *  declaring type, and this concern is cross-type. Absent means excluded. */
export type ExportOverride = {
  proposedBy: string
  /** Must differ from proposedBy. This is the two-person aspect; it enforces
   *  ceremony and attribution, not authentication — Gabriel has no identity system. */
  confirmedBy: string
  confirmedAt: string
  rationale: string
}

export type Relationship = {
  id: string
  fromId: string
  toId: string
  type: RelationshipType
  /** ISO 8601 (YYYY-MM-DD) or null. An edge with no end date is active. */
  startDate: string | null
  endDate: string | null
  metadata: RelationshipMetadata
  /** Read only by the export gate (Stage 1.5). Undefined on virtually every edge. */
  exportOverride?: ExportOverride
}

export type RelationshipDraft = Omit<Relationship, "id">

/** Fail-closed: anything not structurally valid decodes to `undefined`, i.e. "no
 *  override", i.e. excluded from export. Never throws. */
export function decodeExportOverride(raw: unknown): ExportOverride | undefined
```

`decodeExportOverride` accepts a JSON string or an object. It returns `undefined` unless
all four fields are non-empty strings, `proposedBy !== confirmedBy`, and `confirmedAt`
matches `/^\d{4}-\d{2}-\d{2}/`.

**Direction** is fixed by the naming rule: every type reads as "A *type* B", so `fromId` is
always A. No type is symmetric.

### `vocabulary.ts`

```ts
export const EDGE_VOCABULARY_VERSION = "1.0.0"

export type EdgeLayer =
  | "orbat" | "military-industrial" | "industrial"
  | "financial" | "logistics" | "shipping"

/** Closed value sets per metadata key. A `readonly string[]` is an enum; the object
 *  form is an inclusive numeric range (only `percent` uses it). */
export type MetadataSpec = Partial<
  Record<keyof RelationshipMetadata, readonly string[] | { min: number; max: number }>
>

export type EdgeTypeDefinition = {
  type: RelationshipType
  tier: RelationshipTier
  /** null for assessment-tier edges, which are not confined to one layer. */
  layer: EdgeLayer | null
  fromLabel: string
  toLabel: string
  /** Advisory only — orders and filters the target picker. Never rejects. */
  fromKinds: EntityKind[]
  toKinds: EntityKind[]
  /** Ships verbatim in the CC-BY dataset. Authored below; do not paraphrase. */
  publicDefinition: string
  dateRequired: "start" | null
  metadata: MetadataSpec
}

export const EDGE_TYPES: Record<RelationshipType, EdgeTypeDefinition>
export const RECORD_TIER_TYPES: RelationshipType[]
export const ASSESSMENT_TIER_TYPES: RelationshipType[]
```

`dateRequired` is two-state. Only `shipped_to` is `"start"`; every other type is `null`.
There is no "expected" third state, and no field drives a soft date prompt — that UI
behaviour is dropped.

### The thirteen entries

`fromKinds`/`toKinds` are advisory, so a wrong entry mis-orders a picker and never rejects.

`corporate_parent` and `owned_by` are deliberately split. `corporate_parent` is
organisation-to-organisation corporate structure; `owned_by` is a natural person holding an
entity. The distinction exists because the two carry different publication risk: a corporate
parent link is a structural fact, while a person's ownership names an individual and is
gated out of the public dataset by the natural-person clause.

| type | tier | layer | from → to | fromKinds | toKinds | date | metadata |
|---|---|---|---|---|---|---|---|
| `subordinate_to` | record | orbat | unit → formation | unit | unit | — | `attachment` |
| `fields` | record | military-industrial | unit → equipment class | unit | equipment_class | — | — |
| `produces` | record | industrial | facility → equipment class | corporate | equipment_class | — | — |
| `corporate_parent` | record | financial | subsidiary → parent org | corporate, vessel | corporate | — | `percent` |
| `owned_by` | record | financial | entity → owning person | corporate, vessel | person | — | `percent` |
| `beneficially_owned_by` | record | financial | entity → beneficial owner | corporate | person, corporate | — | — |
| `officer_of` | record | financial | officer → organisation | person, corporate | corporate | — | `role` |
| `supplies` | record | industrial | supplier → customer | corporate | corporate | — | — |
| `shipped_to` | record | logistics | consignor → consignee | corporate | corporate | **start** | — |
| `operated_by` | record | shipping | asset → operator | vessel, corporate | corporate | — | `operatorRole` |
| `insured_by` | record | shipping | insured → insurer | vessel, corporate | corporate | — | — |
| `successor_of` | record | financial | entity → predecessor | corporate | corporate | — | — |
| `acts_for` | assessment | null | instrument → principal | corporate, person, vessel | corporate, person | — | `basis` |

### The thirteen public definitions — copy verbatim

These are authored for publication, not transcribed from the PRD. The PRD's section-2
cells contain implementation mechanics, and its `owned_by` cell contradicts the shipped
model (it says the as-of date lives in metadata; it lives on `startDate`). Do not
regenerate these from the PRD.

```
subordinate_to
The subject unit is recorded in a cited source as a subordinate element of the named
formation's order of battle. Where the attachment qualifier reads 'attached' the source
records that subordination as temporary; absent or 'organic', it records the unit's standing place.
This states what the cited record says, not a verified present chain of command.

fields
The subject unit was observed operating the named class of equipment on the recorded date.
Where no date is recorded the observation is undated, and states nothing about what the unit
operates now.

produces
The subject facility is documented as manufacturing, assembling or refurbishing the named
class of equipment. This records what a cited source states about the facility's output; it
is not, on its own, evidence of current production.

corporate_parent
The subject organisation is recorded as part of the named parent organisation's corporate
structure. Where a shareholding is known it is given as a percentage; where no percentage
is recorded, no ownership share, controlling interest or acquisition date has been
established. This is not, on its own, a statement of legal control.

owned_by
The named person holds a registered equity stake in the subject entity. No minimum
threshold is applied; reusers may filter by the recorded percentage.

beneficially_owned_by
The named party is recorded as a beneficial owner of the subject entity — the person or
organisation that ultimately benefits from its ownership.

officer_of
The subject party holds a named office in the organisation: director, secretary, or
registered agent.

supplies
The subject supplier is documented as providing goods or services to the named customer on
a recurring basis — a contract, or at least two recorded transactions. A single or
undocumented delivery does not meet that threshold and is not recorded as a supply
relationship.

shipped_to
The subject consignor shipped goods to the named consignee on the recorded date.

operated_by
The named operator exercises a recorded operating role over the subject asset: technical,
commercial, ISM, or charter.

insured_by
The named insurer provides insurance cover to the subject vessel or organisation.

successor_of
The subject entity is recorded as the successor to the named predecessor, typically
following re-registration, renaming, or restructuring.

acts_for
ASSESSMENT — not a documentary record. This project assesses that the subject entity acts
on behalf of the named principal. This is an analytical judgement and should be weighed as
such.
```

### `validate.ts`

One exported validation function, plus the active-edge predicate.

```ts
export const RELATIONSHIP_VIOLATION_CODES = [
  "unknown-type", "dangling-endpoint", "self-loop", "date-order", "invalid-date",
  "missing-required-date", "invalid-metadata", "multiple-active-hierarchy",
  "invalid-export-override",
] as const

export type RelationshipViolationCode = typeof RELATIONSHIP_VIOLATION_CODES[number]

export type RelationshipViolation = {
  code: RelationshipViolationCode
  relationshipId: string
  detail: string
}

/** `entityIds` omitted skips the dangling-endpoint check — callers that do not yet
 *  have the entity set (pure unit tests) still get every other check. */
export function validateRelationships(
  rels: Relationship[],
  entityIds?: Set<string>,
): RelationshipViolation[]

/** No date: active means `endDate == null`. With a date: the half-open interval
 *  `(startDate == null || startDate <= d) && (endDate == null || endDate > d)`,
 *  so an edge ended on D is absent on D. */
export function isActive(rel: Relationship, onDate?: string): boolean
```

Rules, one per code:

- `unknown-type` — `type` is not a key of `EDGE_TYPES`.
- `dangling-endpoint` — `fromId` or `toId` is absent from `entityIds` (skipped if omitted).
- `self-loop` — `fromId === toId`.
- `invalid-date` — a non-null `startDate`/`endDate` failing `/^\d{4}-\d{2}-\d{2}$/`.
  Checked **before** `date-order`, because the order comparison is a string compare and
  `"2026-1-5" > "2026-10-01"` lexicographically.
- `date-order` — both dates present, well-formed, and `startDate > endDate`.
- `missing-required-date` — `EDGE_TYPES[type].dateRequired === "start"` and `startDate` is null.
- `invalid-metadata` — a metadata key whose value is not `undefined` and which the declaring
  type does not own, or a value outside the declared set. A key present with value
  `undefined` counts as **absent** (`decodeRow` assigns every prop unconditionally, so
  undefined-valued keys are routine in this codebase). `percent` must be finite and
  `0 <= p <= 100`; non-integers are legal.
- `multiple-active-hierarchy` — more than one active organic `subordinate_to` edge shares a
  `fromId`. Emit **one violation per offending edge**, so a child with two such edges
  produces two violations.
- `invalid-export-override` — `exportOverride` is present but malformed, or
  `proposedBy === confirmedBy`, or it sits on a record-tier edge (meaningless there).

### `entity.ts` changes

Add three **bare** profiles and the kind list. Add no fields — see Trap T1.

```ts
export type VesselProfile = { kind: "vessel" }
export type PersonProfile = { kind: "person" }
export type EquipmentClassProfile = { kind: "equipment_class" }

export type Profile =
  | UnitProfile | CorporateProfile
  | VesselProfile | PersonProfile | EquipmentClassProfile

export const ENTITY_KINDS = ["unit", "corporate", "vessel", "person", "equipment_class"] as const
export type EntityKind = typeof ENTITY_KINDS[number]
```

`Entity["kind"]` widens automatically through `kind: Profile["kind"]` at `entity.ts:89`.
The field mirror at `entity.ts:96-102` is **not** touched — the new profiles carry no
fields, which is the whole reason they are bare in this slice. Full profiles and the
mirror edits are Slice 5.

### Tests

- Vocabulary is exactly **13 entries, 12 record + 1 assessment**. A CI tripwire: after
  `EDGE_VOCABULARY_VERSION` 1.0.0 ships, the amendment procedure edits `vocabulary.ts` and
  this test together and bumps the version. Adding to the *initial* list is authoring, not
  amendment — which is why `corporate_parent` costs nothing here and would cost a version
  bump if deferred.
- `corporate_parent` and `owned_by` have disjoint `toKinds` (`corporate` vs `person`).
  A test asserts this, because collapsing them is the mistake the split exists to prevent.
- Every `publicDefinition` is non-empty, at least 40 characters, and contains no backtick —
  proving PRD mechanics were stripped rather than pasted.
  *Amended 2026-07-29 by owner ruling (see `SLICE_RUN_LOG.md`, Ruling 1, and `SLICE_0_1_OPEN_QUESTIONS.md`
  Q14/Q15).* This clause originally also required no semicolon. Two of the authored definitions
  below (`corporate_parent`, `owned_by`) use a semicolon as ordinary English punctuation, so the
  rule contradicted the verbatim-copy requirement and no implementation could satisfy both. The
  no-semicolon check was a heuristic against pasted PRD table cells; the prose it guards is what
  ships. The prose won.
- Every metadata key declared in a `MetadataSpec` exists on `RelationshipMetadata`, and is
  declared by exactly the types that own it.
- `ENTITY_KINDS` and `Profile["kind"]` agree (exhaustiveness lock, via a type-level assertion
  plus a runtime length check).
- `validateRelationships` emits every one of the nine codes on a crafted corpus; assert
  `new Set(violations.map(v => v.code))` equals the full code set.
- `isActive` boundary: an edge with `endDate: "2026-03-01"` is **absent** on `"2026-03-01"`
  and present on `"2026-02-28"`.
- `decodeExportOverride` returns `undefined` for: a non-object, a missing field, an empty
  string field, `proposedBy === confirmedBy`, and a malformed `confirmedAt`.

### Done when

`npm run verify` is green, and each test above exists and passes. ADR 0010 is committed in
this slice, not trailing it.

**Not machine-checkable — a human reads these before Slice 2 starts:** the wording of the
thirteen public definitions, ADR 0010's supersession text, and the `CONTEXT.md` glossary
entries. Everything else in Slice 0 is verified by `npm run verify`.

---

## Slice 1 — External Ids

### Files

```
src/core/entity/externalId.ts                    new
src/core/entity/entity.ts                        modified — externalIds on EntityCore
src/core/persistence/geopackage/units.table.ts   modified — external_ids descriptor
```

`saveGeoPackage`'s signature does **not** change in this slice. `external_ids` travels
inside `entities`, so every existing call site stays green.

### `externalId.ts`

```ts
export type ExternalIdScheme =
  | "imo" | "inn" | "ogrn" | "lei"
  | "ofac" | "eu_fsf" | "uk_hmt" | "opensanctions" | "registry"

export type ExternalId = {
  scheme: ExternalIdScheme
  /** The raw string the analyst typed, preserved as entered. */
  value: string
}

/** Scheme-specific normalisation: upper-case, strip separators and scheme prefixes,
 *  so "IMO 9074729" and "9074729" compare equal. */
export function normalizeExternalId(scheme: ExternalIdScheme, value: string): string

/** Stable map key for exact deduplication: `${scheme}:${normalizeExternalId(...)}`.
 *  There is no persisted `normalized` field — it is recomputed at every comparison. */
export function externalIdKey(id: ExternalId): string

/** Structural validity only. Returns false for a wrong-length or wrong-charset value
 *  and for an IMO failing its check digit. */
export function isValidExternalId(id: ExternalId): boolean
```

Scheme rules: `imo` — 7 digits, seventh is the check digit (sum of digits 1–6 weighted
7,6,5,4,3,2, mod 10). `lei` — 20 alphanumerics, upper-cased; **no mod-97 check** in this
slice (known gap: a typo'd LEI passes structural validation). `inn` — 10 or 12 digits.
`ogrn` — 13 or 15 digits. The five registry/sanctions schemes are free-form non-empty.

Labels for the UI: `"IMO number"`, `"INN"`, `"OGRN"`, `"LEI"`, `"OFAC SDN id"`,
`"EU FSF id"`, `"UK HMT id"`, `"OpenSanctions id"`, `"Registry id"`.

### `EntityCore` and the column

Add `externalIds?: ExternalId[]` to `EntityCore` (`entity.ts:11-33`). Unlike a profile
field, this lands on `Entity` automatically via the intersection at `entity.ts:88`.

The `external_ids` descriptor is a direct copy of the `aliases` descriptor at
`units.table.ts:32-42`:

```ts
{
  prop: "externalIds",
  column: "external_ids",
  sqlType: "TEXT",
  optional: true,
  fallbackSql: "NULL",
  encode: (v) => (Array.isArray(v) && v.length ? JSON.stringify(v) : null),
  decode: (raw) => decodeExternalIds(raw),
}
```

`decodeExternalIds` lives beside `decodeAliases` in
`core/persistence/geopackage/validation.ts` and returns `undefined` for absent, empty, or
corrupt values. It never throws.

### Tests

- IMO check digit: `9074729` is valid (7·7 + 0·6 + 7·5 + 4·4 + 7·3 + 2·2 = 139, mod 10 = 9,
  which is digit seven). A transposition of the same number is rejected. Derive further
  cases from the algorithm; no external fixture needed.
- `normalizeExternalId("imo", "IMO 9074729") === normalizeExternalId("imo", "9074729")`.
- INN/OGRN/LEI length and charset rules.
- **Persistence hard gate**, cloned from `project-gpkg-fixture.test.ts:88-110`: load the
  real `public/project.gpkg`, set one entity's `externalIds`, save, reload, and assert the
  value survived **and** `entities.filter(e => e.externalIds != null)` has length exactly 1.
  Real WASM, 60s timeout, no mocking (`CONSTRAINTS.md:96-101`).

### Done when

`npm run verify` is green and the hard gate passes. Slice 1 has no human-review items.

---

## Traps — read before writing code

**T1 — `Entity` is a hand-mirrored flattening, not `EntityCore & Profile`.**
`entity.ts:88-103` re-declares every profile field by hand. Adding a profile with fields to
the union does *not* make those fields readable on `Entity`; the mirror must be edited too.
Slice 0 sidesteps this by adding bare profiles only. Do not "helpfully" add `vesselType`.

**T2 — widening `EntityKind` silently breaks the units decoder, and it typechecks.**
`units.table.ts:51` is `decode: (raw) => (raw === "corporate" ? "corporate" : "unit")`. A
narrower return type is assignable, so after the union widens a persisted `vessel` row
round-trips back as `"unit"` with no compiler error and no failing test. Change it to an
allowlist check against `ENTITY_KINDS`, falling back to `"unit"` for unknown values. This
is the one persistence edit Slice 0 makes.
*Related, deferred to Slice 5:* `load.ts:54-61` buckets every non-corporate kind as a unit
for the same-kind parent check. Harmless until something mints the new kinds.

**T3 — `optional: true` without `fallbackSql` throws on every read.**
`columnDescriptor.ts:53-57` throws `'external_ids' is optional but has no fallbackSql`. The
failure is a total load failure, not graceful degradation.

**T4 — `ensureOptionalColumns` splices `constraints` into `ALTER TABLE ADD COLUMN`.**
`columnDescriptor.ts:118`. `external_ids` must carry **no** `constraints` — SQLite rejects
`ADD COLUMN ... NOT NULL` without a constant default, and the failure surfaces only on the
reopened-old-file path, which is exactly what the Slice 1 hard gate exercises.

**T5 — empty array encodes to `null` and decodes to `undefined`, never `[]`.**
Follow `decodeAliases` exactly. Decoding to `[]` makes the hard gate's "every other row
stays clean" assertion fail with 1,010 instead of 1.

**T6 — `decodeRow` assigns every descriptor prop unconditionally** (`columnDescriptor.ts:64-68`),
so `"externalIds" in entity` is `true` on every loaded row even when the value is
`undefined`. Only `!= null` checks are safe — never `in` or `hasOwnProperty`.

**T7 — NUL bytes in template literals.** This repo has a recorded history of spaces inside
TS template literals becoming NUL bytes and corrupting git diffs. Slice 0 is almost entirely
string authoring. Use plain quoted strings, not template literals, and byte-scan before
committing: **`npm run scan:nul`** (`scripts/scan-nul.mjs`, also the first gate inside
`npm run verify`).
*Amended 2026-07-29 by owner ruling (Q36).* This trap printed `rg -c $'\x00' src/` until that
date, and the handoff brief suggested `rg --text -c $'\x00'` as a workaround. **Both forms are
vacuous under Git Bash** — the shell collapses the escape to an empty-string argument, so `rg`
matches the empty pattern on every line and the check can neither fail nor distinguish a clean
file from a dirty one. Measured against a control file. The guard for a *recorded historical
failure* was therefore off for the whole of Slices 0 and 1; the shipped code is nonetheless
clean, because the pre-commit scans in both runs used a Node byte scan (`readFileSync`) rather
than the documented command. Never report an `rg`-based NUL check as evidence.

---

## Known documentation defects (do not trust these lines)

- `CONSTRAINTS.md:161` describes a doc-enforcement hook and `package.json` has
  `hooks:install` pointing at `.githooks` — **the `.githooks/` directory does not exist**.
  Nothing enforces the documentation rules.
- `CONSTRAINTS.md:118` says import order is enforced by ESLint. `eslint.config.js` loads no
  import plugin. It is a human review item.
- `useProjectStore.ts` is 343 lines against the 300-line cap (`CONSTRAINTS.md:112`), and
  `EntityInspector.tsx` is 611. Neither slice here touches either file. Do not "fix" them.
- `GABRIEL_V2_FOUNDATION_SPEC.md` described `parentId` deletion, `query.ts`, seven violation
  codes and an eight-slice Stage 1. All four superseded; the file was deleted 2026-07-29.

---

## Decisions carried into Slice 2 and beyond — do not re-open

Resolved by an expert panel review (analyst / editorial judge / platform engineer), 2026-07-29.

### The migration

- `Entity.parentId` is **kept** as a derived, non-authoritative field and is never deleted.
  The `relationships` table is the source of truth on disk.
- **The retained `parent_id` column is NOT a backup.** If `relationships` is ever empty, the
  derived parent goes null and the column is nulled in the same save — primary and backup
  fail together, perfectly correlated. It is a convenience for the nine existing read
  consumers. **The backup is the private repo's git history.** Pin the pre-migration commit
  SHA in the slice's PR description before the migration ever runs.
- **The migration has no `kind` heuristic.** One rule for the 999 unit links
  (`subordinate_to`), and one explicit id-keyed table for the 13 corporate links (below), so
  the classification is reviewable in a diff rather than inferred at runtime.
- `corporate_parent` **must be in `activeParentMap`'s hierarchy-bearing set**, alongside
  active organic `subordinate_to`. Those edges came from `parent_id`; they *are* the industry
  hierarchy as it stands. Omit them and those 13 entities derive a null parent and lose their
  tree on the first save.
- Migration ids stay deterministic (`hier:<childId>`) for idempotence.

### The 13 legacy corporate links — hand-classified, not rule-derived

Analysed row by row from `organisations` in `public/project.gpkg`. All are
organisation-to-organisation, so all take `corporate_parent`. Two carry a shareholding
stated in the source notes; those percentages must survive the migration.

| child | parent | `percent` | basis |
|---|---|---|---|
| United Aircraft Corporation (UAC) PJSC | Rostec | — | holding, no share stated |
| Russian Helicopters JSC | Rostec | — | holding, no share stated |
| United Engine Corporation JSC (UEC) | Rostec | — | holding, no share stated |
| High Precision Systems JSC | Rostec | — | GUR entry filed under `/rostec/144` |
| JSC Concern Radio-Electronic Technologies (KRET) | Rostec | — | no share stated |
| JSC Ruselectronics | Rostec | — | no share stated |
| Shvabe Holding | Rostec | — | no share stated |
| NPK Techmash JSC | Rostec | — | GUR entry filed under `/rostec/317` |
| **KAMAZ PTC** | Rostec | **49.9** | notes: "Rostec holds c.49.9% share" |
| **JSC Kalashnikov Concern** | Rostec | **25** | notes: "Rostec holds 25%+1 share; private majority" |
| Uralvagonzavod JSC (UVZ) | Rostec | — | no share stated |
| **PJSC Motovilikha Plants** | **NPK Techmash JSC** | — | the only two-level chain — assert it explicitly in the migration test |
| JSC Rosoboronexport | Rostec | — | "sole state intermediary for all military export contracts" |

Rostec, Almaz-Antey, USC and KTRV are roots and get no edge.

**Kalashnikov is the publication-sensitive row.** Rostec holds a blocking minority against a
private majority. Any published edge omitting the 25% figure implies control the source
explicitly denies. Its percentage is not optional data.

**Rosoboronexport is a second edge waiting to happen** — "sole state intermediary" is an
`acts_for(basis: "intermediary")` relation, assessment tier, and the most investigatively
interesting relation in the corporate set. That is analyst work, not migration work. Do not
mint it automatically.

### Integrity record and warnings

- Slice 2 adds an **`integrity_events` table** to the GeoPackage: deterministic `id`, `kind`,
  `created_at`, `summary`, `detail` (JSON), `acknowledged_by`, `acknowledged_at`,
  `acknowledged_note`. It follows the existing claims/sources/rating_events table pattern.
  It is the durable migration record, the acknowledgement state, and the dropped-row payload.
  `acknowledged_by` is free text — git supplies the real attribution.
- `integrityEvents` must be a **required** field on `setProject` and must flow through
  `selectPersistableSnapshot`. An optional record field a call site forgets is a record that
  silently does not exist.
- **Capture rejected links verbatim at rejection time**, unnormalised, into `detail`. The
  original `(childId, parentId)` pair survives exactly one save otherwise, because `parentId`
  is now derived and recomputes to null.
- **No banner.** The durable row replaces it. The 4-second auto-clear at
  `useProjectIO.ts:138-145` is the "clicked once, no evidence" anti-pattern.
- **Do not gate `performProjectSave`.** Blocking save on an irreplaceable working file is the
  wrong failure direction. Ship the `unacknowledgedIntegrityEvents(state)` predicate in
  Slice 2 and wire it to the deliverable-export path when that path exists. Until then the
  warning row rides inside every saved file, which is self-incriminating by construction.
- **Fail closed, but not uniformly.** Dangling endpoints and self-loops are unambiguously
  broken — throw. Dual subordination may be *true*: block until a human records which it is,
  never until someone deletes one, or the control destroys the finding.
- The migration count assertion (`entitiesWithParentId == mintedEdges + skippedAlreadyPresent`)
  **throws**; it does not warn. It first runs during the unconditional silent session-restore
  at `useProjectIO.ts:106-136`, before the user has touched anything.

### Ordering and safety in Slice 2

1. Convert `saveGeoPackage` to an options object — **first commit, before any migration code.**
   Eight positional params where omission silently wipes a table, plus two more incoming
   (`relationships`, `integrityEvents`). ~16 call sites, mechanical, compiler-enumerated.
2. Make `relationships` and `integrityEvents` **required** on `setProject`, and extract the
   duplicated literals at `useProjectIO.ts:114-120` and `:194-200` into one
   `projectStateFromLoadResult`. Turns "forgot a call site" into a compile error. Under an hour,
   highest-value change in the slice.
3. **A failed load must not arm a destructive save.** The catch at `useProjectIO.ts:128-132`
   leaves the store at `initialState()` — empty — and `handleSave` will then overwrite the
   project with nothing. Guard inside `performProjectSave` (single chokepoint, already
   dependency-injected). ~6 lines.
4. `activeParentMap` lives in the relationship module (React-free) and ships in **Slice 2** —
   the hard gate is stated in terms of it. In-session recomputation goes through one private
   `commitRelationships(set, next)` store helper doing a single atomic `set`; every
   relationship action funnels through it, and `applyGeoPackageResult` calls the same pure
   function so load and edit share one derivation.

### Tests required before Slice 2 touches the real file

- `selectPersistableSnapshot` carries relationships through, and drops edges whose endpoint
  the OSM-layer filter at `useProjectStore.ts:123-127` removed.
- **A new real-WASM integration test exercising the actual store path**: load →
  `projectStateFromLoadResult` → `setProject` → `selectPersistableSnapshot` → save → reload,
  deep-equalling the full `entityId → parentId` map, then saving and reloading again to assert
  1,012 edges and not 2,024. All three existing persistence tests bypass this path — which is
  why the hard gate can pass green while the running app destroys data.
- Delete the `mock.calls[0][4]` positional assertion in `useProjectIO.save-ordering.test.ts`.
  It stays green through the failure it should catch and goes red on a harmless refactor.
- Run the rehearsal against the **real** `public/project.gpkg`, not a synthetic fixture. That
  is the dry run; a preview UI is not needed and should not be built.

### Later slices

- Slice 6 adds a Phase 0 ORBAT Source for migrated hierarchy provenance. It must be skipped
  by `applyDeterministicRatingPipeline` and never routed through `dedupeSources`, or the
  on-load reliability backfill stamps it with an ADMIRALTY letter. `getDomainTypeFromUrl`
  returns `"web"` for a URN, so construct it as a frozen literal.
- **The Phase 0 identifier must resolve.** Not the catalogue itself — a dated page at a
  working address stating what Phase 0 was, who compiled it, when, and from what classes of
  material. A citation that lands nowhere is a dead end however carefully it is flagged.
- Slice 6 adds `relationshipId` to the `dedupeClaims` key at `merge.ts:184`.
- The export gate's clause order — natural-person, then unsourced, then assessment-tier — is
  a safety property. `exportOverride` is evaluated **inside** the third clause only.
- Stage 3's OpenSanctions connector supplies organisation-to-organisation ownership with
  percentages. That routes to `corporate_parent`, not `owned_by`.

### Two protocol lines (habits, not build tasks)

- **Commit before switching builds, every time.** Otherwise the pre-migration state and a
  day's work weld into one uncommitted blob and the only clean point is yesterday.
- **Whoever migrates first says so in the handoff.** If both collaborators open the same
  pre-migration copy independently they each migrate and produce two divergent binaries, with
  no merge tool. The second person takes the migrated file, not their own copy.

---

## Appendix — why this file survives, and the line-number drift

**Why it was not deleted with the rest of the Slice 0/1 paperwork.** Two of its parts are still
load-bearing, and neither is reproducible from the code:

1. **It is the authored source of the thirteen `publicDefinition` strings** that ship verbatim in
   the CC-BY dataset. `src/core/relationship/vocabulary.test.ts:24` and `:85` transcribe the
   vocabulary table and those definitions *from here*, by line number, deliberately not from the
   implementation — so the test asserts a contract rather than restating the code. Drift between
   this file and `vocabulary.ts` is a publication defect, not a refactor.
2. **The "Decisions carried into Slice 2 and beyond" section is binding** on Slice 2B and is
   cited by `GABRIEL_V2_SLICE_2B_BUILD.md` and by `src/core/relationship/validate.ts:64`.

Everything else here is history, and git holds it.

**Line-number drift, 2026-07-29.** The Trap T7 amendment inserted 9 lines at `:485`. **Any
citation into this file authored before that date and pointing above line 488 is short by 9.**
Measured after the fix:

| section | cited as | actually at |
|---|---|---|
| Decisions carried into Slice 2 | 506 | **515** |
| The 13 legacy corporate links | 528 | **537** |
| Ordering and safety in Slice 2 | 587 | **596** |
| the quote in `validate.ts:64` | 575-576 | **584-585** |

Citations **below** 488 are unaffected and were re-verified line by line:
`vocabulary.test.ts`'s `:175-189` (the vocabulary table) and `:198-247` (the definitions block),
`externalId.test.ts`'s `:379-381` (the scheme union) and `:407-408` (the UI labels).

**Prefer the section headings to the line numbers.** This is the second time in this project that
a cross-file line citation has gone stale, and it will not be the last.
