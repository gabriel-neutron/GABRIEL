# Success Criteria — Slice 2A (safety scaffolding only)

**Frozen at:** HEAD `c8483b5`. Written in Phase 1 by the planning agent.
**Authority:** the section "Decisions carried into Slice 2 and beyond — do not re-open" in
`docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` (lines 506-641), specifically its
"Ordering and safety in Slice 2" subsection (lines 587-604). There is **no Slice 2 build
spec**. Where that section is silent, it is silent — `GABRIEL_V2_FOUNDATION_SPEC.md` is
superseded and is not a fallback.

**This file is frozen.** No later agent may edit, weaken, reword or delete an entry. A
failing criterion is a result to report, not a line to change (SLICE_BUILD_LOOP.md,
Prohibition 2). If a criterion turns out to be unsatisfiable or to contradict the spec:
record it and STOP. That judgement is the owner's.

All commands are run from the repo root in Git Bash unless stated otherwise.
`BASE` below means the commit `c8483b5`.

---

## 0. Reconnaissance — the real numbers this contract is built on

Verified by reading the files at `c8483b5`. Recorded so no later agent rediscovers them,
and so the grader can check the call-site *set* rather than a count.

### 0.1 `saveGeoPackage` today

Declared at `src/core/persistence/geopackage/save.ts:29-41` with **eight positional
parameters**, five of them optional trailing:

| # | name | type | optional |
|---|---|---|---|
| 1 | `layers` | `GpkgLayer[]` | no |
| 2 | `entities` | `GpkgEntity[]` | no |
| 3 | `geometries` | `GpkgGeometry[]` | no |
| 4 | `researchSources` | `Map<string, string>` | yes |
| 5 | `baseBuffer` | `ArrayBuffer` | yes |
| 6 | `sources` | `GpkgSource[]` | yes |
| 7 | `claims` | `GpkgClaim[]` | yes |
| 8 | `ratingEvents` | `GpkgRatingEvent[]` | yes |

Every one of the eight is wired to a table write inside `save.ts`:
`researchSources` -> `writeSourceCache` (`save.ts:71`, preceded by an unconditional
`DELETE FROM research_sources` at `:68`), `layers` -> `writeLayers` (`:73`),
`entities` -> `writeEntities` (`:75`), `geometries` -> `writeGeometries` (`:77`),
`sources` -> `writeProvenanceSources` (`:84`), `claims` -> `writeProvenanceClaims` (`:85`),
`ratingEvents` -> `writeRatingEvents` (`:86`), `baseBuffer` -> the reopen branch (`:44-48`).
The last three self-clear before inserting and are called unconditionally with `?? []`
(`save.ts:79-86`), which is exactly the documented "wipe on omit" behaviour. **Omission is
therefore destructive for six of the eight, and is what this task exists to make impossible.**

### 0.2 Every `saveGeoPackage` call site — the complete set (16)

Produced by `rg -n "saveGeoPackage\(" src/` at BASE and read individually to exclude
imports, the declaration, mock definitions and prose mentions.

| # | file | line at BASE | args passed today |
|---|---|---|---|
| 1 | `src/hooks/useProjectIO.ts` | 84 | 8 (via `deps.saveGeoPackage`, inside `performProjectSave`) |
| 2 | `src/hooks/useProjectIO.ts` | 175 | 5 (`handleNew`: layers, `[]`, `[]`, `undefined`, seedBuffer) |
| 3 | `src/core/persistence/geopackage/geopackage.service.test.ts` | 62 | 4 |
| 4 | `src/core/persistence/geopackage/geopackage.service.test.ts` | 130 | 4 (4th is a literal `undefined`) |
| 5 | `src/core/persistence/geopackage/geopackage.service.test.ts` | 184 | 3 |
| 6 | `src/core/persistence/geopackage/geopackage.service.test.ts` | 289 | 3 |
| 7 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 68 | 5 |
| 8 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 102 | 5 |
| 9 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 128 | 5 |
| 10 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 151 | 7 |
| 11 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 164 | 7 |
| 12 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 205 | 7 |
| 13 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 231 | 8 |
| 14 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 264 | 8 |
| 15 | `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | 281 | 5 |
| 16 | `src/core/persistence/geopackage/project-open-save-restore.integration.test.ts` | 45 | 4 |

**Correction to the handoff brief:** it states 8 call sites in
`project-gpkg-fixture.test.ts`. There are **9** (rows 7-15 above). The stated total of 16
is correct; the per-file split is 2 / 4 / 9 / 1.

Two further sites are not calls but must convert with them:

| # | file | line at BASE | what |
|---|---|---|---|
| T1 | `src/hooks/useProjectIO.ts` | 63-72 | `ProjectSaveDeps.saveGeoPackage` — the injected **function type**, 8 positional params |
| T2 | `src/hooks/useProjectIO.save-ordering.test.ts` | 24-27 | the `vi.fn` mock satisfying T1 |

Sites 7-9, 12 and 15 pass `baseBuffer` positionally with placeholders in front of it —
those are the dangerous ones the options object removes.

### 0.3 `src/hooks/useProjectIO.ts` (242 lines at BASE)

| what | lines |
|---|---|
| `ProjectSaveInput` | 51-59 |
| `ProjectSaveDeps` (incl. the positional `saveGeoPackage` type) | 61-75 |
| `performProjectSave` | 82-98 |
| `deps.loadProject()` inside it | 83 |
| `deps.saveGeoPackage(...)` inside it | 84-93 |
| `restoreSession` effect | 106-136 |
| **duplicated project-state literal A** (`setProject({...})` in `restoreSession`) | **114-120** |
| **the load catch that leaves the store at `initialState()`** | **128-132** |
| `handleNew` | 147-185 |
| `handleOpen` | 187-215 |
| **duplicated project-state literal B** (`setProject({...})` in `handleOpen`) | **194-200** |
| `handleSave` | 217-239 |

Literals A and B are byte-identical five-field objects
(`layers` / `entities` / `drawnGeometries` from `next`, `claims` from `result`,
`selectedEntityId` from `next`), each preceded by an identical
`const next = applyGeoPackageResult(result, null)` at `:113` and `:193`.

### 0.4 What "never successfully loaded" is detectable from

There is **no existing flag** that distinguishes it. Verified:

- `restoreSession`'s catch (`:128-132`) sets the hook-local `error` and returns; it does
  not touch the store, which stays at `initialState()` (`useProjectStore.ts:45-54`) —
  default echelon layers + Industry, `entities: []`, `drawnGeometries: []`, `claims: []`.
- The hook-local `error` is **not** usable: `handleSave` calls `setError(null)` at
  `useProjectIO.ts:225` before saving, and `error` is set by unrelated failures too.
  It is also not visible to `performProjectSave`, which is a module-level function.
- `restoredFromSession` is **not** usable: `handleOpen` never sets it, and the effect at
  `:138-145` auto-clears it after 4 seconds.
- `useProjectStore` carries no "loaded" field and **must not gain one** (Prohibition 5 —
  `useProjectStore.ts` is 343 lines against a 300 cap and is out of bounds).

What `performProjectSave` *does* already have is the result of `deps.loadProject()`
(`:83`) and the whole `ProjectSaveInput`. The failed-restore state is exactly:
**a non-empty persisted session buffer exists on disk, while the in-memory snapshot is
empty in all four data dimensions.** That is derivable with no new flag, no store change
and no new plumbing. Criterion 24 pins it. The judgement call and its residual
false-positive are recorded as Q33 in `SLICE_0_1_OPEN_QUESTIONS.md`.

### 0.5 File sizes at BASE (300-line cap, `CONSTRAINTS.md:113`)

| file | lines | note |
|---|---|---|
| `src/core/persistence/geopackage/save.ts` | 101 | room |
| `src/hooks/useProjectIO.ts` | 242 | room |
| `src/hooks/useProjectIO.save-ordering.test.ts` | 79 | room |
| `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | **299** | one line under the cap |
| `src/core/persistence/geopackage/geopackage.service.test.ts` | **321** | **already over — pre-existing violation** |
| `src/core/persistence/geopackage/project-open-save-restore.integration.test.ts` | 67 | room |

There is no `max-len` ESLint rule and no Prettier config in this repo (verified: no
`.prettierrc*`, no `prettier.config.*`, no `max-len` in `eslint.config.js`), so a converted
call site may stay on one line where it already was. See criteria 19-21 and Q35.

### 0.6 `public/project.gpkg` at BASE

`md5 = 7d0b0e592a1128a0d83e7575110bf2dc`. Several tests load it. It is never written.

---

## 1. Task 1 — convert `saveGeoPackage` to an options object

Spec ordering item 1 (`GABRIEL_V2_SLICE_0_1_BUILD.md:589-591`).

### 1.1 The signature

1. **[MACHINE]** `src/core/persistence/geopackage/save.ts` exports a named type
   `SaveGeoPackageOptions`, and `saveGeoPackage` takes exactly one parameter of that type
   and still returns `Promise<Uint8Array>`.
   Command: `rg -n "export type SaveGeoPackageOptions|export async function saveGeoPackage" src/core/persistence/geopackage/save.ts`
   Expected: two matches; the second is `export async function saveGeoPackage(options: SaveGeoPackageOptions): Promise<Uint8Array> {`
   (the parameter may be destructured in place, e.g. `{ layers, entities, ... }: SaveGeoPackageOptions`,
   but the annotation must be the named type — an inline object-literal type fails this criterion,
   because criterion 8 needs one place for Slice 2B to extend).

2. **[MACHINE]** `SaveGeoPackageOptions` declares **exactly these eight members and no
   others**, with these names: `layers`, `entities`, `geometries`, `researchSources`,
   `baseBuffer`, `sources`, `claims`, `ratingEvents`. The names are the BASE parameter
   names, unchanged — no renaming (in particular `researchSources` does **not** become
   `sourceCache`; that is `ProjectSaveInput`'s name for it and the mapping at criterion 14
   is a real risk spot).
   Command: `rg -n "^\s+(layers|entities|geometries|researchSources|baseBuffer|sources|claims|ratingEvents)\??:" src/core/persistence/geopackage/save.ts`
   Expected: exactly 8 matching lines, one per name.

3. **[MACHINE]** The member **types** are unchanged from the BASE parameter list in §0.1:
   `GpkgLayer[]`, `GpkgEntity[]`, `GpkgGeometry[]`, `Map<string, string>`, `ArrayBuffer`,
   `GpkgSource[]`, `GpkgClaim[]`, `GpkgRatingEvent[]` (each of the last five unioned with
   `undefined` per criterion 4).
   Command: `sed -n '/export type SaveGeoPackageOptions/,/^}/p' src/core/persistence/geopackage/save.ts`
   Expected: read output; each of the eight carries the type above.

4. **[MACHINE]** **Every one of the eight is a REQUIRED property.** None carries a `?`.
   The five that can be legitimately absent (`researchSources`, `baseBuffer`, `sources`,
   `claims`, `ratingEvents`) are typed `T | undefined`, so a call site that means "nothing
   here" must write the word `undefined` and a call site that *forgets* gets a compile error.
   Command: `sed -n '/export type SaveGeoPackageOptions/,/^}/p' src/core/persistence/geopackage/save.ts | rg -c "\?:"`
   Expected: `rg` exits 1 and prints `0` — zero optional members.

   **Reasoning, recorded here because it is a judgement call (also filed as Q32).**
   The spec's stated complaint is "eight positional params where omission silently wipes a
   table". Naming the params fixes wrong-slot bugs but not omission; only requiredness makes
   omission a compile error, which is the whole point of ordering item 1 being a separate
   commit "before any migration code". The same document's ordering item 2 applies the
   identical remedy to the store — "Make `relationships` and `integrityEvents` **required**
   on `setProject` ... Turns 'forgot a call site' into a compile error ... highest-value
   change in the slice" (`:592-595`) — and states the principle plainly at `:571-572`: "An
   optional record field a call site forgets is a record that silently does not exist."
   Requiredness here is the same ruling applied to the save side.
   *Why `T | undefined` and not a bare required `T`:* `baseBuffer` has no meaningful empty
   value, and the regression test at call site 15 exists precisely to exercise the
   "omits sources/claims/ratingEvents entirely" shape. `T | undefined` keeps that shape
   expressible and visible in a diff, while still failing to compile if the key is dropped.
   *Cost, accepted:* every call site grows by the members it previously omitted. Criteria
   19-21 bound the file-size fallout.
   *If the owner rules the other way,* the change is mechanical: add `?` to the five and
   delete the explicit `undefined`s. Criterion 4 is the only one that must then be recorded
   as failed — do not edit it.

5. **[MACHINE]** A compile-time proof that omission is an error lives in a **new** file
   `src/core/persistence/geopackage/save.options.test.ts`, in a test named exactly
   `makes omitting a table's option a compile error`. It declares a `SaveGeoPackageOptions`
   value missing `ratingEvents` under a `// @ts-expect-error` comment (and does **not**
   invoke `saveGeoPackage` — no WASM in this test).
   Command: `npx vitest run src/core/persistence/geopackage/save.options.test.ts`
   Expected: exit 0, the named test passes.
   Command: `npx tsc -b`
   Expected: exit 0. (If any of the eight were made optional, `tsc` would report
   `Unused '@ts-expect-error' directive` and exit non-zero — that is the criterion's teeth.)

6. **[MACHINE]** `saveGeoPackage`'s **runtime behaviour is unchanged**: the body still
   creates the same seven tables, runs the same four `DELETE FROM` statements plus
   `clearLegacyOrganisationsTable`, calls the same three `ensureOptionalColumns`, and still
   calls `writeProvenanceSources` / `writeProvenanceClaims` / `writeRatingEvents`
   unconditionally with `?? []`.
   Command: `git diff BASE -- src/core/persistence/geopackage/save.ts | rg "^-" | rg -v "^---" | rg -v "^-\s*(\*|//|/\*)"`
   Expected: the only removed **code** lines are the parameter list (`save.ts:29-41`) and
   nothing else. No removed line contains `write`, `create`, `DELETE`, `ensureOptional`,
   `export()` or `close()`.

7. **[MACHINE]** `SaveGeoPackageOptions` is re-exported from the package barrel so
   `useProjectIO.ts` can type its dependency against it.
   Command: `rg -n "SaveGeoPackageOptions" src/core/persistence/geopackage/index.ts`
   Expected: at least one match, exporting the type from `./save`.

8. **[MACHINE]** **Room for the two incoming fields, without adding them now.** No added
   code line anywhere in `src/` mentions `relationships`, `integrityEvents` or
   `integrity_events`. Scoped to the diff, comment lines excluded (a tree-wide grep is
   defeated by ordinary JSDoc prose — this shape has broken a frozen criterion in each of
   the last two slices).
   Command: `git diff BASE -- src/ | rg "^\+" | rg -v "^\+\+\+" | rg -v "^\+\s*(\*|//|/\*)" | rg "relationships|integrityEvents|integrity_events"`
   Expected: no output, `rg` exits 1.
   The "room" is structural, not textual: criterion 1 requires a named, exported,
   single-declaration-site type, so Slice 2B adds two members in one place and criterion 4's
   requiredness turns every un-updated call site into a compile error.

### 1.2 Every call site converted

9. **[MACHINE]** No positional `saveGeoPackage` call survives anywhere in `src/`. Every
   call passes exactly one argument, an object literal. `save.ts` is excluded because it
   holds the *declaration*, whose parameter is `options: SaveGeoPackageOptions` and would
   match the pattern; the declaration is pinned separately by criterion 1.
   Command: `rg -n --multiline --multiline-dotall "saveGeoPackage\(\s*[^{)]" src/ -g "!src/core/persistence/geopackage/save.ts"`
   Expected: no output, `rg` exits 1. (The only permitted characters after the open paren
   are whitespace then `{`, or a closing paren for a zero-arg mock declaration.)
   Measured at BASE this same command returns 23 output lines covering all 16 call sites of
   §0.2 — so it is known to have teeth, not merely to be vacuously satisfiable.

10. **[MACHINE]** All 16 call sites in §0.2 are converted — the **set**, not a count. For
    each of the four files, the number of `saveGeoPackage({` occurrences equals the number
    of rows §0.2 gives it.
    Command: `rg -c --multiline "saveGeoPackage\(\s*\{" src/hooks/useProjectIO.ts src/core/persistence/geopackage/geopackage.service.test.ts src/core/persistence/geopackage/project-gpkg-fixture.test.ts src/core/persistence/geopackage/project-open-save-restore.integration.test.ts`
    Expected: `useProjectIO.ts:2`, `geopackage.service.test.ts:4`,
    `project-gpkg-fixture.test.ts:9`, `project-open-save-restore.integration.test.ts:1`.
    If `project-gpkg-fixture.test.ts` was split under criterion 20, the 9 may be spread
    across the split files and their sum must be 9.

11. **[MACHINE]** `ProjectSaveDeps.saveGeoPackage` (site T1, `useProjectIO.ts:63-72`) is
    the options form: a single parameter typed `SaveGeoPackageOptions`, returning
    `Promise<Uint8Array>`.
    Command: `sed -n '/export interface ProjectSaveDeps/,/^}/p' src/hooks/useProjectIO.ts`
    Expected: the `saveGeoPackage` member reads
    `saveGeoPackage: (options: SaveGeoPackageOptions) => Promise<Uint8Array>` and no longer
    lists `layers`/`entities`/`geometries`/`researchSources`/`baseBuffer`/`sources`/`claims`/`ratingEvents`
    as separate parameters.

12. **[MACHINE]** `handleNew` (site 2, `useProjectIO.ts:175`) preserves its BASE behaviour
    exactly: layers from `gpkgLayers`, empty entities and geometries, no research sources,
    `seedBuffer ?? undefined` as `baseBuffer`, and **explicit `undefined` for `sources`,
    `claims` and `ratingEvents`** (which is what the positional call meant, and is what
    keeps the New-Project wipe behaviour the regression test at site 15 guards).
    Command: `rg -n -A 12 "const bytes = await saveGeoPackage\(\{" src/hooks/useProjectIO.ts`
    Expected: the `handleNew` occurrence lists all eight keys, with
    `baseBuffer: seedBuffer ?? undefined`, `entities: []`, `geometries: []`, and
    `researchSources`/`sources`/`claims`/`ratingEvents` each `undefined`.

13. **[MACHINE]** No call site changed the *value* it passes for any field. Every option
    value is the same expression that occupied the corresponding position at BASE.
    Command: `git diff BASE -- src/core/persistence/geopackage/geopackage.service.test.ts src/core/persistence/geopackage/project-gpkg-fixture.test.ts src/core/persistence/geopackage/project-open-save-restore.integration.test.ts`
    Expected: read the diff. Every changed hunk is a call-site rewrite. **No `expect(...)`
    line is added, removed or altered in any of the three files**, and no `it(` title
    changes. (Mechanical conversion only — Phase 2 coding agents do not author assertions.)

14. **[MACHINE]** `performProjectSave` (site 1) maps its input to the options correctly,
    including the two renames that are the likeliest silent bug:
    `input.sourceCache -> researchSources` and `existing?.buffer -> baseBuffer`.
    Pinned behaviourally by criterion 32.

### 1.3 Behavioural equivalence — every table still written

The refactor that compiles, passes most tests and destroys data is the one that quietly
drops a field. These criteria prove each of the eight still reaches disk.

15. **[MACHINE]** A **new** file `src/core/persistence/geopackage/save.options.roundtrip.test.ts`
    contains a test named exactly
    `round-trips every one of the eight save options through one reopen-and-save`,
    with a 60000 ms timeout, using **real WASM and the real `public/project.gpkg`**
    (read-only — `readFileSync` only; no mocking of the GeoPackage layer,
    `CONSTRAINTS.md:96-102`). It performs one `saveGeoPackage` call in which **all eight
    options are supplied non-vacuously**, reloads the bytes, and asserts, one assertion per
    option:
    - `layers` — the reloaded layer count equals the count passed in;
    - `entities` — the reloaded entity count equals the count passed in, **and** a marker
      value set on exactly one entity before the save survives on exactly that entity;
    - `geometries` — the reloaded geometry count equals the count passed in;
    - `researchSources` — a marker key/value put in the passed `Map` is present in the
      reloaded `sourceCache`;
    - `sources` — the reloaded source count equals the count passed in;
    - `claims` — the reloaded claim count equals the count passed in;
    - `ratingEvents` — the reloaded `ratingEvents` deep-equals the single synthetic event
      passed in;
    - `baseBuffer` — the saved bytes, reopened with `GeoPackageAPI`, still carry a legacy
      `organisations` table. This is decisive: `clearLegacyOrganisationsTable`
      (`organisations.table.ts:124-127`) empties that table but never drops it, and a
      package created without a `baseBuffer` never creates it at all — so its presence
      proves the reopen branch (`save.ts:44-45`) ran on the passed buffer.
    Command: `npx vitest run src/core/persistence/geopackage/save.options.roundtrip.test.ts`
    Expected: exit 0, the named test passes, 8 groups of assertions all green.

16. **[MACHINE]** The pre-existing round-trip coverage still passes unchanged in substance
    after conversion — these are the tests that would go red if a field were dropped:
    Command: `npx vitest run src/core/persistence/geopackage/project-gpkg-fixture.test.ts src/core/persistence/geopackage/geopackage.service.test.ts src/core/persistence/geopackage/project-open-save-restore.integration.test.ts`
    Expected: exit 0. Every test present at BASE is still present and passing; in
    particular, by name:
    - `round-trips losslessly: re-saving and reloading preserves every entity, geometry, and layer`
    - `persists merge aliases through a reopen-and-save against the real pre-E3 fixture (ADR 0006, E3)`
    - `persists external ids through a reopen-and-save against the real pre-Slice-1 fixture`
    - `derives Source/Claim provenance from the real fixture's legacy sources strings, and a double round-trip doesn't duplicate them (ADR 0006, E2 Slice A)`
    - `adds reliability_meta/credibility_meta to a reopened pre-feature fixture via ensureOptionalColumns, and a rating survives the round-trip`
    - `adds rating_events to a reopened pre-Phase-4 fixture, and the audit trail survives the round-trip`
    - `wipes provenance_sources/provenance_claims/rating_events when a later save omits them, reusing a buffer that previously had rows (Fix 6 regression)`
    - `saveGeoPackage -> loadGeoPackage round-trips entities, geometries, and source cache`
    - `saveGeoPackage -> loadGeoPackage round-trips corporate entities (kind: 'corporate')`

17. **[MACHINE]** No test was deleted or skipped to reach green.
    Command: `npx vitest run 2>&1 | rg "Tests\s+"`
    Expected: the passing count is **>= 502** and the skipped count is 0. (BASE is 63 test
    files / 502 tests.)
    Command: `git diff BASE -- src/ | rg "^\+" | rg "\.skip\(|\.todo\(|it\.only|describe\.only"`
    Expected: no output.

18. **[MACHINE]** `npm run verify` is green on the final tree.
    Command: `npm run verify`
    Expected: exit 0 — `eslint` clean, `vitest run --coverage` green with coverage
    thresholds met (lines 12 / branches 9 / functions 9 / statements 12), `tsc -b && vite build`
    clean.

### 1.4 File-size fallout of the conversion

19. **[MACHINE]** No file under `src/` that was **at or under** 300 lines at BASE ends this
    run over 300 lines.
    Command: `git diff --name-only BASE -- src/ | while read f; do [ -f "$f" ] && n=$(wc -l < "$f"); o=$(git show BASE:"$f" 2>/dev/null | wc -l); [ "${o:-0}" -le 300 ] && [ "$n" -gt 300 ] && echo "$f $o -> $n"; done; git status --porcelain -- src/ | rg "^\?\?" | sed "s/^?? //" | while read f; do n=$(wc -l < "$f"); [ "$n" -gt 300 ] && echo "NEW $f $n"; done`
    Expected: no output.

20. **[MACHINE]** Specifically, `src/core/persistence/geopackage/project-gpkg-fixture.test.ts`
    (299 lines at BASE) ends **<= 300 lines**, or is split by concern into files each
    <= 300 lines, with the split stated in the agent's report.
    Command: `wc -l src/core/persistence/geopackage/project-gpkg-fixture.test.ts`
    Expected: <= 300. If the file was split, every resulting file is <= 300 and the union of
    their `saveGeoPackage({` occurrences is 9 (criterion 10).

21. **[MACHINE]** `src/core/persistence/geopackage/geopackage.service.test.ts` was **321
    lines at BASE — already over the cap.** It is a pre-existing violation:
    Prohibition 5 says record it and move on, so it is **not** split and **not** "fixed" in
    this slice, even though the conversion will grow it. Its growth is recorded, not gated.
    Command: `wc -l src/core/persistence/geopackage/geopackage.service.test.ts`
    Expected: report the number. **No threshold — this criterion cannot fail on size.** It
    fails only if the file was split or otherwise restructured beyond call-site conversion:
    Command: `git diff BASE --stat -- src/core/persistence/geopackage/geopackage.service.test.ts && git status --porcelain -- src/core/persistence/geopackage/ | rg "geopackage\.service.*\.test\.ts"`
    Expected: exactly one changed file, no new sibling split file. See Q35.

---

## 2. Task 2 — a failed load must not arm a destructive save

Spec ordering item 3 (`GABRIEL_V2_SLICE_0_1_BUILD.md:596-599`): "Guard inside
`performProjectSave` (single chokepoint, already dependency-injected). ~6 lines."

22. **[MACHINE]** The guard lives **inside `performProjectSave`** in
    `src/hooks/useProjectIO.ts`, after `deps.loadProject()` and before
    `deps.saveGeoPackage(...)`. No other file gains a guard.
    Command: `git diff BASE --name-only -- src/`
    Expected: the guard hunk appears only in `src/hooks/useProjectIO.ts`
    (`git diff BASE -- src/hooks/useProjectIO.ts` shows the added lines between the
    `loadProject` call and the `saveGeoPackage` call).

23. **[MACHINE]** **No new flag on the store, and no store change at all.**
    Command: `git diff --stat BASE -- src/store/`
    Expected: empty output.
    Command: `git diff BASE -- src/hooks/useProjectIO.ts | rg "^\+" | rg -v "^\+\s*(\*|//)" | rg "useProjectStore\.getState\(\)\.set|loaded:|hasLoaded|loadFailed"`
    Expected: no output. (The guard derives its answer from data `performProjectSave`
    already receives — see §0.4.)

24. **[MACHINE]** **The guard condition, pinned.** `performProjectSave` refuses when *both*
    hold:
    - `deps.loadProject()` resolved to a project whose `buffer.byteLength > 0` — i.e. there
      is something real on disk to destroy; **and**
    - the in-memory snapshot is empty in all four data dimensions:
      `input.entities.length === 0 && input.geometries.length === 0 && input.claims.length === 0 && input.sources.length === 0`.

    That conjunction is exactly the failed-restore state (§0.4) and nothing else the app
    can reach by a normal path: `handleNew` calls `clearProject()` (`useProjectIO.ts:162`)
    before its save, so `loadProject()` returns `null` for a genuinely new empty project and
    the guard stays silent. The four-way emptiness (rather than entities alone) narrows the
    false-positive surface without weakening the true positive, since a failed restore
    leaves all four empty. Residual false positive — a user who deliberately empties a real
    project and saves — is recorded as Q33 for an owner ruling. Do not "fix" it here.
    Command: `sed -n '/export async function performProjectSave/,/^}/p' src/hooks/useProjectIO.ts`
    Expected: read output; the condition matches the above.

25. **[MACHINE]** The refusal **throws** (so `handleSave`'s existing catch surfaces it via
    `setError`, `useProjectIO.ts:232-235`) with a message matching `/refusing to overwrite/i`.
    The wording is a planner choice, recorded as Q33.
    Command: `rg -ni "refusing to overwrite" src/hooks/useProjectIO.ts`
    Expected: exactly one match, inside `performProjectSave`.

26. **[MACHINE]** **The refusal is observable.** `src/hooks/useProjectIO.save-ordering.test.ts`
    contains a test named exactly
    `refuses to save an empty snapshot over an existing non-empty session buffer`
    which asserts **all** of:
    - `await expect(performProjectSave(...)).rejects.toThrow(/refusing to overwrite/i)`;
    - `expect(deps.saveGeoPackage).not.toHaveBeenCalled()`;
    - `expect(deps.writeGeoPackageToFile).not.toHaveBeenCalled()`;
    - `expect(deps.saveProject).not.toHaveBeenCalled()`;
    - `expect(calls).toEqual(["loadProject"])`.
    Command: `npx vitest run src/hooks/useProjectIO.save-ordering.test.ts -t "refuses to save an empty snapshot"`
    Expected: exit 0, 1 test passed.

27. **[MACHINE]** The guard does **not** fire when there is nothing to destroy. Two tests,
    named exactly:
    - `saves an empty snapshot when there is no persisted session buffer` — `loadProject`
      resolves `null`; asserts `deps.saveGeoPackage` **was** called once and the promise
      resolves;
    - `saves an empty snapshot when the persisted session buffer is empty` — `loadProject`
      resolves a buffer of `byteLength === 0`; same assertions.
    Command: `npx vitest run src/hooks/useProjectIO.save-ordering.test.ts -t "saves an empty snapshot"`
    Expected: exit 0, 2 tests passed.

28. **[MACHINE]** The guard does not fire when any one of the four dimensions is non-empty.
    A test named exactly
    `does not refuse when the snapshot carries claims or sources but no entities`
    asserts `deps.saveGeoPackage` was called once.
    Command: `npx vitest run src/hooks/useProjectIO.save-ordering.test.ts -t "does not refuse when the snapshot carries"`
    Expected: exit 0, 1 test passed.

29. **[MACHINE]** The four **pre-existing** tests in
    `src/hooks/useProjectIO.save-ordering.test.ts` still exist and pass, with their
    assertions unchanged except for criterion 33's replacement. Their shared fixture
    `makeInput()` (`:4-13`) returns `entities: []` at BASE while `makeDeps()` (`:17`) hands
    back a 4-byte buffer, so **the guard would fire on all four unless `makeInput()` gains
    at least one entity** — it must, and that is a fixture correction, not a weakening.
    Command: `npx vitest run src/hooks/useProjectIO.save-ordering.test.ts`
    Expected: exit 0; the following tests all present and passing:
    - `runs loadProject -> saveGeoPackage -> writeGeoPackageToFile -> saveProject in order`
    - `passes a fresh copied ArrayBuffer (not the saved Uint8Array's own buffer) to saveProject`
    - `does not call saveProject when the disk write fails`
    plus the renamed/replaced baseBuffer test (criterion 33) and the new guard tests.
    Command: `rg -n "entities:" src/hooks/useProjectIO.save-ordering.test.ts`
    Expected: `makeInput()`'s `entities` is a non-empty array literal.

30. **[MACHINE]** The guard preserves the load-bearing save ordering documented at
    `useProjectIO.ts:77-81`: disk write still precedes the IndexedDB overwrite.
    Covered by criterion 29's first and third test names.

---

## 3. Task 3 — `projectStateFromLoadResult`

The half of spec ordering item 2 (`:592-595`) that does not depend on tables that do not
exist yet. **The `relationships`/`integrityEvents`-required-on-`setProject` half is
explicitly out of scope** (criterion 41).

31. **[MACHINE]** `src/hooks/useProjectIO.ts` exports one function
    `projectStateFromLoadResult`, with an explicit return type
    (`CONSTRAINTS.md:115`), taking the `GeoPackageLoadResult` produced by `loadGeoPackage`
    and returning the object currently passed to `setProject`. It calls
    `applyGeoPackageResult(result, null)` internally, since that call is duplicated at
    `:113` and `:193` alongside the literals. Its file placement, exact signature and
    return-type naming are a planner choice recorded as Q34; the conservative reading is
    "same file as `performProjectSave`, exported, plain function, no new module".
    Command: `rg -n "export function projectStateFromLoadResult" src/hooks/useProjectIO.ts`
    Expected: exactly one match, with an explicit `):` return type on the signature.

32. **[MACHINE]** **Both** former literal sites go through it, and **neither literal
    survives.** At BASE the duplicated five-field literals are
    `useProjectIO.ts:114-120` (in `restoreSession`) and `useProjectIO.ts:194-200`
    (in `handleOpen`), each preceded by an identical
    `const next = applyGeoPackageResult(result, null)` at `:113` and `:193`.
    Command: `rg -c "drawnGeometries: next.drawnGeometries" src/hooks/useProjectIO.ts`
    Expected: `rg` exits 1 (zero matches) — the duplicated literal is gone from both sites.
    Command: `rg -c "projectStateFromLoadResult\(" src/hooks/useProjectIO.ts`
    Expected: `3` — the declaration plus exactly two call sites.
    Command: `rg -c "applyGeoPackageResult\(result, null\)" src/hooks/useProjectIO.ts`
    Expected: `1` — the single remaining call, inside `projectStateFromLoadResult`.

33. **[MACHINE]** Extraction is behaviour-preserving: `setProject` still receives the same
    five fields with the same values on both paths, and no sixth field appears.
    Command: `sed -n '/export function projectStateFromLoadResult/,/^}/p' src/hooks/useProjectIO.ts`
    Expected: the returned object has exactly the keys `layers`, `entities`,
    `drawnGeometries`, `claims`, `selectedEntityId`, sourced as at BASE (`layers`,
    `entities`, `drawnGeometries` and `selectedEntityId` from `applyGeoPackageResult`'s
    result; `claims` from the load result).
    Command: `npx vitest run src/core/persistence/geopackage/project-open-save-restore.integration.test.ts`
    Expected: exit 0 (the integration test exercising `applyGeoPackageResult`).

34. **[MACHINE]** A unit test named exactly
    `builds one project state from a load result for both the restore and open paths`
    lives in `src/hooks/useProjectIO.save-ordering.test.ts` or a sibling
    `src/hooks/useProjectIO.loadState.test.ts`, and asserts the returned object's five keys
    against a hand-built `GeoPackageLoadResult`, including that `claims` comes from the load
    result rather than from `applyGeoPackageResult`.
    Command: `npx vitest run src/hooks/ -t "builds one project state from a load result"`
    Expected: exit 0, 1 test passed.

---

## 4. Task 4 — kill the positional assertion, replace it with a named one

Spec, tests-required list (`GABRIEL_V2_SLICE_0_1_BUILD.md:615-616`): "Delete the
`mock.calls[0][4]` positional assertion ... It stays green through the failure it should
catch and goes red on a harmless refactor."

35. **[MACHINE]** `mock.calls[0][4]` (in any spelling, including `calls[0]?.[4]`) no longer
    appears in the file.
    Command: `rg -n "calls\[0\]\??\.?\[4\]" src/hooks/useProjectIO.save-ordering.test.ts`
    Expected: no output, `rg` exits 1.
    Command: `rg -n "\[4\]" src/hooks/`
    Expected: no output.

36. **[MACHINE]** **Deleting without replacing is not acceptable.** A replacement assertion
    on the **named** option exists:
    Command: `rg -n "calls\[0\]\??\.?\[0\]\??\.?baseBuffer|\.baseBuffer\)\.toBe" src/hooks/useProjectIO.save-ordering.test.ts`
    Expected: at least one match asserting the forwarded `baseBuffer` is the buffer
    `loadProject` returned (`toBe`, identity, as at BASE).

37. **[MACHINE]** The replacement is **at least as strong** — it pins every option
    `performProjectSave` forwards, which is precisely the class of bug Task 1 could
    introduce (a refactor that silently stops passing `ratingEvents`). A test named exactly
    `forwards every ProjectSaveInput field to the matching saveGeoPackage option`
    asserts, on `saveGeoPackageMock.mock.calls[0][0]`, that:
    `layers`, `entities`, `geometries`, `sources`, `claims`, `ratingEvents` each `toBe`
    the corresponding `ProjectSaveInput` field; `researchSources` `toBe` `input.sourceCache`
    (the rename at criterion 14); and `baseBuffer` `toBe` the buffer from `loadProject`.
    `makeInput()` must supply a **non-empty, distinguishable** value for all seven input
    fields — including `ratingEvents`, which is absent at BASE — so no assertion is vacuous.
    Command: `npx vitest run src/hooks/useProjectIO.save-ordering.test.ts -t "forwards every ProjectSaveInput field"`
    Expected: exit 0, 1 test passed, 8 assertions.

38. **[MACHINE]** No other assertion in that file was deleted.
    Command: `git diff BASE -- src/hooks/useProjectIO.save-ordering.test.ts | rg "^-" | rg -v "^---" | rg "expect\("`
    Expected: exactly one removed `expect(` line — `expect(saveGeoPackageMock.mock.calls[0]?.[4]).toBe(existingBuffer)`
    (BASE line 53). If any other `expect(` was removed, this criterion fails.

---

## 5. Negative criteria — the out-of-scope list (Slice 2B)

All scoped to the **diff**, comment lines excluded. A directory grep is not acceptable here:
that exact shape has been defeated by ordinary JSDoc prose in each of the last two slices.

39. **[MACHINE]** No migration code, no new table, no minted edge. No **added code** line in
    `src/` mentions any of these tokens.
    Command: `git diff BASE -- src/ | rg "^\+" | rg -v "^\+\+\+" | rg -v "^\+\s*(\*|//|/\*)" | rg "relationships|integrityEvents|integrity_events|activeParentMap|commitRelationships|unacknowledgedIntegrityEvents|migrat"`
    Expected: no output, `rg` exits 1.

40. **[MACHINE]** No new file whose name suggests 2B work.
    Command: `git status --porcelain -- src/ | rg "^\?\?" | rg -i "relationship|integrity|migrat|parentMap"`
    Expected: no output.
    Command: `ls src/core/persistence/geopackage/relationships.table.ts src/core/persistence/geopackage/integrityEvents.table.ts 2>&1`
    Expected: "No such file or directory" for both.

41. **[MACHINE]** `setProject` is unchanged — no field became required, none was added.
    Covered by criterion 42 (`useProjectStore.ts` byte-unchanged).

42. **[MACHINE]** **Prohibition 5 — the pre-existing over-cap files are not "helpfully"
    fixed.** `src/store/useProjectStore.ts` (343 lines) and
    `src/modules/orbat/ui/EntityInspector.tsx` (611 lines) are byte-identical to BASE.
    Command: `git diff --stat BASE -- src/store/useProjectStore.ts src/modules/orbat/ui/EntityInspector.tsx`
    Expected: empty output.

43. **[MACHINE]** Committed work from Slices 0 and 1 is untouched.
    Command: `git diff --stat BASE -- src/core/relationship/ src/core/entity/externalId.ts`
    Expected: empty output.

44. **[MACHINE]** **`public/project.gpkg` is byte-identical before and after the whole run.**
    Command: `git status --porcelain -- public/`
    Expected: empty output.
    Command: `md5sum public/project.gpkg`
    Expected: `7d0b0e592a1128a0d83e7575110bf2dc  public/project.gpkg`

45. **[MACHINE]** No test fixture or checked-in data file was modified.
    Command: `git status --porcelain | rg -i "\.gpkg|\.sqlite|fixtures?/"`
    Expected: empty output.

46. **[MACHINE]** The set of files changed under `src/` is exactly the expected set. Any
    extra file is scope creep and must be explained, not silently accepted.
    Command: `git diff --name-only BASE -- src/ && git status --porcelain -- src/ | rg "^\?\?"`
    Expected: modified —
    `src/core/persistence/geopackage/save.ts`,
    `src/core/persistence/geopackage/index.ts`,
    `src/core/persistence/geopackage/geopackage.service.test.ts`,
    `src/core/persistence/geopackage/project-gpkg-fixture.test.ts`,
    `src/core/persistence/geopackage/project-open-save-restore.integration.test.ts`,
    `src/hooks/useProjectIO.ts`,
    `src/hooks/useProjectIO.save-ordering.test.ts`;
    new — `src/core/persistence/geopackage/save.options.test.ts`,
    `src/core/persistence/geopackage/save.options.roundtrip.test.ts`, and optionally
    `src/hooks/useProjectIO.loadState.test.ts` (criterion 34) and a split sibling of
    `project-gpkg-fixture.test.ts` (criterion 20). Nothing else.

47. **[MACHINE]** No commit, no push, no `--no-verify`. Work is left in the working tree.
    Command: `git log --oneline BASE..HEAD`
    Expected: empty output (HEAD is still `c8483b5`).

---

## 6. Repo-wide invariants

48. **[MACHINE]** **Trap T7 — no NUL bytes.** **Use the Node byte scan. Do not use `rg`.**
    Measured during Phase 1 on this machine, with a control file: both
    `rg -c $'\x00' <file>` **and** `rg --text -c $'\x00' <file>` report a match on **every
    line** of a file containing no NUL at all (a 2-line NUL-free file reports `2`, exit 0),
    and report the identical count for a file that *does* contain a NUL. Git Bash collapses
    `$'\x00'` to an empty-string argument, so rg matches the empty pattern everywhere. Both
    forms are useless here: they can never fail and they can never distinguish. The
    `--text` workaround suggested in the handoff brief is therefore **also** broken, and the
    `rg -c $'\x00' src/` line at `GABRIEL_V2_SLICE_0_1_BUILD.md:488` and
    `SLICE_BUILD_LOOP.md:120` should be corrected by the owner (this file may not edit them).
    Command (the authority — copy verbatim, one line):
    `node -e "const {execSync}=require('child_process');const fs=require('fs');const out=execSync('git diff --name-only c8483b5 -- src/; git status --porcelain -- src/').toString();const f=out.split('\n').map(s=>s.replace(/^\s*\?\?\s*/,'').replace(/^\s*M\s*/,'').trim()).filter(s=>s&&fs.existsSync(s));let bad=0;for(const p of f){if(fs.readFileSync(p).includes(0)){console.log('NUL',p);bad++}}console.log(bad===0?'clean':'FAIL')"`
    Expected: the single word `clean`, exit 0. Any `NUL <path>` line is a hard stop.
    The verifying agent must state in its report that it used the Node byte scan, and must
    **not** report an `rg`-based NUL check as evidence for this criterion.

49. **[MACHINE]** ESLint is clean, including no `any` (`CONSTRAINTS.md:114`) in authored
    source.
    Command: `npx eslint .`
    Expected: exit 0, no errors and no new warnings.

50. **[MACHINE]** The GeoPackage layer is never mocked in a persistence test
    (`CONSTRAINTS.md:102`).
    Command: `git diff BASE -- src/core/persistence/ | rg "^\+" | rg "vi\.mock|vi\.fn"`
    Expected: no output. Same for the two new files under
    `src/core/persistence/geopackage/`.

51. **[MACHINE]** New persistence tests carry a 60000 ms timeout.
    Command: `rg -n "60_000|60000" src/core/persistence/geopackage/save.options.roundtrip.test.ts`
    Expected: at least one match.

52. **[MACHINE]** `saveGeoPackage` is still called only from the sanctioned callers
    (`CLAUDE.md`, `CONSTRAINTS.md:64-71`): `useProjectIO.ts` and persistence tests. No new
    caller appeared.
    Command: `rg -l --multiline "saveGeoPackage\(\s*\{" src/`
    Expected: only `src/hooks/useProjectIO.ts` and files under
    `src/core/persistence/geopackage/`.

53. **[MACHINE]** No React import entered `core/` (`CONSTRAINTS.md:29-31`).
    Command: `git diff BASE -- src/core/ | rg "^\+" | rg "from \"react\""`
    Expected: no output.

---

## 7. `[HUMAN]` criteria

Few, as expected for a mechanical refactor. These do **not** block the commit; they go on
the morning-review list.

54. **[HUMAN]** **The required-vs-optional ruling (criterion 4).** Every one of the eight
    options is a required property typed `T | undefined`, so a test that only cares about
    layers must now write five explicit `undefined`s. The reasoning is at criterion 4 and
    is filed as Q32. A reader must confirm this is the trade the owner wants before Slice 2B
    adds `relationships` and `integrityEvents` on top of it, because 2B's compile-error
    behaviour depends on it.

55. **[HUMAN]** **The guard's false-positive surface (criterion 24).** A user who
    deliberately deletes every entity, geometry, claim and source from a real project and
    then saves will be refused, with no in-app override. That is the conservative failure
    direction, but it is a product decision, and the spec elsewhere warns that "blocking
    save on an irreplaceable working file is the wrong failure direction" (`:576-578`) —
    in a different context (integrity-event gating), which is why the guard shipped. Filed
    as Q33. A reader rules whether an override is needed.

56. **[HUMAN]** **The refusal message wording (criterion 25).** `refusing to overwrite ...`
    is surfaced verbatim to the analyst through `handleSave`'s error banner. Nobody has read
    it for tone or actionability — it should tell the user what to do next (reload the
    project), not just that the save was refused.

57. **[HUMAN]** **`geopackage.service.test.ts` crosses further over the 300-line cap
    (criterion 21).** It was 321 at BASE and this conversion grows it. Prohibition 5 forbids
    fixing it here. A reader decides whether it gets its own splitting task. Filed as Q35.

---

## 8. Coverage of the spec's own clauses

Every clause of "Ordering and safety in Slice 2" that is in scope maps to at least one
criterion; the out-of-scope clauses map to a negative criterion.

| spec line | clause | criteria |
|---|---|---|
| `:589-591` | ordering item 1 — options object, first commit, ~16 call sites | 1-21 |
| `:592-595` | ordering item 2 — `projectStateFromLoadResult` (the extractable half) | 31-34 |
| `:592-593` | ordering item 2 — required `relationships`/`integrityEvents` on `setProject` | **out of scope**: 39, 41, 42 |
| `:596-599` | ordering item 3 — the save guard | 22-30 |
| `:600-604` | ordering item 4 — `activeParentMap`, `commitRelationships` | **out of scope**: 39, 40 |
| `:615-616` | delete the `mock.calls[0][4]` positional assertion | 35-38 |
| `:563-585` | `integrity_events` table, migration, 13 corporate links | **out of scope**: 39, 40, 44 |
| Trap T7 | NUL bytes | 48 |
| Prohibition 1 | never modify `public/project.gpkg` or a fixture | 44, 45 |
| Prohibition 3 | never mock the GeoPackage layer | 50 |
| Prohibition 5 | never widen scope / fix pre-existing violations | 21, 42, 46 |
| Prohibition 6 | never delete or skip a failing test | 17, 38 |
| Stop-ship | `npm run verify` green | 18 |

---

## 9. Decomposition (confirmed, with concerns)

The fixed decomposition from the handoff is **confirmed as correct** — the two tasks are
correctly ordered and no two concurrent agents write the same file. Concerns are recorded
below rather than resolved here.

**TASK A** — `save.ts` (declaration + `SaveGeoPackageOptions`), `index.ts` re-export, and
all 16 call sites from §0.2 including the two in `useProjectIO.ts` and the `ProjectSaveDeps`
function type (site T1). Criteria 1-21.

**TASK B** — strictly **after** A, because it edits `useProjectIO.ts` which A also touches:
the save guard, `projectStateFromLoadResult`, and the positional-assertion replacement.
Criteria 22-38.

Concerns are in `decompositionConcerns` in the structured report; the load-bearing one is
that **Task A necessarily leaves the test suite red** (BASE line 53's `calls[0]?.[4]`
becomes `undefined` the moment the deps type becomes an options object, and it is `any`-typed
so `tsc` will not catch it), so **no pass/fail verdict may be taken between A and B.**

---

## 10. Recorded judgement calls

Appended to `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` as **Q32-Q36**: the
required-vs-optional design (Q32), the guard's detection signal, wording and false positive
(Q33), `projectStateFromLoadResult`'s placement and signature (Q34), the 300-line-cap
conflict in the two test files (Q35), and the fact that the NUL byte-scan command printed in
both `GABRIEL_V2_SLICE_0_1_BUILD.md:488` and `SLICE_BUILD_LOOP.md:120` — **and** the
`--text` workaround suggested for this slice — can neither fail nor distinguish a clean file
from a dirty one, measured against a control file (Q36, criterion 48).

No source file was touched in Phase 1. `git status --porcelain` at the end of this phase
shows exactly two doc entries: `M docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` and
`?? docs/timelines/SLICE_2A_CRITERIA.md`. HEAD is still `c8483b5` and
`public/project.gpkg` is untouched (`md5 = 7d0b0e592a1128a0d83e7575110bf2dc`).
