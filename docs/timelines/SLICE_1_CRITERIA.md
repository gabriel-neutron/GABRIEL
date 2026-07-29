# Slice 1 — Frozen success criteria

**Authority.** `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` (the "spec" below), **Slice 1
section only** (spec:363-448), plus the Traps block (spec:452-488) and the Prohibitions in
`docs/SLICE_BUILD_LOOP.md`. Line references are to the spec at the revision current on branch
`telegram-osint-sidecar`, 2026-07-29.

**Frozen.** No later agent may edit, weaken, reword or delete an entry here. A failing
criterion is a result to report, not a line to change (`docs/SLICE_BUILD_LOOP.md`, Phase 1 and
Prohibition 2).

**Scope.** Slice 1 only. Slice 0 is committed at `507f425` (run log `ee93a0c`) and is finished:
**nothing under `src/core/relationship/` may change** (criterion 58). Slice 2 work — the
`relationships` table, any migration, any store field, any UI — is out of scope and is
explicitly excluded by criteria 59-63.

## How to grade

- Every `[MACHINE]` criterion below is a command plus its exact expected result. Run the
  commands from the repo root, `C:/Users/antoi/Documents/Netechoppe/gabriel`.
- `rg`, `git`, `diff`, `sed`, `node` and `test` commands are written for **Git Bash**.
  `npx` / `npm` commands run in either shell.
- `[HUMAN]` criteria do **not** block the commit. They are collected into the morning-review
  list in `docs/timelines/SLICE_RUN_LOG.md`. The spec states at spec:448 that **Slice 1 has no
  human-review items**; the single `[HUMAN]` entry below (criterion 64) is the run-loop's own
  procedural item, not a spec clause, and is marked as such.

**Shorthand `PASSES(<test-file>, "<name>")`** expands to: the command

```
npx vitest run <test-file> --reporter=verbose
```

exits `0`, and its output contains a line that begins with the pass mark and contains the
substring `> <name>` (the verbose reporter prints
`✓ <file> > <describe> > <name> <duration>`).

**Test names are part of the contract.** The names quoted inside `PASSES(...)` are exact. A
test that asserts the right thing under a different name fails its criterion; rename the test,
do not edit the criterion.

**Test file placement** is fixed here because the spec names no test files (recorded in
`docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md`, Q23). Four test files carry this slice:

| file | why here |
|---|---|
| `src/core/entity/externalId.test.ts` | colocated, repo convention |
| `src/core/persistence/geopackage/validation.test.ts` | **existing** — `decodeAliases`'s tests live here, so `decodeExternalIds`'s do too |
| `src/core/persistence/geopackage/units.table.externalIds.test.ts` | **new** — `units.table.test.ts` is already 282 lines against the 300-line cap (`CONSTRAINTS.md:113`, "split by concern") |
| `src/core/persistence/geopackage/project-gpkg-fixture.test.ts` | **existing** — the spec says the hard gate is "cloned from `project-gpkg-fixture.test.ts:88-110`" (spec:440); it belongs in the same `describe` as the `aliases` gate it clones |

---

## A. Global gates

1. **[MACHINE]** `npm run verify` exits `0`. Its three stages (`eslint .`,
   `vitest run --coverage`, `tsc -b && vite build`) all succeed, and the coverage stage does not
   report a threshold failure (`vitest.config.ts` sets global thresholds lines 12 / branches 9 /
   functions 9 / statements 12). This discharges the spec's "Done when" first clause
   (spec:446-448).

2. **[MACHINE]** `npx tsc -b` exits `0` with no output. `tsconfig.app.json` has
   `"include": ["src"]`, so this type-checks the new test files too — every type-level
   assertion in a `*.test.ts` is enforced by this command.

3. **[MACHINE]** `npx eslint .` exits `0` with no output.

4. **[MACHINE]** `npx vitest run --coverage` exits `0` and reports `0 failed` and `0 skipped`
   test files. No test added by this slice is `.skip`ped, `.todo`ed or `.only`d:

   ```
   rg -n "it\.(skip|todo|only)|describe\.(skip|todo|only)" src/core/entity/externalId.test.ts src/core/persistence/geopackage/validation.test.ts src/core/persistence/geopackage/units.table.externalIds.test.ts src/core/persistence/geopackage/project-gpkg-fixture.test.ts
   ```

   exits `1` with no output.

---

## B. The four files (spec's Slice 1 "Files" block, spec:367-371, plus `validation.ts` named in prose at spec:430-432)

5. **[MACHINE]** `test -f src/core/entity/externalId.ts` exits `0`, and

   ```
   rg -c "export type ExternalIdScheme|export type ExternalId |export function normalizeExternalId|export function externalIdKey|export function isValidExternalId" src/core/entity/externalId.ts
   ```

   exits `0` reporting **5** matching lines. Every one of the three functions has an explicit
   return type (`CONSTRAINTS.md:115`), enforced by criterion 2.

6. **[MACHINE]** `src/core/entity/entity.ts` is modified and carries `externalIds` on
   `EntityCore` — see criteria 33-35.

7. **[MACHINE]** `src/core/persistence/geopackage/units.table.ts` is modified and carries the
   `external_ids` descriptor — see criteria 39-44.

8. **[MACHINE]** `src/core/persistence/geopackage/validation.ts` is modified and exports
   `decodeExternalIds`:

   ```
   rg -c "export function decodeExternalIds" src/core/persistence/geopackage/validation.ts
   ```

   exits `0` reporting **1** matching line. This is the home the spec names in prose
   ("`decodeExternalIds` lives beside `decodeAliases` in
   `core/persistence/geopackage/validation.ts`", spec:430-431).

---

## C. `externalId.ts` — the type surface (spec:376-400)

9. **[MACHINE]** `ExternalIdScheme` is the nine-member union the spec prints at spec:379-381 —
   exactly the literals `imo`, `inn`, `ogrn`, `lei`, `ofac`, `eu_fsf`, `uk_hmt`,
   `opensanctions`, `registry`, and no tenth:

   ```
   sed -n '/^export type ExternalIdScheme =/,/registry"/p' src/core/entity/externalId.ts | rg -o '"[a-z_]+"' | sort | tr '\n' ' '
   ```

   prints exactly `"eu_fsf" "imo" "inn" "lei" "ofac" "ogrn" "opensanctions" "registry" "uk_hmt" `
   — nine tokens, no more, no fewer. The union is additionally locked at runtime by
   criterion 12 and at compile time by criterion 11's `Record<ExternalIdScheme, string>`.

10. **[MACHINE]** `ExternalId` is exactly `{ scheme: ExternalIdScheme; value: string }` — two
    fields, both required, no `normalized` field (criterion 57):

    ```
    sed -n '/^export type ExternalId = {/,/^}/p' src/core/entity/externalId.ts | rg -c "scheme: ExternalIdScheme|value: string"
    ```

    exits `0` reporting **2** matching lines, and there is no third property and no optional
    property (property lines start with whitespace then an identifier, so this does not trip on
    JSDoc):

    ```
    sed -n '/^export type ExternalId = {/,/^}/p' src/core/entity/externalId.ts | rg -n "^\s*normalized|^\s*[a-zA-Z]+\?:"
    ```

    exits `1` with no output.

11. **[MACHINE]** The nine UI labels (spec:407-408) exist as a scheme-keyed record whose type
    is `Record<ExternalIdScheme, string>`, so `tsc` (criterion 2) enforces exhaustiveness. The
    constant is named `EXTERNAL_ID_LABELS` and lives in `src/core/entity/externalId.ts` — the
    spec gives the strings but names neither constant nor home, and the Slice 1 "Files" block
    admits no other file (recorded in `SLICE_0_1_OPEN_QUESTIONS.md`, Q21).

    ```
    rg -c "export const EXTERNAL_ID_LABELS: Record<ExternalIdScheme, string>" src/core/entity/externalId.ts
    ```

    exits `0` reporting **1** matching line.

12. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "labels every scheme with the
    authored UI string")`. The test transcribes the nine pairs from **spec:379-381 and
    spec:407-408** independently of the implementation and deep-equals
    `EXTERNAL_ID_LABELS` against:

    | scheme | label |
    |---|---|
    | `imo` | `IMO number` |
    | `inn` | `INN` |
    | `ogrn` | `OGRN` |
    | `lei` | `LEI` |
    | `ofac` | `OFAC SDN id` |
    | `eu_fsf` | `EU FSF id` |
    | `uk_hmt` | `UK HMT id` |
    | `opensanctions` | `OpenSanctions id` |
    | `registry` | `Registry id` |

    The mapping is positional: the spec's label list at spec:407-408 is in the same order as the
    union at spec:379-381. The test also asserts `Object.keys(EXTERNAL_ID_LABELS)` has length
    **9** — this is the runtime lock on "no tenth scheme" referenced by criterion 9.

---

## D. Scheme rules — all nine (spec:402-405)

`isValidExternalId` is **structural validity only** (spec:397-399). It validates the
**normalised** form of `value`, not the raw string: `value` is "the raw string the analyst typed,
preserved as entered" (spec:385-386), so a check against the raw string would reject
`"IMO 9074729"` while `externalIdKey` treats it as identical to `"9074729"` — incoherent.
(Recorded in `SLICE_0_1_OPEN_QUESTIONS.md`, Q22.)

13. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts the worked IMO example
    9074729")`. `isValidExternalId({ scheme: "imo", value: "9074729" })` is `true`, and so is
    `{ scheme: "imo", value: "IMO 9074729" }`. Algorithm (spec:402-404): digits one to six
    weighted 7, 6, 5, 4, 3, 2; the sum mod 10 equals digit seven. For `9074729` that is
    `9·7 + 0·6 + 7·5 + 4·4 + 7·3 + 2·2 = 63 + 0 + 35 + 16 + 21 + 4 = 139`, `139 mod 10 = 9`,
    which is digit seven.

    > **Spec typo — do not copy it.** Spec:436 prints the first term as `7·7`. The total (139)
    > and the check digit (9) are correct; only that printed term is wrong. `9074729`'s first
    > digit is `9`, so the first term is `9·7 = 63`. Implement the algorithm, not the printed
    > expansion.

14. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "rejects a transposition of a
    valid IMO number")` — spec:437-438. The transposition is **`9704729`** (digits two and three
    of `9074729` swapped): `9·7 + 7·6 + 0·5 + 4·4 + 7·3 + 2·2 = 146`, `146 mod 10 = 6 ≠ 9`, so
    `isValidExternalId({ scheme: "imo", value: "9704729" })` is `false`. The exact value is
    pinned because not every transposition changes the weighted sum mod 10 — a test free to pick
    its own could pick an undetectable one and pass a broken implementation.

15. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts a second IMO derived from
    the algorithm")` — spec:438, "Derive further cases from the algorithm; no external fixture
    needed." `"1234567"` is valid (`1·7 + 2·6 + 3·5 + 4·4 + 5·3 + 6·2 = 77`, `77 mod 10 = 7`).
    Without a second accept case, criterion 13 is satisfiable by hard-coding one string.

16. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "rejects an IMO with a wrong check
    digit, wrong length, or a non-digit character")`. All of these are `false`:
    `"9074728"` (right shape, wrong check digit), `"907472"` (6 digits), `"90747290"` (8 digits),
    `"907472A"` (non-digit in the charset).

17. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts a 20-character
    alphanumeric LEI in either case")` — spec:404. `"5493001KJTIIGC8Y1R12"` is valid, and so is
    `"5493001kjtiigc8y1r12"` (normalisation upper-cases, spec:389-390).

18. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "rejects a LEI of the wrong length
    or charset")`. `"5493001KJTIIGC8Y1R1"` (19) and `"5493001KJTIIGC8Y1R123"` (21) are `false`;
    `"5493001KJTIIGC8Y1R1*"` (20 characters, one outside `[0-9A-Z]`) is `false`.

19. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "records the known gap: a
    mod-97-invalid LEI still passes structural validation")` — spec:404, "**no mod-97 check** in
    this slice (known gap: a typo'd LEI passes structural validation)".
    `isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R00" })` is `true`.

    **This is a deliberate, recorded gap, not a defect.** The test locks it as intended
    behaviour so that a later slice adding mod-97 has to change this test on purpose. A
    reviewer must not "fix" it inside Slice 1, and must not file it as a bug. The gap is
    additionally recorded in prose — criterion 20.

20. **[MACHINE]** The known gap is documented at the point of implementation:

    ```
    rg -in "mod-97" src/core/entity/externalId.ts
    ```

    exits `0` with at least one match, in a comment explaining *why* the check is absent
    (`CONSTRAINTS.md:120-121` — comments explain why, not what).

21. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts an INN of 10 or 12 digits
    and rejects 11")` — spec:404-405. `"7707083893"` (10) and `"500100732259"` (12) are `true`;
    `"77070838931"` (11) and `"770708389"` (9) are `false`; `"770708389A"` (10, non-digit) is
    `false`.

22. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts an OGRN of 13 or 15
    digits and rejects 14")` — spec:405. `"1027700132195"` (13) and `"304500116000157"` (15) are
    `true`; `"10277001321950"` (14) and `"102770013219"` (12) are `false`;
    `"102770013219A"` (13, non-digit) is `false`.

23. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "accepts any non-empty value for
    the five registry and sanctions schemes")` — spec:405, "The five registry/sanctions schemes
    are free-form non-empty." For **each** of `ofac`, `eu_fsf`, `uk_hmt`, `opensanctions`,
    `registry` the test asserts a plain value is `true` (e.g. `"12345"`, `"EU.1234.56"`,
    `"CHE0001"`, `"NK-A7bC"`, `"1027700132195"`) — five schemes, five assertions, none skipped.

24. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "rejects an empty or
    whitespace-only value for every scheme")`. For **all nine** schemes, `value: ""` and
    `value: "   "` are both `false`. Iterating `Object.keys(EXTERNAL_ID_LABELS)` is the
    intended shape, so a tenth scheme cannot be added without this test covering it.

---

## E. `normalizeExternalId` and `externalIdKey` (spec:388-395)

25. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "normalizes IMO 9074729 and
    9074729 to the same string")` — the spec's second test bullet, spec:439, asserted literally:

    ```ts
    normalizeExternalId("imo", "IMO 9074729") === normalizeExternalId("imo", "9074729")
    ```

    and both equal `"9074729"` (the scheme prefix and the separator are stripped, spec:389-390).

26. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "upper-cases structured schemes,
    trims every scheme, and is idempotent")`. For all nine schemes and a mixed-case,
    space-padded sample value: the result equals its own `trim()`, and
    `normalizeExternalId(s, normalizeExternalId(s, v)) === normalizeExternalId(s, v)`. For the
    four **structured** schemes (`imo`, `inn`, `ogrn`, `lei`) the result additionally equals its
    own `toUpperCase()`. These are the pinned minimum guarantees; which further separators a
    scheme strips is implementation freedom (recorded in `SLICE_0_1_OPEN_QUESTIONS.md`, Q25),
    subject to criterion 27.

    > **Amendment, 2026-07-29 — owner-authorised. The second amendment to this frozen file.**
    > The criterion previously required the result to equal its own `toUpperCase()` for **all
    > nine** schemes, and the test was named ~~`"upper-cases and trims for every scheme, and is
    > idempotent"`~~. The clause is narrowed to the four structured schemes by the owner ruling
    > on **Q31**: upper-casing a free-form value contradicted the rule immediately above it in
    > `normalizeExternalId`, which preserves hyphens and dots in an opaque registry string
    > precisely because stripping them "could merge two distinct ids onto one dedup key". Case
    > is the same argument — an OpenSanctions entity id is a case-sensitive token — so the
    > original clause pinned a silent entity merge as a guarantee. Unlike the Slice 0 semicolon
    > amendment, this one was satisfiable as written; it was ruled wrong, not defective.
    > Amended before any consumer shipped, so no persisted data is affected: the normalised
    > form is recomputed at every comparison and never stored.

26b. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "preserves case for free-form
    schemes, so two case-distinct ids keep distinct keys")`. Added by the same Q31 ruling. For
    each of the five free-form schemes (`ofac`, `eu_fsf`, `uk_hmt`, `opensanctions`,
    `registry`): `normalizeExternalId(s, "NK-a7bC") === "NK-a7bC"`, and
    `externalIdKey({ scheme: s, value: "NK-a7bC" }) !== externalIdKey({ scheme: s, value: "nk-a7bc" })`.

27. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "never throws for any scheme on
    any input")`. `normalizeExternalId` is called for all nine schemes with `""`, `"   "`, a
    1000-character string, a string of only separators, and a string of astral-plane
    characters; no call throws. (`isValidExternalId` and `externalIdKey` are exercised over the
    same inputs and must not throw either.)

28. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "builds a stable dedup key of
    scheme and normalized value")` — spec:393-395.
    `externalIdKey({ scheme: "imo", value: "IMO 9074729" }) === "imo:9074729"`, and it equals
    `externalIdKey({ scheme: "imo", value: "9074729" })`. The separator is a single `":"`, and
    the key's left-hand side is the raw scheme string (lower-case, not the label). Two ids of
    **different** schemes with the same value produce **different** keys.

29. **[MACHINE]** **No persisted `normalized`.** Spec:394 — "There is no persisted `normalized`
    field — it is recomputed at every comparison."

    ```
    rg -n "normalized" src/core/entity/externalId.ts src/core/entity/entity.ts src/core/persistence/geopackage/validation.ts src/core/persistence/geopackage/units.table.ts
    ```

    matches only inside function bodies, comments or local variable names — **never** as a
    property of `ExternalId`, of `EntityCore`, or as a persisted column. Discharged concretely
    by criterion 10 (the `ExternalId` block has exactly two fields) and criterion 40 (the
    descriptor list gains exactly one column).

---

## F. `EntityCore` (spec:410-414)

30. **[MACHINE]** `src/core/entity/entity.ts` declares the field:

    ```
    rg -c "externalIds\?: ExternalId\[\]" src/core/entity/entity.ts
    ```

    exits `0` reporting **1** matching line.

31. **[MACHINE]** The field sits inside `EntityCore`, not on `Entity`:

    ```
    sed -n '/^export type EntityCore = {/,/^}/p' src/core/entity/entity.ts | rg -c "externalIds\?: ExternalId\[\]"
    ```

    exits `0` reporting **1** matching line (the declaration form, so a JSDoc line that also
    mentions `externalIds` does not inflate the count). Spec:411-413 — it "lands on `Entity` automatically
    via the intersection at `entity.ts:88`", so no mirror edit is needed (criterion 55).

32. **[MACHINE]** The type is imported, not redeclared:
    `rg -c 'import type \{ ExternalId \} from "./externalId"' src/core/entity/entity.ts` exits
    `0` reporting **1** matching line. (`verbatimModuleSyntax` is on; a value import fails
    criterion 3 or 2.)

33. **[MACHINE]** `PASSES(src/core/entity/externalId.test.ts, "reads externalIds off an Entity
    without narrowing on kind")`. A `const e: Entity = { ... externalIds: [{ scheme: "imo",
    value: "9074729" }] }` compiles and `e.externalIds` is readable — i.e. the field genuinely
    reached `Entity` through the intersection (spec:412-413), and `MapEntity` (aliased at
    `src/types/domain.types.ts:34`) sees it too. Enforced by criterion 2 plus a runtime
    `expect(e.externalIds).toHaveLength(1)`.

---

## G. `decodeExternalIds` in `validation.ts` (spec:430-432)

`decodeAliases` (`validation.ts:23-33`) is the exact template. `decodeExternalIds` "returns
`undefined` for absent, empty, or corrupt values. It never throws" (spec:431-432).

34. **[MACHINE]** `PASSES(src/core/persistence/geopackage/validation.test.ts, "parses a JSON
    array of well-formed external ids")`.
    `decodeExternalIds('[{"scheme":"imo","value":"9074729"},{"scheme":"lei","value":"5493001KJTIIGC8Y1R12"}]')`
    deep-equals those two objects in that order.

35. **[MACHINE]** `PASSES(src/core/persistence/geopackage/validation.test.ts, "returns undefined
    for missing, empty, non-array, or corrupt values")`. Every one of `undefined`, `null`, `""`,
    `"not json"`, `"{}"`, `'{"scheme":"imo"}'`, `"[]"`, `42`, `[]` (a non-string raw) returns
    `undefined`. **`"[]"` returning `undefined` and never `[]` is Trap T5** — see criterion 47.

36. **[MACHINE]** `PASSES(src/core/persistence/geopackage/validation.test.ts, "drops entries
    with an unknown scheme, a missing field, or a blank value")`. From
    `'[{"scheme":"imo","value":"9074729"},{"scheme":"bogus","value":"x"},{"scheme":"lei"},{"scheme":"inn","value":"  "},7]'`
    only the first entry survives; the result has length **1**. An array whose entries are *all*
    dropped returns `undefined`, not `[]` (Trap T5 again). This mirrors `decodeAliases`'s
    filter-then-`undefined`-if-empty shape rather than rejecting the whole array (recorded in
    `SLICE_0_1_OPEN_QUESTIONS.md`, Q26).

37. **[MACHINE]** `PASSES(src/core/persistence/geopackage/validation.test.ts, "keeps a
    structurally invalid but well-shaped id")`.
    `decodeExternalIds('[{"scheme":"imo","value":"9074728"}]')` returns that one entry —
    a failing IMO check digit is a **validation** concern (`isValidExternalId`), not a
    **decoding** concern. Dropping it would silently delete what the analyst typed on the next
    save. `decodeExternalIds` must not call `isValidExternalId`:
    `rg -n "isValidExternalId" src/core/persistence/geopackage/validation.ts` exits `1` with no
    output.

38. **[MACHINE]** `PASSES(src/core/persistence/geopackage/validation.test.ts, "never throws on
    arbitrary input")` — spec:432. The test calls `decodeExternalIds` over at least: `undefined`,
    `null`, `0`, `NaN`, `true`, `Symbol` -free plain objects, an array, a `Date`, a deeply nested
    JSON string, a JSON string of `"null"`, and a 100 000-character string. No call throws;
    every call returns `undefined` or an `ExternalId[]`.

---

## H. The `external_ids` descriptor in `units.table.ts` (spec:416-428)

39. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "declares external_ids optional with a NULL fallback and no constraints")`. The test reads
    `unitColumns.find((d) => d.column === "external_ids")` — an object assertion, not a grep, so
    formatting cannot fool it — and asserts **all** of:

    | assertion | trap |
    |---|---|
    | the descriptor is found (not `undefined`) | — |
    | `prop === "externalIds"` | — |
    | `sqlType === "TEXT"` | — |
    | `optional === true` | **T3** |
    | `fallbackSql === "NULL"` | **T3** |
    | `"constraints" in descriptor === false` | **T4** |
    | `descriptor.constraints === undefined` | **T4** |

    Both T4 forms are asserted: `ensureOptionalColumns` (`columnDescriptor.ts:118`) splices
    `constraints` straight into `ALTER TABLE ... ADD COLUMN`, and SQLite rejects
    `ADD COLUMN ... NOT NULL` without a constant default — a failure that surfaces **only** on
    the reopened-old-file path, which is exactly what criterion 45 exercises.

40. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "adds exactly one column to the units descriptor list")`. `unitColumns` has **18** entries
    (17 at `507f425` — `id`, `name`, `layer_id`, `parent_id`, `aliases`, `kind`, `type`,
    `nato_symbol_code`, `echelon`, `affiliation`, `domain`, `osm_relation_id`,
    `military_unit_id`, `notes`, `analyzed_at`, `position_mode`, `is_exact_position` — plus
    `external_ids`), and `unitColumns.filter((d) => d.column === "external_ids")` has length
    **1**. No existing descriptor is removed or renamed.

41. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "keeps kind decoded before type and osm_relation_id")`. The index of the `kind` descriptor
    is less than the index of both `type` and `osm_relation_id` (`units.table.ts:38-41` — a
    `DecodeContext.decoded` ordering invariant that inserting a descriptor could break).

42. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "round-trips external ids through a fresh units table")`. Using `createTestGeoPackage()` /
    `createUnitsTable` / `writeEntities` / `readEntities` — real WASM, no mocking
    (`CONSTRAINTS.md:102`) — an entity with
    `externalIds: [{ scheme: "imo", value: "9074729" }, { scheme: "lei", value: "5493001KJTIIGC8Y1R12" }]`
    survives write → read with `toEqual`.

43. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "encodes an absent or empty externalIds array as SQL NULL and decodes it back to
    undefined")` — **Trap T5**, spec:477-479. Three entities are written: one with
    `externalIds: undefined`, one with `externalIds: []`, one with a real id. On read back, the
    first two have `externalIds === undefined` (**not** `[]`, and not `null`), the third has its
    array. The encoder is the spec's verbatim expression (spec:425):
    `encode: (v) => (Array.isArray(v) && v.length ? JSON.stringify(v) : null)`.

44. **[MACHINE]** `PASSES(src/core/persistence/geopackage/units.table.externalIds.test.ts,
    "defaults externalIds to undefined when the column is absent (pre-Slice-1 schema)")`. A
    `units` table created without the `external_ids` column is read through `readEntities`; the
    `NULL AS external_ids` fallback branch of `buildSelectClause`
    (`columnDescriptor.ts:48-61`) fires, the read does **not** throw, and `externalIds` is
    `undefined`. This is the direct T3 regression: `optional: true` without `fallbackSql`
    throws `'external_ids' is optional but has no fallbackSql` — a total load failure, not
    graceful degradation. Clone the shape of the existing
    `defaults kind to 'unit' when the column is absent (pre-E1 schema)` test.

---

## I. THE PERSISTENCE HARD GATE — the most important criterion in this file

Spec:440-444, the fourth Tests bullet. Cloned from `project-gpkg-fixture.test.ts:88-110` (the
`aliases` gate), which is the same shape against the same real file.

45. **[MACHINE]** `PASSES(src/core/persistence/geopackage/project-gpkg-fixture.test.ts,
    "persists external ids through a reopen-and-save against the real pre-Slice-1 fixture")`.
    The test, in the existing
    `describe("public/project.gpkg round-trip (real pre-E1 fixture)")` block, does **exactly**
    this:

    1. Reads `public/project.gpkg` from disk with `readFileSync(resolve(process.cwd(),
       "public/project.gpkg"))` and copies it into a fresh `ArrayBuffer` via
       `Uint8Array.from(fileBytes).buffer` — Node pools small `readFileSync` results into a
       shared backing buffer, so `.buffer` alone can carry a non-zero `byteOffset`
       (`project-gpkg-fixture.test.ts:59-62`).
    2. `const first = await loadGeoPackage(buffer)` — **the real file, real WASM, no mock**
       (`CONSTRAINTS.md:102`, `SLICE_BUILD_LOOP.md` Prohibition 3).
    3. Picks **one** entity: `first.entities.find((e) => e.kind === "unit")!`, exactly as the
       `aliases` gate does at `:97`.
    4. Maps the entities array, setting `externalIds` on that one id **only**:
       `[{ scheme: "imo", value: "9074729" }]`.
    5. Saves through the **`baseBuffer` reopen path** —
       `await saveGeoPackage(first.layers, withIds, first.geometries, first.sourceCache, buffer)`
       — with `buffer` as the fifth argument. This is the path that drives
       `ensureOptionalColumns`' `ALTER TABLE ... ADD COLUMN external_ids` against a file that
       predates the column, and is the only path where T4 can fire.
       `saveGeoPackage`'s signature is unchanged (criterion 53).
    6. `const second = await loadGeoPackage(Uint8Array.from(bytes).buffer)`.
    7. Asserts the value survived:
       `expect(second.entities.find((e) => e.id === target.id)!.externalIds).toEqual([{ scheme: "imo", value: "9074729" }])`.
    8. Asserts every other row stayed clean:
       **`expect(second.entities.filter((e) => e.externalIds != null)).toHaveLength(1)`** —
       length **exactly 1**, against 1027 loaded entities (1010 `units` rows plus 17 folded
       `organisations`; spec:18-32). `!= null` and **never** `in` or `hasOwnProperty`
       (**Trap T6**, criterion 48). If this reports 1027 or 1010, `decodeExternalIds` is
       returning `[]` where it must return `undefined` (**Trap T5**).
    9. The `it(...)` carries the **60 000 ms** timeout as its third argument, matching every
       other test in that file.

46. **[MACHINE]** **`public/project.gpkg` is byte-identical before and after the whole run.**
    After `npm run verify` and after the hard gate has run,

    ```
    git status --porcelain -- public/
    ```

    prints nothing and exits `0`, and

    ```
    git diff --stat -- public/project.gpkg
    ```

    prints nothing. Independently, the file's hash is unchanged — these two digests are equal:

    ```
    sha256sum public/project.gpkg
    git show 507f425:public/project.gpkg | sha256sum
    ```

    > **`SLICE_BUILD_LOOP.md` Prohibition 1.** If criterion 45 goes red, **the code is wrong,
    > not the file.** Never edit, regenerate, re-save or "repair" `public/project.gpkg`, any
    > test fixture, or any checked-in data file to reach green. This is the single most likely
    > way to destroy the project's irreplaceable data while showing green.

47. **[MACHINE]** **No mocking anywhere in the persistence tests of this slice.**

    ```
    rg -n "vi\.mock|vi\.spyOn|vi\.fn" src/core/persistence/geopackage/project-gpkg-fixture.test.ts src/core/persistence/geopackage/units.table.externalIds.test.ts
    ```

    exits `1` with no output, and

    ```
    rg -n "60_000|60000" src/core/persistence/geopackage/project-gpkg-fixture.test.ts
    ```

    exits `0` with one match per `it(` in the file (`CONSTRAINTS.md:96-102`).

---

## J. Negative criteria — the traps (spec:452-488)

48. **[MACHINE]** **T5 — empty array is `null` on the way out and `undefined` on the way back.**
    Discharged by criteria 35, 36 and 43. Restated as a grep so a failure names itself: the
    literal `return []` and `?? []` do not appear in `decodeExternalIds`:

    ```
    sed -n '/^export function decodeExternalIds/,/^}/p' src/core/persistence/geopackage/validation.ts | rg -n "return \[\]|\?\? \[\]"
    ```

    exits `1` with no output. Decoding to `[]` makes criterion 45's step 8 report 1027 instead
    of 1.

49. **[MACHINE]** **T6 — only `!= null`, never `in`, never `hasOwnProperty`.** `decodeRow`
    (`columnDescriptor.ts:63-69`) assigns every descriptor prop unconditionally, so
    `"externalIds" in entity` is `true` on every loaded row even when the value is `undefined`.

    ```
    rg -n '"externalIds" in |hasOwnProperty\("externalIds"\)|hasOwnProperty\(.externalIds.\)' src/
    ```

    exits `1` with no output. Every presence test for `externalIds` in source **and** in tests
    is written `!= null` or `!== undefined`.

50. **[MACHINE]** **T4 — the descriptor carries no `constraints` key.** Discharged by
    criterion 39. Grep form:

    ```
    sed -n '/prop: "externalIds"/,/^  },$/p' src/core/persistence/geopackage/units.table.ts | rg -n "constraints"
    ```

    exits `1` with no output.

51. **[MACHINE]** **T3 — the descriptor carries `optional: true` *and* `fallbackSql: "NULL"`.**
    Discharged by criteria 39 and 44. Grep form:

    ```
    sed -n '/prop: "externalIds"/,/^  },$/p' src/core/persistence/geopackage/units.table.ts | rg -c "optional: true|fallbackSql: \"NULL\""
    ```

    exits `0` reporting **2** matching lines.

52. **[MACHINE]** **`decodeExternalIds` never throws, on any input.** Discharged by
    criterion 38. Additionally, the function body contains a `try`/`catch` around the
    `JSON.parse` (mirroring `decodeAliases`, `validation.ts:25-32`):

    ```
    sed -n '/^export function decodeExternalIds/,/^}/p' src/core/persistence/geopackage/validation.ts | rg -c "try \{|\} catch"
    ```

    exits `0` reporting **2** matching lines.

53. **[MACHINE]** **T7 — no NUL bytes.**

    ```
    rg --text -c '\x00' src/ docs/
    ```

    exits `1` and prints nothing. **Note:** the command printed at spec:488 and
    `SLICE_BUILD_LOOP.md:120`, `rg -c $'\x00' src/`, does **not** work — in Git Bash `$'\x00'`
    expands to an empty pattern and ripgrep then matches every line of every file and exits `0`.
    Use the form above (recorded in `SLICE_0_1_OPEN_QUESTIONS.md`, Q1). Shell-independent
    equivalent:

    ```
    node -e "const{readFileSync}=require('fs');const{execSync}=require('child_process');const files=execSync('git ls-files src docs').toString().split('\n').filter(Boolean);const bad=files.filter(f=>{try{return readFileSync(f).includes(0)}catch{return false}});console.log(bad.length?'NUL: '+bad.join(', '):'clean');process.exit(bad.length?1:0)"
    ```

    prints `clean` and exits `0`. (Untracked new files must be `git add -N`'d first for the node
    form to see them; the `rg` form sees them regardless.)

54. **[MACHINE]** **T7 — no backtick template literals in any file this slice authors or
    edits.** In `src/core/entity/externalId.ts` and
    `src/core/persistence/geopackage/units.table.externalIds.test.ts`, no backtick appears in
    code position (backticks inside JSDoc comment lines are fine):

    ```
    rg -n "^\s*[^\s*/].*\x60" src/core/entity/externalId.ts src/core/persistence/geopackage/units.table.externalIds.test.ts
    ```

    exits `1` with no output, and `rg -n '\$\{' src/core/entity/externalId.ts src/core/persistence/geopackage/units.table.externalIds.test.ts`
    exits `1` with no output. In particular `externalIdKey` is built by string concatenation
    (`scheme + ":" + ...`), **not** by the template literal the spec's JSDoc prints at
    spec:393. For the four modified files, the diff adds no new backtick in code position:

    ```
    git diff -- src/core/entity/entity.ts src/core/persistence/geopackage/units.table.ts src/core/persistence/geopackage/validation.ts src/core/persistence/geopackage/validation.test.ts src/core/persistence/geopackage/project-gpkg-fixture.test.ts | rg -n "^\+[^+].*\x60"
    ```

    exits `1` with no output. (`units.table.ts` already contains pre-existing template literals
    at lines 130, 137 and 158 — those are **not** to be touched.)

55. **[MACHINE]** **T1 — the `Entity` field mirror is not touched.** The
    `export type Entity = EntityCore & { ... }` block is byte-identical to `HEAD`:

    ```
    diff <(git show HEAD:src/core/entity/entity.ts | sed -n '/^export type Entity = EntityCore & {/,/^}/p') <(sed -n '/^export type Entity = EntityCore & {/,/^}/p' src/core/entity/entity.ts)
    ```

    exits `0` with no output. T1 does **not** apply to this slice — `externalIds` is an
    `EntityCore` field and reaches `Entity` through the intersection (spec:411-413) — and this
    criterion proves nobody "helpfully" mirrored it anyway.

56. **[MACHINE]** **No existing test is deleted or skipped.** Together with criterion 4:

    ```
    git diff -- src/core/persistence/geopackage/validation.test.ts src/core/persistence/geopackage/project-gpkg-fixture.test.ts | rg -n "^-\s*it\("
    ```

    exits `1` with no output. `git diff --stat -- src/core/persistence/geopackage/units.table.test.ts`
    prints nothing (that file is not touched at all). Prohibition 6.

---

## K. Negative criteria — what Slice 1 must NOT contain (spec:36-42, spec:373-374)

57. **[MACHINE]** **The changed-file set under `src/` is exactly these eight paths.**
    `git status --porcelain --untracked-files=all -- src` lists exactly them and nothing else
    (status letters may be `M`, `A` or `??`; `src/` is clean at `507f425`, so anything else is
    scope creep):

    ```
    src/core/entity/externalId.ts
    src/core/entity/externalId.test.ts
    src/core/entity/entity.ts
    src/core/persistence/geopackage/validation.ts
    src/core/persistence/geopackage/validation.test.ts
    src/core/persistence/geopackage/units.table.ts
    src/core/persistence/geopackage/units.table.externalIds.test.ts
    src/core/persistence/geopackage/project-gpkg-fixture.test.ts
    ```

    This one criterion subsumes "no store field", "no UI", "no migration", "no `relationships`
    table" and "no change under `src/core/relationship/`", because every one of those would add
    a path. Criteria 58-63 restate the individually named prohibitions so a failure names
    itself.

58. **[MACHINE]** **Nothing under `src/core/relationship/` changes.** Slice 0 is committed and
    finished.

    ```
    git status --porcelain --untracked-files=all -- src/core/relationship
    ```

    prints nothing, and `git diff HEAD --stat -- src/core/relationship` prints nothing.

59. **[MACHINE]** **`saveGeoPackage`'s signature does not change** (spec:373-374). The
    parameter list is byte-identical to `HEAD`:

    ```
    diff <(git show HEAD:src/core/persistence/geopackage/save.ts | sed -n '/^export async function saveGeoPackage(/,/^): Promise<Uint8Array> {/p') <(sed -n '/^export async function saveGeoPackage(/,/^): Promise<Uint8Array> {/p' src/core/persistence/geopackage/save.ts)
    ```

    exits `0` with no output, and `git status --porcelain -- src/core/persistence/geopackage/save.ts`
    prints nothing. `external_ids` travels inside `entities`, so every existing call site stays
    green.

60. **[MACHINE]** **No `relationships` table, migration, store field or UI.**
    `test -f src/core/persistence/geopackage/relationships.table.ts` exits `1`, and

    ```
    git status --porcelain --untracked-files=all -- src/store src/hooks src/modules src/ui src/pages src/shell src/components src/types
    ```

    prints nothing.

    ~~No migration file is added: `rg -ln "migrat" src/core/persistence/` exits `1` with no
    output.~~

    > **Amendment, 2026-07-29 — owner-authorised. The only amendment to this frozen file.**
    > The struck sub-clause was **defective at authoring time**, not failed by the code. The
    > grep matches pre-existing JSDoc prose (`"pre-migration schema"` in `columnDescriptor.ts`,
    > `load.ts`, `save.ts`) and the legacy `migrateLegacyOrganisations` helper in
    > `organisations.table.ts`. Proof it was never satisfiable: the identical grep run against a
    > clean `git archive HEAD` extraction of `src/core/persistence`, containing **no Slice 1 code
    > at all**, returns the same seven files and exits `0`. `git diff HEAD -- src/ | rg "^\+.*migrat"`
    > exits `1`, so Slice 1 adds zero matching lines. The sub-clause would have failed on an empty
    > slice.
    >
    > The clause's substantive intent — *no migration file is added* — **is satisfied**, and is
    > independently proven by criterion 57, whose changed-file set under `src/` is exactly the
    > eight authorised paths. The other two sub-clauses of criterion 60 are untouched and both
    > pass.
    >
    > Same disposal as Slice 0's criterion 23: a proxy check that contradicts the thing it proxies
    > for is what gets amended, not the code. Recorded rather than deleted so the defect stays
    > visible to the next reader.

61. **[MACHINE]** **No pre-existing violation is "fixed"** (Prohibition 5).

    ```
    git status --porcelain -- src/store/useProjectStore.ts src/modules/orbat/ui/EntityInspector.tsx
    ```

    prints nothing. `useProjectStore.ts` stays at 343 lines and `EntityInspector.tsx` at 611;
    both are recorded at spec:499-500 and neither is this slice's business.

62. **[MACHINE]** **No UI is built for the labels.** `EXTERNAL_ID_LABELS` has no consumer in
    this slice: `rg -l "EXTERNAL_ID_LABELS" src/` lists **only**
    `src/core/entity/externalId.ts` and `src/core/entity/externalId.test.ts`. Slice 1 ships the
    strings; the picker that renders them is a later slice.

63. **[MACHINE]** **No `Claim.relationshipId`, no export gate, no `activeAt`, no `query.ts`** —
    the Slice 0 exclusions stay excluded:
    `rg -n "activeAt|exportGate|canExport" src/` exits `1` with no output, and
    `test -f src/core/relationship/query.ts` exits `1`.

---

## L. Human review

The spec states at spec:448: **"Slice 1 has no human-review items."** That is correct — every
clause in the Slice 1 section is machine-checkable, and the one thing that looks like prose
(the nine UI labels) is a verbatim string list locked byte-for-byte by criterion 12. The single
entry below is the build loop's own procedural obligation, not a spec clause, and is recorded
here only so it reaches the morning-review list.

64. **[HUMAN]** Every entry appended to `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` during this
    run (Q21-Q26 from planning, plus anything the coding, test-author or verification agents
    add) is read and answered before Slice 2 starts. Q19's LEI mod-97 gap in particular is a
    **known, deliberate gap recorded as such** (criteria 19-20) — a reader confirms it stays a
    gap rather than being silently closed or silently forgotten.

---

## Notes for implementers (not criteria)

- `tsconfig.app.json` sets `noUnusedLocals` and `noUnusedParameters`. A type-level assertion
  helper in a test file must be referenced or exported, or `tsc -b` (criterion 2) fails.
- `verbatimModuleSyntax` is on: import types with `import type`.
- `vitest.config.ts` sets global coverage thresholds (12 / 9 / 9 / 12) and they currently pass
  with room. The new files are well covered, so this should not bind — but a Phase 4 failure
  reading `ERROR: Coverage for lines does not meet global threshold` is a real gate, not a
  flake.
- `eslint.config.js` enforces no `max-lines` rule; the 300-line cap at `CONSTRAINTS.md:113` is a
  convention. `project-gpkg-fixture.test.ts` is 268 lines and the hard gate adds ~28 — it stays
  under. `units.table.test.ts` is already 282, which is why criterion 39's tests go in a new
  file.
- `saveGeoPackage`'s real parameter order is
  `(layers, entities, geometries, researchSources, baseBuffer, sources?, claims?, ratingEvents?)`.
  The hard gate passes `first.sourceCache` as the fourth argument and `buffer` as the fifth,
  exactly as the `aliases` gate does at `project-gpkg-fixture.test.ts:102`.
- `saveGeoPackage` folds legacy `organisations` rows into `units` on every save, so corporate
  entities also carry `external_ids`. The hard gate still targets a `kind === "unit"` entity,
  cloning `:97` — do not "improve" it into a corporate target.
- The `aliases` descriptor at `units.table.ts:47-57` is the exact template for `external_ids`;
  `decodeAliases` at `validation.ts:23-33` is the exact template for `decodeExternalIds`. Copy
  their shape rather than inventing one.
