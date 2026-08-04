# Success Criteria — Slice 2B (the hierarchy migration)

**Slice:** 2B, the `relationships` / `integrity_events` tables and the hierarchy migration.
**BASE:** `44994ef` (HEAD when this file was frozen). `git diff --name-only f9f1046 44994ef -- src/`
is **empty** — the only commit since prerequisite P3 is documentation, so every measurement below
was taken on the same source tree as `f9f1046` and both SHAs name the same `src/`.
**Frozen:** 2026-07-31, Phase 1, by the planning agent. Written from
`docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md` (the authoritative spec) and the binding section
**"Decisions carried into Slice 2 and beyond — do not re-open"** in
`docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` (cited by heading; that file's line numbers drifted
+9 above line 488). `GABRIEL_V2_FOUNDATION_SPEC.md` was deleted on 2026-07-29 and is not a source.

**This file is frozen after this phase.** No later agent may edit, weaken, reword or delete an
entry (`SLICE_BUILD_LOOP.md`, Prohibition 2). A failing criterion is a result to report, not a line
to change. If a criterion turns out to be unsatisfiable or to contradict the spec: record it and
**STOP**. That judgement is the owner's (spec §12).

**Command conventions.** Commands are run from the repo root. `rg` / `git` / `sed` commands are Git
Bash; commands introduced with `PowerShell:` are PowerShell. Line counts use
`(Get-Content <path>).Count` and never `Measure-Object -Line`, which skips blank lines and produced
a wrong count during the P1 run. Test commands are `npx vitest run <file>` or
`npx vitest run <file> -t "<test name>"`. `npm run verify` is `scan:nul` -> `lint` ->
`test:coverage` -> `build` (`package.json:14`); this environment's libuv abort is worked around with
`start /affinity 1 /wait /min` and the exit code is read from `$LASTEXITCODE`, never through a pipe.

**`BASE` in a `git diff` command below means the commit `44994ef`.**

> **This run does NOT execute §10, the rehearsal.** §10 steps 1-5 and 17-28 are the owner's, in a
> separate session with an off-machine backup. `public/project.gpkg` must be byte-identical at the
> end of this build (criterion 3). Steps 6-16 are covered by criteria 66-75 as read-only, in-memory
> assertions; §5 of this file gives the per-step ruling.

---

## 0. Corrections post-run, 2026-08-03 — annotations, not amendments (the criteria below are unchanged)

> **Not one of the 83 criteria was edited, weakened, reworded or deleted** (Prohibition 2). The value
> of this file is that it records what was actually frozen on 2026-07-31, and a corrected criterion
> would erase the evidence that the run graded **73 of 83 with zero implementation failures**
> (`SLICE_RUN_LOG.md`, "Run 2026-08-03 — Slice 2B, the hierarchy migration", which carries the
> measurements this section summarises). Everything here is an annotation *around* the criteria,
> dated, with the measurement it rests on. **Read it before running any command below, and before
> reusing this file as a template for Slice 3.**

### 0.1 Four criteria whose literal command exits 0 while running nothing

**A `vitest -t` filter naming a file that does not contain the test exits 0 having proved nothing.**
vitest reports the named file's other tests as skipped, matches the filter against none of them, and
returns success. There is no failure to notice: the command is green, and the only evidence is a
`skipped` count in a summary line nobody reads.

Criteria **46, 47, 51 and 58** each name the file their test would naturally have lived in. The
300/385-line caps that criteria 4, 5 and 6 impose then forced those tests into **siblings** of those
files, so all four literal commands are vacuously green. Measured 2026-08-03:

| criterion | `-t` filter | literal command | corrected command | corrected output |
|---|---|---|---|---|
| 46 | `dangling endpoint` | `1 skipped` / `8 skipped`, **exit 0** | `npx vitest run src/core/persistence/geopackage/ -t "dangling endpoint"` | `1 passed`, 24 skipped |
| 47 | `cross-kind` | `1 skipped` / `8 skipped`, **exit 0** | same directory scope | `2 passed`, 23 skipped |
| 51 | `round-trips relationships and integrity events` | `1 skipped` / `8 skipped`, **exit 0** | same directory scope | `1 passed`, 24 skipped |
| 58 | `drops an edge whose endpoint` | `18 skipped (18)`, **exit 0** | `npx vitest run src/store/ -t "drops an edge whose endpoint"` | `1 passed`, 4 skipped |

46, 47 and 51's tests live in `src/core/persistence/geopackage/migration.store-path.fixtures.test.ts`
(the cap-forced sibling of `migration.store-path.test.ts`); 58's lives in
`src/store/useProjectStore.snapshot.test.ts` (Q2B-20). **Criterion 49b escaped only because its
command was already directory-scoped**, not because it was written more carefully.

**Directory-scoping is the fix**: it finds the test wherever the cap put it, and it survives the next
split. Re-point all four before this file is reused. Read the *pass count*, never the exit code —
these four exit 0 either way. The general rule is now §8b lesson 6 of
`GABRIEL_V2_SLICE_2B_BUILD.md`.

### 0.2 Criterion 55d's count is stale, and its production half still holds

55d expects `... | grep -c "getState().setProject("` -> **21**. The tree measures **24** at
`8527d44`: Phase 3's three new test files (`migration.store-path.fixtures.test.ts`,
`useProjectStore.snapshot.test.ts`, `useEntityInspector.parent.test.ts`) each carry one.
**The production count is still exactly 3** — `src/hooks/projectIO.ts:104`,
`src/hooks/projectIO.ts:197`, `src/pages/ViewPage.tsx:45` — which is what the criterion is actually
for, and criterion 55c (`npm run build`) is what proves every site compiles.

This is **§8b lesson 5 recurring one storey out**: a count frozen before the tests existed, then
invalidated by writing the tests this same criteria file mandates. A criterion that counts
occurrences across the whole tree cannot be frozen by a document that also requires new test files;
it must count the *production* sites and name them, as §1.1 does.

### 0.3 The four criterion defects, with their causes

- **15a** expects exactly four paths from `git diff --name-only BASE -- src/core/relationship/`;
  there are **five**. Criterion **6** *explicitly directs* the `isHierarchyBearing` truth table into a
  sibling file when `validate.test.ts` would exceed 300 lines — and it does exceed it: the file is at
  **292** with criterion 14b's test in it, and the truth table needs roughly 40 lines more.
  **15a and 6 cannot both hold.** 15b and 15c pass, so the Q39 scope limit 15 exists for — no
  `vocabulary.ts`, no `relationship.ts`, `EDGE_VOCABULARY_VERSION` still `1.0.0` — is intact. 15a
  should have said "no other *source* path, and no vocabulary file", which is what its own prose
  says. Recorded in full as Q2B-17.
- **22** (`metadata NOT NULL`) **fails by owner ruling, not by defect.** §4.4 demanded both
  `NOT NULL` and an encoder emitting `null` for the empty bag; SQLite cannot honour both, and 1010 of
  the 1012 minted edges carry `{}`, so every save of a project with a hierarchy failed. **Ruled
  2026-07-31 mid-run: drop `NOT NULL`, keep `encode({}) -> null`** — criterion 25's
  `decode(null) -> {}` is what settles which half was wrong. Q2B-19.
- **36** (`acts_for` unreachable under `src/core/persistence/`) matches **one line**:
  `migration.store-path.test.ts:212`, which **criterion 69 requires** ("no third type, `acts_for`
  **0**"). Criterion 36's own exclusion note asserts that nothing this slice's positive criteria
  require puts that string there; **that assertion is false**, which is §8b lesson 1 failing on its
  own terms. Corrected form: add `--glob '!*.test.ts'` to the command -> no output, exit 1.
- **77** — two of its eight bullets match, both self-inflicted: the same `acts_for` line, and
  `src/store/useProjectStore.renameLayer.test.ts` matching the `renameLayer` pattern, which **§2's own
  file table lists as compile-forced**. Neither is out-of-scope work; the fence caught the slice's own
  mandated changes.

### 0.4 Criterion 8 is superseded by a later owner ruling, not failed

Ruled 2026-08-03 (Q2B-7): **`IntegrityEventKind` gains a fifth member**, so the six otherwise
unrecordable violation codes — `unknown-type`, `date-order`, `invalid-date`,
`missing-required-date`, `invalid-metadata`, `invalid-export-override` — get a durable
`integrity_events` row instead of a `console.warn`. Criterion 8's "exactly four" and its locking test
(`locks the integrity event kinds at four`) are **superseded by that ruling**, not failed by the
implementation: they were satisfied at `8527d44` and the ruling changes what they should assert. A
parallel agent is implementing it; whoever lands it re-points the locking test at the five-member
array and keeps its deep-equal shape, which is the part of criterion 8 worth preserving.

### 0.5 Six files exist that no criterion grades

None is out of scope; none is graded, because §2's file table was written before the caps forced the
splits (`SLICE_RUN_LOG.md`, "Six files exist that §2's file table does not list"):

| file | lines | why it exists |
|---|---|---|
| `src/store/projectSnapshot.ts` | 57 | the Phase 5 extraction that keeps `useProjectStore.ts` under criterion 5's 400 |
| `src/core/integrity/contestedParentEvents.ts` | 69 | the pure minter `commitRelationships` calls (Q2B-23) |
| `src/core/persistence/geopackage/migration.store-path.fixtures.test.ts` | 181 | cap-forced sibling; holds 46, 47 and 51's tests (§0.1) |
| `src/core/relationship/isHierarchyBearing.test.ts` | 74 | cap-forced sibling directed by criterion 6; the fifth path 15a forbids (§0.3) |
| `src/store/useProjectStore.snapshot.test.ts` | 71 | cap-forced sibling; holds 58's test (Q2B-20) |
| `src/modules/orbat/hooks/useEntityInspector.parent.test.ts` | 121 | criterion 62c's test, written without jsdom (Q2B-21) |

### 0.6 Criterion 79 rests on a fact that was never true — the repository is public

Criterion **79(a)** requires ADR 0011 to record that "the real backup is the private repo's git
history pinned at **`5b0d2ed`**". Measured 2026-08-04 against the GitHub API rather than assumed:
`github.com/gabriel-neutron/GABRIEL` returns `"private": false` and has been public since it was
created on 2026-05-05 — so the repository was already public on 2026-07-31 when this criterion was
frozen, and on 2026-08-03 when the run graded it **pass**. The criterion is **not edited**
(Prohibition 2), and the grade stands: ADR 0011 did say what 79(a) asked it to say. Both were
wrong about the world, which is a different failure from a criterion the implementation missed —
and it is the first one in this project where *every* participant, criterion and artefact agreed
with each other and none of them checked.

The owner has since ruled that code and data are both public, so this is the intended state. ADR
0011's paragraph carries a dated correction; `GABRIEL_V2_PRD.md` requirement 89 and its baton-pass
rule, `GABRIEL_V2_TIMELINE.md` and `GABRIEL_V2_SLICE_0_1_BUILD.md` carry the same. **The backup
argument itself survives** — `5b0d2ed`'s blob is still byte-identical to the file on disk, re-verified
the same day at md5 `7d0b0e59…` / 4,984,832 bytes.

**For §8b:** this is the seventh lesson's sibling. Lesson 7 says a criterion must name an observable
the checked work actually produces; this one says a criterion must not assert a fact about the
world that nobody is required to measure. 79(a) graded a *document against a document*, and the
loop has no step at which the underlying claim is checked against anything outside the repo.

---

## 1. Measurement corrections

Every enumeration this contract rests on was re-measured at `BASE` per §8b's standing hazard.
Where the spec disagrees with the tree, **the tree wins and the corrected figure is what a
criterion below asserts.**

### 1.1 `setProject` call sites — **21**, not 18 (§4.7) and not 22 (§9 clause 5)

§4.7's table was measured at `65ddc11`; prerequisite commit **P2** then added three more. §9
clause 5's "22" is the older, doubly-wrong figure §4.7 itself corrected. Verbatim, by file and
enclosing function (`grep -rn "setProject" src/ | grep -v resetProject`, then each hit read):

| where | count | sites |
|---|---|---|
| production | 3 | `src/pages/ViewPage.tsx:45` (the `loadDemoProject` effect); `src/hooks/projectIO.ts:104` (`performSessionRestore`); `src/hooks/projectIO.ts:192` (`performOpenProject`) |
| gate test | 1 | `src/core/persistence/geopackage/store-path.integration.test.ts:54` |
| **P2's gate test** | **2** | `src/core/persistence/geopackage/layer-rehabilitation.store-path.test.ts:46` and `:128` |
| **P2's store test** | **1** | `src/store/useProjectStore.renameLayer.test.ts:30` |
| stories | 5 | `TreeView.stories.tsx:43`, `SymbolsLayer.stories.tsx:41`, `HierarchyPanel.stories.tsx:119`, `LayersPanel.stories.tsx:68`, `EntityInspector.stories.tsx:34` |
| `src/store/useProjectStore.test.ts` | 9 | `:122`, `:140`, `:168`, `:203`, `:218`, `:254`, `:310`, `:340`, `:357` |

**Not call sites** (§8b lesson 5 — a count of a name must exclude the names that contain it):
`OsmQueryMenu.stories.tsx:16`, `useProjectStore.test.ts:118/:163/:236/:306`,
`store-path.integration.test.ts:27`, `layer-rehabilitation.store-path.test.ts:54`,
`projectIO.authority.fixtures.ts:67` are all `resetProject()`.
`useProjectIO.load-state.test.ts:51`, `applyResult.ts:85`, `store-path.integration.test.ts:12/:43/:53/:106`,
`layer-rehabilitation.store-path.test.ts:14` are comments or test titles.
`useProjectStore.ts:61` is the interface declaration, `:146` the implementation, `:150` the devtools
action label. `ViewPage.tsx:17/:58` are `setProjectLoading`.

### 1.2 `selectPersistableSnapshot` call sites — **9**, not the 8 §4.7 claims

`src/hooks/projectIO.ts:219` (enclosing function **`performSaveProject`**, not `performProjectSave`
— see 1.4); `store-path.integration.test.ts:60`; **`layer-rehabilitation.store-path.test.ts:47`**
(new, P2); `useProjectStore.test.ts` `:22`, `:29`, `:35`, `:66`, `:92`, `:111`.
`makeState()` is `useProjectStore.test.ts:7-17` and returns a `ProjectState` literal with six
members; it must gain `relationships` and `integrityEvents` or all six of that file's calls fail to
compile.

### 1.3 §3's file table is stale (the P1b run log says so). Corrected in §2 below

- `performProjectSave` and `ProjectSaveInput` are in **`src/hooks/projectSave.ts`** (81 lines).
- `performSessionRestore` / `performNewProject` / `performOpenProject` / **`performSaveProject`**
  are in **`src/hooks/projectIO.ts`** (243 lines).
- **`src/hooks/useProjectIO.ts` is 88 lines of React dep-wiring and gains nothing in 2B.** §3's
  entry "modified — options, `ProjectSaveInput`, the three call paths" is counterfactual.
- `projectStateFromLoadResult` and `ProjectStateFromLoadResult` are in
  **`src/core/persistence/geopackage/applyResult.ts`** (P1), re-exported from `./index`.

### 1.4 The save path has two similarly-named functions and the spec conflates them

`performProjectSave(input, deps)` — `projectSave.ts:51-81`, holds the `snapshotIsAuthoritative`
guard (`:57`) and calls `saveGeoPackage` (`:67`). It does **not** call
`selectPersistableSnapshot`. `performSaveProject(authority, deps, ui)` — `projectIO.ts:212-243`,
is the one that calls `selectPersistableSnapshot` (`:219`) and then `performProjectSave` (`:228`).
Criteria below name the exact function; do not treat the two as one.

### 1.5 Line-number drift in the spec, re-measured at `BASE`

| spec cite | status at BASE |
|---|---|
| §7 step 6: `applyResult.ts:47-52`, "pass-through cast at `:49`" | **wrong.** `applyGeoPackageResult` returns at `:76-82`; the cast `result.entities as MapEntity[]` is at `:78`; `projectStateFromLoadResult` is `:94-103`. **Cite symbols, not numbers.** |
| §7 step 2: `load.ts:56-66` entity validation loop | holds exactly |
| §7 step 5: `load.ts:76` `readRatingEvents`, `:78` the return | holds exactly |
| T13: `load.ts:79-83` re-wrap, pass-through at `:80` | holds |
| §4.7: `useProjectStore.ts:117-139`, `:123-127`, `:148` (`claims ?? []`) | all hold |
| §4.2: `validate.ts:6-10`, `:140-147`, `:217-226`, `isActiveOrganicSubordination` `:68-72` | all hold |
| §4.4: `relationship.ts:41-52` (the type), `:49` (`metadata`, required, no `?`) | holds |
| T16: `merge.ts:49`, `useEntityInspector.ts:203-213` (`handleParentChange`), `MainLayout.tsx:30,39` (`entityFromGeometry`) | all hold |
| §4.8: `resolveParent` called `:88`, defined `:113-120` | holds |
| T9 precedent `decodeAssessor` `ratingEvents.table.ts:20-29`; T3 counter-example `readRatingEvents` `:48-54` | both hold |
| T8: `tableExists` `columnDescriptor.ts:96-98`; T4: `ensureOptionalColumns` splices `constraints` at `:118`; T6: `decodeRow` `:63-69` | all hold |
| T3: "`columnDescriptor.ts:52-57` throws twice" | **off by one.** The two throws are at **`:53` and `:56`**; `buildSelectClause` is `:48-63`. |
| §10 step 17: "`useProjectIO.ts:31`" for `suggestedName` | **wrong file and line.** It is **`src/hooks/projectIO.ts:70`** after P1b. (Step 17 is out of scope; the citation is corrected so the owner's rehearsal does not chase it.) |
| §4.4 heading "None is `optional` — see Trap **T8**" | **wrong trap number.** The `optional`/`fallbackSql` trap is **T3** (with T4). T8 is the `gpkg_contents` / `createAttributesTable` trap. Both are asserted below, under their own numbers. |
| §9 clause 7 / T16: "`merge.ts:49` ... are deleted" | `merge.ts:49` is `if (e.parentId === secondaryId) return { ...e, parentId: primaryId }` — confirmed |

### 1.6 Green at `BASE`, spot-checked

- `npm run scan:nul` -> `scan-nul: clean, 316 files scanned under src docs scripts.` **Verified today.**
- 72 test files under `src/` (`find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l` -> `72`).
  548 tests / 0 skipped and a clean build are taken from the P3 entry of `SLICE_RUN_LOG.md`; the
  full suite was **not** re-run in Phase 1 (it is criterion 1's job).
- `public/project.gpkg` was **not opened, read, copied or hashed** during Phase 1. Its md5 is
  asserted by criterion 3, taken from the spec.

### 1.7 Pre-existing 300-line-cap facts 2B must not trip over (`CONSTRAINTS.md:113`)

| file | lines at BASE | 2B does |
|---|---|---|
| `src/store/useProjectStore.ts` | **348 — already over** | adds 2 state fields, 3 required `setProject` members, `commitRelationships`, `unacknowledgedIntegrityEvents`, the snapshot edge filter |
| `src/store/useProjectStore.test.ts` | **371 — already over** | `makeState` gains 2 fields |
| `src/modules/orbat/hooks/useEntityInspector.ts` | **301 — already over by 1** | ports `handleParentChange` to an edge operation |
| `src/shell/MainLayout.tsx` | 293 — 7 lines of headroom | ports `entityFromGeometry`'s parent to an edge |
| `src/core/relationship/validate.test.ts` | 273 — 27 lines of headroom | gains `corporate_parent` and `isHierarchyBearing` coverage |
| `src/core/identity/merge.ts` | 198 | gains edge handling, loses `resolveParent` |
| `src/hooks/projectIO.ts` | 243 | mapping only |
| `src/hooks/projectSave.ts` | 81 | `ProjectSaveInput` gains 2 required fields |

**Ruling for 2B, stated so no coding agent discovers it silently.** Prohibition 5 forbids fixing
the pre-existing overruns, so the cap is handled as **declared, bounded, accepted debt**:
criteria **4, 5 and 6** bound the growth, and the residual overrun is recorded as an owner item in
§6. Nobody may "fix" `useProjectStore.ts`, `useProjectStore.test.ts` or `useEntityInspector.ts`
inside this slice, and nobody may grow them without bound either.

---

## 2. Files — the corrected §3 table, at real current paths

```
src/core/integrity/integrityEvent.ts                          new   (dir src/core/integrity/ does not exist yet)
src/core/integrity/integrityEvent.test.ts                     new
src/core/relationship/activeParent.ts                         new
src/core/relationship/activeParent.test.ts                    new
src/core/relationship/validate.ts                             mod   export isHierarchyBearing, replace isActiveOrganicSubordination (Q39)
src/core/relationship/validate.test.ts                        mod   corporate_parent + isHierarchyBearing (see criterion 6 on the cap)
src/core/persistence/geopackage/relationships.table.ts        new
src/core/persistence/geopackage/relationships.table.test.ts   new
src/core/persistence/geopackage/integrityEvents.table.ts      new
src/core/persistence/geopackage/integrityEvents.table.test.ts new
src/core/persistence/geopackage/migrateHierarchy.ts           new   migration + the 13 hand-classified links
src/core/persistence/geopackage/migrateHierarchy.test.ts      new
src/core/persistence/geopackage/migration.store-path.test.ts  new   the real-WASM gate (name chosen by this planner, after layer-rehabilitation.store-path.test.ts; the spec names the test, not the file)
src/core/persistence/geopackage/types.ts                      mod   GeoPackageLoadResult + ApplyGeoPackageResultState gain relationships, integrityEvents
src/core/persistence/geopackage/index.ts                      mod   barrel
src/core/persistence/geopackage/load.ts                       mod   read, migrate, validate, derive (§7)
src/core/persistence/geopackage/save.ts                       mod   two create/write pairs, two required options members
src/core/persistence/geopackage/applyResult.ts                mod   carries both collections through (see §6 contradiction C1)
src/core/identity/merge.ts                                    mod   edges in IdentityGraph (Q41)
src/store/useProjectStore.ts                                  mod   state, setProject, commitRelationships, unacknowledgedIntegrityEvents, snapshot
src/store/useProjectStore.test.ts                             mod   makeState only (criterion 5)
src/store/useProjectStore.relationships.test.ts               new   commitRelationships / unacknowledgedIntegrityEvents (criterion 5)
src/hooks/projectSave.ts                                      mod   ProjectSaveInput gains relationships, integrityEvents (NOT useProjectIO.ts)
src/hooks/projectIO.ts                                        mod   performSaveProject's mapping; performNewProject's saveGeoPackage call
src/pages/ViewPage.tsx                                        unchanged expected — already converted in 2A/P1 (Q38); gains nothing
src/hooks/useProjectIO.ts                                     unchanged expected — 88 lines of dep wiring (correction 1.3)
src/shell/MainLayout.tsx                                      mod   entity creation with a parent (T16)
src/modules/orbat/hooks/useEntityInspector.ts                 mod   parent change becomes an edge operation (T16)
src/store/useProjectStore.renameLayer.test.ts                 mod   compile-forced setProject literal
src/core/persistence/geopackage/store-path.integration.test.ts      mod   compile-forced
src/core/persistence/geopackage/layer-rehabilitation.store-path.test.ts mod compile-forced (2 sites)
5 story files (TreeView, SymbolsLayer, HierarchyPanel, LayersPanel, EntityInspector)   mod   compile-forced
docs/adr/0011-relationships-are-the-hierarchy.md              new   (0011 is free: the dir holds 0001-0010 and 0012)
CONTEXT.md                                                    mod   glossary
```

---

## 3. The criteria

### A. Baseline, stop-ship and the file-size envelope

1. **[MACHINE]** `npm run verify` is green on the exact tree being committed: `scan:nul` -> `lint`
   -> `test:coverage` -> `build`, exit code 0 read from `$LASTEXITCODE`.
   Command: `npm run verify`
   Expected: exit 0; the vitest summary line reports **0 failed and 0 skipped**, with a test-file
   count and test count strictly greater than BASE's 72 / 548.

2. **[MACHINE]** No NUL byte anywhere (T7).
   Command: `npm run scan:nul`
   Expected: exit 0 and a line beginning `scan-nul: clean,` with a file count **>= 316**.
   **An `rg`-based NUL check is not accepted as evidence for this criterion under any
   circumstances** (Q36: `rg -c $'\x00'` and its `--text` variant are vacuous under Git Bash and
   reported green for two slices while blind).

3. **[MACHINE]** **§9 clause 14.** `public/project.gpkg` is byte-identical at the end of the build.
   PowerShell: `(Get-FileHash -Algorithm MD5 public/project.gpkg).Hash.ToLower()`
   Expected: exactly `7d0b0e592a1128a0d83e7575110bf2dc`.
   Also: `git status --porcelain public/project.gpkg` prints nothing.
   Every test that touches the real file reads it with `readFileSync` + `Uint8Array.from(...).buffer`
   and writes only to in-memory buffers — the pattern at `store-path.integration.test.ts:47-48`.

4. **[MACHINE]** Every file 2B **creates** is at or under the 300-line cap (`CONSTRAINTS.md:113`).
   PowerShell: `git diff --name-only --diff-filter=A BASE -- src/ | ForEach-Object { "{0} {1}" -f (Get-Content $_).Count, $_ }`
   Expected: every printed count is `<= 300`.

5. **[MACHINE]** **Declared accepted debt, bounded.** `src/store/useProjectStore.ts` is over the cap
   at BASE (348) and Prohibition 5 forbids fixing it. 2B may grow it **only** by the members §4.7
   declares.
   PowerShell: `(Get-Content src/store/useProjectStore.ts).Count`
   Expected: `> 348` and `<= 400`. (348 + the declared additions: two state fields, three
   `setProject` members plus destructure and `set`, `commitRelationships`,
   `unacknowledgedIntegrityEvents`, the snapshot edge filter, imports — ~45 lines with headroom.
   A number above 400 means something the spec did not declare was put in this file.)
   And: `(Get-Content src/store/useProjectStore.test.ts).Count` is `<= 385` — that file grows by
   `makeState`'s two fields and nothing else; `commitRelationships` and
   `unacknowledgedIntegrityEvents` tests go in the new `src/store/useProjectStore.relationships.test.ts`
   (the split precedent is P1b's `projectIO.authority.test.ts` / `.fixtures.ts` and P2's
   `useProjectStore.renameLayer.test.ts`).

6. **[MACHINE]** The three other near-cap files 2B touches do not silently cross it.
   PowerShell: `foreach ($f in "src/modules/orbat/hooks/useEntityInspector.ts","src/shell/MainLayout.tsx","src/core/relationship/validate.test.ts","src/core/identity/merge.ts","src/hooks/projectIO.ts","src/hooks/projectSave.ts","src/core/persistence/geopackage/load.ts","src/core/persistence/geopackage/save.ts","src/core/persistence/geopackage/applyResult.ts") { "{0} {1}" -f (Get-Content $f).Count, $f }`
   Expected: `MainLayout.tsx <= 300`; `validate.test.ts <= 300` (if `corporate_parent` /
   `isHierarchyBearing` coverage would push it over, it goes in a new sibling test file instead);
   `merge.ts`, `projectIO.ts`, `projectSave.ts`, `load.ts`, `save.ts`, `applyResult.ts` each
   `<= 300`; `useEntityInspector.ts <= 305` (301 at BASE, pre-existing overrun, must not grow by
   more than the port needs — recorded as debt in §6, **not** to be refactored here).

### B. `src/core/integrity/integrityEvent.ts` (§4.1)

7. **[MACHINE]** The file exists and exports `IntegrityEventKind`, `IntegrityEvent` and
   `decodeIntegrityEvent` with exactly the §4.1 signatures.
   Command: `rg -n "export type IntegrityEventKind|export type IntegrityEvent = |export function decodeIntegrityEvent" src/core/integrity/integrityEvent.ts`
   Expected: three matches; the third reads
   `export function decodeIntegrityEvent(raw: unknown): IntegrityEvent | undefined`.

8. **[MACHINE]** `IntegrityEventKind` is a four-member union, verbatim, and
   `"multiple-active-hierarchy"` is the same string as in `RELATIONSHIP_VIOLATION_CODES`
   (`validate.ts:6-10`) — not a parallel taxonomy.
   Command: `sed -n '/export type IntegrityEventKind/,/^$/p' src/core/integrity/integrityEvent.ts`
   Expected: exactly `"hierarchy-migrated"`, `"multiple-active-hierarchy"`, `"cross-kind-parent"`,
   `"merge-dropped-edge"` and nothing else.
   Backed by a test in `src/core/integrity/integrityEvent.test.ts` named
   `locks the integrity event kinds at four` that deep-equals the four-element array.

9. **[MACHINE]** `IntegrityEvent` declares `id`, `kind`, `createdAt`, `summary`, `detail` as
   **required** and `acknowledgedBy` / `acknowledgedAt` / `acknowledgedNote` as optional; `detail`
   is typed `Record<string, unknown>`.
   Command: `sed -n '/export type IntegrityEvent = {/,/^}/p' src/core/integrity/integrityEvent.ts | rg -n "\?:"`
   Expected: exactly three lines, all three `acknowledged*`.

10. **[MACHINE]** `decodeIntegrityEvent` is **fail-closed and never throws**: a corrupt integrity
    row must not make a project unopenable.
    Command: `npx vitest run src/core/integrity/integrityEvent.test.ts -t "never throws"`
    Expected: exit 0. The test feeds `undefined`, `null`, `42`, `"x"`, `[]`, `{}`, a row with an
    unknown `kind`, and a row whose `detail` is invalid JSON; each returns `undefined` or a valid
    `IntegrityEvent`, and **no call throws**. Where an event is returned, `detail` is `{}`, never
    `undefined` (the T9 rule, applied to this type's required field).

### C. `isHierarchyBearing` — the single definition (§4.2, Q39)

11. **[MACHINE]** `validate.ts` exports exactly the declared function.
    Command: `rg -n "export function isHierarchyBearing" src/core/relationship/validate.ts`
    Expected: one match, `export function isHierarchyBearing(rel: Relationship): boolean`.

12. **[MACHINE]** `isActiveOrganicSubordination` is **replaced**, not kept alongside.
    Command: `rg -n "isActiveOrganicSubordination" src/`
    Expected: **no output, exit 1.**

13. **[MACHINE]** The truth table (§8, first bullet), in `src/core/relationship/validate.test.ts`
    (or a sibling per criterion 6) under a describe named `isHierarchyBearing`:
    `subordinate_to` with no attachment -> `true`; `attachment: "organic"` -> `true`;
    `attachment: "attached"` -> `false`; `corporate_parent` -> `true`; an edge with a non-null
    `endDate` -> `false` for both types; each of the other eleven `RelationshipType` values ->
    `false`.
    Command: `npx vitest run src/core/relationship/ -t "isHierarchyBearing"`
    Expected: exit 0, at least 6 tests, including one that iterates the eleven remaining types
    rather than spot-checking one.

14. **[MACHINE]** **Both consumers switch, and the point of Q39 is proven.**
    `countActiveOrganicParents` (`validate.ts:140-147`) and the `multiple-active-hierarchy` branch
    (`:217-226`) both call `isHierarchyBearing`, so a child with **one active `subordinate_to` and
    one active `corporate_parent`** now draws a `multiple-active-hierarchy` violation — a test that
    would have failed at BASE.
    Command a: `sed -n '/function countActiveOrganicParents/,/^}/p' src/core/relationship/validate.ts | rg -c "isHierarchyBearing"` -> `1`.
    Command b: `npx vitest run src/core/relationship/ -t "one active subordinate_to and one active corporate_parent"`
    Expected: exit 0; the test asserts exactly one `multiple-active-hierarchy` violation **per
    offending edge** (two violations for the two edges, matching `validate.ts:149-154`'s documented
    behaviour), and asserts zero for the same child when the `corporate_parent` edge has an
    `endDate`.

15. **[MACHINE]** **§9 clause 12 — the Q39 scope limit, with the exclusions §8b lesson 1 requires.**
    The only *changed* file under `src/core/relationship/` is `validate.ts` (plus its test); the
    only *new* ones are `activeParent.ts` and `activeParent.test.ts`.
    Command a: `git diff --name-only BASE -- src/core/relationship/`
    Expected: exactly `src/core/relationship/activeParent.test.ts`,
    `src/core/relationship/activeParent.ts`, `src/core/relationship/validate.test.ts`,
    `src/core/relationship/validate.ts` — **and no other path**. In particular not
    `vocabulary.ts`, not `vocabulary.test.ts`, not `relationship.ts`, not `relationship.test.ts`.
    Command b: `npx vitest run src/core/relationship/vocabulary.test.ts -t "pins EDGE_VOCABULARY_VERSION at 1.0.0"`
    Expected: exit 0 — `EDGE_VOCABULARY_VERSION` is still `"1.0.0"`; no vocabulary entry moved, so
    this is not an amendment under ADR 0010.
    Command c: `git diff BASE -- src/core/relationship/validate.ts | rg "^[-+]" | rg -v "^[-+]{3}" | rg "publicDefinition|RELATIONSHIP_VIOLATION_CODES = |EDGE_TYPES"`
    Expected: **no output, exit 1** — the nine violation codes and the thirteen `publicDefinition`
    strings are untouched.

### D. `src/core/relationship/activeParent.ts` (§4.3)

16. **[MACHINE]** The file exports `ActiveParentMap`, `activeParentMap` and `withDerivedParents`
    with exactly the §4.3 signatures, `withDerivedParents` generic on
    `T extends { id: string; parentId: string | null }`.
    Command: `rg -n "export type ActiveParentMap|export function activeParentMap|export function withDerivedParents" src/core/relationship/activeParent.ts`
    Expected: three matches with those exact heads.

17. **[MACHINE]** `activeParentMap`: a single hierarchy-bearing edge maps the child; an ended edge
    does not compete; an `attached` edge does not compete; a `corporate_parent` edge **does** map.
    Command: `npx vitest run src/core/relationship/activeParent.test.ts -t "activeParentMap"`
    Expected: exit 0.

18. **[MACHINE]** **Q40, contested children.** Two competing active hierarchy-bearing edges leave
    the child **absent from `parentById`** — not mapped to `null`, and no arbitrary winner — and
    present in `contested` with **both edge ids**.
    Command: `npx vitest run src/core/relationship/activeParent.test.ts -t "contested"`
    Expected: exit 0; the test asserts `map.parentById.has(childId) === false` (not
    `.get(childId) === null`) and `map.contested.get(childId)` deep-equals both edge ids.

19. **[MACHINE]** `withDerivedParents` is pure: it returns fresh items, sets `parentId` to `null`
    for any item absent from `parentById`, never mutates its input, and **never reads the item's
    incoming `parentId`**.
    Command: `npx vitest run src/core/relationship/activeParent.test.ts -t "withDerivedParents"`
    Expected: exit 0; one test freezes the input array and its objects with `Object.freeze` and
    asserts no throw and that the inputs are unchanged; one asserts an item carrying
    `parentId: "x"` and absent from the map comes back with `parentId: null`.

20. **[MACHINE]** **T15 — reproduce the orphan policy by omission.** `activeParentMap` /
    `withDerivedParents` never emit a parent id that is not in the map, and `load.ts` never writes a
    dangling parent: the derivation's output is checked against the entity id set.
    Command: `npx vitest run src/core/relationship/activeParent.test.ts -t "never emits a parent absent"`
    Expected: exit 0; the test builds an edge whose `toId` is not among the items and asserts the
    child's derived `parentId` is `null`, not the missing id.
    Plus, in the real-WASM gate (criterion 66): every derived non-null `parentId` on the reloaded
    entities is a member of the reloaded entity id set — the artefact that would be absent if a
    dangling parent were written (`load.ts:60-63` would throw on the *next* load, which is the
    failure this criterion is buying insurance against).

21. **[MACHINE]** `activeParent.ts` contains **no second hierarchy predicate** — it decides
    hierarchy-bearing-ness only by calling `isHierarchyBearing`.
    Command: `rg -n '=== "subordinate_to"|!== "subordinate_to"|=== "corporate_parent"|!== "corporate_parent"|attachment' src/core/relationship/activeParent.ts`
    Expected: **no output, exit 1.**

### E. `relationships.table.ts` (§4.4)

22. **[MACHINE]** Exactly eight `ColumnDescriptor<Relationship>` entries, columns `id`, `from_id`,
    `to_id`, `type`, `start_date`, `end_date`, `metadata`, `export_override`; constraints
    `id PRIMARY KEY`, `from_id/to_id/type/metadata NOT NULL`.
    Command: `sed -n '/export const relationshipColumns/,/^]/p' src/core/persistence/geopackage/relationships.table.ts | rg -c "prop:"` -> `8`
    and `sed -n '/export const relationshipColumns/,/^]/p' src/core/persistence/geopackage/relationships.table.ts` read for the column names and constraints above.

23. **[MACHINE]** **T3 + T4 — no descriptor in either new table is `optional`.** Both tables are
    created whole, so `NOT NULL` in `CREATE TABLE` is safe **only** there.
    Command: `rg -n "optional|fallbackSql" src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts`
    Expected: **no output, exit 1.**
    And: `rg -n "ensureOptionalColumns" src/core/persistence/geopackage/save.ts`
    Expected: exactly the three BASE calls — `UNITS_TABLE`, `PROVENANCE_SOURCES_TABLE`,
    `PROVENANCE_CLAIMS_TABLE` — and **no call for `relationships` or `integrity_events`**.

24. **[MACHINE]** **T8 — plain SQLite tables, not registered GeoPackage tables.**
    Command a: `rg -n "CREATE TABLE IF NOT EXISTS" src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts`
    Expected: one match per file, each on a `geoPackage.connection.run(...)` call.
    Command b: `rg -n "createAttributesTable|gpkg_contents|getFeatureTables" src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts src/core/persistence/geopackage/save.ts src/core/persistence/geopackage/load.ts src/core/persistence/geopackage/migrateHierarchy.ts`
    Expected: **no output, exit 1.**
    Command c: existence is detected with `tableExists` (`columnDescriptor.ts:96-98`):
    `rg -n "tableExists" src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts` -> one match per file.

25. **[MACHINE]** **T9 — `metadata` decodes to `{}`, never `undefined`,** following `decodeAssessor`
    (`ratingEvents.table.ts:20-29`) and **not** `decodeAliases`; the encoder tests for no own
    enumerable keys and emits `null` (because `encodeRatingMeta` does not test emptiness and would
    persist the string `"{}"`).
    Command: `npx vitest run src/core/persistence/geopackage/relationships.table.test.ts -t "metadata"`
    Expected: exit 0; tests assert `decode(null)`, `decode(undefined)`, `decode("")`,
    `decode("not json")` each deep-equal `{}` and are **not** `undefined`; and
    `encode({})` returns `null` while `encode({ percent: 25 })` returns a JSON string.

26. **[MACHINE]** **T5 — `export_override` encodes to `null` when absent and decodes to
    `undefined`, never `{}`.** The descriptor's `decode` is the shipped `decodeExportOverride`
    (`relationship.ts:80`) used directly.
    Command a: `rg -n "decodeExportOverride" src/core/persistence/geopackage/relationships.table.ts` -> at least one match, used as the descriptor's `decode`.
    Command b: `npx vitest run src/core/persistence/geopackage/relationships.table.test.ts -t "export_override"`
    Expected: exit 0; `decode(null)` is `undefined` (asserted with `toBeUndefined()`, and
    explicitly **not** `{}`); `encode(undefined)` is `null`.

27. **[MACHINE]** **T11 — the deviation, and it is load-bearing.** `readRelationships` returns
    `null` when the table does not exist and `[]` when it exists and is empty. §9 clause 2.
    Command: `npx vitest run src/core/persistence/geopackage/relationships.table.test.ts -t "absent table"`
    and `... -t "empty table"`
    Expected: exit 0 for both.
    **The artefact, not a count (§8b lesson 3):** the absent-table test opens the **real
    `public/project.gpkg` read-only** — the file has no `relationships` table today, which is what
    makes `null` observable at all — and asserts `readRelationships(...) === null` with
    `toBeNull()`. The empty-table test round-trips a `saveGeoPackage` call with
    `relationships: []` and asserts the reload gives `[]` **and** that
    `tableExists(connection, "relationships")` is `true`, so `[]` cannot be an absent table in
    disguise. 60000 ms timeout, real WASM, no mocking, nothing written to disk.

28. **[MACHINE]** Read order is `ORDER BY rowid ASC` and a JSDoc line says so, as every sibling
    table does; `start_date` / `end_date` are `string | null` (`null` is a value, not an absence),
    following `provenanceClaims.table.ts:22`.
    Command: `rg -n "ORDER BY rowid ASC" src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts`
    Expected: one match per file.

### F. `integrityEvents.table.ts` (§4.5)

29. **[MACHINE]** Exactly eight descriptors: `id` PRIMARY KEY, `kind` NOT NULL, `created_at` NOT
    NULL, `summary` NOT NULL, `detail`, `acknowledged_by`, `acknowledged_at`, `acknowledged_note`.
    Command: `sed -n '/export const integrityEventColumns/,/^]/p' src/core/persistence/geopackage/integrityEvents.table.ts | rg -c "prop:"` -> `8`.

30. **[MACHINE]** `readIntegrityEvents` returns **`[]`** for an absent table — the ordinary pattern;
    only `readRelationships` deviates.
    Command: `npx vitest run src/core/persistence/geopackage/integrityEvents.table.test.ts -t "absent table"`
    Expected: exit 0; the test reads the real `public/project.gpkg` read-only (no
    `integrity_events` table there today) and asserts `toEqual([])`, explicitly **not** `null`.

31. **[MACHINE]** `detail` decodes to `{}` for `null`, `undefined`, `""` and malformed JSON (T9
    again), and encodes to `null` when the object has no own enumerable keys.
    Command: `npx vitest run src/core/persistence/geopackage/integrityEvents.table.test.ts -t "detail"`
    Expected: exit 0.

32. **[MACHINE]** **T6 — only `!= null` checks on decoded rows.** `decodeRow`
    (`columnDescriptor.ts:63-69`) assigns every descriptor prop unconditionally, so
    `"metadata" in rel` and `Object.hasOwn(rel, "exportOverride")` are `true` on every row read from
    disk.
    Command: `rg -n '"[a-zA-Z_]+" in |Object\.hasOwn|=== undefined' src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts src/core/persistence/geopackage/migrateHierarchy.ts src/core/relationship/activeParent.ts`
    Expected: **no output, exit 1.** (`=== undefined` is included because it is the same mistake
    wearing a different hat; `validate.ts:116-122` already documents the rule and must not regress.)

### G. `migrateHierarchy.ts` (§4.6, §5)

33. **[MACHINE]** `LEGACY_CORPORATE_LINKS` is a `Readonly<Record<...>>` keyed by **child entity
    id**, with **exactly 13 entries** whose ids and parent ids are byte-for-byte the §5 table:
    twelve pointing at `23dfd3ce-6465-55ca-83d4-cc8c766d8444` (Rostec State Corporation) and one —
    `f727b211-b3f4-525c-9776-07192c0d2e80` (PJSC Motovilikha Plants) — pointing at
    `b4f1f1cf-1791-58de-b761-f65842e9d202` (NPK Techmash JSC), which is itself a child of Rostec.
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "locks the 13 legacy corporate links"`
    Expected: exit 0; the test deep-equals the whole table against a literal written from §5, so a
    changed id is a red test and not a silent re-classification. The table is keyed on **ids, never
    on labels** (§5: the parent's real name is `Rostec State Corporation`, not `Rostec`).

34. **[MACHINE]** **The percent domain.** Exactly two minted edges carry `percent`; the multiset is
    `{49.9, 25}`; every other minted edge has `metadata.percent === undefined` — **not `null`, not
    `0`** (T5). `49.9` never `50`; `25` never `25.000001`.
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "percent"`
    Expected: exit 0; includes an assertion that `percent: 0` would be a legal *recorded* value
    (`0` is zero percent) and therefore is never used as a default.

35. **[MACHINE]** **T12 — the emitted type set is a two-element literal.**
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "emits exactly two relationship types"`
    Expected: exit 0; the test runs the migration over a mixed entity set and asserts
    `new Set(result.relationships.filter(minted).map(r => r.type))` deep-equals
    `new Set(["subordinate_to", "corporate_parent"])`.

36. **[MACHINE]** **T12 — `acts_for` is unreachable from this module by any path, including
    configuration.**
    Command: `rg -n "acts_for" src/core/persistence/`
    Expected: **no output, exit 1.** (Exclusion note per §8b lesson 1: nothing this slice's positive
    criteria require puts the string `acts_for` anywhere under `src/core/persistence/`; the
    vocabulary entry lives in `src/core/relationship/vocabulary.ts`, which criterion 15 pins as
    unchanged. If a later reading needs the string there, this criterion fails and is reported —
    it is not edited.)

37. **[MACHINE]** **T12 — the migration never reads `notes`, and mints no percentage by parsing.**
    Command: `rg -n "notes|%|\\\\d\\+.*%|match\\(|RegExp|\\.exec\\(" src/core/persistence/geopackage/migrateHierarchy.ts`
    Expected: the only matches are inside the frozen comment block quoting the two source sentences
    (§5) and the `detail` payload string; **no regex literal, no `.match(`, no `RegExp`, no
    `.exec(`, and no read of any `notes` field**. Read the output and confirm each match is a
    comment or a frozen literal.

38. **[MACHINE]** **The parser test (T12) — the one test that cannot be argued with, and its own
    criterion.** The migration runs over an in-memory entity set in which the Kalashnikov record's
    note reads exactly `"Rostec holds 100% and 3% and c.7%"`. The minted edge for
    `d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c` still carries `percent: 25`.
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "still mints 25 percent when the note says otherwise"`
    Expected: exit 0. No regex, however careful, survives this.

39. **[MACHINE]** Every minted edge: `id` is the string `"hier:"` concatenated with the child id;
    `startDate` and `endDate` are `null`; `metadata` is `{}` except for the two `percent` entries;
    `exportOverride` is absent. Ids are unambiguous and reversible on a first-colon split (no id in
    the file contains `:`).
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "minted edge shape"`
    Expected: exit 0.

40. **[MACHINE]** **T13 — the count assertion throws with the right prefix and the right payload.**
    `entitiesWithParentId === mintedEdges + skippedAlreadyPresent`; on failure it throws an `Error`
    whose message **begins with exactly `Hierarchy migration`** and contains both numbers and the
    `childId`s of the deficit.
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "count assertion"`
    Expected: exit 0; the test crafts a deficit and asserts
    `expect(() => ...).toThrow(/^Hierarchy migration/)`, plus that the message contains both
    integers and every missing child id.

41. **[MACHINE]** **Idempotence at the function level.** A second call with the first call's
    `relationships` as `existing` gives `mintedEdges === 0` and `skippedAlreadyPresent` equal to the
    first run's `mintedEdges`, and the count assertion holds as `N === 0 + N`.
    Command: `npx vitest run src/core/persistence/geopackage/migrateHierarchy.test.ts -t "idempotent"`
    Expected: exit 0. **The artefact (§8b lesson 3): `skippedAlreadyPresent` is asserted non-zero**,
    so "0 minted" cannot pass by the function having done nothing at all.

42. **[MACHINE]** The function is pure and `now` is injected — no clock inside — so `createdAt` is
    asserted exactly, and the input arrays are never mutated.
    Command: `rg -n "Date\.now|new Date\(\)" src/core/persistence/geopackage/migrateHierarchy.ts`
    Expected: **no output, exit 1**; plus a test that freezes the input arrays and asserts
    `createdAt` equals the injected string exactly.

### H. Ordering inside `load.ts` (§7) — every statement pinned by what precedes and follows it

For criteria 43-47 the source order is read once and compared:
`rg -n "readRelationships|readIntegrityEvents|for \(const e of entities\)|migrateHierarchyToRelationships|validateRelationships|activeParentMap|withDerivedParents|readRatingEvents|return \{" src/core/persistence/geopackage/load.ts`
Each criterion states the required relation between those line numbers.

43. **[MACHINE]** **§7 step 1.** `readRelationships(geoPackage)` and `readIntegrityEvents(geoPackage)`
    are called **after** `const entities = [...unitEntities, ...corporateEntities]` and **before**
    the entity-validation loop `for (const e of entities) {`.
    Expected: `line(readRelationships) > line(const entities = [...unitEntities)` and
    `line(readRelationships) < line(for (const e of entities))`; same for `readIntegrityEvents`.

44. **[MACHINE]** **§7 step 2 — the existing entity validation runs UNCHANGED, on the RAW
    `parentId` values.** Not moved, not weakened. It is what proves all 1012 parents resolve within
    their own kind, which is what makes the minted edges free of `dangling-endpoint` and
    `self-loop`.
    Command: `git diff BASE -- src/core/persistence/geopackage/load.ts | rg "^-" | rg -v "^---" | rg "parentId|sameKindIds|unitIds|corporateIds|entity references missing parent"`
    Expected: **no output, exit 1** — no line of the loop or its id sets was removed or rewritten.
    (Exclusion note, §8b lesson 1: the positive criteria for this file add lines containing
    `parentId` — the derivation — so the check is scoped to **removed** lines only, which the
    additions cannot satisfy away.)

45. **[MACHINE]** **§7 step 3 — the migration, gated on `persisted === null` (T11), placed
    immediately after the validation loop and before any derivation.** It consumes the **raw**
    `parentId` values.
    Command a: `rg -n "=== null|!== null" src/core/persistence/geopackage/load.ts`
    Expected: a gate reading `persisted === null` (or the equivalent `if (persisted == null)`)
    guarding the `migrateHierarchyToRelationships` call. **The gate is on table absence, never on
    row count**: `rg -n "\.length === 0|\.length > 0" src/core/persistence/geopackage/load.ts`
    returns **no line inside the migration gate**.
    Command b: ordering — `line(migrateHierarchyToRelationships)` is **greater** than
    `line(for (const e of entities))` and **less** than `line(activeParentMap)`.

46. **[MACHINE]** **§7 step 4 — `validateRelationships(all, entityIds)` immediately after the
    migration and before the derivation**, with the entity id set built at `load.ts:50`.
    `dangling-endpoint` and `self-loop` **throw**; every other code becomes an `integrity_events`
    row (fail closed, but not uniformly).
    Expected: `line(migrateHierarchyToRelationships) < line(validateRelationships) < line(activeParentMap)`,
    and `validateRelationships` is called with two arguments, the second being the `entityIds` set.
    Backed by: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "dangling endpoint"`
    — a persisted edge pointing at a non-existent entity makes the load throw, and a
    `multiple-active-hierarchy` edge pair does **not** throw but produces an
    `integrity_events` row of that kind.

47. **[MACHINE]** **§7 step 5 — the derivation is last, between `readRatingEvents` and the return,
    and the T10 cross-kind filter is applied there, where the kinds are known.** Never mutate: the
    migration needed the raw array.
    Expected: `line(readRatingEvents) < line(activeParentMap) < line(withDerivedParents) < line(return {)`.
    The cross-kind filter sits **after `activeParentMap(...)` and before `withDerivedParents(...)`**:
    it removes the pair from `parentById` (omission, never a written dangling parent — T15) and
    appends one `cross-kind-parent` `IntegrityEvent` per filtered child. **It does not throw**
    (T10): the edge itself is a legitimate record.
    Backed by: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "cross-kind"`
    — **the artefact, not a count**: a project saved with a `subordinate_to` edge from a `unit` to a
    `corporate` reloads without throwing, that entity's derived `parentId` is `null`, and the
    reloaded `integrityEvents` contains exactly one row with `kind: "cross-kind-parent"` naming that
    child. **§9 clause 11.**

48. **[MACHINE]** **§7 step 6.** `loadGeoPackage`'s return gains `relationships` and
    `integrityEvents`; `GeoPackageLoadResult` and `ApplyGeoPackageResultState` each gain both
    members; `applyGeoPackageResult` carries them through and `projectStateFromLoadResult` passes
    them to `setProject`.
    Command: `rg -n "relationships|integrityEvents" src/core/persistence/geopackage/types.ts src/core/persistence/geopackage/applyResult.ts`
    Expected: both names present in both interfaces in `types.ts`, and present in
    `applyGeoPackageResult`'s returned object and in `projectStateFromLoadResult`'s returned object.

49. **[MACHINE]** **T13 — a migration failure is not reported as file corruption.** The
    pass-through at `load.ts:80` also lets through messages beginning `"Hierarchy migration"`.
    Command a: `rg -n "startsWith" src/core/persistence/geopackage/load.ts`
    Expected: the catch tests both `"Unsupported schema"` and `"Hierarchy migration"`, and only a
    message matching neither is re-wrapped as `Corrupted GeoPackage or unsupported schema: ...`.
    Command b: `npx vitest run src/core/persistence/geopackage/ -t "Hierarchy migration message survives"`
    Expected: exit 0 — a forced count-assertion failure surfaces with its original message and is
    **not** prefixed `Corrupted GeoPackage`. **§9 clause 10.**
    Command c: **the migration never writes to the open GeoPackage** —
    `rg -n "\.export\(\)" src/core/persistence/geopackage/load.ts src/core/persistence/geopackage/migrateHierarchy.ts`
    Expected: **no output, exit 1** (only `save.ts` exports).

### I. `save.ts`, `types.ts`, the barrel

50. **[MACHINE]** `SaveGeoPackageOptions` gains `relationships` and `integrityEvents` as
    **required** members (Q32: every member required, `T | undefined` where absence is meaningful),
    and `saveGeoPackage` creates then writes both tables.
    Command a: `sed -n '/export type SaveGeoPackageOptions/,/^}/p' src/core/persistence/geopackage/save.ts | rg -c "\?:"` -> `0`, and the block lists ten members.
    Command b: `rg -n "createRelationshipsTable|writeRelationships|createIntegrityEventsTable|writeIntegrityEvents" src/core/persistence/geopackage/save.ts`
    Expected: four matches; each `create*` precedes its `write*`, and both `create*` calls sit with
    the other `create*Table` calls (`save.ts:59-65` at BASE), before the `DELETE FROM` block.

51. **[MACHINE]** **§9 clause 1 — round trip through a real save and reload.**
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "round-trips relationships and integrity events"`
    Expected: exit 0; a saved project's edges and events reload deep-equal, including a `metadata`
    of `{}`, a `percent`, a `null` `startDate` and an absent `exportOverride`.

52. **[MACHINE]** The barrel re-exports what the app needs and nothing stale.
    Command: `rg -n "relationships.table|integrityEvents.table|migrateHierarchy|IntegrityEvent" src/core/persistence/geopackage/index.ts`
    Expected: the new tables' read/write/create functions and the types the store and hooks import
    are exported from `./index`; no page or hook imports a deep path that the barrel already covers.

53. **[MACHINE]** `src/core/integrity/` and `src/core/relationship/` stay React-free (`CLAUDE.md`).
    Command: `rg -n "from \"react\"|useState|useEffect|useCallback" src/core/integrity/ src/core/relationship/ src/core/persistence/`
    Expected: **no output, exit 1.**

### J. Store (§4.7)

54. **[MACHINE]** `ProjectState` gains `relationships: Relationship[]` and
    `integrityEvents: IntegrityEvent[]`, both initialised to `[]` in `initialState()`.
    Command: `rg -n "relationships|integrityEvents" src/store/useProjectStore.ts | head -20`
    Expected: both in the state type and both in `initialState()`.

55. **[MACHINE]** **§9 clause 5, with the corrected count.** `setProject` requires
    `relationships`, `integrityEvents` **and** `claims`; `claims ?? []` (`useProjectStore.ts:148`)
    is gone; **all 21 call sites compile** (§1.1 — the clause's "22" is wrong; §4.7's "18" is wrong
    too, because P2 added three).
    Command a: `sed -n '/setProject(p: {/,/}): void/p' src/store/useProjectStore.ts | rg -c "\?:"` -> `0`.
    Command b: `rg -n "claims \?\? \[\]" src/store/useProjectStore.ts` -> **no output, exit 1.**
    Command c: `npm run build` exits 0 — the compiler is the enumerator (§8b lesson 5: do **not**
    grade this by `grep -c "setProject("`, which matches `resetProject(`).
    Command d: `grep -rn "setProject" src/ --include=*.ts --include=*.tsx | grep -v "resetProject" | grep -c "getState().setProject("` -> **21**.

56. **[MACHINE]** **`commitRelationships` — private, and one atomic `set`, edges and entities
    together, order pinned.**
    Command a: `rg -n "commitRelationships" src/` — the function is **not** exported and **not** on
    the `ProjectActions` interface; every relationship mutation in the store funnels through it.
    Command b: `sed -n '/function commitRelationships/,/^}/p' src/store/useProjectStore.ts | rg -c "set\("` -> **exactly 1**.
    Command c (the order pin): inside that function, the derivation
    (`activeParentMap` then `withDerivedParents`) is computed **from `next`, before** the single
    `set`, and the `set` writes `relationships` **and** `entities` in the **same object literal** —
    read `sed -n '/function commitRelationships/,/^}/p' src/store/useProjectStore.ts` and confirm
    there is no `set` between the two derivation calls and no second `set` after it.
    Command d: `npx vitest run src/store/useProjectStore.relationships.test.ts -t "single store notification"`
    Expected: exit 0 — a `useProjectStore.subscribe` listener fires **exactly once** for one
    `commitRelationships`, and the state observed by that listener already has both the new edges
    and the re-derived entities (ADR 0005 atomicity). **Counting `set` calls alone is not enough;
    the artefact is the listener seeing both halves at once.**

57. **[MACHINE]** `unacknowledgedIntegrityEvents(state)` is exported, returns only rows with no
    `acknowledgedAt`, and **does not gate `performProjectSave`**.
    Command a: `npx vitest run src/store/useProjectStore.relationships.test.ts -t "unacknowledgedIntegrityEvents"` -> exit 0.
    Command b: `rg -n "unacknowledgedIntegrityEvents" src/hooks/`
    Expected: **no output, exit 1** — blocking save on an irreplaceable working file is the wrong
    failure direction ("Decisions carried into Slice 2 and beyond", *Integrity record and
    warnings*).

58. **[MACHINE]** **§9 clause 6.** `selectPersistableSnapshot` returns both new collections and
    **drops any edge whose `fromId` or `toId` is not in `survivingEntityIds`** (the set already
    computed at `useProjectStore.ts:127` for the same class of bug on `claim.entityId`).
    Command: `npx vitest run src/store/useProjectStore.test.ts -t "drops an edge whose endpoint"`
    Expected: exit 0; the test puts an entity on an OSM layer, adds an edge to it, and asserts the
    snapshot's `relationships` excludes that edge while keeping an edge between two surviving
    entities. **The artefact:** the surviving edge is asserted present in the same test, so
    "drops everything" cannot pass.

59. **[MACHINE]** `makeState()` (`useProjectStore.test.ts:7-17`) gains `relationships: []` and
    `integrityEvents: []`; the file's nine `setProject` literals and six
    `selectPersistableSnapshot` calls compile unchanged otherwise.
    Command: `npx vitest run src/store/useProjectStore.test.ts` -> exit 0.

### K. The three write sites (T16) and the Slice 3 boundary (T14)

60. **[MACHINE]** **§9 clause 7, Q41.** `IdentityGraph` gains `relationships: Relationship[]`;
    endpoints equal to `secondaryId` become `primaryId`; edges that become self-loops are dropped
    and captured **verbatim and unnormalised** into a `merge-dropped-edge` integrity event; edges
    that become duplicates are de-duplicated; a survivor inheriting two parents ends up
    **contested**.
    Command: `npx vitest run src/core/identity/ -t "merge"`
    Expected: exit 0, with one test per clause above. **The artefact for the dropped edge:** the
    event's `detail` contains the original `(id, fromId, toId, type)` quadruple **as it was before
    re-pointing** — asserted by string equality against the pre-merge edge, so a normalised copy
    fails.

61. **[MACHINE]** `merge.ts:49` (the `parentId` re-parenting map) and `resolveParent`
    (`:88`, `:113-120`) are **deleted** — after the port they would write a derived field.
    Command: `rg -n "resolveParent|parentId: primaryId|e\.parentId === secondaryId" src/core/identity/merge.ts`
    Expected: **no output, exit 1.**
    (Exclusion note: `merge.ts` legitimately still reads `parentId` in `isDescendant` for cycle
    safety **only if** that function survives the port; if it does, this command's pattern does not
    match it, which is deliberate — the criterion targets the *writes*, not the reads.)

62. **[MACHINE]** **§9 clause 8.** `useEntityInspector.ts`'s `handleParentChange` (`:203-213` at
    BASE) sets a parent by **committing an edge**, and still forces `positionMode: "none"` when the
    parent is cleared — the coupling must survive the port.
    Command a: `sed -n '/const handleParentChange/,/^  )/p' src/modules/orbat/hooks/useEntityInspector.ts`
    Expected: read output — the parent write goes through the store's relationship action, and the
    `parentId == null && entity.positionMode === "parent"` branch still sets
    `positionMode: "none"`.
    Command b: `rg -n "updateEntity\(entity\.id, \{ parentId" src/modules/orbat/hooks/useEntityInspector.ts`
    Expected: **no output, exit 1** — no direct write to the derived field remains.
    Command c: `npx vitest run src/modules/orbat/ -t "parent"` -> exit 0, including a test that
    clearing the parent still yields `positionMode: "none"`.

63. **[MACHINE]** **§9 clause 9.** `MainLayout.tsx`'s `entityFromGeometry` (`:30`, `:39` at BASE)
    creates an entity's parent as an **edge**, not as a `parentId` literal.
    Command: `sed -n '/function entityFromGeometry/,/^}/p' src/shell/MainLayout.tsx | rg -n "parentId"`
    Expected: either no match, or a match that assigns `parentId: null` with the real parent
    committed as an edge by the caller — read the diff and confirm the edge is committed on the
    same code path that creates the entity, so the write cannot be lost at the next save.

64. **[MACHINE]** **T14 — `buildOrbat` and its callers change by zero lines**, and the Slice 3
    work is not built here.
    Command a: `git diff --stat BASE -- src/core/entity/hierarchy.ts`
    Expected: **no output** (file unchanged).
    Command b: `rg -n "hierarchyIndex|parentOf" src/`
    Expected: **no output, exit 1** — no `core/relationship/hierarchyIndex.ts`, no `Orbat.parentOf`.
    Command c: `git diff --name-only BASE -- src/ | rg -c "hierarchy"` -> `0`.

65. **[MACHINE]** **Lesson-2 order pin outside this slice's own code:** the six
    `snapshotIsAuthoritative` assignments are untouched by 2B. Their positions are load-bearing
    (2A criterion 24b, Q2A-8/11/15) and 2B edits the same functions.
    Command: `git diff BASE -- src/hooks/projectIO.ts src/hooks/projectSave.ts | rg "^[-+].*(authority\.current|snapshotIsAuthoritative)" | rg -v "^[-+]{3}"`
    Expected: **no output, exit 1.** At BASE the assignments are `projectIO.ts:109` (true, end of
    `performSessionRestore`), `:130` (false, before the stores are emptied in `performNewProject`),
    `:144` (true, after `clearProject` succeeded), `:191` (false, after the two awaits in
    `performOpenProject`), `:199` (true, before the peripheral resets), `:234` (true, after
    `performProjectSave` returned), plus the read at `:229` and the guard at `projectSave.ts:57`.

### L. Hooks wiring

66. **[MACHINE]** `ProjectSaveInput` (`projectSave.ts:18-37`) gains `relationships` and
    `integrityEvents` as **required** members, and `performProjectSave` forwards both to
    `saveGeoPackage`; `performSaveProject` (`projectIO.ts:212-243`) maps them out of
    `selectPersistableSnapshot`'s return; `performNewProject`'s direct `saveGeoPackage` call
    (`projectIO.ts:157-166`) passes both explicitly.
    Command a: `sed -n '/export interface ProjectSaveInput/,/^}/p' src/hooks/projectSave.ts | rg -c "\?:"` -> `0`, and the block lists nine members.
    Command b: `rg -n "relationships|integrityEvents" src/hooks/projectSave.ts src/hooks/projectIO.ts`
    Expected: present in the type, in the `saveGeoPackage` call inside `performProjectSave`, in
    `performSaveProject`'s destructure of the snapshot, and in `performNewProject`'s options
    literal (as `[]`, which for a new project is the correct "deliberately nothing here").
    Command c: `git diff --stat BASE -- src/hooks/useProjectIO.ts`
    Expected: **no output** — correction 1.3: that file gains nothing in 2B.

### M. The real-WASM gates — §8's load-bearing tests and §10's dry run, read-only

All of criteria 67-75 run against the **real `public/project.gpkg`, read-only**, following
`store-path.integration.test.ts:44-48`: `readFileSync` + `Uint8Array.from(fileBytes).buffer`,
60000 ms timeout, real WASM, **no mocking** (`CONSTRAINTS.md:96-102`, Prohibition 3), nothing ever
written to disk. They live in
`src/core/persistence/geopackage/migration.store-path.test.ts`.

67. **[MACHINE]** **The load-bearing gate — the actual store path.** load ->
    `projectStateFromLoadResult` -> `setProject` -> `selectPersistableSnapshot` -> save -> reload,
    then save and reload a second time.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "carries the migrated project through the store path"`
    Expected: exit 0, asserting **all** of:
    (a) the full `entityId -> parentId` map after the round trip **deep-equals** the pre-migration
    map read from the raw file — 1012 non-null entries, none extra, none missing (§10 steps 6, 13);
    (b) **1012 edges after the first reload and 1012 after the second, never 2024** (§9 clause 3,
    §10 step 18's in-memory form);
    (c) **the artefacts, not the counts (§8b lesson 3):** the reloaded edge ids are all
    `hier:`-prefixed and set-equal to `"hier:"` + each parented entity id; `readRelationships` on
    the **raw** file returns `null` while on the saved bytes it returns a non-null array; and the
    legacy `organisations` table still exists in the saved bytes
    (`tableExists(connection, ORGANISATIONS_TABLE)` — the worked example at
    `store-path.integration.test.ts:77-86`, which proves the `baseBuffer` reopen path ran);
    (d) every derived non-null `parentId` is a member of the reloaded entity id set (criterion 20).

68. **[MACHINE]** **Hash B — the assertion nobody thinks to write (§8, §10 step 7).** The
    **rendered** position map from `computeAllEntityPositions` (`src/core/map/geometry.ts:121`) over
    all 1027 entities deep-equals before and after the round trip, with **zero tolerance**.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "rendered position map is identical"`
    Expected: exit 0. On failure the test reports **how many entities moved** — a number at or below
    741 says the derivation is broken (599 `position_mode = "none"` + 142 `"parent"` derive their
    position from the parent chain). This is the only test that catches the failure mode that
    actually matters.

69. **[MACHINE]** **§10 step 9, in memory.** The migration over the real file mints **1012** edges:
    **999** `subordinate_to`, **13** `corporate_parent`, no third type, `acts_for` **0**.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "mints 1012 edges"`
    Expected: exit 0. `entitiesWithParentId` is asserted to be **1012** as well, so the count
    assertion is exercised on the real population.

70. **[MACHINE]** **§10 step 10.** `validateRelationships(minted, entityIds)` returns **0**
    violations, asserted **across all nine codes** — including **0** `multiple-active-hierarchy`,
    the hard number Q40 makes assertable.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "zero violations"`
    Expected: exit 0; the test asserts `violations` is `[]` **and** iterates
    `RELATIONSHIP_VIOLATION_CODES` asserting a count of 0 for each, so a future code addition cannot
    hide inside a bare length check.

71. **[MACHINE]** **§10 steps 11 and 12.** 1012 distinct ids, all `hier:`-prefixed, set-equal to
    `"hier:"` + each parented entity id; exactly **2** edges carry `percent`, being
    `49.9` on KAMAZ PTC (`9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39`) and `25` on JSC Kalashnikov
    Concern (`d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c`); the other 1010 have
    `metadata.percent === undefined`.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "hier ids and the two percentages"`
    Expected: exit 0.

72. **[MACHINE]** **§10 step 14.** Motovilikha -> Techmash -> Rostec asserted at **both hops**;
    Motovilikha's depth is **2**; Rostec State Corporation has exactly **12** incoming
    `corporate_parent`; roots are **15**; the four organisation roots (Rostec State Corporation,
    JSC Concern VKO Almaz-Antey, United Shipbuilding Corporation JSC (USC), JSC Tactical Missiles
    Corporation (KTRV)) have **zero** outgoing `corporate_parent`.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "the corporate chain"`
    Expected: exit 0.

73. **[MACHINE]** **§10 step 15.** Second pass in memory: 1012 edges, not 2024;
    `skippedAlreadyPresent` **1012**; `mintedEdges` **0**; the count assertion holds as
    `1012 === 0 + 1012`.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "second pass"`
    Expected: exit 0. `skippedAlreadyPresent` non-zero is the artefact that distinguishes
    "recognised the existing edges" from "did nothing".

74. **[MACHINE]** **§10 step 16.** The migration produces **exactly 1** `integrity_events` row,
    `kind: "hierarchy-migrated"`, and **zero** rejected rows; its `detail` carries the two source
    sentences from `organisations.notes` **verbatim** (`... Rostec holds c.49.9% share.` and
    `Rostec holds 25%+1 share; private majority.`), so the derivation is auditable inside the file.
    Command: `npx vitest run src/core/persistence/geopackage/migration.store-path.test.ts -t "one hierarchy-migrated event"`
    Expected: exit 0; the row survives the save/reload round trip (asserted on the **reloaded**
    events, not only the in-memory ones).

75. **[MACHINE]** **Read-only discipline.** No test writes `public/project.gpkg`, and no test leaves
    a stray `gabriel-*.gpkg` in the repo root (the `afterEach` sweep at
    `store-path.integration.test.ts:24-40` is the pattern to clone).
    Command a: `rg -n "writeFileSync|createWriteStream|public/project.gpkg" src/ | rg -v "readFileSync"`
    Expected: no write to `public/project.gpkg` anywhere under `src/`.
    Command b: after the full suite, `git status --porcelain` shows no `gabriel-*.gpkg` and no
    modification to `public/project.gpkg` (criterion 3).

### N. Scope fences — the negative criteria, with their exclusions written out

76. **[MACHINE]** **§9 clause 4 — `isHierarchyBearing` is the only definition of
    hierarchy-bearing in the tree.** The clause's own command
    (`rg -n "subordinate_to" src/core/relationship/ src/core/persistence/`) **cannot pass as
    written**: at BASE it already returns 33 lines, and 2B's own `validate.ts`, `migrateHierarchy.ts`
    and their tests legitimately add more (§8b lesson 1). The passable form is a **predicate**
    search, not a **string** search:
    Command a: `rg -n '=== "subordinate_to"|!== "subordinate_to"|=== "corporate_parent"|!== "corporate_parent"|type === RELATIONSHIP|attachment === ' src/ --glob '!*.test.ts' --glob '!*.test.tsx' --glob '!*.stories.tsx'`
    Expected: **exactly two lines, both inside `isHierarchyBearing` in
    `src/core/relationship/validate.ts`** — the `subordinate_to` test and the
    `attachment === "attached"` test. Any third line is a second predicate and fails this criterion.
    Command b: `rg -n "isHierarchyBearing" src/ --glob '!*.test.ts'`
    Expected: the definition in `validate.ts`, its use inside `countActiveOrganicParents` and the
    `multiple-active-hierarchy` branch in the same file, and its use in
    `src/core/relationship/activeParent.ts`. **No other file.**
    Command c: criterion 12 — `isActiveOrganicSubordination` is gone from the whole tree.

77. **[MACHINE]** **Nothing out of scope was built.** Each of these returns **no output, exit 1**:
    - `rg -n "relationshipId" src/core/provenance/ src/core/identity/merge.ts` — `Claim.relationshipId` is Slice 6.
    - `rg -n "ORBAT Source|orbatSource|phase0|PHASE_0" src/` — the Phase 0 ORBAT Source is Slice 6.
    - `rg -n "hierarchyIndex|parentOf" src/` — Slice 3 (criterion 64).
    - `rg -n "exportGate|export_gate" src/` — the export gate is Stage 1.5.
    - `rg -n "migrationPreview|MigrationPreview|previewMigration" src/` — a preview UI is
      **explicitly forbidden** (§10 preamble; the two fingerprints are the preview).
    - `git diff BASE -- src/core/entity/entity.ts` — no new `EntityKind` (T2), no new profile field
      (T1); expected: **empty diff**.
    - `rg -n "acts_for" src/core/persistence/ src/store/ src/hooks/` — no `acts_for` edge anywhere
      the migration can reach (criterion 36).
    - `git diff --name-only BASE -- src/ | rg "renameLayer|layers\.table|applyResult\.rehabilitation"`
      — **everything in ADR 0012 landed in P2 and is out of scope here.** `renameLayer`,
      the echelon-name rule and residual-`custom` must not be re-touched. (Exclusion: `applyResult.ts`
      **is** modified by 2B for §7 step 6, so it is deliberately absent from this pattern;
      `applyResult.rehabilitation.test.ts` is not.)
    - An unrecognised layer kind mints **no** `integrity_events` row:
      `rg -n "integrityEvent|IntegrityEvent" src/core/persistence/geopackage/applyResult.ts` returns
      only the pass-through of the load result's array, never a minting call. P2 removed the loss
      rather than recording it (§2).

78. **[MACHINE]** ADR 0011 exists, is committed **in this slice** (not trailing it), and is
    referenced from the code that implements it.
    Command a: `test -f docs/adr/0011-relationships-are-the-hierarchy.md; echo $?` -> `0`.
    Command b: `git log --oneline BASE..HEAD -- docs/adr/0011-relationships-are-the-hierarchy.md`
    Expected: at least one commit, and it is one of this slice's commits (**§9 clause 13**).
    Command c: `rg -n "ADR 0011|0011-relationships" src/` -> at least one reference from
    `migrateHierarchy.ts` or `activeParent.ts`.

### O. `[HUMAN]` — the morning-review list (these do not block the commit)

79. **[HUMAN]** **ADR 0011's prose.** It must record, in words a reader who was not here can
    follow: (a) why the retained `parent_id` column is **not** a backup — if `relationships` is
    ever empty the derived parent goes null and the column is nulled in the same save, so primary
    and backup fail together, perfectly correlated, and the real backup is the private repo's git
    history pinned at **`5b0d2ed`**; (b) why the migration has **no `kind` heuristic** — one rule
    for the 999 unit links and one id-keyed table for the 13 corporate ones, reviewable in a diff
    rather than inferred at runtime; (c) why contested children derive **`null`** rather than an
    arbitrary winner (Q40); (d) why the two percentages are **frozen literals** rather than parsed
    (T12 — the Kalashnikov note's first percentage is a 95% *market* share, and publishing
    "Rostec holds 95% of Kalashnikov" is false and defamatory).

80. **[HUMAN]** **`CONTEXT.md` glossary entries** for the terms this slice introduces —
    hierarchy-bearing edge, active parent, contested child, integrity event, the migration's
    `hier:` id shape — read as project language, not as implementation notes, and sit under the
    existing `## Language` structure (`CONTEXT.md:5`, `### Typed relationships (edges)` at `:39`).

81. **[HUMAN]** **The `hierarchy-migrated` event's `summary`** reads as **something publishable**,
    naming entities rather than ids, not as a log line. "If it reads like a stack trace it is a
    log, not a record" (§10 step 25). One sentence.

82. **[HUMAN]** The `merge-dropped-edge` and `cross-kind-parent` summaries meet the same bar, and
    the `detail` payloads capture the rejected link **verbatim at rejection time, unnormalised** —
    the original `(childId, parentId)` pair survives exactly one save otherwise, because `parentId`
    is now derived and recomputes to null ("Decisions carried into Slice 2 and beyond", *Integrity
    record and warnings*).

83. **[HUMAN]** The §1.7 file-cap debt: `useProjectStore.ts` (348 -> up to 400),
    `useProjectStore.test.ts` (371) and `useEntityInspector.ts` (301) remain over
    `CONSTRAINTS.md:113`. Prohibition 5 forbids fixing them in 2B. **The owner schedules the split**
    — the P2 run log already flags `useProjectStore.ts` as needing one, and the P1b log asks whether
    `projectSave.ts` should exist at all, which is the same question one storey down.

---

## 4. Coverage — §7, §8, §9 and §10 clause by clause

One row per clause. Where a clause is not covered, the row says **out of scope** and why
(§8b lesson 4: 2A lost its most important test to a summary sentence).

### §7 — ordering inside `load.ts`

| clause | criterion |
|---|---|
| 1. read the persisted edges and events (`:28` area) | 43 |
| 2. `:56-66` entity validation unchanged, on raw `parentId` | 44 |
| 3. the migration, gated on `persisted === null`, after `:66` | 45 |
| 4. `validateRelationships(all, entityIds)` immediately after | 46 |
| 5. derivation last, between `:76` and `:78`; T10 filter here | 47 |
| 6. the return + `ApplyGeoPackageResultState` + pass-through | 48 |
| "the migration never writes to the open GeoPackage" | 49c |
| "why throwing is right", conditions (a)-(d) | 40 (message), 49 (a, d), 65 (b — the flag stays false), 45 (c — gated on absence) |

### §8 — tests

| clause | criterion |
|---|---|
| `isHierarchyBearing` truth table (6 cases) | 13 |
| `validateRelationships` reports `multiple-active-hierarchy` for `subordinate_to` + `corporate_parent` | 14 |
| `activeParentMap`: single edge maps | 17 |
| `activeParentMap`: two competing edges -> absent + `contested` with both ids | 18 |
| `activeParentMap`: an ended edge does not compete | 17 |
| `activeParentMap`: an `attached` edge does not compete | 17 |
| `withDerivedParents`: null for unmapped, no mutation, never a parent absent from the map | 19, 20 |
| `migrateHierarchyToRelationships` idempotent on a second call | 41 |
| the count assertion throws with both numbers and the missing ids | 40 |
| the emitted type set deep-equals the two-element set | 35 |
| **the parser test (T12)** | **38** |
| `percent` domain: two edges, `{49.9, 25}`, others `undefined` | 34, 71 |
| `mergeEntities` (Q41): re-point, drop, dedupe, contested survivor | 60 |
| `selectPersistableSnapshot` carries both and drops a filtered-endpoint edge | 58 |
| `commitRelationships` single `set` — one store notification | 56 |
| `unacknowledgedIntegrityEvents` returns only unacknowledged rows | 57 |
| **real WASM, the load-bearing gate** (store path, deep-equal parent map, 1012 not 2024) | **67** |
| **the second real-WASM assertion** (rendered position map, `computeAllEntityPositions`) | **68** |

### §9 — Done when

| clause | criterion |
|---|---|
| 1. `relationships` and `integrity_events` round-trip through a real save and reload | 51, 67 |
| 2. `readRelationships` `null` for absent, `[]` for empty, a test for each | 27 |
| 3. migration gated on table absence, proven by two runs asserting 1012 both times | 45, 67b, 73 |
| 4. `isHierarchyBearing` the only definition; the `rg` shows no second predicate | **76** (the clause's own command is unpassable as written — corrected there) |
| 5. `setProject` requires `relationships`, `integrityEvents`, `claims`; "all 22 call sites" compile | 55 — **the count is 21, not 22** (§1.1) |
| 6. `selectPersistableSnapshot` drops edges with a filtered endpoint | 58 |
| 7. `mergeEntities` rewrites edges; `merge.ts:49` and `resolveParent` gone | 60, 61 |
| 8. `useEntityInspector` sets a parent by committing an edge, still forces `positionMode: "none"` | 62 |
| 9. `MainLayout.tsx:30,39` creates an entity's parent as an edge | 63 |
| 10. `load.ts:80` passes through `Hierarchy migration` unwrapped | 49 |
| 11. cross-kind edges produce a `cross-kind-parent` event and no throw | 47 |
| 12. `EDGE_VOCABULARY_VERSION` still `1.0.0`; only `isHierarchyBearing` changes under `src/core/relationship/` | 15 |
| 13. ADR 0011 committed **in this slice**, recording four specific things | 78 (machine: exists, committed here) + 79 (human: the prose) |
| 14. `public/project.gpkg` byte-identical at the end of the build | **3** |
| "Not machine-checkable": ADR prose, glossary, the `summary` sentence | 79, 80, 81 |

### §10 — the rehearsal

**The whole of §10 is the owner's procedure. This run does not execute it.** Steps 6-16 are the
"dry run, in memory, nothing written" block and are re-expressed as read-only `[MACHINE]` criteria;
everything else is out of scope by step number.

| step | ruling |
|---|---|
| 1. clean tree, starting SHA in the run log | **out of scope** — owner's pre-flight; Phase 0/6 of the loop record the SHA anyway |
| 2. `md5sum` equals `7d0b...` **and** equals `git show 5b0d2ed:public/project.gpkg` | **out of scope as a pre-flight**; the end-state half is criterion 3. The `git show` comparison is the owner's, in the rehearsal session |
| 3. `npm run verify` green | criterion 1 (it is also the stop-ship) |
| 4. a dated copy outside the repo, different volume, unsynced | **out of scope** — physical, and an agent must not copy that file |
| 5. re-run §1's integrity queries against the real file | **out of scope as a pre-flight query**, but its content is machine-covered: criterion 70 asserts zero violations across all nine codes on the real file's minted edge set, and criterion 67d asserts no dangling parent |
| 6. **Hash A** — sha256 of the sorted `entityId -> parentId` map | **[MACHINE] now**, criterion 67a — as a within-run deep-equal rather than a frozen digest. Freezing a digest here would require reading the file in Phase 1, which is forbidden; and a deep-equal reports *which* entity moved, where a digest reports only that one did |
| 7. **Hash B** — sha256 of the sorted rendered position map | **[MACHINE] now**, criterion 68, same form and same reason. This is the fingerprint nobody takes and the only one that catches the 741 |
| 8. row counts for `claims`, `sources`, `rating_events`, `geometries`, `layers`; file size | **[MACHINE] now** for the counts, inside criterion 67 (the existing gate at `store-path.integration.test.ts:93-129` already asserts claims/geometries/layers survive count-for-count; the migration gate asserts the same after migration). **File size in bytes is out of scope** — it is a property of a written file, and this run writes none |
| 9. minted 1012 = 999 + 13, no third type, `acts_for` 0 | **[MACHINE] now**, criterion 69 (+36) |
| 10. `validateRelationships` 0 violations across all nine codes | **[MACHINE] now**, criterion 70 |
| 11. 1012 distinct `hier:` ids, set-equal | **[MACHINE] now**, criterion 71 |
| 12. exactly 2 `percent`, `{49.9, 25}`, others `undefined` | **[MACHINE] now**, criterion 71 (+34) |
| 13. `activeParentMap(minted).parentById` **deep-equals** the pre-migration map | **[MACHINE] now**, criterion 67a |
| 14. Motovilikha chain both hops, depth 2, Rostec 12 incoming, roots 15, 4 org roots with no outgoing | **[MACHINE] now**, criterion 72 |
| 15. second pass in memory: 1012 not 2024, `skippedAlreadyPresent` 1012, `1012 === 0 + 1012` | **[MACHINE] now**, criterion 73 |
| 16. 1 `integrity_events` row, `hierarchy-migrated`, zero rejected | **[MACHINE] now**, criterion 74 |
| 17. save to `project-migrated-<date>.gpkg` (picker `suggestedName` is at `projectIO.ts:70`, not `useProjectIO.ts:31`) | **out of scope — owner's first write** |
| 18. reload it: 1012, not 2024; save and reload again | **out of scope as a file operation**; its in-memory equivalent is criterion 67b |
| 19. Hash A and Hash B after reload equal before, zero tolerance | **out of scope on disk**; in-memory equivalents are 67a and 68 |
| 20. `units.parent_id` still non-null on 999, organisations on 13 | **out of scope — owner's** (it inspects the written file's columns) |
| 21. the 17 `organisations.notes` byte-identical | **out of scope — owner's** |
| 22. entities 1027, units 1010, organisations 17; counts unchanged; the file grew | **out of scope — owner's** (a file that shrinks is a table that was emptied; this run writes no file) |
| 23. open the app once; Central Military District shows 31 children; a `position_mode = "parent"` unit orbits | **out of scope — owner's**, plus the run log's addition (a): a ten-minute manual workout on the migrated file — reparent, clear a parent, create under a parent, merge, save, reload |
| 24. cold reopen next morning; re-assert 1012, Hash A, Hash B | **out of scope — owner's** |
| 25. read `integrity_events` by hand; the `summary` is publishable | **out of scope as a file read**; the wording bar is criterion 81 `[HUMAN]` |
| 26. spot-check 10 units by name across depths 1-5 | **out of scope — owner's** |
| 27. `npm run verify` on a cold checkout | **out of scope — owner's**; criterion 1 covers this tree |
| 28. replace `public/project.gpkg`, keep the copy, pin `5b0d2ed` in the message | **out of scope — owner's.** Criterion 3 requires the file to be **untouched** when this build stops |
| run-log addition (b): open the out-of-repo backup once before step 9 | **out of scope — owner's** |

---

## 5. Trap coverage — T1 to T16

| trap | criterion |
|---|---|
| T1 `Entity` is a hand-mirrored flattening | 77 (`entity.ts` diff empty) |
| T2 the `EntityKind` allowlist | 77 |
| T3 `optional: true` without `fallbackSql` throws on every read | 23 |
| T4 `ensureOptionalColumns` splices `constraints` into `ALTER TABLE` | 23 (no `ensureOptionalColumns` for the new tables; both created whole) |
| T5 empty encodes `null`, decodes `undefined` | 26, 34 |
| T6 `decodeRow` assigns unconditionally — only `!= null` is safe | 32 |
| T7 NUL bytes | 2 |
| T8 plain SQLite tables, not registered GeoPackage tables | 24 |
| T9 `metadata` decodes to `{}` — `decodeAssessor`, not `decodeAliases` | 25, 31 |
| T10 an edge is not constrained to one kind, but `load.ts:60-63` is | 47 |
| T11 gated on table ABSENCE, never on id uniqueness or row count | 27, 45 |
| T12 the migration must not read `notes` | 35, 36, 37, **38** |
| T13 a migration failure is not file corruption | 40, 49 |
| T14 `activeParentMap` feeds `buildOrbat`, does not replace it | 64 |
| T15 opposite orphan policies — omission, never a dangling parent | 20, 67d |
| T16 three write sites still target the derived field | 60/61, 62, 63 |

---

## 6. Contradictions — owner must rule

**C1. Where the derivation is applied: §3 says `applyResult.ts`, §7 step 5 says `load.ts`.**
§3's file table annotates `applyResult.ts` "modified — derivation applied here". §7, the section
that exists to fix the ordering, says "**Last, between `:76` and `:78`** — apply the derivation.
`activeParentMap` then `withDerivedParents` ... Apply the T10 cross-kind filter here, where kinds
are known", and then says `applyGeoPackageResult` merely "carries them through". Re-measuring
cannot resolve this — it is internal to the spec. **Criteria 47 and 48 are written on §7's
reading** (derivation in `load.ts`, pass-through in `applyResult.ts`), because §7 is explicit,
reasoned and ordered, while §3 is a one-phrase annotation; and because deriving in
`applyGeoPackageResult` would leave `GeoPackageLoadResult.entities` carrying raw `parentId` while
the store carries derived values — two answers to one question, on the seam the slice exists to
close. **This planner is not adjudicating it** (spec §12): if the owner rules for §3, criteria 47
and 48 are the ones to record as failed and re-plan. Nothing else in this file depends on the
choice.

**C2. §9 clause 4's own command cannot pass.** `rg -n "subordinate_to" src/core/relationship/
src/core/persistence/` returns **33 lines at BASE** and necessarily returns more after 2B, because
the positive criteria require the string in `validate.ts` and `migrateHierarchy.ts`. Recorded, not
adjudicated: criterion 76 states the passable predicate-scoped form and says so explicitly. If the
owner wants the clause's literal command to be the gate, the clause is unsatisfiable and the slice
stops.

**C3. `claims` becoming required goes one step beyond the carried decisions.** §4.7 says so itself
and offers the revert ("If the owner disagrees, revert this one field; nothing else in the spec
depends on it"). Criterion 55 requires it. Flagged so the owner sees the choice rather than
inherits it.

**C4 (not a contradiction, a numbers correction the owner should see).** §9 clause 5 says 22 call
sites, §4.7 says 18, the tree says **21**. §4.7 says `selectPersistableSnapshot` has 8, the tree
says **9**. Both corrected in §1; criteria 55 and 59 use the measured figures.

---

## 7. Phase 2 task decomposition

Phase 2 spawns one coding agent per task. **Coding agents write no tests** (Phase 3 does) and do
not give the verify verdict (Phase 4 does). Every agent gets: its task, the criteria listed for it,
the spec's trap list, and the rule that a guess is recorded in
`docs/timelines/SLICE_2B_OPEN_QUESTIONS.md` rather than made (Prohibition 7).

**Wave 1 — fully disjoint, run in parallel.**

| task | files | criteria |
|---|---|---|
| **A. IntegrityEvent** | `src/core/integrity/integrityEvent.ts` (new dir) | 7, 8, 9, 10 |
| **B. isHierarchyBearing (Q39)** | `src/core/relationship/validate.ts` | 11, 12, 14, 15, 76 |
| **E. The migration** | `src/core/persistence/geopackage/migrateHierarchy.ts` (imports A's type only) | 33-42, 36, 37 |
| **K. Docs** | `docs/adr/0011-relationships-are-the-hierarchy.md`, `CONTEXT.md` | 78, 79, 80 |

**Wave 2 — each depends on a Wave 1 task; C and D are disjoint from each other.**

| task | files | depends on | criteria |
|---|---|---|---|
| **C. The derivation** | `src/core/relationship/activeParent.ts` (new) | B (`isHierarchyBearing`) | 16-21, 53 |
| **D. The two tables** | `relationships.table.ts`, `integrityEvents.table.ts` (new) | A (the `IntegrityEvent` type) | 22-32, 53 |

**Wave 3 — the persistence seam. F and G touch different files but share `types.ts`/`index.ts`;
F owns both, G rebases on F.**

| task | files | depends on | criteria |
|---|---|---|---|
| **F. load + types + barrel** | `load.ts`, `types.ts`, `index.ts`, `applyResult.ts` | C, D, E | 43-49, 52, 77 (the `applyResult` exclusion) |
| **G. save** | `save.ts` | D, F | 50, 23 (no `ensureOptionalColumns`), 24 |

**Wave 4 — the store. Single agent: `useProjectStore.ts` is one file and three concerns, and the
21 compile-forced call sites all break at once.**

| task | files | depends on | criteria |
|---|---|---|---|
| **H. Store** | `useProjectStore.ts`; the 21 `setProject` call sites (5 stories, `useProjectStore.test.ts`, `useProjectStore.renameLayer.test.ts`, `store-path.integration.test.ts`, `layer-rehabilitation.store-path.test.ts`, `projectIO.ts` x2, `ViewPage.tsx`); `makeState` | A, C | 5, 54-59 |

**Wave 5 — the consumers. I and J are disjoint; both need H.**

| task | files | depends on | criteria |
|---|---|---|---|
| **I. The three write sites (T16)** | `src/core/identity/merge.ts`, `src/modules/orbat/hooks/useEntityInspector.ts`, `src/shell/MainLayout.tsx` | H | 6, 60, 61, 62, 63, 64 |
| **J. Hooks wiring** | `src/hooks/projectSave.ts`, `src/hooks/projectIO.ts` | F, G, H | 65, 66 |

**Sequencing notes for the orchestrator.**

- **A -> D and A -> E** are type-only dependencies; **B -> C** is a function dependency.
- **Nothing in Waves 1-2 touches a file another Wave 1-2 task touches.** Wave 3 onward is
  sequential on the seam.
- **I must come after H**, not beside it: all three write sites need the store action that commits
  an edge, and `useEntityInspector.ts` is at 301 lines (criterion 6) so the port must be minimal.
- **J must come after F and G**, because `ProjectSaveInput`'s new members are the pre-image of
  `SaveGeoPackageOptions`' new members and the compile error is the enumerator.
- `src/hooks/useProjectIO.ts`, `src/pages/ViewPage.tsx` and `src/core/entity/hierarchy.ts` are
  expected to be **untouched** (criteria 66c, 64a, and correction 1.3). An agent that finds itself
  editing one of them has misread the tree and should stop.
- **Nobody edits `public/project.gpkg`, and nobody runs §10.** Criterion 3 is checked before the
  commit.
