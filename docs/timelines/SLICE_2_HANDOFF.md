# Handoff — Slice 2A resumption and the Slice 2B spec

**Written:** 2026-07-29, at the end of the run that shipped Slices 0 and 1.
**For:** a session with no memory of that run. Everything needed is here or is cited by path.
**Read in this order:** this file, then `docs/timelines/SLICE_RUN_LOG.md`, then
`docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`.

---

## 1. Where the tree stands

| | |
|---|---|
| Branch | `telegram-osint-sidecar` (not `main`; nothing pushed) |
| HEAD | `c8483b5` — `docs: pin 5b0d2ed as the pre-migration revert point for Slice 2` |
| **Pre-migration revert point** | **`5b0d2ed`** — pinned by the owner. The backup for the migration is git history and nothing else. |
| `npm run verify` | GREEN — 63 test files, 502 tests, lint clean, `tsc -b && vite build` clean |
| Working tree | clean except `docs/timelines/SLICE_2A_CRITERIA.md` (untracked) and an appended `SLICE_0_1_OPEN_QUESTIONS.md` |
| `public/project.gpkg` | untouched, md5 `7d0b0e592a1128a0d83e7575110bf2dc` |

Shipped, committed, and closed:

- **Slice 0** — `507f425`. `src/core/relationship/`: the `Relationship` record, the closed
  13-entry edge vocabulary at `EDGE_VOCABULARY_VERSION` 1.0.0, nine-code validation. Three
  field-less profiles (`vessel`, `person`, `equipment_class`) and `ENTITY_KINDS`. Trap T2 closed
  in the units decoder.
- **Slice 1** — `cfaf80b`. `src/core/entity/externalId.ts`, `externalIds` on `EntityCore`, and the
  `external_ids` column with `decodeExternalIds`.
- Owner follow-ups: `d02654f` stopped case-folding free-form external ids (closing Q31),
  `5b0d2ed` renamed `CONTEXT.md`'s Relationships section.

**Do not modify** `src/core/relationship/` or `src/core/entity/externalId.ts`. Finished work.

---

## 2. Slice 2A — frozen criteria, zero code. Resume here first.

Slice 2 was deliberately split. **2A is safety scaffolding with no migration code**, because the
spec's own "Ordering and safety in Slice 2" subsection says the `saveGeoPackage` refactor must be
its own commit *"before any migration code."*

`docs/timelines/SLICE_2A_CRITERIA.md` (755 lines, **53 `[MACHINE]` + 4 `[HUMAN]`**) is written and
frozen. **No source file was touched** — the run hit a session limit after the planning phase and
before the first coding agent. So 2A is cleanly unstarted with its contract already in place.

### The four in-scope tasks

1. Convert `saveGeoPackage` to an options object. Eight positional params, five optional trailing,
   **all eight wired to a table write**, so omission is destructive for six of them.
2. Guard `performProjectSave` so a failed load cannot arm a destructive save.
3. Extract `projectStateFromLoadResult` from the duplicated literals in `useProjectIO.ts`.
4. Delete the `mock.calls[0][4]` positional assertion in `useProjectIO.save-ordering.test.ts` and
   replace it with a named-option assertion at least as strong.

**Out of scope, deferred to 2B:** the `relationships` table, `integrity_events`, any migration
code, required `setProject` fields, `activeParentMap`, `commitRelationships`,
`unacknowledgedIntegrityEvents`, the 13 legacy corporate links.

### Reconnaissance already done — do not redo it

**19 sites must convert, not 16.** The three the original brief missed are the reason a naive
conversion fails to compile:

| where | count |
|---|---|
| `src/hooks/useProjectIO.ts` | 2 calls (`:84` in `performProjectSave`, `:175` in `handleNew`) |
| `geopackage.service.test.ts` | 4 calls (`:62`, `:130`, `:184`, `:289`) |
| `project-gpkg-fixture.test.ts` | **9** calls (`:68, 102, 128, 151, 164, 205, 231, 264, 281`) |
| `project-open-save-restore.integration.test.ts` | 1 call (`:45`) |
| `save.ts:29` | the declaration |
| **`useProjectIO.ts:63-72`** | the `ProjectSaveDeps.saveGeoPackage` **function type** |
| **`save-ordering.test.ts:24-27`** | the `vi.fn` mock satisfying that type |

Other measured facts: `useProjectIO.ts` load catch at `:128-132`; duplicated literals at
`:114-120` and `:194-200` (seven lines each, not five — an identical `applyGeoPackageResult` call
precedes both at `:113` and `:193`); `performProjectSave` at `:82-98`.

### Three traps in the 2A work itself

- **Task A necessarily leaves the suite RED, and that is expected.** Converting the
  `ProjectSaveDeps` type makes `save-ordering.test.ts:53`'s `mock.calls[0]?.[4]` read `undefined`
  and fail. `tsc` will *not* catch it — the mock is `Mock<any>`, so `calls[0]?.[4]` typechecks
  and fails only at runtime. That assertion is Task 4, owned by Task B. **Do not take a pass/fail
  verdict between A and B.**
- **The shared `makeInput()` fixture at `save-ordering.test.ts:4-13` will trip the new guard.**
  It returns empty `entities`/`geometries`/`claims`/`sources` while `makeDeps()` hands back a
  4-byte buffer — exactly the shape Task 2's guard refuses. All four pre-existing tests go red
  unless `makeInput` gains at least one entity. Tell the agent this or it will read a working
  guard as a broken one.
- **Task A pushes two test files over the 300-line cap** — `project-gpkg-fixture.test.ts`
  299→~338 and `geopackage.service.test.ts` 321→~350. See Q35 below; this needs a ruling.

---

## 3. Five open questions blocking 2A — owner rulings needed

Recorded as **Q32–Q36** in `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md`. The planner implemented
the conservative option for each and flagged it rather than guessing silently.

**Q32 — are all eight `SaveGeoPackageOptions` fields required?** *Implemented: yes, all eight
required, the five nullable ones typed `T | undefined` rather than `?`, so "nothing here" must be
written explicitly and a forgotten key is a compile error.* The reasoning is that naming the
params fixes wrong-slot bugs but not the failure the spec actually names — *"omission silently
wipes a table"* — and only requiredness makes omission a compile error. The same spec section
applies the identical remedy to `setProject` one item later. Given teeth by a
`@ts-expect-error` type test that breaks the build if a field is later made optional. **Cost:
churn at every call site.** If the owner rules the other way it is one keystroke per field.

**Q33 — what distinguishes "never successfully loaded" from "legitimately empty"?** The planner
looked before inventing and found **no existing signal**: the hook-local error is cleared by
`handleSave` at `:225` and is invisible to `performProjectSave`; `restoredFromSession` is never
set by `handleOpen` and self-clears after 4s; `useProjectStore` has no `loaded` field and must not
gain one (Prohibition 5). *Implemented: refuse when `loadProject` returned a buffer with
`byteLength > 0` **and** entities, geometries, claims and sources are all empty.* **Two rulings
owed:** the residual false positive (a real project that is genuinely empty in all four
collections), and the wording of the refusal.

**Q34 — where does `projectStateFromLoadResult` live?** *Implemented: same file as
`performProjectSave`, exported plain function, no new module, no new domain type.*

**Q35 — the 300-line cap versus Prohibition 5, and they conflict.** `project-gpkg-fixture.test.ts`
is compliant today, so crossing the cap is a **new** violation and must be split.
`geopackage.service.test.ts` is **already 321 lines** — a pre-existing violation — so splitting it
would be *fixing* one, which Prohibition 5 forbids. *Implemented: split the first, leave the
second over-cap.* This is a genuine rule collision and wants an explicit ruling.

**Q36 — a measured defect in the loop, not a guess. This one matters beyond Slice 2.**

> The NUL byte-scan printed at `GABRIEL_V2_SLICE_0_1_BUILD.md:488` and `SLICE_BUILD_LOOP.md:120`
> — `rg -c $'\x00' src/` — **is vacuous in Git Bash**, and so is the `rg --text -c $'\x00'`
> workaround used throughout the Slice 0 and 1 runs.

Verified directly: against a two-line NUL-**free** control file both forms report `2` and exit
`0`; against a file that **does** contain a NUL they report `2` and exit `0`. Identical. Git Bash
collapses `$'\x00'` to an empty-string argument, so the pattern matches every line and the check
**can never fail**. Every agent-reported NUL scan in this project has been vacuously green.

**The shipped slices are nonetheless clean.** The pre-commit scans run before each commit used
Node (`fs.readFileSync(f).includes(0)`), which distinguishes correctly: 299 files scanned before
Slice 0, 302 before Slice 1, zero hits. The *code* was really scanned; the *rg command in the
docs* is what is broken.

**Action required:** replace the command in both `SLICE_BUILD_LOOP.md:120` and the spec with a Node
byte scan, and forbid reporting an `rg`-based NUL check as evidence. This matters because T7 —
template literals writing NUL bytes and corrupting diffs — is a *recorded historical failure* in
this repo, and its only automated guard has been off the whole time.

```bash
node -e "const fs=require('fs'),p=require('path');let hits=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
 if(['node_modules','.git','dist'].includes(e.name))continue;
 const f=p.join(d,e.name); if(e.isDirectory())walk(f);
 else if(fs.readFileSync(f).includes(0))hits.push(f);}};
walk('src');walk('docs');
if(hits.length){console.error('NUL:',hits.join('\n'));process.exit(1)}
console.log('clean')"
```

---

## 4. Slice 2B — the spec that does not exist yet

**This is the real deliverable of the handoff.** Slices 0 and 1 had
`GABRIEL_V2_SLICE_0_1_BUILD.md`: Done-when clauses, declared signatures, a numbered trap list, and
a "known documentation defects" section. **Slice 2 has none of that.** The only authority is the
section *"Decisions carried into Slice 2 and beyond — do not re-open"* near the end of that same
file — a list of resolved decisions from an expert panel review, not a build spec.

That gap is acceptable for 2A, which is four mechanical refactors. **It is not acceptable for 2B**,
which is the first slice that writes to `public/project.gpkg` — 1,010 units, 17 organisations, an
irreplaceable working file whose only backup is git history at `5b0d2ed`.

### What the decisions section already settles — do not re-open these

- `Entity.parentId` is **kept** as derived and non-authoritative, never deleted. The
  `relationships` table is the source of truth on disk.
- **The retained `parent_id` column is NOT a backup.** If `relationships` is ever empty the derived
  parent goes null and the column is nulled in the same save — primary and backup fail together,
  perfectly correlated.
- **No `kind` heuristic in the migration.** One rule for the 999 unit links (`subordinate_to`), and
  one explicit id-keyed table for the 13 corporate links, so classification is reviewable in a diff
  rather than inferred at runtime.
- `corporate_parent` **must** be in `activeParentMap`'s hierarchy-bearing set alongside active
  organic `subordinate_to`, or those 13 entities derive a null parent and lose their tree on the
  first save.
- Migration ids stay deterministic (`hier:<childId>`) for idempotence.
- `integrity_events` table; `integrityEvents` **required** on `setProject` and flowing through
  `selectPersistableSnapshot`.
- **Capture rejected links verbatim at rejection time**, unnormalised — the original
  `(childId, parentId)` pair survives exactly one save otherwise, because `parentId` is now derived.
- **No banner.** The durable row replaces it.
- **Do not gate `performProjectSave`** on unacknowledged events — blocking save on an irreplaceable
  working file is the wrong failure direction.
- **Fail closed, but not uniformly.** Dangling endpoints and self-loops throw. Dual subordination
  may be *true* — block until a human records which it is, never until someone deletes one.
- The count assertion (`entitiesWithParentId == mintedEdges + skippedAlreadyPresent`) **throws**.
  Note it first runs during the unconditional silent session-restore at `useProjectIO.ts:106-136`,
  before the user has touched anything.

### The 13 legacy corporate links

Hand-classified row by row in the decisions section. All organisation-to-organisation, so all take
`corporate_parent`. **Two carry a shareholding that must survive the migration**: KAMAZ PTC at
49.9%, JSC Kalashnikov Concern at 25%.

**Kalashnikov is the publication-sensitive row.** Rostec holds a blocking minority against a
private majority; any published edge omitting the 25% figure implies control the source explicitly
denies. Its percentage is not optional data.

**PJSC Motovilikha Plants → NPK Techmash JSC is the only two-level chain** — assert it explicitly
in the migration test. Rostec, Almaz-Antey, USC and KTRV are roots and get no edge.

### What the 2B spec must add that the decisions section does not have

1. **Declared signatures** for `activeParentMap`, `commitRelationships`,
   `unacknowledgedIntegrityEvents`, the migration entry point, and the `relationships` /
   `integrity_events` column descriptors — written out, the way Slice 0/1's spec wrote out
   `relationship.ts` and `externalId.ts`.
2. **A numbered trap list.** T3–T6 all apply again to two new tables. Whatever else it contains, it
   needs the equivalent of T4 (`constraints` splices into `ALTER TABLE ADD COLUMN`) and T5
   (empty decodes to `undefined`, never `[]`) restated for the new columns.
3. **Explicit Done-when clauses**, so criteria can map one-to-one.
4. **The rehearsal procedure.** The decisions section says to run against the **real**
   `public/project.gpkg`, not a synthetic fixture, and that a preview UI is not needed and should
   not be built. Write down what a successful rehearsal looks like and what is checked afterwards.
5. **The tests required before 2B touches the real file** — the decisions section lists them; the
   spec should make each a Done-when. The load-bearing one: *a new real-WASM integration test
   exercising the actual store path* (load → `projectStateFromLoadResult` → `setProject` →
   `selectPersistableSnapshot` → save → reload), deep-equalling the full `entityId → parentId` map,
   then saving and reloading again to assert **1,012 edges and not 2,024**. All three existing
   persistence tests bypass this path, *which is why the hard gate can pass green while the running
   app destroys data.*
6. **Measured ground truth restated**: 1010 `units` rows, 999 with a non-null `parent_id`, 17
   `organisations` (13 with a parent), 1027 entities after `load.ts` folds organisations, 1012 with
   a non-null `parentId`. Do **not** trust the "1,010 units" figure repeated in the PRD.

---

## 5. Process lessons — read before writing 2B criteria

Three failures in this run, each of which cost a rebuild. All three are avoidable by construction.

**1. Never phrase a criterion as "this string appears nowhere in directory X."** It has now been
defeated twice, in consecutive slices, by ordinary prose:

- Slice 0's criterion 23 required no semicolon in prose whose authored text legitimately contains
  semicolons — mutually unsatisfiable with criterion 24, which required byte-identity to that same
  prose.
- Slice 1's criterion 60 required `"migrat"` to appear nowhere under `src/core/persistence/`, where
  it appears in JSDoc (`"pre-migration schema"`) and in the legacy `migrateLegacyOrganisations`
  helper. It returned the same 7 files against a clean `HEAD` extraction with **no slice code at
  all** — it would have failed on an empty slice.

**Scope such checks to the diff** (`git diff <base> -- src/ | rg "^\+.*pattern"`), never to the
tree. Both criteria are now struck with dated owner-authorised amendments.

**2. Key the repeat-failure check on the criterion number, never the file path.** The loop's
control rule says two identical consecutive failures are a spec defect and must stop the run. In
the Slice 0 run the orchestrator keyed the check on file-plus-message; the reported file moved
between iterations while the criterion stayed the same, the signatures did not match, and a third
iteration ran — which reached green by editing the spec's published CC-BY prose. Fixed for Slices
1 and 2A, but it is a property of the orchestrator, not of the repo, so **re-verify it in any new
harness.**

**3. A machine must not adjudicate a contradiction between the criteria and the spec.** When it
happened, the agents behaved correctly at every step *except* the last: three separate agents
identified the contradiction and refused to weaken the test, and the one that finally resolved it
led its report with a loud disclosure and recorded both original strings verbatim for restoration.
The recovery worked. But the resolution itself was still a judgement about *published prose* that
belonged to a human. Coding agents in 2A are instructed to **record and stop** instead. Keep that
instruction.

---

## 6. Suggested order for the next session

1. **Rule on Q32–Q36.** Q36 is the urgent one — it is a safety control that has been off since the
   first slice. Q35 is a genuine rule collision. The rest are design calls with a conservative
   option already implemented.
2. **Fix the NUL command** in `SLICE_BUILD_LOOP.md:120` and the spec. Small, and it unblocks honest
   verification for everything after.
3. **Resume Slice 2A** against its frozen criteria. No code exists yet; the contract does. Expect
   Task A to leave the suite red until Task B lands, and do not grade in between.
4. **Author the Slice 2B spec** — the section-4 checklist above is its outline. Discuss it before
   building it; the migration is the first irreversible thing this project does.
5. Only then build 2B, with `5b0d2ed` pinned and stated in the commit.

**Two protocol lines from the decisions section, worth repeating because they bite hardest here.**
Commit before switching builds, every time — otherwise the pre-migration state and a day's work
weld into one uncommitted blob. And whoever migrates first says so in the handoff: if both
collaborators open the same pre-migration copy independently they each migrate and produce two
divergent binaries, with no merge tool. The second person takes the migrated file, not their own
copy.
