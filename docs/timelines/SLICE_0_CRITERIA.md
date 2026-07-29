# Slice 0 — Frozen success criteria

**Authority.** `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` (the "spec" below), Slice 0
section only. Line references are to that file at the revision current on
branch `telegram-osint-sidecar`, 2026-07-29.

**Frozen.** No later agent may edit, weaken, reword or delete an entry here. A failing
criterion is a result to report, not a line to change (`docs/SLICE_BUILD_LOOP.md`, Phase 1
and Prohibition 2).

**Scope.** Slice 0 only. Slice 1 (External Ids) has its own criteria file and none of its
work may appear in this tree.

## How to grade

- Every `[MACHINE]` criterion below is a command plus its exact expected result. Run the
  commands from the repo root, `C:/Users/antoi/Documents/Netechoppe/gabriel`.
- `rg`, `git`, `diff`, `sed` and `test` commands are written for **Git Bash**. `npx`/`npm`
  commands run in either shell.
- `[HUMAN]` criteria do **not** block the commit. They are collected into the morning-review
  list in `docs/timelines/SLICE_RUN_LOG.md`.

**Shorthand `PASSES(<test-file>, "<name>")`** expands to: the command

```
npx vitest run <test-file> --reporter=verbose
```

exits `0`, and its output contains a line that begins with the pass mark and contains the
substring `> <name>` (the verbose reporter prints
`✓ <file> > <describe> > <name> <duration>`).

**Test file placement** is fixed here because the spec does not name it (recorded in
`SLICE_0_1_OPEN_QUESTIONS.md`, Q2). Repo convention is a colocated `*.test.ts` beside the
source.

---

## A. Global gates

1. **[MACHINE]** `npm run verify` exits `0`. Its three stages (`eslint .`, `vitest run
   --coverage`, `tsc -b && vite build`) all succeed, and the coverage stage does not report
   a threshold failure (`vitest.config.ts` sets global thresholds lines 12 / branches 9 /
   functions 9 / statements 12).

2. **[MACHINE]** `npx tsc -b` exits `0` with no output. `tsconfig.app.json` has
   `"include": ["src"]`, so this type-checks the new test files too — every type-level
   assertion in a `*.test.ts` is enforced by this command.

3. **[MACHINE]** `npx eslint .` exits `0` with no output.

4. **[MACHINE]** `npx vitest run --coverage` exits `0` and reports `0 failed` and `0 skipped`
   test files. No test added by this slice is `.skip`ped, `.todo`ed, or `.only`d:
   `rg -n "it\.(skip|todo|only)|describe\.(skip|todo|only)" src/core/relationship/ src/core/entity/entity.test.ts src/core/persistence/geopackage/units.table.test.ts`
   exits `1` with no output.

---

## B. The eight files in the spec's Slice 0 "Files" block (spec:50-59)

5. **[MACHINE]** `test -f src/core/relationship/relationship.ts` exits `0`, and

   ```
   rg -c "export type RelationshipTier|export type RelationshipType|export type RelationshipMetadata|export type ExportOverride|export type Relationship |export type RelationshipDraft|export function decodeExportOverride" src/core/relationship/relationship.ts
   ```

   exits `0` reporting **7** matching lines.

6. **[MACHINE]** `test -f src/core/relationship/vocabulary.ts` exits `0`, and

   ```
   rg -c "export const EDGE_VOCABULARY_VERSION|export type EdgeLayer|export type MetadataSpec|export type EdgeTypeDefinition|export const EDGE_TYPES|export const RECORD_TIER_TYPES|export const ASSESSMENT_TIER_TYPES" src/core/relationship/vocabulary.ts
   ```

   exits `0` reporting **7** matching lines.

7. **[MACHINE]** `test -f src/core/relationship/validate.ts` exits `0`, and

   ```
   rg -c "export const RELATIONSHIP_VIOLATION_CODES|export type RelationshipViolationCode|export type RelationshipViolation |export function validateRelationships|export function isActive" src/core/relationship/validate.ts
   ```

   exits `0` reporting **5** matching lines.

8. **[MACHINE]** `src/core/entity/entity.ts` is modified and contains the three bare profiles,
   `ENTITY_KINDS` and `EntityKind` — see criteria 33-36.

9. **[MACHINE]** `src/core/persistence/geopackage/units.table.ts` is modified for Trap T2 only
   — see criteria 37-39.

10. **[MACHINE]** `test -f docs/adr/0010-first-class-relationships.md` exits `0`; the file is
    at least 20 lines (`wc -l` >= 20); and
    `rg -c "^# |^## Why$|^## Considered options$|^## Consequences$" docs/adr/0010-first-class-relationships.md`
    reports **4** matching lines (the repo's ADR shape, cf. `docs/adr/0004`, `0006`, `0009`).
    This satisfies the spec's "ADR 0010 is committed in this slice, not trailing it"
    (spec:348-349).

11. **[MACHINE]** `rg -n "0010" docs/adr/0004-entity-profile-tagged-union.md` exits `0` with at
    least one match — the one supersession line the spec requires (spec:57).

12. **[MACHINE]** `CONTEXT.md` gains glossary entries. All three of
    `rg -in "\*\*Relationship\*\*" CONTEXT.md`, `rg -in "record tier" CONTEXT.md` and
    `rg -in "assessment tier" CONTEXT.md` exit `0`. (Which terms Slice 0 must add is not
    enumerated by the spec; these three are the conservative minimum — recorded in
    `SLICE_0_1_OPEN_QUESTIONS.md`, Q3. Wording is criterion 46.)

---

## C. `relationship.ts` behaviour (spec:65-124)

13. **[MACHINE]** `PASSES(src/core/relationship/relationship.test.ts, "decodes a well-formed
    export override from an object and from the equivalent JSON string")`. Without this the
    spec's five reject cases are satisfied by `() => undefined`.

14. **[MACHINE]** `PASSES(src/core/relationship/relationship.test.ts, "returns undefined for a
    non-object")`.

15. **[MACHINE]** `PASSES(src/core/relationship/relationship.test.ts, "returns undefined when a
    field is missing")` and `PASSES(..., "returns undefined when a field is an empty string")`.

16. **[MACHINE]** `PASSES(src/core/relationship/relationship.test.ts, "returns undefined when
    proposedBy equals confirmedBy")` and `PASSES(..., "returns undefined for a malformed
    confirmedAt")`. `confirmedAt` must match `/^\d{4}-\d{2}-\d{2}/` (spec:120).

17. **[MACHINE]** `PASSES(src/core/relationship/relationship.test.ts, "never throws on
    arbitrary input")` — spec:113-114, "Never throws."

   *Criteria 13-17 together discharge the spec's `decodeExportOverride` test bullet
   (spec:343-344).*

---

## D. `vocabulary.ts` content (spec:126-247)

18. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "locks the vocabulary at 13
    entries, 12 record + 1 assessment")`. The test asserts `Object.keys(EDGE_TYPES).length ===
    13`, `RECORD_TIER_TYPES.length === 12`, `ASSESSMENT_TIER_TYPES.length === 1`, and that the
    two arrays partition the key set. (Spec test bullet 1, spec:326-330.)

19. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "pins
    EDGE_VOCABULARY_VERSION at 1.0.0")` — spec:128, the version the tripwire in criterion 18
    is anchored to.

20. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "matches the authored
    vocabulary table row for row")`. For each of the 13 types the test asserts `tier`, `layer`,
    `fromKinds` and `toKinds` against the table at **spec:175-189**, transcribed independently
    from that table (not read off the implementation). `layer` is `null` for `acts_for` and a
    non-null `EdgeLayer` for the other twelve. Every entry's `type` field equals its key.

21. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "keeps corporate_parent and
    owned_by toKinds disjoint")` — spec test bullet 2 (spec:331-332): `corporate` vs `person`,
    intersection empty.

22. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "requires a start date for
    shipped_to and for no other type")` — spec:161-163, `dateRequired` is two-state.

23. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "publishes a non-empty
    definition of at least 40 characters with no backtick for every type")` —
    spec test bullet 3 (spec:333-334).

    **Amendment, 2026-07-29 — owner-authorised, the only amendment to this frozen file.** This
    criterion previously read ~~`PASSES(..., "publishes a non-empty definition of at least 40
    characters with no backtick **and no semicolon** for every type")`~~. The `and no semicolon`
    clause is struck, and with it the `expect(definition).not.toContain(";")`
    assertion; the test's name loses the same four words. Reason: the clause contradicted
    criterion 24, which locks the thirteen strings to the authored block at spec:198-247 — two of
    which (`corporate_parent`, `owned_by`) use a semicolon in ordinary English prose. The two
    criteria were mutually unsatisfiable (recorded as Q8-B, Q12 and Q14 in
    `SLICE_0_1_OPEN_QUESTIONS.md`). The spec calls the no-semicolon check a heuristic "proving
    PRD mechanics were stripped rather than pasted"; authored punctuation is not PRD mechanics,
    and a proxy assertion must not rewrite the artefact it exists to protect — the definitions
    ship verbatim in a CC-BY dataset, the assertion ships nowhere. The owner therefore ruled that
    the original prose is restored and this clause, not the prose, is amended. **The `>= 40
    characters` clause and the no-backtick clause survive unchanged**, as separate, explicit
    assertions. Every other criterion in this file remains frozen and byte-identical.

24. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "publishes each authored
    definition verbatim as a single-line string")`. The test holds the 13 expected strings,
    transcribed from **spec:198-247**, and deep-equals them. Each string is one line: it
    contains no `\n` and no double space — the spec block's line wraps are joined by exactly
    one space. This locks the strings against silent drift; whether the *wording* is right for
    publication is criterion 44, which a human answers.

25. **[MACHINE]** `PASSES(src/core/relationship/vocabulary.test.ts, "declares each metadata key
    on exactly the types that own it, with the authored value sets")` — spec test bullet 4
    (spec:335-336). Required ownership, from spec:78-84 and spec:175-189:

    | key | declared by | value set |
    |---|---|---|
    | `attachment` | `subordinate_to` | `["organic", "attached"]` |
    | `role` | `officer_of` | `["director", "secretary", "registered_agent"]` |
    | `operatorRole` | `operated_by` | `["technical", "commercial", "ISM", "charterer"]` |
    | `basis` | `acts_for` | `["control", "intermediary", "proxy"]` |
    | `percent` | `corporate_parent`, `owned_by` | `{ min: 0, max: 100 }` |

    No other type declares any metadata key. The other half of that spec bullet — "every
    metadata key declared in a `MetadataSpec` exists on `RelationshipMetadata`" — is enforced
    by the compiler through `MetadataSpec = Partial<Record<keyof RelationshipMetadata, ...>>`
    (spec:136-138) and is therefore covered by criterion 2, not by a runtime assertion.

---

## E. `validate.ts` behaviour (spec:249-301)

26. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "emits every one of the nine
    violation codes on a crafted corpus")`. The test asserts
    `new Set(violations.map(v => v.code))` **equals** the full
    `new Set(RELATIONSHIP_VIOLATION_CODES)` — set equality, not `toContain`. (Spec test bullet
    6, spec:339-340.)

27. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "returns no violations for a
    clean corpus")`. Without this, a function returning all nine codes unconditionally passes
    criterion 26.

28. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "skips the dangling-endpoint
    check when entityIds is omitted")` — spec:268-269. The same corpus with `entityIds`
    supplied does produce `dangling-endpoint`.

29. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "reports invalid-date and not
    date-order for a non-padded start date")` — spec:286-288. The ordering matters because the
    comparison is a string compare and `"2026-1-5" > "2026-10-01"` lexicographically.

30. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "emits one
    multiple-active-hierarchy violation per offending edge")` — spec:296-298. A child with two
    active organic `subordinate_to` edges yields exactly two violations, both carrying that
    code. Non-organic (`attachment: "attached"`) and ended edges do not count.

31. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "treats a metadata key present
    with value undefined as absent")` — spec:291-295 and Trap T6. `{ role: undefined }` on a
    `subordinate_to` edge is **not** an `invalid-metadata` violation.

32. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "rejects an export override on
    a record-tier edge")` — spec:299-300. A structurally valid `exportOverride` on any
    record-tier edge yields `invalid-export-override`; the same override on the assessment-tier
    edge does not.

33. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "accepts a percent of 0, 100
    and a non-integer, and rejects 101 and NaN")` — spec:295, "`percent` must be finite and
    `0 <= p <= 100`; non-integers are legal."

34. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "treats an edge ended on a
    date as absent on that date and present the day before")` — spec test bullet 7
    (spec:341-342): `endDate: "2026-03-01"` is absent on `"2026-03-01"`, present on
    `"2026-02-28"`.

35. **[MACHINE]** `PASSES(src/core/relationship/validate.test.ts, "treats an edge with a null
    endDate as active when no date is given")` — spec:275-276, the no-argument branch of
    `isActive`.

---

## F. `entity.ts` (spec:303-322)

36. **[MACHINE]** All three of these exit `0` with exactly one match each, i.e. the profiles are
    declared **bare**, in the single-line form the spec prints at spec:307-309:

    ```
    rg -c 'export type VesselProfile = \{ kind: "vessel" \}' src/core/entity/entity.ts
    rg -c 'export type PersonProfile = \{ kind: "person" \}' src/core/entity/entity.ts
    rg -c 'export type EquipmentClassProfile = \{ kind: "equipment_class" \}' src/core/entity/entity.ts
    ```

37. **[MACHINE]**

    ```
    rg -c 'export const ENTITY_KINDS = \["unit", "corporate", "vessel", "person", "equipment_class"\] as const' src/core/entity/entity.ts
    rg -c 'export type EntityKind = typeof ENTITY_KINDS\[number\]' src/core/entity/entity.ts
    ```

    each exit `0` with exactly one match — spec:315-316, order included.

38. **[MACHINE]** `PASSES(src/core/entity/entity.test.ts, "keeps ENTITY_KINDS and the Profile
    kind union in agreement")` — spec test bullet 5 (spec:337-338). The test carries **both**
    halves: a type-level assertion in each direction (every `Profile["kind"]` is an
    `EntityKind` and every `EntityKind` is a `Profile["kind"]`, enforced by criterion 2) and a
    runtime `expect(ENTITY_KINDS).toHaveLength(5)`.

39. **[MACHINE]** `Profile` is the five-member union: `npx tsc -b` (criterion 2) passes with
    criterion 38's bidirectional assertion in place. Additionally
    `rg -c "VesselProfile|PersonProfile|EquipmentClassProfile" src/core/entity/entity.ts`
    reports **6** matching lines at minimum (three declarations plus their appearance in the
    `Profile` union).

---

## G. `units.table.ts` — Trap T2, the one persistence edit (spec:453-458)

40. **[MACHINE]** The old two-branch ternary is gone:

    ```
    rg -n 'raw === "corporate" \? "corporate" : "unit"' src/core/persistence/geopackage/units.table.ts
    ```

    exits `1` with no output.

41. **[MACHINE]** The decoder is an allowlist against `ENTITY_KINDS`:
    `rg -c "ENTITY_KINDS" src/core/persistence/geopackage/units.table.ts` exits `0` with at
    least **2** matches (the import and the use).

42. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.test.ts, "round-trips
    every ENTITY_KINDS value through the kind column")` — writes one entity per `ENTITY_KINDS`
    member through `writeEntities`, reads back through `readEntities`, and asserts each
    `kind` survives. A `vessel` row must not come back as `"unit"`.

43. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.test.ts, "falls back to
    unit for an unknown persisted kind")` — a persisted value outside `ENTITY_KINDS` decodes to
    `"unit"`. The existing test `defaults kind to 'unit' when the column is absent (pre-E1
    schema)` must still pass unchanged.

---

## H. Human review list (spec:351-353)

None of these block the commit. All go into the morning-review list.

44. **[HUMAN]** The thirteen `publicDefinition` strings in `src/core/relationship/vocabulary.ts`
    read as publishable CC-BY prose: no implementation mechanics, no PRD phrasing pasted
    through, `corporate_parent` still states that a missing percentage establishes no ownership
    share or control, `owned_by` still states that no minimum threshold is applied, and
    `acts_for` still opens with the ASSESSMENT caveat. (Spec:191-247; criterion 24 only locks
    the bytes, not the judgement.)

45. **[HUMAN]** ADR 0010's prose: its title, its `## Why`, its `## Considered options` and its
    `## Consequences`, and specifically its supersession text against ADR 0004 — a reader must
    confirm the ADR actually says what 0010 supersedes and what survives, and that it records
    (a) why `corporate_parent` and `owned_by` are split on publication risk rather than
    collapsed (spec:170-173), and (b) that `ExportOverride`'s two-person rule enforces ceremony
    and attribution, not authentication, because Gabriel has no identity system
    (spec:90-92).

46. **[HUMAN]** The one supersession line added to
    `docs/adr/0004-entity-profile-tagged-union.md` states accurately what ADR 0010 changes
    about the flat tagged union, and does not overclaim (Slice 0 adds bare profiles only;
    fields and the `Entity` mirror are Slice 5).

47. **[HUMAN]** The `CONTEXT.md` glossary entries are consistent with the rest of the file's
    voice, do not duplicate content already in the ADRs (`CONSTRAINTS.md:161`), and use the
    project's existing terms — Entity, Profile, Hierarchy — rather than introducing synonyms.
    A reader also decides whether `## Relationships` (the existing section listing sentences
    about the model) has become ambiguous now that **Relationship** is a domain term, and
    whether that belongs in `## Flagged ambiguities`.

48. **[HUMAN]** Every entry appended to `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` during the
    run is read and answered before Slice 2 starts.

---

## I. Negative criteria — the traps

49. **[MACHINE]** **T7, NUL bytes.** No file in the tree carries a NUL byte:

    ```
    rg --text -c '\x00' src/ docs/ CONTEXT.md
    ```

    exits `1` and prints nothing. **Note:** the command printed at spec:482 and
    `SLICE_BUILD_LOOP.md:120`, `rg -c $'\x00' src/`, does **not** work — in Git Bash `$'\x00'`
    expands to an empty pattern and ripgrep then matches every line of every file. Use the
    form above (recorded in `SLICE_0_1_OPEN_QUESTIONS.md`, Q1). Shell-independent equivalent:

    ```
    node -e "const{readFileSync}=require('fs');const{execSync}=require('child_process');const files=execSync('git ls-files src docs CONTEXT.md').toString().split('\n').filter(Boolean);const bad=files.filter(f=>{try{return readFileSync(f).includes(0)}catch{return false}});console.log(bad.length?'NUL: '+bad.join(', '):'clean');process.exit(bad.length?1:0)"
    ```

    prints `clean` and exits `0`. (Untracked new files must be `git add -N`'d first for the
    node form to see them; the `rg` form sees them regardless.)

50. **[MACHINE]** **T7, template literals.** No backtick in code position anywhere under
    `src/core/relationship/` — backticks inside JSDoc comment lines are fine, template
    literals are not:

    ```
    rg -n "^\s*[^\s*/].*\x60" src/core/relationship/
    ```

    exits `1` with no output. And no interpolation at all:
    `rg -n '\$\{' src/core/relationship/` exits `1` with no output. Both cover the colocated
    test files in that directory as well as the three source files.

51. **[MACHINE]** **T7, the two modified source files.** The slice introduces no new backtick
    in code position in `entity.ts` or `units.table.ts`:

    ```
    git diff -- src/core/entity/entity.ts src/core/persistence/geopackage/units.table.ts | rg -n "^\+[^+].*\x60"
    ```

    exits `1` with no output. (`units.table.ts` already contains three pre-existing template
    literals at lines 115, 122 and 143 — those are **not** to be touched.)

52. **[MACHINE]** **T1, the `Entity` field mirror is not touched.** The `export type Entity =
    EntityCore & { ... }` block is byte-identical to `HEAD`:

    ```
    diff <(git show HEAD:src/core/entity/entity.ts | sed -n '/^export type Entity = EntityCore & {/,/^}/p') <(sed -n '/^export type Entity = EntityCore & {/,/^}/p' src/core/entity/entity.ts)
    ```

    exits `0` with no output.

53. **[MACHINE]** **T1, no field is added to the three bare profiles.** `rg -n "vesselType" src/`
    exits `1` with no output, and criterion 36's three single-line greps each match — which is
    only possible if the declarations carry `kind` and nothing else.

54. **[MACHINE]** **No test fixture or data file is modified.**
    `git status --porcelain -- public/ src/test/` prints nothing, and
    `git diff --stat -- public/project.gpkg` prints nothing. (Prohibition 1.)

55. **[MACHINE]** **No pre-existing violation is "fixed".** `git status --porcelain --
    src/store/useProjectStore.ts src/modules/orbat/ui/EntityInspector.tsx` prints nothing.

56. **[MACHINE]** **No existing test is deleted or skipped.** `units.table.test.ts` is the only
    pre-existing test file this slice touches (criterion 57), and no `it(` line is removed
    from it:

    ```
    git diff -- src/core/persistence/geopackage/units.table.test.ts | rg -n "^-\s*it\("
    ```

    exits `1` with no output. Together with criterion 4 (no `.skip`/`.todo`/`.only`) this
    discharges Prohibition 6.

---

## J. Negative criteria — what Slice 0 must NOT contain (spec:36-42, spec:61-63)

57. **[MACHINE]** **The changed-file set under `src/` is exactly ten paths.**
    `git status --porcelain --untracked-files=all -- src` lists exactly these, and nothing
    else (status letters may be `M`, `A` or `??` depending on staging; `src/` is clean at the
    Phase 0 starting SHA, so anything else is scope creep):

    ```
    src/core/entity/entity.ts
    src/core/entity/entity.test.ts
    src/core/persistence/geopackage/units.table.ts
    src/core/persistence/geopackage/units.table.test.ts
    src/core/relationship/relationship.ts
    src/core/relationship/relationship.test.ts
    src/core/relationship/vocabulary.ts
    src/core/relationship/vocabulary.test.ts
    src/core/relationship/validate.ts
    src/core/relationship/validate.test.ts
    ```

    This single criterion subsumes "no store field", "no UI", "no migration", "no
    `relationships` table" and "no `index.ts` barrel", because every one of those would add a
    path. Criteria 58-64 restate the individually named prohibitions so a failure names itself.

58. **[MACHINE]** No `query.ts`: `test -f src/core/relationship/query.ts` exits `1`.

59. **[MACHINE]** No `activeAt`: `rg -n "activeAt" src/` exits `1` with no output.

60. **[MACHINE]** No `edgesOf`, `outgoing`, `incoming` or `isUnsourced` graph helpers:
    `rg -n "edgesOf|isUnsourced|function outgoing|function incoming" src/` exits `1` with no
    output.

61. **[MACHINE]** No `relationships` table and no migration:
    `test -f src/core/persistence/geopackage/relationships.table.ts` exits `1`, and
    `rg -in "relationship" src/core/persistence/ src/store/ src/hooks/` exits `1` with no
    output (all four paths are free of the word at the Phase 0 SHA).

62. **[MACHINE]** No store field and no UI:
    `git status --porcelain -- src/store src/hooks src/modules src/ui src/pages src/shell src/components`
    prints nothing.

63. **[MACHINE]** No export gate. `rg -l "exportOverride" src/` lists **only** files under
    `src/core/relationship/`, and `rg -n "exportGate|export_gate|canExport" src/` exits `1`
    with no output. `ExportOverride` is a type and a decoder in Slice 0; nothing reads it.

64. **[MACHINE]** No `Claim.relationshipId`: `rg -n "relationshipId" src/core/provenance/
    src/core/persistence/ src/types/` exits `1` with no output. (`RelationshipViolation.
    relationshipId` inside `src/core/relationship/validate.ts` is required by spec:263 and is
    not covered by this check.)

65. **[MACHINE]** No Slice 1 work leaks in: `test -f src/core/entity/externalId.ts` exits `1`,
    and `rg -n "externalIds|external_ids|normalizeExternalId" src/` exits `1` with no output.

---

## Notes for implementers (not criteria)

- `tsconfig.app.json` sets `noUnusedLocals` and `noUnusedParameters`. A type-level assertion
  helper in a test file must be referenced or exported, or `tsc -b` (criterion 2) fails.
- `verbatimModuleSyntax` is on: import types with `import type`.
- `vitest.config.ts` **does** set global coverage thresholds (12/9/9/12). The task brief said
  otherwise; the new files are well covered, so this should not bind — but a Phase 4 failure
  reading `ERROR: Coverage for lines does not meet global threshold` is a real gate, not a
  flake.
- The GeoPackage tests in `units.table.test.ts` use `createTestGeoPackage()` and a 30s timeout
  and clean up `gabriel-test-*.gpkg` in `afterEach`. Clone that shape for criteria 42-43;
  do not mock the library (`CONSTRAINTS.md:101`).
