# Build Spec — Gabriel v2, Slice 2B (the hierarchy migration)

**Authority.** This document extends the section **"Decisions carried into Slice 2 and beyond —
do not re-open"** in `GABRIEL_V2_SLICE_0_1_BUILD.md` (at line **515** today — cite the heading,
not the line; that file's numbers drifted +9 on 2026-07-29 and its appendix explains it). That
section remains binding: where it speaks, it wins over anything softer here. Where this document
speaks and that section is silent, this document is the authority. **There is no third document.**
`GABRIEL_V2_FOUNDATION_SPEC.md` was deleted on 2026-07-29 — it was superseded and its Slice 2
material was wrong in six measured places. If you find a copy, do not read it.

**Audience.** An autonomous coding agent working unattended, and the human who grades it. Every
open question that blocked a dry run has been ruled and is cited by number. If you find yourself
about to guess, stop and record the guess in `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` rather
than inventing (`SLICE_BUILD_LOOP.md`, Prohibition 7).

**Stop-ship.** `npm run verify` (`scan:nul` → `lint` → `test:coverage` → `build`) must pass
before this slice is claimed done.

**Prerequisite.** Slice 2A must be committed first — it is, at **`65ddc11`**, which is `BASE` for
2B. This spec assumes `SaveGeoPackageOptions` exists as a named, exported, single-declaration-site
type with all eight members required, that `projectStateFromLoadResult` exists and is used by all
three former literal sites, and that `performProjectSave` carries the `snapshotIsAuthoritative`
guard. **Do not begin 2B on a tree where 2A is uncommitted.**

**Four prerequisite commits, ruled 2026-07-31, all before any migration code.** None of them may
land inside the migration commit: a commit that first writes to `public/project.gpkg` has to stay
reviewable. Full reasoning in `SLICE_RUN_LOG.md`, *"Owner ruling session — 2026-07-31, before
Slice 2B"*.

- **P1** — move `projectStateFromLoadResult` into `core/persistence/geopackage/applyResult.ts`
  (Q34's scheduled move, Q2A-7). Deletes the `ViewPage.tsx:6` page-boundary breach and frees
  ~10 lines in a file at 296/300 that this slice must grow.
- **P1b** — extract `useProjectIO`'s three handler bodies into React-free async functions taking
  `authority: { current: boolean }` beside their deps. The 300-line cap forces the split anyway,
  and the split line is exactly the six untested `snapshotIsAuthoritativeRef` assignments. **No
  jsdom and no `@testing-library/react`** — that was ruled against.
- **P2** — ADR [0012](../adr/0012-layer-identity-is-the-id.md), layer identity and the residual
  bucket. Must be **green before** the first write to `public/project.gpkg`.
- **P3** — `ProjectSaveInput`: rename `sourceCache` to `researchSources` and make `ratingEvents`
  required (Q2A-6). One commit for both, because this slice adds two further required fields to
  the same type and four required-ness changes in one commit make a compile break unattributable.
  **This changes §4.7's call-site work**: `researchSources` is then the name on both sides and
  `performProjectSave:122`'s translation disappears.

**This is the first slice that ever writes to `public/project.gpkg`.** 1,010 units,
17 organisations, 4,984,832 bytes, and one backup: git history at **`5b0d2ed`**, pushed to
`origin/telegram-osint-sidecar`. Pin that SHA in the commit message. Read the rehearsal procedure
(§10) before writing a line.

---

## 1. Measured ground truth

Measured directly from `public/project.gpkg` on 2026-07-29 (md5
`7d0b0e592a1128a0d83e7575110bf2dc`, read from a temp copy, file never opened for writing).
**These numbers, not the ones in `GABRIEL_V2_PRD.md`.** The PRD's "1,010 units" is right about the
table and wrong about the migration's cardinality, and an earlier handoff put the
position-derived population at 142 when it is 741.

| fact | value |
|---|---|
| `units` rows | 1010 |
| `units` with `parent_id NOT NULL` | 999 |
| `organisations` rows | 17 (13 with a parent) |
| entities after `load.ts:27` folds organisations | 1027 |
| entities with a non-null `parentId` | **1012** |
| edges the migration mints | **1012** — 999 `subordinate_to` + 13 `corporate_parent` |
| roots | 15 (11 units, 4 organisations) |
| distinct parents referenced in `units` | 166 |
| largest sibling group | 31 children (Central Military District) |
| hierarchy depth | 5 (units), 3 (organisations) |
| **units whose map position derives from the parent chain** | **741** — 599 `position_mode = "none"` + 142 `"parent"` |
| units in `position_mode = "own"` | 269 (258 parented, 11 roots) |
| entities carrying a drawn geometry | 275 |
| other table counts | `layers` 16, `geometries` 291, `research_sources` 5 |
| file size | 4,984,832 bytes (1217 pages × 4096) |

**Referential integrity, measured.** Zero dangling `parent_id`, zero self-loops, zero cycles
(1010 of 1010 units reachable from the 11 roots), zero cross-kind parents, zero duplicate ids,
zero dangling `layer_id`. `PRAGMA integrity_check` returns `ok`. **The fail-closed throws are
dead code on this file today** — which is exactly why §10 requires re-running those checks before
every migration run rather than trusting this table.

**Id shape, measured.** All 1027 ids are canonical 36-character UUIDs, charset `[0-9a-f-]` only.
Unit ids are v4, organisation ids are v5. The two sets are **disjoint**. **No id contains `:`**,
so `hier:<childId>` is unambiguous and reversible on a first-colon split. That disjointness is an
observed fact, not a constraint — no SQL enforces it. If it ever breaks, `hier:<childId>` collides
as a PRIMARY KEY, which fails loudly rather than corrupting silently. That is the right direction.

**Two facts that change how the migration must be written.**

1. **The `units` table has no `kind` column.** All 1010 rows decode to `"unit"`
   (`units.table.ts:26` falls back). Every `corporate` entity comes from the legacy
   `organisations` table alone. The two populations live in physically distinct tables, which is
   what makes "one rule for units, one hand-written table for the 13" structurally safe rather
   than a heuristic.
2. **`organisations` still holds all 17 rows**, so `clearLegacyOrganisationsTable`
   (`save.ts:69`) has never run on this file. It has never been re-saved by post-E1 code. Slice
   2B's first save is genuinely the first write.

---

## 2. Scope

**In scope.** The `relationships` and `integrity_events` tables; the hierarchy migration;
`isHierarchyBearing`; `activeParentMap`; `withDerivedParents`; `commitRelationships`;
`unacknowledgedIntegrityEvents`; making `relationships`, `integrityEvents` and `claims` required
on `setProject`; threading both through `selectPersistableSnapshot`, `saveGeoPackage` and
`loadGeoPackage`; porting `mergeEntities` and the two other `parentId` write sites to edges.

**Not in scope.** Any UI for resolving a contested hierarchy. Any preview UI for the migration
(explicitly forbidden — `GABRIEL_V2_SLICE_0_1_BUILD.md:617-618`). `Claim.relationshipId` (Slice
6). The Phase 0 ORBAT Source (Slice 6). `core/relationship/hierarchyIndex.ts` and `Orbat.parentOf`
(Slice 3 — see Trap T14). The export gate (Stage 1.5). Any new entity `kind`. Any `acts_for` edge.
**Anything in ADR 0012** — the echelon-name rule, the `renameLayer` guard and the residual-`custom`
rehabilitation all land in prerequisite commit P2, not here. In particular, an unrecognised layer
kind mints **no** `integrity_events` row: P2 removes the loss rather than recording it, and adding
an `integrityEvents` member to `ApplyGeoPackageResultState` for layer concerns is the seam change
this sequencing exists to keep out of the migration commit.

**Rulings this spec is built on**, all in `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md`:
Q32 (all save options required), Q33 (the save guard reads a session flag), Q34
(`projectStateFromLoadResult` placement, with a scheduled move here), Q35, Q36 (the NUL scan is
`npm run scan:nul`), Q37, **Q38** (three literal sites, not two), **Q39** (`validate.ts` may be
reopened, for one export only), **Q40** (contested children derive `null`), **Q41**
(`mergeEntities` is ported).

---

## 3. Files

```
src/core/relationship/activeParent.ts                        new
src/core/relationship/activeParent.test.ts                   new
src/core/relationship/validate.ts                            modified — export isHierarchyBearing (Q39, scope-limited)
src/core/relationship/validate.test.ts                       modified — cover corporate_parent
src/core/integrity/integrityEvent.ts                         new — the IntegrityEvent record
src/core/integrity/integrityEvent.test.ts                    new
src/core/persistence/geopackage/relationships.table.ts       new
src/core/persistence/geopackage/relationships.table.test.ts  new
src/core/persistence/geopackage/integrityEvents.table.ts     new
src/core/persistence/geopackage/integrityEvents.table.test.ts new
src/core/persistence/geopackage/migrateHierarchy.ts          new — the migration + the 13 hand-classified links
src/core/persistence/geopackage/migrateHierarchy.test.ts     new
src/core/persistence/geopackage/types.ts                     modified — Gpkg aliases, GeoPackageLoadResult, ApplyGeoPackageResultState
src/core/persistence/geopackage/index.ts                     modified — barrel
src/core/persistence/geopackage/load.ts                      modified — read, migrate, validate, derive (see §7)
src/core/persistence/geopackage/save.ts                      modified — two create/write pairs, two options
src/core/persistence/geopackage/applyResult.ts               modified — derivation applied here
src/core/identity/merge.ts                                   modified — edges in IdentityGraph (Q41)
src/store/useProjectStore.ts                                 modified — state, setProject, commitRelationships, selectPersistableSnapshot
src/hooks/useProjectIO.ts                                    modified — options, ProjectSaveInput, the three call paths
src/pages/ViewPage.tsx                                       modified — already converted in 2A (Q38); gains nothing new
src/shell/MainLayout.tsx                                     modified — entity creation with a parent
src/modules/orbat/hooks/useEntityInspector.ts                modified — parent change becomes an edge operation
docs/adr/0011-relationships-are-the-hierarchy.md             new
CONTEXT.md                                                   modified — glossary
```

The stories and `useProjectStore.test.ts` call sites (§4.7) are compile-forced and are not listed
as design work.

---

## 4. Declared signatures

Everything below is written out so no agent invents one. Where a signature deviates from the
house pattern, the deviation and its reason are stated — copying the pattern there would be
wrong.

### 4.1 `src/core/integrity/integrityEvent.ts`

```ts
/** A durable record of an integrity problem, written into the saved GeoPackage.
 *  Follows the claims/sources/rating_events table pattern. `acknowledgedBy` is free
 *  text: Gabriel has no identity system and git supplies the real attribution. */
export type IntegrityEventKind =
  | "hierarchy-migrated"
  | "multiple-active-hierarchy"
  | "cross-kind-parent"
  | "merge-dropped-edge"

export type IntegrityEvent = {
  /** Deterministic, so re-detection updates one row instead of accumulating. */
  id: string
  kind: IntegrityEventKind
  /** ISO 8601. Injected, never read from a clock inside a pure function. */
  createdAt: string
  /** One sentence, publishable, naming entities rather than ids. */
  summary: string
  /** Structured payload. Always an object; `{}` when there is nothing to add. */
  detail: Record<string, unknown>
  acknowledgedBy?: string
  acknowledgedAt?: string
  acknowledgedNote?: string
}

/** Fail-closed: anything not structurally valid decodes to a neutral event rather
 *  than throwing, because a corrupt integrity row must never make a project
 *  unopenable — that would be the control destroying the data it records. */
export function decodeIntegrityEvent(raw: unknown): IntegrityEvent | undefined
```

`IntegrityEventKind` reuses `multiple-active-hierarchy` **verbatim from
`RELATIONSHIP_VIOLATION_CODES`** (`validate.ts:6-10`). Do not invent a parallel taxonomy for the
same condition.

### 4.2 `src/core/relationship/validate.ts` — one new export (Q39)

```ts
/** The single definition of "this edge places a child under a parent".
 *  Consumed by `activeParentMap` AND by `countActiveOrganicParents`, so the
 *  derivation and the control cannot disagree.
 *
 *  - `subordinate_to`, unless `metadata.attachment === "attached"`. Absent
 *    attachment counts as organic (owner Ruling 2, 2026-07-29).
 *  - `corporate_parent`, always — those 13 edges ARE the industry hierarchy
 *    (GABRIEL_V2_SLICE_0_1_BUILD.md:521-525).
 *  - Active in both cases: `isActive(rel)` with no date, i.e. `endDate == null`. */
export function isHierarchyBearing(rel: Relationship): boolean
```

`isActiveOrganicSubordination` is **replaced by** this function, not kept alongside it.
`countActiveOrganicParents` (`validate.ts:140-147`) and the `multiple-active-hierarchy` branch
(`:217-226`) both switch to it, so a child with one active `subordinate_to` and one active
`corporate_parent` now draws a violation. **That is the point of Q39.**

**Nothing else under `src/core/relationship/` may change.** Not the vocabulary, not the
`Relationship` type, not `decodeExportOverride`, not the nine violation codes, not the thirteen
`publicDefinition` strings. `EDGE_VOCABULARY_VERSION` stays `1.0.0` — no vocabulary entry moves,
so this is not an amendment under ADR 0010.

### 4.3 `src/core/relationship/activeParent.ts`

```ts
export type ActiveParentMap = {
  /** child id -> parent id. A CONTESTED child is ABSENT from this map. It is not
   *  mapped to null, and no arbitrary winner is picked (Q40). */
  parentById: Map<string, string>
  /** child id -> the ids of every competing active hierarchy-bearing edge.
   *  Returned here, at the point the conflict is decided, so the caller mints the
   *  integrity event without a second validation pass. */
  contested: Map<string, string[]>
}

export function activeParentMap(rels: Relationship[]): ActiveParentMap

/** Pure. Returns fresh items with `parentId` replaced by the derivation; never
 *  mutates. Generic on the minimal shape, mirroring `OrbatNode` (hierarchy.ts:1-4)
 *  and `Positionable` (geometry.ts:40) — the house style for React-free derivations. */
export function withDerivedParents<T extends { id: string; parentId: string | null }>(
  items: T[],
  map: ActiveParentMap,
): T[]
```

`withDerivedParents` sets `parentId` to `null` for any item absent from `parentById`. It never
writes a parent that is not in `parentById`, and it never reads the item's incoming `parentId`.

### 4.4 `src/core/persistence/geopackage/relationships.table.ts`

Eight columns, mirroring `Relationship` (`relationship.ts:41-52`). **None is `optional`** — see
Trap T8.

```ts
export const RELATIONSHIPS_TABLE = "relationships"

export const relationshipColumns: ColumnDescriptor<Relationship>[] = [
  // id PRIMARY KEY, from_id NOT NULL, to_id NOT NULL, type NOT NULL,
  // start_date, end_date, metadata NOT NULL, export_override
]

export function createRelationshipsTable(geoPackage: GeoPackage): void
export function writeRelationships(geoPackage: GeoPackage, rels: Relationship[]): void

/** DEVIATION FROM THE HOUSE PATTERN, AND IT IS LOAD-BEARING.
 *  Returns `null` when the table does not exist, and `[]` when it exists and is
 *  empty. Every other `read<X>` returns `[]` for both. The migration gates on
 *  "table absent", never on "no rows" — see Trap T11. */
export function readRelationships(geoPackage: GeoPackage): Relationship[] | null
```

- `metadata` — the field is **required** on `Relationship` (`relationship.ts:49`, no `?`), so it
  decodes to `{}`, never to `undefined`. The precedent is `decodeAssessor`
  (`ratingEvents.table.ts:20-29`), **not** `decodeAliases`. Encode: `null` when the object has no
  own enumerable keys, otherwise `JSON.stringify`. See Trap T9.
- `export_override` — absent on virtually every edge, so full trap-T5 treatment: encode to `null`
  when absent, decode to `undefined`, never `{}`. **Use the shipped `decodeExportOverride`
  (`relationship.ts`) directly as the descriptor's `decode`** — it already accepts `unknown`,
  already parses a JSON string, and is already fail-closed.
- `start_date` / `end_date` — `string | null`. `null` is a legitimate value, not an absence.
  Follow `provenanceClaims.table.ts:22` (`timestamp`).
- Read order: `ORDER BY rowid ASC`, and say so in a JSDoc line, as every sibling table does.

### 4.5 `src/core/persistence/geopackage/integrityEvents.table.ts`

Same anatomy. Columns: `id` PRIMARY KEY, `kind` NOT NULL, `created_at` NOT NULL, `summary`
NOT NULL, `detail` (JSON, decodes to `{}`), `acknowledged_by`, `acknowledged_at`,
`acknowledged_note`. None `optional`. `readIntegrityEvents` returns `[]` for an absent table —
the ordinary pattern; only `readRelationships` deviates.

### 4.6 `src/core/persistence/geopackage/migrateHierarchy.ts`

```ts
/** The 13 legacy corporate links, hand-classified row by row from `organisations`
 *  and verified against the real file on 2026-07-29. Keyed by CHILD entity id.
 *
 *  THE MIGRATION NEVER READS `notes`. Both percentages are frozen literals here,
 *  with the source sentence beside them, so the classification is reviewable in a
 *  diff rather than inferred at runtime (GABRIEL_V2_SLICE_0_1_BUILD.md:519-521).
 *  See Trap T12 for why a parser is forbidden and not merely discouraged. */
export const LEGACY_CORPORATE_LINKS: Readonly<
  Record<string, { readonly parentId: string; readonly percent?: number }>
>

export type HierarchyMigrationResult = {
  /** Existing edges plus newly minted ones. Never mutates the input. */
  relationships: Relationship[]
  integrityEvents: IntegrityEvent[]
  mintedEdges: number
  skippedAlreadyPresent: number
  entitiesWithParentId: number
}

/** Pure. `now` is injected — no clock inside, so the result is reproducible and
 *  the test can assert `createdAt` exactly. */
export function migrateHierarchyToRelationships(
  entities: readonly { id: string; kind: EntityKind; parentId: string | null }[],
  existing: readonly Relationship[],
  now: string,
): HierarchyMigrationResult
```

**The two rules, and there is no third.**

1. A child id present in `LEGACY_CORPORATE_LINKS` mints `corporate_parent`, with `toId` and
   `percent` taken from that table and from nowhere else.
2. Every other entity with a non-null `parentId` mints `subordinate_to`, with `toId` from
   `parentId`. No `attachment` is stamped — absent attachment counts as organic, which is what
   puts all 999 under the dual-subordination gate (owner Ruling 2).

Every minted edge: `id` = `hier:` + childId, `startDate` and `endDate` `null`, `metadata` `{}`
except the two `percent` entries, no `exportOverride`.

**The set of emissible types is a two-element literal.** `acts_for` must not be reachable from
this module by any path, including configuration.

**The count assertion throws:**

```
entitiesWithParentId === mintedEdges + skippedAlreadyPresent
```

On failure it throws an `Error` whose message begins with **`Hierarchy migration`** and contains
both numbers and the `childId`s of the deficit. See Trap T13 for why the prefix matters.

### 4.7 Store

```ts
// useProjectStore.ts — ProjectState gains:
relationships: Relationship[]
integrityEvents: IntegrityEvent[]

// setProject: relationships, integrityEvents AND claims all become REQUIRED.
setProject(p: {
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  claims: Claim[]              // was `claims?`, with `claims ?? []` at :148
  relationships: Relationship[]
  integrityEvents: IntegrityEvent[]
  selectedEntityId: string | null
}): void

/** Private. Not exported, not on the store interface. Every relationship mutation
 *  funnels through it: one atomic `set` writing the edges AND the entities whose
 *  derived parent changed, so the two can never be observed out of step
 *  (ADR 0005 atomicity). Load goes through the same pure derivation via
 *  `applyGeoPackageResult`, so load and edit share one code path. */
function commitRelationships(set: SetFn, state: ProjectState, next: Relationship[]): void

/** Ships in Slice 2B and is wired to the deliverable-export path when that path
 *  exists. It does NOT gate `performProjectSave` — blocking save on an
 *  irreplaceable working file is the wrong failure direction
 *  (GABRIEL_V2_SLICE_0_1_BUILD.md:576-579). */
export function unacknowledgedIntegrityEvents(state: ProjectState): IntegrityEvent[]
```

**`claims` becomes required too.** This goes one step beyond the letter of the carried decisions,
and the reason is that `claims ?? []` at `useProjectStore.ts:148` is precisely the pathology the
same decisions name — "an optional record field a call site forgets is a record that silently
does not exist" (`:571-572`) — sitting on the provenance ledger, and all 22 call sites are being
edited by this slice anyway. Ruling it costs nothing extra and closes a real hole. **If the owner
disagrees, revert this one field; nothing else in the spec depends on it.**

`selectPersistableSnapshot` (`useProjectStore.ts:117-139`) returns both new collections, and
**drops any edge whose `fromId` or `toId` is not in `survivingEntityIds`** — the set already
computed at `:127` for exactly this class of bug on `claim.entityId`. An edge pointing at an
OSM-layer entity that the filter removed would otherwise be written to disk with a dangling
endpoint and make the file unopenable on the next load.

**Compile-forced `setProject` call sites — 18, not the 22 this section claimed until 2026-07-31.**
Re-measured at `65ddc11` by listing every occurrence verbatim rather than counting matches. The
old figure was wrong in three independent ways and the composition mattered more than the total.

| where | count | sites |
|---|---|---|
| production | 3 | `restoreSession` and `handleOpen` in `useProjectIO.ts`; the `loadDemoProject` effect in `ViewPage.tsx` |
| **the gate test** | **1** | `store-path.integration.test.ts` — **missing from the old list entirely** |
| stories | **5** | `LayersPanel`, `TreeView`, `SymbolsLayer`, `HierarchyPanel`, `EntityInspector` |
| `useProjectStore.test.ts` | **9** | — |

The three errors, recorded because each is a distinct failure mode a criteria-writer repeats:

1. **`OsmQueryMenu.stories.tsx` calls `resetProject()`, not `setProject`.** It is not compile-forced
   by a `setProject` signature change. Six stories became five.
2. **Four of the "13" in `useProjectStore.test.ts` are `resetProject()` too.** Thirteen became nine.
   Both errors come from counting `grep -c "setProject("`, which matches `resetProject(` as a
   substring. **A criterion that counts occurrences of a name must exclude the names that contain
   it** — this is the negative-grep lesson (§8b, lesson 1) wearing a different hat.
3. **`store-path.integration.test.ts` did not exist when this section was written.** It was created
   by Slice 2A's fix pass on 2026-07-30, one day after this spec froze, and it is *the* test that
   exercises the real store path — the one §8 calls the load-bearing gate. A planner working from
   the old enumeration would have omitted the single most important call site in the slice.

**Line numbers are deliberately absent from the table above.** The old figures (`useProjectIO.ts:114`,
`:194`) were pre-2A; the same two calls sit at `:155` and `:248` at `BASE`, and prerequisite commits
P1 and P1b move them again. Cite the enclosing function, as §11 already requires for
`GABRIEL_V2_SLICE_0_1_BUILD.md`, and re-measure before freezing a criterion on a count.

`selectPersistableSnapshot` has **8** call sites, re-measured and unchanged in shape: `handleSave`
in `useProjectIO.ts`, one in `store-path.integration.test.ts`, and **6** in `useProjectStore.test.ts`.
`makeState()` at `useProjectStore.test.ts:7-17` must gain the new fields or those six fail to compile.

### 4.8 `src/core/identity/merge.ts` (Q41)

`IdentityGraph` gains `relationships: Relationship[]`. Endpoints equal to `secondaryId` become
`primaryId`; edges that become self-loops are dropped and captured **verbatim and unnormalised**
into a `merge-dropped-edge` integrity event; edges that become duplicates are de-duplicated.
`merge.ts:49` and `resolveParent` (`:88`, `:113-120`) are **deleted** — after the port they write
a derived field.

---

## 5. The 13 legacy corporate links — verified against the file

All organisation-to-organisation, so all take `corporate_parent`. Child names match the hand
classification in `GABRIEL_V2_SLICE_0_1_BUILD.md:543-568` byte for byte. **The parent's real name
is `Rostec State Corporation`, not the `Rostec` the docs abbreviate** — key the table on ids, never
on labels.

Rostec State Corporation = `23dfd3ce-6465-55ca-83d4-cc8c766d8444` (12 of the 13 edges).
NPK Techmash JSC = `b4f1f1cf-1791-58de-b761-f65842e9d202` (1 edge).

| child id | child | parent | `percent` |
|---|---|---|---|
| `74212d89-d123-5e04-8e7e-f817483c6b1d` | United Aircraft Corporation (UAC) PJSC | Rostec | — |
| `95a79d63-c7d6-5cdf-b415-23499d444448` | Russian Helicopters JSC | Rostec | — |
| `d3708808-9a6b-54cb-94b7-ecef7315efb8` | United Engine Corporation JSC (UEC) | Rostec | — |
| `d2f659b0-7f66-5c14-8081-39f48737145f` | High Precision Systems JSC | Rostec | — |
| `e667a62a-386a-548a-a8e2-9989616ab7a0` | JSC Concern Radio-Electronic Technologies (KRET) | Rostec | — |
| `f0be4fd5-018d-5413-a8fb-93ad47643ac9` | JSC Ruselectronics | Rostec | — |
| `02b83897-e746-500c-a4da-48a9be042986` | Shvabe Holding | Rostec | — |
| `b4f1f1cf-1791-58de-b761-f65842e9d202` | NPK Techmash JSC | Rostec | — |
| `9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39` | **KAMAZ PTC** | Rostec | **49.9** |
| `d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c` | **JSC Kalashnikov Concern** | Rostec | **25** |
| `2b57b3fb-4fdb-593c-bab4-28bad2214670` | Uralvagonzavod JSC (UVZ) | Rostec | — |
| `f727b211-b3f4-525c-9776-07192c0d2e80` | **PJSC Motovilikha Plants** | **NPK Techmash JSC** | — |
| `ac8c1602-9c56-5615-b08c-10e67cb93a05` | JSC Rosoboronexport | Rostec | — |

Roots with no edge: Rostec State Corporation, `JSC Concern VKO Almaz-Antey`,
`United Shipbuilding Corporation JSC (USC)`, `JSC Tactical Missiles Corporation (KTRV)`.

**Motovilikha → Techmash → Rostec is the only two-level chain.** Assert both hops explicitly, and
assert Motovilikha's depth is 2.

### The two percentages, and why they are exactly these numbers

The source text lives in `organisations.notes` as free English prose:

```
KAMAZ PTC:
  ... Rostec holds c.49.9% share.

JSC Kalashnikov Concern:
  ... Produces 95% of Russian small arms including AK-12 rifles.
  Rostec holds 25%+1 share; private majority.
```

- **`49.9`, never `50`.** `c.` is a precision qualifier and `49.9` is already the approximation.
  Rounding to 50 would invert the analytical meaning: 49.9% is deliberately below the control
  threshold.
- **`25`, never `25.000001`.** Fabricating a value to encode the "+1" would invent unsourced data
  in a published field. The `+1 share` and `private majority` are a legal effect, not a quantity;
  their home is a `Claim` attached to the edge, and `Claim.relationshipId` is Slice 6. Until then
  they stay in `notes`, verbatim and untouched, **and the exact source sentence is copied into the
  migration event's `detail`** so the derivation is auditable inside the file rather than only in
  a commit message.
- **Omitting the percentage is the greater danger.** The published CC-BY definition says that where
  no percentage is recorded, "no ownership share, controlling interest or acquisition date has
  been established". A bare `corporate_parent` edge on Kalashnikov therefore reads as more control
  than 25%, against a source that explicitly denies it. The number is not optional data.
- `percent: 0` is legal and means zero percent. It must never appear as a default in place of
  `undefined`.

---

## 6. Traps — read before writing code

**T1 — `Entity` is a hand-mirrored flattening.** Unchanged from Slices 0–1
(`entity.ts:88-103`). 2B adds no profile field, so this should not bite; it is restated because
the migration touches `Entity`.

**T2 — the `EntityKind` allowlist.** Unchanged. 2B mints no new kind.

**T3 — `optional: true` without `fallbackSql` throws on every read.**
`columnDescriptor.ts:52-57` throws twice: once when the caller omits `availableColumns`, once
when the descriptor omits `fallbackSql`. The failure is a **total load failure**, re-wrapped by
`load.ts:79-83`. Restated for two new tables: if a later slice ever adds a column to
`relationships` or `integrity_events`, that column is `optional: true` **with** `fallbackSql`,
its `read<X>` must switch to the `getTableColumnNames` + `buildSelectClause(cols, available)`
variant (`provenanceSources.table.ts:53-60`), **and** `save.ts` must gain an
`ensureOptionalColumns` call for that table. Copying `readRatingEvents`
(`ratingEvents.table.ts:48-54`) at that point is the bug — it calls `buildSelectClause` with one
argument and is legal only while nothing is optional.

**T4 — `ensureOptionalColumns` splices `constraints` into `ALTER TABLE ADD COLUMN`.**
`columnDescriptor.ts:118`. SQLite rejects `ADD COLUMN ... NOT NULL` without a constant default.
Applies the moment T3's "later slice" arrives. In Slice 2B both tables are created whole, so
`NOT NULL` in `CREATE TABLE` is safe — it is safe **only** there.

**T5 — empty encodes to `null` and decodes to `undefined`, never `[]` or `{}`.** Applies to
`export_override`. Follow `decodeRatingMeta` / `encodeRatingMeta` (`ratingMeta.ts:35-51`), or
better, reuse `decodeExportOverride` directly.

**T6 — `decodeRow` assigns every descriptor prop unconditionally** (`columnDescriptor.ts:63-69`),
so `"metadata" in rel` and `Object.hasOwn(rel, "exportOverride")` are `true` on **every** row read
from disk. Only `!= null` checks are safe. The shipped code already observes this
(`validate.ts:117-122`); do not regress it.

**T7 — NUL bytes.** This repo has a recorded history of spaces inside TS template literals
becoming NUL bytes and corrupting git diffs. Slice 2B authors two `CREATE TABLE` template
literals and a migration event `summary`. Prefer plain quoted strings and concatenation. Scan with
**`npm run scan:nul`** — it is the first gate of `npm run verify`. **Never report an `rg`-based
NUL check as evidence** (Q36: `rg -c $'\x00'` and its `--text` variant are both vacuous under Git
Bash and have been reporting green for two slices).

**T8 — these are plain SQLite tables, not registered GeoPackage tables, and that is correct.**
Measured: `gpkg_contents` holds exactly one row, `geometries`, `data_type = "features"`. `units`,
`layers`, `organisations` and `research_sources` are invisible to the GeoPackage layer. Create the
two new tables with `geoPackage.connection.run("CREATE TABLE IF NOT EXISTS ...")` like every
sibling. **Do not call `createAttributesTable` and do not write to `gpkg_contents`** — a file
shaped differently from the rest of the project is worse than one QGIS shows fewer layers for.
Detect with `tableExists` (`columnDescriptor.ts:96-98`), never with `getFeatureTables()`.

**T9 — `metadata` decodes to `{}`, and the precedent everyone will reach for is the wrong one.**
`Relationship.metadata` is **required** (`relationship.ts:49`, no `?`), so a corrupt or absent
value must decode to `{}` — never `undefined`. **Do not follow `decodeAliases`**: it decodes to
`undefined` (`validation.ts:30,33`), which on a required field produces a value the type says
cannot exist. The correct precedent is `decodeAssessor` (`ratingEvents.table.ts:20-29`) — a
neutral non-undefined default for a NOT NULL column backing a required field. (The now-deleted
Foundation Spec named `decodeAliases` here, which is how this trap was found; if that error has
been copied anywhere else, this is the correction.) Note also that `encodeRatingMeta` does **not**
test object emptiness, so `{}` would persist as the string `"{}"`; the `metadata` encoder must
test for no own keys and emit `null`.

**T10 — an edge is not constrained to one `kind`, but `load.ts:60-63` is.** `Relationship` places
no restriction on the kinds of its endpoints, while the entity validation throws
`Unsupported schema: entity references missing parent.` when a `parentId` does not resolve within
the same kind. So a cross-kind hierarchy-bearing edge derives a `parentId` that makes the **next**
load throw. Filter cross-kind pairs at the point the derivation is applied — where the kinds are
known — omit the parent, and emit a `cross-kind-parent` integrity event. **Do not throw**: the
edge itself is a legitimate record, and throwing would make a legitimate record unopenable.

**T11 — the migration gates on the ABSENCE of the `relationships` table, never on `hier:` id
uniqueness.** Deterministic ids stop duplication, not resurrection. After the first save,
`parent_id` no longer holds original data — it holds the derivation. A second run that re-mints
from that column would not duplicate; it would **resurrect** an edge an analyst had replaced, and
recreate a dual subordination. That failure is far harder to see and harder to undo. This is why
`readRelationships` returns `null` for an absent table rather than `[]` (§4.4).

**T12 — the migration must not read `notes`, and this is a hard rule, not a preference.**
The Kalashnikov note contains **two** percentages and the first one, `95%`, is a *market* share.
Any `/(\d+(?:\.\d+)?)%/` captures 95 first and publishes "Rostec holds 95% of Kalashnikov" —
false and defamatory. `c.49.9%` would need a second ad-hoc strip; two ad-hoc rules for two rows is
the signal that there should be no rule at all. And a parser is a permanent liability: it re-runs
over notes edited later by an analyst who does not know their prose is being read. The same
temptation with the opposite stake is `Rosoboronexport`'s "sole state intermediary for all
military export contracts" — an auto-minted `acts_for` edge would launder an analytical judgement
into a documentary record, which is what the tier split exists to prevent (ADR 0010), and no
machine-minted edge can carry the two-person `ExportOverride` (ADR 0009: the machine never
confirms).

**T13 — a migration failure must not be reported as file corruption.** `load.ts:79-83` re-wraps
anything whose message does not start with `"Unsupported schema"` as
`Corrupted GeoPackage or unsupported schema: ...`. A failed count assertion on a perfectly healthy
file would therefore tell the analyst their data is corrupt — a false diagnosis at the worst
possible moment. **Extend the pass-through at `load.ts:80` to also let through messages beginning
`"Hierarchy migration"`**, and make the assertion's message begin with exactly that.

**T14 — `activeParentMap` does not replace `buildOrbat`, it feeds it.**
`hierarchy.ts:36-144` builds the tree from `{id, parentId}` and has six production callers.
Because `parentId` is kept as a derived field, `buildOrbat` and all six callers change by **zero
lines**. A `core/relationship/hierarchyIndex.ts` and an `Orbat.parentOf` that move those consumers
off `parentId` and onto edges are **Slice 3, and must not be built here** — building them in 2B
would put a migration and a consumer rewrite in the same irreversible commit. `activeParentMap`
fills the field; `buildOrbat` reads the field. Different storeys.

**T15 — `buildOrbat` and `load.ts` have opposite orphan policies, and the derivation sits between
them.** `hierarchy.ts:77` treats an unresolvable parent as a root; `load.ts:60-63` throws on one.
`activeParentMap` must therefore never emit a parent id that is not in the entity set. Reproduce
the orphan policy by **omission**, never by writing a dangling parent.

**T16 — three write sites still target the derived field.** `mergeEntities`
(Q41 — ported here), `useEntityInspector.ts:203-213` (the analyst's parent change, whose coupling
to `positionMode: "none"` must survive the port to an edge operation), and `MainLayout.tsx:30,39`
(entity creation with a parent). The first breaks the file; the other two silently lose the write
at the next save. All three are Done-when clauses.

---

## 7. Ordering inside `load.ts`

The order is load-bearing and is not obvious from any existing document. Line numbers are at the
pre-2B tree.

1. **`:28` area — read the persisted edges.** `const persisted = readRelationships(geoPackage)`
   and `readIntegrityEvents(geoPackage)`. No dependencies.
2. **`:56-66` — the existing entity validation runs UNCHANGED, on the RAW `parentId` values.**
   Do not move it, do not weaken it. It is what proves every one of the 1012 parents resolves
   within its own kind, which is the precondition that makes the minted edges free of
   `dangling-endpoint` and `self-loop`. Validation before migration, always.
3. **After `:66` — the migration**, if and only if `persisted === null` (T11). It consumes the raw
   `parentId` values and `LEGACY_CORPORATE_LINKS`. It must run before any derivation, or it would
   mint from already-derived values.
4. **Immediately after — `validateRelationships(all, entityIds)`**, with the entity id set built
   at `:50`. `dangling-endpoint` and `self-loop` throw. Every other code becomes an
   `integrity_events` row (fail closed, but not uniformly —
   `GABRIEL_V2_SLICE_0_1_BUILD.md:580-582`). Placing this after the migration is what gets the
   minted edges validated at all.
5. **Last, between `:76` and `:78` — apply the derivation.** `activeParentMap` then
   `withDerivedParents`, producing new entity objects. Never mutate: the migration needed the raw
   array. Apply the T10 cross-kind filter here, where kinds are known.
6. The return at `:78` gains `relationships` and `integrityEvents`;
   `applyGeoPackageResult` (`applyResult.ts:47-52`, currently a pass-through cast at `:49`) carries
   them through, and `ApplyGeoPackageResultState` gains both members.

**The migration never writes to the open GeoPackage.** `load.ts` never calls `export()`; only
`save.ts:88` does. The file on disk is untouched until a deliberate save. That is what makes a
migration failure survivable, and it is the reason the count assertion may throw at all.

**Why throwing is right, and the four conditions that make it safe.** A warning is strictly worse:
if the load succeeds with an incomplete migration, `snapshotIsAuthoritative` goes `true`
(Slice 2A criterion 24b), the save is armed, `save.ts:66` runs `DELETE FROM units`, and the missing
links vanish from the column and the table at the same instant. Throwing is safe because
(a) nothing has been written; (b) the throw precedes `setProject`, so the store stays at
`initialState()`, the flag stays `false`, and the 2A guard refuses every save — the app opens
empty **and inert**, not empty and armed; (c) the migration is gated on table absence, so the
assertion is a one-time event and not a permanent startup lock; (d) the message survives
`load.ts:80` intact (T13) and names both counts and the deficit ids.

---

## 8. Tests

Ordinary unit tests are assumed. These are the ones that carry the slice.

**Pure, in `core/`:**

- `isHierarchyBearing` returns `true` for `subordinate_to` with no attachment, `true` with
  `attachment: "organic"`, `false` with `"attached"`, `true` for `corporate_parent`, `false` for
  an ended edge, `false` for every other type.
- `validateRelationships` now reports `multiple-active-hierarchy` for a child with one active
  `subordinate_to` **and** one active `corporate_parent`. This test is the whole point of Q39 and
  would have failed before it.
- `activeParentMap`: a single edge maps; two competing edges leave the child **absent** from
  `parentById` and present in `contested` with both edge ids; an ended edge does not compete;
  an `attached` edge does not compete.
- `withDerivedParents` sets `parentId` to `null` for an unmapped item, does not mutate its input,
  and never emits a parent absent from the map.
- `migrateHierarchyToRelationships`: idempotent on a second call (`mintedEdges` 0,
  `skippedAlreadyPresent` equal to the first run's minted count); the count assertion throws on a
  crafted deficit with both numbers and the missing ids in the message; the emitted type set
  deep-equals `{"subordinate_to", "corporate_parent"}`.
- **The parser test (T12), and it is the one test that cannot be argued with.** Run the migration
  against an in-memory entity set whose Kalashnikov note reads
  `"Rostec holds 100% and 3% and c.7%"`. The minted edge still carries `percent: 25`. No regex,
  however careful, survives this. Six lines.
- `percent` domain: exactly two minted edges carry `percent`, the multiset is `{49.9, 25}`, and
  every other minted edge has `metadata.percent === undefined` — not `null`, not `0` (T5).
- `mergeEntities` (Q41): edges are re-pointed; an edge joining primary and secondary is dropped
  and its original quadruple appears verbatim in a `merge-dropped-edge` event; duplicates
  collapse; a survivor inheriting two parents ends up contested.

**Store, no DOM required** (`useProjectStore.getState()`, the precedent in
`useProjectStore.test.ts`):

- `selectPersistableSnapshot` carries relationships and integrity events through, **and drops an
  edge whose endpoint the OSM-layer filter at `useProjectStore.ts:123-127` removed.**
- `commitRelationships` writes edges and the entities whose derived parent changed in a **single**
  `set` — assert one store notification, not two.
- `unacknowledgedIntegrityEvents` returns only rows with no `acknowledgedAt`.

**Real WASM, the load-bearing gate.** A new integration test exercising **the actual store path**:
load → `projectStateFromLoadResult` → `setProject` → `selectPersistableSnapshot` → save → reload.
It deep-equals the full `entityId → parentId` map against the pre-migration column, then saves and
reloads a second time to assert **1,012 edges and not 2,024**. All three pre-existing persistence
tests bypass this path, which is why the existing hard gate can pass green while the running app
destroys data. 60000 ms timeout, real `public/project.gpkg`, read-only, no mocking
(`CONSTRAINTS.md:96-102`).

**A second real-WASM assertion nobody thinks to write.** Deep-equal the **rendered position map**
(`computeAllEntityPositions`) before and after the round trip. The parent map can be perfect while
741 units move or vanish; a count of edges stays green throughout. This is the only test that
catches the failure mode that actually matters.

---

## 8b. Writing 2B's criteria — five lessons, each of which already cost a criterion

**Read this before freezing `SLICE_2B_CRITERIA.md`.** These were scattered across Q2A-9, Q2A-12,
Q2A-15 and the 2A fix pass, where a Phase 1 planner would never find them. They are collected here
on 2026-07-31 because the planner reads this spec and does not read the 2A question file.

1. **A negative grep must exclude the strings the positive criteria force you to write.** Slices 0,
   1 and 2A each lost a criterion to this exact shape. 2A's criterion 23 asserted that
   `useProjectIO.ts`'s added lines contain no `setProject`, while criterion 32 *required* rewriting
   the two lines that contain it. The only formatting satisfying both defeated the excess-property
   check that criterion 32 existed to create. Diff-scoping is not enough — 23 was already
   diff-scoped. Write the exclusion.

2. **A criterion that pins *sites* must also pin the *order within each site*.** This single
   omission generated Q2A-8, Q2A-11 and Q2A-15, two of them with a data-loss direction. Criterion
   24b named exactly which three sites assign `snapshotIsAuthoritative` and never said *when* within
   each — so a faithful implementation set the flag before the work that made it true, and a second
   faithful implementation never lowered it at all. If a criterion names a statement's location,
   it must name what precedes and what follows it.

3. **Counts do not prove a path was taken.** `save.options.roundtrip.test.ts` stayed green with
   `baseBuffer` deleted outright, because the snapshot supplied every row it counted. It went red
   only once an assertion looked for the legacy `organisations` table, which exists in the output
   **only** if the reopen path ran. For every criterion phrased as a count, name the artefact that
   exists only if the intended path executed, and assert that instead or as well.

4. **The criteria are a proxy for the spec, so map every clause or disown it by name.** 2A's
   criteria §8 claimed to cover every in-scope spec clause while giving the entire tests-required
   list a single row. The store-path test was neither mapped nor declared out of scope; criterion 15
   silently stood in for it and proved strictly less, and five reviewers graded the proxy. For 2B:
   walk §7, §8, §9 and §10 clause by clause, and for each either cite the criterion number or write
   the words "out of scope" beside it.

5. **A criterion that counts occurrences of a name must exclude the names that contain it.** Added
   2026-07-31, having just cost this document two of the three errors corrected in §4.7:
   `grep -c "setProject("` matches `resetProject(`, which inflated one figure from 5 to 6 and
   another from 9 to 13. List the occurrences verbatim and read them; do not report the count.

**And one that is not a lesson but a standing hazard:** this spec was frozen on 2026-07-29 and the
tree moved under it on 2026-07-30. Any enumeration, count or line number in it is a measurement with
a date on it. Re-measure before freezing a criterion on one — §4.7 is the worked example of what
happens otherwise.

---

## 9. Done when

`npm run verify` is green, every test above exists and passes, and:

1. `relationships` and `integrity_events` round-trip through a real save and reload.
2. `readRelationships` returns `null` for an absent table and `[]` for an empty one, with a test
   for each (T11).
3. The migration is gated on table absence, proven by a test that runs it twice against a saved
   file and asserts 1,012 edges both times.
4. `isHierarchyBearing` is the **only** definition of hierarchy-bearing in the tree.
   `rg -n "subordinate_to" src/core/relationship/ src/core/persistence/` shows no second predicate.
5. `setProject` requires `relationships`, `integrityEvents` and `claims`; all 22 call sites
   compile.
6. `selectPersistableSnapshot` drops edges with a filtered endpoint.
7. `mergeEntities` rewrites edges; `merge.ts:49` and `resolveParent` are gone (T16, Q41).
8. `useEntityInspector.ts:203-213` sets a parent by committing an edge, and still forces
   `positionMode: "none"` when the parent is cleared.
9. `MainLayout.tsx:30,39` creates an entity's parent as an edge.
10. `load.ts:80` passes through `Hierarchy migration` messages unwrapped (T13).
11. Cross-kind hierarchy edges produce a `cross-kind-parent` event and no throw (T10).
12. `EDGE_VOCABULARY_VERSION` is still `1.0.0`, and the only change under
    `src/core/relationship/` is `isHierarchyBearing` plus its consumer (Q39 scope limit).
13. ADR 0011 is committed **in this slice**, not trailing it, and records: why the retained
    `parent_id` column is not a backup; why the migration has no `kind` heuristic; why contested
    children derive `null` rather than an arbitrary winner; and why the two percentages are frozen
    literals rather than parsed.
14. `public/project.gpkg` is byte-identical to `7d0b0e592a1128a0d83e7575110bf2dc` **at the end of
    the build**. The migration ships; running it against the real file is §10, deliberately after.

**Not machine-checkable — a human reads these:** ADR 0011's prose; the `CONTEXT.md` glossary
entries; and the `summary` sentence of the `hierarchy-migrated` event, which must read as
something publishable rather than as a log line.

---

## 10. The rehearsal

The dry run. Against the **real** `public/project.gpkg`, not a synthetic fixture
(`GABRIEL_V2_SLICE_0_1_BUILD.md:617-618`). No preview UI — the two fingerprints below **are** the
preview, and unlike a screenshot they compare bit for bit.

### Pre-flight — before any write

1. Working tree clean; the starting SHA recorded in `SLICE_RUN_LOG.md`.
2. `md5sum public/project.gpkg` equals `7d0b0e592a1128a0d83e7575110bf2dc` **and** equals the md5 of
   `git show 5b0d2ed:public/project.gpkg`. **If those two differ, STOP** — the pinned revert point
   is not the file on disk, and the backup the whole plan rests on does not exist.
3. `npm run verify` green.
4. **A dated copy outside the repo**, on a different volume, outside any synced folder. The docs
   say git is the only backup; for the first irreversible write that is not good enough, and it
   costs thirty seconds.
5. Re-run the integrity queries from §1 — zero dangling, zero self-loops, zero cycles, zero
   cross-kind. They passed on 2026-07-29; they are cheap, and the fail-closed throws are only dead
   code for as long as they keep passing.

### Fingerprints, taken from the file and not from this document

6. **Hash A** — sha256 of the sorted, serialised `entityId → parentId` map (1012 entries).
7. **Hash B** — sha256 of the sorted, serialised **rendered** position map from
   `computeAllEntityPositions` over all 1027 entities. This is the fingerprint nobody takes and
   the only one that catches the 741.
8. Row counts for `claims`, `sources`, `rating_events`, `geometries`, `layers`; file size in bytes.

### Dry run, in memory, nothing written

9. Minted edges **1012**: `subordinate_to` **999**, `corporate_parent` **13**, no third type,
   `acts_for` **0**.
10. `validateRelationships(minted, entityIds)` returns **0** violations across all nine codes —
    including **0** `multiple-active-hierarchy`, the hard number Q40 makes assertable.
11. 1012 distinct ids, all `hier:`-prefixed, set-equal to `hier:` + each parented entity id.
12. Exactly **2** edges carry `percent`: `{49.9 → KAMAZ PTC, 25 → JSC Kalashnikov Concern}`. The
    other 1010 have `metadata.percent === undefined`.
13. `activeParentMap(minted).parentById` **deep-equals** the pre-migration map. Not "same size" —
    deep-equal, 1012 entries, none extra, none missing.
14. Motovilikha → Techmash → Rostec asserted at both hops; Motovilikha's depth is 2. Rostec has
    exactly **12** incoming `corporate_parent`. Roots **15**, and the four organisation roots have
    zero outgoing `corporate_parent`.
15. Second pass in memory: 1012, not 2024; `skippedAlreadyPresent` 1012; the count assertion holds
    as `1012 === 0 + 1012`.
16. `integrity_events` produced: **1** row, `hierarchy-migrated`. Zero rejected rows.

### First write — and it does not go to `project.gpkg`

17. Save to **`project-migrated-<date>.gpkg`**, a new filename. The save picker's `suggestedName`
    is `"project.gpkg"` (`useProjectIO.ts:31`), so the default lands on the original; type a new
    name deliberately. This costs nothing, needs no code, and keeps the pre-migration file on disk
    rather than only in git.
18. Reload it: **1012** edges, not 2024. Save and reload again: still 1012.
19. **Hash A after reload equals Hash A before.** **Hash B after reload equals Hash B before**,
    with zero tolerance. If B differs, count the moved entities — a number at or below 741 says
    the derivation is broken, and that is the diagnosis on the spot.
20. `units.parent_id` still non-null on **999** rows, organisations on **13**. The column is
    rewritten, not nulled.
21. The 17 `organisations.notes` are byte-identical, `c.49.9%` and `95%` compared verbatim.
22. Entities **1027**, units **1010**, organisations **17**; the counts from step 8 unchanged; the
    file grew and did not shrink. A file that shrinks is a table that was emptied.
23. Open the app once against the migrated file. Central Military District shows **31** children.
    One `position_mode = "parent"` unit sits in orbit around its parent.

### The next morning, before any real work

24. **Cold reopen** — fresh browser profile or cleared IndexedDB — so the silent session restore
    runs against the *saved* file rather than a warm memory state. Re-assert 1012, Hash A, Hash B.
    This run is the one that catches "the save was fine, the restore doubled it", and it is where
    the count assertion first executes on a file that has already been written.
25. Read `integrity_events` by hand. One row, and its `summary` is a sentence you would publish.
    If it reads like a stack trace it is a log, not a record.
26. Spot-check **10** units chosen by name across depths 1 to 5: identical hierarchy path.
27. `npm run verify` on a cold checkout.
28. Only then replace `public/project.gpkg`, keep the out-of-tree copy for at least one more
    session, and state the pin `5b0d2ed` in the commit message.

**Not accepted as evidence:** an edge count alone (it catches 1012-vs-2024 and nothing else); a
screenshot of the map (it cannot show an entity that is absent); a synthetic fixture; or an
`rg`-based NUL scan.

---

## 11. Known documentation defects (do not trust these lines)

**Six of the defects found while writing this spec were in `GABRIEL_V2_FOUNDATION_SPEC.md`, and
that file was deleted on 2026-07-29 rather than annotated.** A superseded document that is wrong
about a DDL, a decoder precedent, a violation-code count and a function signature costs a slice,
not an afternoon. Its one surviving correction is Trap T9, because that error is the kind a reader
reproduces from memory. Everything below is a defect in a document that still exists.

- **`SLICE_2A_CRITERIA.md` §0.3** records **two** duplicated project-state literals. There are
  **three** — `ViewPage.tsx:46-52` is the third. Criterion 46 carries the dated amendment (Q38).
- **`GABRIEL_V2_SLICE_0_1_BUILD.md`'s "nine existing read consumers"** (line **525**, in the
  Decisions section) is wrong in both directions. Measured: **15 read sites across 13 files**.
  `layered-research.service.ts` and `request-builder.ts` do not read `parentId` at all, and
  `src/core/entity/hierarchy.ts` — the central reader — was missing from the inventory.
- **`GABRIEL_V2_SLICE_0_1_BUILD.md`'s line numbers drifted +9 above line 488** on 2026-07-29.
  Anything citing that file above 488 is short by 9; its appendix has the table. Cite its headings.
- **The docs abbreviate the corporate parent as "Rostec".** Its name in the file is
  **`Rostec State Corporation`**. Key the migration table on ids, never on labels.
- **`GABRIEL_V2_PRD.md`'s "1,010 units"** is right about the table and misleading as the
  migration's cardinality: 1027 entities, **1012** edges.
- `CONSTRAINTS.md:161` describes a doc-enforcement hook and `package.json` has `hooks:install`
  pointing at `.githooks` — **the `.githooks/` directory does not exist.** Still true.
- `CONSTRAINTS.md:118` says import order is enforced by ESLint. `eslint.config.js` loads no import
  plugin. Still a human review item.

---

## 12. Protocol

- **Commit before switching builds, every time.** Otherwise the pre-migration state and a day's
  work weld into one uncommitted blob.
- **Whoever migrates first says so in the handoff.** Two collaborators who each open the same
  pre-migration copy produce two divergent binaries and there is no merge tool. The second person
  takes the migrated file, not their own copy.
- **A machine must not adjudicate a contradiction between the criteria and this spec.** Record it
  and stop. That judgement is the owner's (`SLICE_RUN_LOG.md`, and the Slice 0 run that proved it).
