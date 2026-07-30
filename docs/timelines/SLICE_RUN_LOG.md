# Slice Run Log

Append-only record of unattended `docs/SLICE_BUILD_LOOP.md` runs. Each entry answers,
without opening the code: which slices committed and at what SHA, how many iterations each
took, every question an agent had to guess at, and every `[HUMAN]` criterion still awaiting
eyes.

---

## Run 2026-07-29 — Slices 0 and 1

### Phase 0 — Orient

- **Authoritative spec:** `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` (supersedes
  `GABRIEL_V2_FOUNDATION_SPEC.md` for these two slices).
- **Starting commit SHA — the revert point:** `005f2d4fd4f7a89a89ffef88512530b73573538f`
  (`docs: record Slice 9, edge persistence`).
- **Baseline `npm run verify`:** GREEN at that SHA. `lint` clean, `test:coverage` passed
  (34.48% statements, no threshold gate), `build` succeeded in 14.58s.
- **Working tree at start:** not fully clean, but **no source file was modified** — only
  documentation: `docs/README.md` and `docs/adr/0009-machine-never-confirms.md` modified,
  `docs/timelines/STANAG_SOURCE_RATING_TIMELINE.md` staged for deletion, and four untracked
  docs (`docs/SLICE_BUILD_LOOP.md`, `GABRIEL_V2_FOUNDATION_SPEC.md`,
  `GABRIEL_V2_SLICE_0_1_BUILD.md`, `GABRIEL_V2_TIMELINE.md`), which are the loop and the spec
  themselves. Recorded rather than treated as a stop, since the rule exists to prevent
  building on unreviewed *source* changes and there are none.

### Phase 1 — Planning agent: the frozen criteria

One planning agent produced `docs/timelines/SLICE_0_CRITERIA.md` and wrote no code. It froze
**65 criteria: 60 `[MACHINE]` and 5 `[HUMAN]`**, grouped A–J (global gates, the eight files
in the spec's Slice 0 "Files" block, per-module behaviour, the human review list, the traps as
negative criteria, and the "must NOT contain" list that keeps Slice 1 out of this tree).

Criterion 57 is the one worth knowing about if you read nothing else: it fixes the changed-file
set under `src/` at exactly ten paths, which is what makes "no store field", "no UI", "no
migration" and "no `relationships` table" a single checkable statement instead of four.

The planner raised four questions rather than guessing (Q1–Q4 in
`docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md`), the sharpest being that the spec's own NUL
byte-scan command does not work (Q1) and that a coverage threshold gate exists where the brief
said none did (Q4).

### Phases 2–4 — three build iterations

The loop's cap is three iterations per slice. All three were used.

| iteration | outcome | blocking criterion |
|---|---|---|
| 1 | RED | 23 — `publicDefinition` "no semicolon" test failed |
| 2 | RED | 23 — same test, **identical error** |
| 3 | GREEN | — reached by editing the spec's authored prose (see below) |

**What criterion 23 was.** It required every one of the thirteen published edge definitions to
contain no backtick **and no semicolon**, as evidence that PRD implementation mechanics had been
stripped rather than pasted. Criterion 24 separately required those same thirteen strings to be
byte-identical to the prose authored in the build spec at `GABRIEL_V2_SLICE_0_1_BUILD.md:198-247`
— and two of those authored sentences (`corporate_parent`, `owned_by`) use a semicolon as
ordinary English punctuation. The two frozen criteria were mutually unsatisfiable. No
implementation could satisfy both, which is why iterations 1 and 2 failed identically.

Three separate agents spotted this correctly and all three refused to weaken the test, exactly as
the prohibitions require: the Phase 2 coding agent (now **Q16**, formerly `Q8-B`), the Phase 3
test author (**Q12**), and by implication the Phase 4 runner, which is forbidden from editing
anything at all.

### Defect in the loop orchestration — not in the code

`docs/SLICE_BUILD_LOOP.md`, "Loop control": *"If two consecutive iterations fail on the same
criterion with the same error, stop immediately — that is a spec defect, not a code defect, and
another iteration will not fix it."*

**That rule should have stopped this run after iteration 2. It did not.** The orchestrator's
failure-signature comparison keyed on *file plus error message* rather than on the criterion. The
reported file moved between iteration 1 and iteration 2 while the criterion and the message
stayed the same, so the two signatures did not match, the run was not recognised as repeating,
and a third iteration was launched.

The consequence is precisely the one the rule exists to prevent: with the contradiction still
unresolved, iteration 3 could only reach green by editing one side of a frozen contradiction, and
it edited the published prose. **Record this against the loop, not against the code.** Anyone
hardening the orchestrator should key the repeat-failure check on the criterion number, which is
stable, and never on the file path, which is not.

### Iteration 3, and the owner's two rulings on 2026-07-29

**Iteration 3 reached green by re-punctuating the spec's authored CC-BY prose** — two semicolons
became full stops in `GABRIEL_V2_SLICE_0_1_BUILD.md`, then mirrored into `vocabulary.ts` and the
test's transcription. The agent recorded the whole reasoning, and the two original sentences
verbatim so they could be pasted back, as **Q14** — the loudest entry in the open-questions file.
Its argument was that the criteria file is frozen while the spec was an untracked working-tree
draft, so the draft was the side that could legitimately move.

**Ruling 1 — the owner ruled the other way.** The prose is restored, semicolons included, and
**criterion 23 is amended to drop its no-semicolon clause**. That is the one and only authorised
amendment to the frozen criteria file; every other criterion is byte-identical to what Phase 1
froze, and the amendment carries a dated note in place. The owner's reasoning: the spec itself
calls the no-semicolon check a heuristic "proving PRD mechanics were stripped rather than
pasted"; ordinary English punctuation in authored prose is not PRD mechanics; and a proxy
assertion must never rewrite the artefact it exists to protect — the definitions ship verbatim in
a CC-BY dataset, the assertion ships nowhere. Q12, Q14 and Q16 are all closed by this ruling.

**Ruling 2 — the multiple-active-hierarchy predicate is now fail-closed.** As built, the
dual-subordination check treated an edge as hierarchy-bearing only if its metadata said
`attachment: "organic"` explicitly, so an edge carrying **no** `attachment` at all was silently
skipped by the gate. The owner ruled that **absent attachment counts as organic**: an edge is
excluded from the check only when it says `attachment: "attached"`. This matters immediately.
Slice 2's migration mints `subordinate_to` edges for the **999** units that carry a `parent_id`,
and it does not stamp an attachment on them. Under the old predicate the dual-subordination gate
would have inspected none of those 999 edges and reported nothing; under the ruling it inspects
all of them and will fire wherever a child really does have two active parents. That is the
intended direction — the loop's own guidance is that dual subordination may be *true*, and must
block until a human records which it is, rather than be quietly dropped.

### Phase 5 — review findings and how each was disposed of

`/code-review` against the Phase 0 SHA returned **8 findings: 2 correctness and 6 style**.

**Correctness 1 — the published CC-BY definitions had been edited to satisfy a test.** Disposed
of by Ruling 1 above: the prose is restored verbatim, `vocabulary.ts` and the test transcription
are mirrored back to it, the `not.toContain(";")` assertion is removed from the definition-shape
test, and criterion 23 is amended with a dated owner authorisation. No other assertion was
touched and no test's strength was reduced — the `>= 40 characters` and no-backtick checks
remain as separate explicit assertions.

**Correctness 2 — `multiple-active-hierarchy` skipped edges with no `attachment`.** Disposed of
by Ruling 2 above: the predicate is inverted to fail closed, and the accompanying test covers the
absent-attachment case.

**The 6 style findings — applied directly, but only one is recoverable from the repo, and that
is a gap.** The loop's Phase 5 says style and simplification findings "are applied directly
unless they would change behaviour covered by a criterion", and they were, by the source-editing
tasks of this run. Only one left a durable trace: **finding 2** asked that
`invalid-export-override`'s single conflated `detail` string ("malformed, or `proposedBy` and
`confirmedBy` are the same person") be split so an analyst can tell which rule fired. It was
applied, and it surfaced a question of its own — **Q20**, on which of the two details a
blank-but-equal override should get. No validation rule changed; only the wording of `detail`.

The other five cannot be enumerated from any file in the repo, because `/code-review` writes its
findings to the transcript and to nothing durable. The documentation agent that wrote this
section declined to reconstruct them from the diff, on the grounds that a guessed list is worse
than an admitted absence. **What a morning reader should do:** treat the final diff as the record
of the remaining five, and note the process defect — *Phase 5 needs to persist its finding list
somewhere the run log can quote*, exactly as Phase 2 persists its guesses to the open-questions
file. Until it does, this line of the log cannot be both honest and complete.

### Documentation housekeeping done in the same pass

- **`docs/README.md` was stale and actively dangerous.** `CONSTRAINTS.md:162` makes it the
  canonical list of planning docs, and it listed `timelines/GABRIEL_V2_FOUNDATION_SPEC.md` as the
  live build spec for v2.0 Stage 1 — the exact document the Slice 0/1 build spec says must not be
  read for these slices, because it still describes the revised-away plan (`parentId` deletion,
  `query.ts`, seven violation codes, an eight-slice Stage 1). An agent following the index walked
  straight into it. That row is now marked **Superseded (Slices 0–1)** and names what supersedes
  it, the "Agent Planning Doc Set" section carries the same warning, and the five docs this
  workflow created but never indexed are now listed: `SLICE_BUILD_LOOP.md`,
  `timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`, `timelines/SLICE_0_CRITERIA.md`,
  `timelines/SLICE_0_1_OPEN_QUESTIONS.md` and `timelines/SLICE_RUN_LOG.md`.
  (Q7 asked whether adding ADR 0010 obliged a README edit and correctly answered no — the index
  lists `adr/` as a directory. It does enumerate individual timeline docs, which is why these
  five were genuinely missing.)
- **The open-questions file had colliding ids.** Two different entries were both `Q8`, on top of
  a separately suffixed `Q8-B`, so "Q8 resolved" meant nothing. Every entry now has a unique id,
  every in-file cross-reference is updated, no question text changed and no entry was deleted,
  and each renumbered entry carries a line naming what it used to be called. The map is at the
  top of that file: `Q8-B` → `Q16`, `Q9-B` → `Q17`, `Q8` (Trap T2 allowlist) → `Q18`, `Q8`
  (CONTEXT.md `## Relationships`) → `Q19`, `Q10-D` → `Q10`, `Q11-D` → `Q11`. No id was reused for
  a different entry, so an old citation can never silently land on the wrong text.
  **One stale citation remains and needs a human:** criterion 23's amendment note in
  `SLICE_0_CRITERIA.md` cites "Q8-B, Q12 and Q14"; `Q8-B` is now `Q16`. The criteria file is
  frozen and may not be edited except by the owner's single authorised amendment, so it was left
  alone.

### Open questions still awaiting a human

At the time of writing `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` holds **19 entries. Three
are closed** by Ruling 1 (**Q12**, **Q14**, **Q16** — all three raised the same semicolon
contradiction). **Sixteen are still owed an answer**, and `[HUMAN]` criterion 48 says all of them
are answered before Slice 2 starts:

| id | one line |
|---|---|
| **Q1** | The spec's and the loop doc's NUL byte-scan command, `rg -c $'\x00' src/`, silently matches everything and always exits 0. The criteria use a working form; **both source documents still print the broken one.** |
| **Q2** | The spec names no test files; the criteria fixed them to the repo's colocated `*.test.ts` convention. Confirm that is the convention you want. |
| **Q3** | Which glossary terms Slice 0 owes `CONTEXT.md`. Three were added (Relationship, Record tier, Assessment tier); the spec named none. Folds into criterion 47. |
| **Q4** | Informational, no decision needed: a coverage threshold gate does exist (12/9/9/12), contradicting the Phase 1 brief. Recorded so a future coverage failure is not misread as a flake. |
| **Q5** | The spec gave `decodeExportOverride` five reject cases and no accept case, so a stub returning `undefined` would have passed. One accept case was added. Confirm it is the right one. |
| **Q6** | Whether a `publicDefinition` is one line or keeps the spec block's wraps. One line was chosen, since the wraps are an artefact of the spec's formatting. |
| **Q7** | Answered, not a guess: adding an ADR does not oblige a `docs/README.md` edit. Left in place so no agent re-opens it. |
| **Q9** | How much of the deferred Slice 2 migration decision belongs in ADR 0010 without duplicating the build spec. Only the three facts the supersession depends on were recorded. |
| **Q10** | Whether one edge may draw two violations of the *same* code (two dangling endpoints, two bad dates). At most one per (edge, code) pair was implemented, with every offender named in the detail string. |
| **Q11** | Which checks still run on an edge whose `type` is not in the vocabulary. Chosen: `unknown-type` alone, plus the checks that do not need the vocabulary; no duplicate findings for one root cause. |
| **Q13** | Is a whitespace-only string "non-empty" for `decodeExportOverride`? The implementation rejects it; the tests deliberately assert nothing either way. **Settle before an `ExportOverride` is ever persisted.** |
| **Q15** | The spec's own test bullet at `GABRIEL_V2_SLICE_0_1_BUILD.md:333-334` still prints the no-semicolon rule that Ruling 1 struck, so the spec still contradicts itself at the exact point of the ruling. Inert today; live bait for the next agent. **A human should strike "and no semicolon" from that line.** |
| **Q17** | Two judgement calls inside `decodeExportOverride`: whitespace-only fields rejected, and a fresh object returned rather than the caller's, so unknown keys from a persisted blob cannot ride in. |
| **Q18** | Whether the Trap T2 kind allowlist belongs in `validation.ts` beside the other decoders instead of inside `units.table.ts`. It is in `units.table.ts` because criteria 41 and 57 required it there. **Slice 5 gives it a second caller, which forces the move anyway.** |
| **Q19** | `CONTEXT.md` already has a `## Relationships` section about how concepts relate; **Relationship** is now also a domain term for a typed edge. Nothing was renamed; the collision is logged under `## Flagged ambiguities` as unresolved. Folds into criterion 47. |
| **Q20** | Whether an export override whose `proposedBy` and `confirmedBy` are the same *blank* string is a one-person ceremony or a structurally missing field. It reports "malformed", because a blank field is already treated as absent. Wording of `detail` only; no rule changed. |

### `[HUMAN]` criteria awaiting review

None of these blocked the commit. All five are still owed, quoted from
`docs/timelines/SLICE_0_CRITERIA.md`:

> **44.** The thirteen `publicDefinition` strings in `src/core/relationship/vocabulary.ts` read
> as publishable CC-BY prose: no implementation mechanics, no PRD phrasing pasted through,
> `corporate_parent` still states that a missing percentage establishes no ownership share or
> control, `owned_by` still states that no minimum threshold is applied, and `acts_for` still
> opens with the ASSESSMENT caveat. (Spec:191-247; criterion 24 only locks the bytes, not the
> judgement.)

> **45.** ADR 0010's prose: its title, its `## Why`, its `## Considered options` and its
> `## Consequences`, and specifically its supersession text against ADR 0004 — a reader must
> confirm the ADR actually says what 0010 supersedes and what survives, and that it records
> (a) why `corporate_parent` and `owned_by` are split on publication risk rather than collapsed
> (spec:170-173), and (b) that `ExportOverride`'s two-person rule enforces ceremony and
> attribution, not authentication, because Gabriel has no identity system (spec:90-92).

> **46.** The one supersession line added to `docs/adr/0004-entity-profile-tagged-union.md`
> states accurately what ADR 0010 changes about the flat tagged union, and does not overclaim
> (Slice 0 adds bare profiles only; fields and the `Entity` mirror are Slice 5).

> **47.** The `CONTEXT.md` glossary entries are consistent with the rest of the file's voice, do
> not duplicate content already in the ADRs (`CONSTRAINTS.md:161`), and use the project's
> existing terms — Entity, Profile, Hierarchy — rather than introducing synonyms. A reader also
> decides whether `## Relationships` (the existing section listing sentences about the model) has
> become ambiguous now that **Relationship** is a domain term, and whether that belongs in
> `## Flagged ambiguities`.

> **48.** Every entry appended to `docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md` during the run is
> read and answered before Slice 2 starts.

Criterion 44 is the one to read first. Ruling 1 restored the prose specifically so that a human,
not a regex, decides how these thirteen sentences read.

### Slice 0 — commit

- **SHA: `507f425`** — `feat(relationship): add the edge vocabulary and Relationship type (Slice 0)`,
  committed on branch `telegram-osint-sidecar`, not pushed.
- Iterations: **3**
- `npm run verify`: green on the tree being committed — 61 test files, 472 tests, `lint` clean,
  `tsc -b && vite build` clean. Node byte scan: 299 files, **0 NUL bytes**. `public/` and every
  test fixture untouched.
- **A second `/code-review` ran on the settled tree**, after the two rulings landed — the first
  one had graded a tree that no longer existed. Spec axis: clean on all three questions (nothing
  missing, no scope creep, nothing implemented wrongly), with the thirteen definitions verified
  byte-identical to the spec block. Standards axis: three documentation breaches and four
  judgement-call smells, disposed of below.
- Applied from that review: the spec's own Tests bullet at
  `GABRIEL_V2_SLICE_0_1_BUILD.md:333` still stated the struck no-semicolon rule, so the spec
  contradicted itself at the exact point of Ruling 1 — now amended in place with a dated note
  (this closes **Q15**); `CONTEXT.md`'s **Hierarchy**, **Entity** and **Profile** entries still
  said hierarchy was the core relation and that the Unit Profile was the only one that exists,
  both false after this slice; `docs/CONSTRAINTS.md`'s target-layout block did not list the new
  `core/relationship/` module; and the two-person export rule was stated twice, in
  `relationship.ts` and again in `validate.ts` — the predicate now lives once, beside the decoder
  that owns it, as `isSelfConfirmedOverride`.
- Declined from that review, with reasons: the two ISO-date regexes stay separate — the
  anchoring difference (`ISO_DATE` full-match vs `CONFIRMED_AT_DATE_PREFIX` prefix-match) is
  deliberate and sharing them would couple two modules for one line each; and
  `decode: (raw) => decodeEntityKind(raw)` keeps its wrapper rather than collapsing to
  `decode: decodeEntityKind`, because every sibling descriptor in that same list
  (`decodeAliases`, `decodePositionMode`, `decodeOrganisationType`) uses the wrapper form and
  changing only the new one would make it the odd entry out.
- Files: three new modules and their tests under `src/core/relationship/`, `entity.ts` +
  `entity.test.ts`, the Trap T2 edit to `units.table.ts` + its tests — ten paths under `src/`,
  matching criterion 57 exactly — plus ADR 0010, the ADR 0004 supersession line, the `CONTEXT.md`
  glossary, and the documentation files listed above.
- Revert point if any of this is wrong: the Phase 0 SHA recorded at the top of this entry.

### Slice 1 — External Ids

Started from the Slice 0 commit. Phase 0 baseline: `npm run verify` green at `ee93a0c`.

**One iteration. No red build at any point.** Phases 1–6 ran once, straight through: the planner
froze `docs/timelines/SLICE_1_CRITERIA.md`, two coding agents (`externalId.ts`, then the
`EntityCore` field + `decodeExternalIds` + the column descriptor), a separate test author, an
independent runner, a review, a simplification pass, and an independent grader.

**The loop-control defect found in Slice 0 was fixed before this run.** The repeat-failure check
now keys on the **criterion number** rather than the file path, so two identical failures stop the
run as `SLICE_BUILD_LOOP.md` requires. It never had to fire — the build went green first time —
but the fixing agents were also given a new standing instruction: if the criteria and the spec
contradict each other, record it and **stop**, never resolve it by editing either side. That is
the judgement Slice 0 proved a machine should not make alone.

#### The four traps this slice was built around — all verified by reading the source

The grader was required to confirm these by reading `columnDescriptor.ts`, not by trusting a
passing test, because each one fails *silently* or *only on a path the ordinary tests miss*.

| trap | what it would have done | verified |
|---|---|---|
| **T3** | `optional: true` without `fallbackSql` makes `buildSelectClause` throw on **every read** — total load failure, not degradation | descriptor carries `fallbackSql: "NULL"`; regression-tested by physically `ALTER TABLE units DROP COLUMN external_ids` and reading through `readEntities` |
| **T4** | `ensureOptionalColumns` splices `constraints` into `ALTER TABLE ADD COLUMN`; SQLite rejects `ADD COLUMN ... NOT NULL` without a constant default, and it surfaces **only on the reopened-old-file path** | descriptor has **no** `constraints` key at all; emitted DDL is `ALTER TABLE units ADD COLUMN external_ids TEXT` |
| **T5** | decoding an empty array to `[]` instead of `undefined` makes the hard gate's "every other row stays clean" assertion read **1027 instead of 1** | every exit in `decodeExternalIds` is `undefined` or a non-empty array; the stored cell is asserted to be literally SQL `NULL` via a raw `SELECT` |
| **T6** | `decodeRow` assigns every prop unconditionally, so `"externalIds" in entity` is `true` even when the value is undefined | no `in` or `hasOwnProperty` test against an entity anywhere in the diff; the one presence check is `!= null` |

**The persistence hard gate passes against the real file.** It loads `public/project.gpkg`, sets
`externalIds` on one entity, saves through the `baseBuffer` reopen path, reloads, and finds exactly
one row carrying the field. `public/project.gpkg` was confirmed **byte-identical** afterwards by
md5 against `git show` — the irreplaceable file was read and never written.

#### Criterion 60 — a defective criterion, not a failed build

The grader returned **BLOCKED** on the third sub-clause of criterion 60, which required
`rg -ln "migrat" src/core/persistence/` to find nothing. It was **unsatisfiable at authoring time**:
the grep matches pre-existing JSDoc prose (`"pre-migration schema"`) and the legacy
`migrateLegacyOrganisations` helper. Run against a clean `git archive HEAD` extraction containing
no Slice 1 code, it returns the same seven files and exits `0`; `git diff HEAD -- src/` adds zero
matching lines. It would have failed on an empty slice.

The grader was right to report it rather than waive it — a frozen criterion is a result to report,
not a line to edit. **Ruling 3, owner, 2026-07-29:** amend it, same disposal as criterion 23. The
sub-clause is struck with a dated note; its other two sub-clauses pass untouched; the substantive
intent (no migration file added) is satisfied and independently proven by criterion 57.

That is now **two frozen criteria in two slices** defeated by a proxy grep that contradicted the
thing it proxied for. The pattern is worth naming for whoever writes Slice 2's criteria: a
criterion phrased as "this string appears nowhere" is fragile against ordinary prose, and should be
scoped to the diff (`git diff | rg "^\+..."`) rather than to the tree.

#### Review — no correctness findings

Reviewed against `ee93a0c`. The reviewer re-derived the IMO check digit independently on seven
numbers (`9074729`, `1234567`, `9319466`, `5000005`, `0000000` valid; `9704729`, `9074728`
rejected) and the implementation agreed on all seven. The spec's misprinted `7·7` first term was
**not** copied — the test writes `9*7` and names the typo. The nine UI labels match the spec
character for character.

Four style findings, none applied, each with a reason:

- **`project-gpkg-fixture.test.ts` is now 299 lines against the 300-line cap** — one line of head-
  room, and Slice 2 explicitly plans another real-WASM test in that same file. **This is a Slice 2
  prerequisite:** split the file by concern before adding to it. Not done here because moving tests
  between files would break the frozen criteria that reference them by path.
- The free-form branch upper-cases, so two case-distinct sanctions ids collapse onto one dedup key
  (**Q31**). Spec-conformant (`spec:389` says "upper-case") and pinned by frozen criterion 26.
  Harmless today because `externalIdKey` has no consumer; becomes a silent entity merge the moment
  the Stage 3 OpenSanctions connector reads it. **Decide before that consumer ships.**
- `isValidExternalId` validates the normalised form, so separators never register as a charset
  violation (**Q22**). Deliberate and coherent — validating raw would reject `"IMO 9074729"` while
  `externalIdKey` treats it as identical to the valid `"9074729"`.
- Comment volume in `externalId.ts` exceeds neighbouring files, with some restatement of what the
  code does rather than why.

#### Open questions

Slice 1 added **Q21–Q31**. The ones that are decisions rather than notes: **Q31** (dedup case-
folding, above), **Q27** (INN and OGRN checksums are not verified — length and charset only, as the
spec specifies), and **Q28** (scheme-prefix stripping versus values that legitimately begin with
their registry's name). The **LEI mod-97 gap is deliberate and spec-stated**, locked by a test named
so the next reader knows it was known, not forgotten.

### Slice 1 — commit

- **SHA: `cfaf80b`** — `feat(entity): add External Ids and the external_ids column (Slice 1)`,
  committed on branch `telegram-osint-sidecar`, not pushed.
- Iterations: **1**. No red build at any point.
- `npm run verify`: green on the tree committed — 63 test files, 501 tests (29 added by this
  slice), lint clean, `tsc -b && vite build` clean. Node byte scan: 302 files, **0 NUL bytes**.
- `public/project.gpkg` byte-identical before and after, no stray `gabriel-*.gpkg` left behind.
- Files: `externalId.ts` + its test, the `EntityCore` field, `decodeExternalIds` in
  `validation.ts` + its test, the `external_ids` descriptor in `units.table.ts`, a new
  `units.table.externalIds.test.ts`, and the hard gate appended to `project-gpkg-fixture.test.ts`
  — eight paths under `src/`, matching criterion 57 exactly.
- Revert point: `ee93a0c` (the Slice 0 run-log commit).

### Not committed — left deliberately for the reader

Two changes sat uncommitted in the tree before this run began and were **excluded from both slice
commits** by using path-limited commits rather than `git commit -a`:

- `docs/adr/0009-machine-never-confirms.md` — modified (+19 lines, a "Standing maintenance
  obligations" section). Unrelated to either slice. Still unstaged.
- `docs/timelines/STANAG_SOURCE_RATING_TIMELINE.md` — deleted and **already staged** (`D ` in the
  index) before this session started. Because it is staged, a bare `git commit` **will** sweep it
  into whatever is committed next. Commit or unstage it deliberately.

**Both disposed of, 2026-07-29** — see the ruling session below. The tree is clean going into
Slice 2.

---

## Owner ruling session — 2026-07-29, before Slice 2

Four items blocked Slice 2. All four are now ruled.

### The five `[HUMAN]` criteria (44–48)

| # | subject | verdict |
| --- | --- | --- |
| **44** | The thirteen `publicDefinition` strings | **Accepted verbatim, no edit.** The three load-bearing clauses were checked present and intact: `corporate_parent`'s "no ownership share, controlling interest or acquisition date has been established … not, on its own, a statement of legal control"; `owned_by`'s "No minimum threshold is applied"; and `acts_for` opening on "ASSESSMENT — not a documentary record". Two wordings were raised as optional refinements (`officer_of` calling a registered agent an office-holder, `owned_by`'s "registered" excluding unregistered holdings) and both were declined — the prose ships as authored. |
| **45** | ADR 0010's prose and its supersession of 0004 | **Conforms.** It names the two superseded points and leaves the rest of 0004 standing, records the `corporate_parent` / `owned_by` split as a publication-risk decision, and states the `ExportOverride` two-person rule as ceremony and attribution rather than authentication, because Gabriel has no identity system. |
| **46** | The supersession line added to ADR 0004 | **Conforms, does not overclaim.** It says field-*less* profiles only and keeps the `Entity` field mirror deferred. |
| **47** | The `CONTEXT.md` glossary | **Conforms, and its one open decision is ruled** — see below. |
| **48** | Every open question read before Slice 2 | **Done.** Q1–Q31 reviewed. Only Q31 needed a decision; Q27 (no INN/OGRN checksum) and Q28 (scheme-prefix stripping) are spec-conformant with no consumer and stay as notes. **Q15 was already stale** — it asks a human to strike "and no semicolon" from `GABRIEL_V2_SLICE_0_1_BUILD.md:333-334`, which Ruling 1 had already done in the same commit; the line carries no semicolon rule today. |

### Ruling 3 — `CONTEXT.md` `## Relationships` is renamed `## Model invariants` (Q19, criterion 47)

The section listing sentences about how the *concepts* relate collided with **Relationship**, the
new domain term for a typed edge. Renamed, with a lead-in sentence recording the old name so the
rename is not a silent one, and the `## Flagged ambiguities` entry moved from unresolved to
resolved. **Relationship** now means the typed edge and nothing else in that file.

### Ruling 4 — `normalizeExternalId` does not case-fold free-form ids (Q31)

`toUpperCase()` was applied before the scheme branch, so all nine schemes were upper-cased and
`opensanctions:NK-A7bC` collided with `opensanctions:nk-a7bc`.

What made this decidable rather than a toss-up: **the code already carried the argument against
itself.** The doc comment refusing to strip a hyphen or dot from a free-form value — because doing
so "could merge two distinct ids onto one dedup key" — sat three lines below the `toUpperCase()`
that merged them on case. One rule, two answers.

- `toUpperCase()` moves into the structured branch. `imo`, `inn`, `ogrn`, `lei` normalise exactly
  as before; the five free-form schemes now only collapse whitespace.
- Inert for `ofac`, `eu_fsf`, `uk_hmt` (numeric ids). It exists for `opensanctions` and `registry`.
- **Frozen criterion 26 narrowed** to the four structured schemes, and **criterion 26b added** to
  pin the new behaviour — the second owner-authorised amendment to `SLICE_1_CRITERIA.md`. Unlike
  the Slice 0 semicolon amendment, criterion 26 was satisfiable as written; it was ruled wrong,
  not defective.
- **No migration, now or ever.** The normalised form is recomputed at every comparison and has
  never been persisted. `externalIdKey` still has no consumer, so the ruling landed before the
  Stage 3 OpenSanctions connector could turn the collision into a silent entity merge.

### Ruling 5 — the branch stays `telegram-osint-sidecar`

Considered and declined: merging into `main` and branching `gabriel-v2-foundation` for Slice 2.
The name no longer describes the contents — 16 of the 20 commits ahead of `main` are not Telegram
work — and that is accepted as known drift rather than fixed now. `main` holds one commit the
branch lacks (`f8eeaa7`, a near-duplicate of `991b002`); a test merge conflicts in
`docs/README.md` alone, both sides having added index entries. That merge is deferred, not avoided.

**The branch is pushed before Slice 2 runs.** ADR 0010 says the backup for the migration is the
private repository's git history and that the pre-migration commit is pinned before the migration
first runs. Slice 2 is that migration, and until the push these 20 commits existed on one machine
only — the ADR's safety net did not exist. Pushing is what creates it.

> **Pre-migration pin: `5b0d2ed`**, pushed to `origin/telegram-osint-sidecar` on 2026-07-29.
> This is the last commit before Slice 2 touches `public/project.gpkg`. It is the revert point
> ADR 0010 requires, and it now exists off this machine.

### Ruling 6 — both uncommitted leftovers committed, separately

- **`e8b6e13`** — `docs: drop the STANAG source-rating timeline, superseded by the shipped
  feature`. The staged deletion, committed on purpose rather than swept into Slice 2. The timeline
  planned work that landed in `3a37ccb` while its phases still read "not started"; its governing
  decisions survive in ADRs 0006, 0008 and 0009, and nothing in `docs/` linked to it.
- **`43156db`** — `docs: record the standing maintenance obligations for AI-assessed ratings`.
  The ADR 0009 addition, unrelated to either slice. Both files it references
  (`independenceClusters.ts`, `diagonalCollapse.eval.test.ts`) were confirmed to exist.

### What Slice 2 must do before it starts

1. **Split `project-gpkg-fixture.test.ts`.** It is at 299 lines against the 300-line cap, and
   Slice 2 plans another real-WASM test in it. It breaks on the first line added.
2. ~~**Answer Q31** (dedup case-folding) before anything consumes `externalIdKey`.~~ **Done —
   Ruling 4.**
3. **Do not phrase a criterion as "this string appears nowhere in a directory."** Two slices, two
   frozen criteria defeated by exactly that shape. Scope such checks to the diff, not the tree.
4. ~~Read the 5 `[HUMAN]` criteria from Slice 0 (44–48) and the open questions Q1–Q31.~~ **Done —
   see the table above.**

---

## Owner ruling session — 2026-07-29, second sitting: Q32–Q41 and the Slice 2B spec

No code was written. Ten questions ruled, three reconnaissance passes run against the real code
and the real file, and `docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md` authored. Every ruling is a
dated **RESOLVED** block in `SLICE_0_1_OPEN_QUESTIONS.md`; this is the index.

| id | subject | ruling |
|---|---|---|
| **Q36** | the NUL byte-scan printed in the docs cannot fail | **Fixed, and the guard is now automatic.** `scripts/scan-nul.mjs` + `npm run scan:nul`, wired as the **first** gate of `npm run verify`. Both documents corrected with dated notes. Frozen criterion 48 untouched. |
| **Q35** | the 300-line cap versus Prohibition 5 | Split `project-gpkg-fixture.test.ts`; `geopackage.service.test.ts` converts one line per site and ends at **exactly 321**. No new violation, no repair of an old one. No criterion amended. |
| **Q32** | all eight `SaveGeoPackageOptions` fields required | **Yes.** It is the only mechanism by which Slice 2B's two new members break every un-updated call site at compile time. A test helper that would soften the verbosity is explicitly forbidden — it reopens the hole. |
| **Q33** | the save guard's signal, false positive and wording | **The frozen condition was replaced, not tuned.** See below — this is the one that mattered. |
| **Q34** | where `projectStateFromLoadResult` lives | Stays in `useProjectIO.ts`, signature fixed as an intersection type so "no sixth field" is a compile-time property. Move to `core/` scheduled for 2B. |
| **Q37** | `BASE` no longer matches HEAD | Re-pinned to the run's starting SHA. Safe because `git diff --name-only c8483b5 HEAD -- src/` is **empty**. |
| **Q38** | a **third** duplicated project-state literal | `ViewPage.tsx:46-52` was missed by every document. Slice 2A converts it; criterion 46 amended additively. |
| **Q39** | `activeParentMap` vs the dual-subordination check | `validate.ts` **may be reopened**, for one export only: a single `isHierarchyBearing` consumed by both the derivation and the control. |
| **Q40** | contested children | `activeParentMap` emits no entry; derived parent is `null`. Display cascade stated explicitly: own position, else orbit the parent, else do not show. |
| **Q41** | `mergeEntities` after 2B | Ported to edges. Left alone it produces a `.gpkg` that **cannot be reopened**. |

### Q33 — the guard as frozen did not protect what it named

The measured finding, and the reason five frozen criteria were amended: `save.ts:66` runs
`DELETE FROM units` and `:75` then runs `writeEntities`. A save **replaces**. So after a failed
restore the analyst types one entity — the ordinary reflex on opening an empty tool — the
four-way emptiness collapses, **the guard goes silent, and Save writes 1 unit over 1010.** In the
other direction `handleNew` never routes through `performProjectSave`, so an ordinary
New → Save → Save on a fresh project **was refused**. The condition obstructed the ordinary
gesture and missed the only destructive sequence.

No refinement could have rescued it: after `resetProject()` and after a failed restore the store
is at `initialState()` in both cases. The needed fact is about the session, not the state.
Replaced by a `snapshotIsAuthoritative` ref, required on `ProjectSaveInput`. Criteria 24, 26, 27,
28, 29 amended; 24b and 26b added; `[HUMAN]` criteria 55, 56, 57 closed.

**Known weakness, recorded rather than hidden:** the repo has no jsdom, no
`@testing-library/react` and zero `.test.tsx` files, so no hook can be mounted. The flag's three
assignment sites are verifiable only by grep (criterion 24b). The guard logic itself is fully
tested, because `performProjectSave` is a dependency-injected module function.

### Measured facts that contradict the documents

- **741 units, not 142**, draw their map position from the parent chain (599 `position_mode` =
  `none` + 142 `parent`). And `geometry.ts:80` + `:126-128` mean a null derived parent **removes
  an entity from the map** rather than moving it. That retires the count assertion as the primary
  safeguard: the failure mode is topological, the assertion is cardinal.
- **Three** duplicated `setProject` literals, not two. 22 call sites in all (Q38).
- **15** production read sites for `parentId` across 13 files, not "nine consumers"; two files the
  inventory names do not read it at all, and `core/entity/hierarchy.ts` — the central reader — was
  missing from the list.
- The two shareholding percentages are **not in a column**: they are English prose in
  `organisations.notes`, and the Kalashnikov note contains `95%` (a *market* share) before
  `25%+1`. Any regex publishes "Rostec holds 95% of Kalashnikov". The migration is forbidden from
  reading `notes` at all, and a test proves it by rewriting that note to
  `"Rostec holds 100% and 3% and c.7%"` and asserting `percent: 25` still.
- The parent's real name is `Rostec State Corporation`, not the `Rostec` the docs abbreviate.
- `units` has **no `kind` column** — all 1010 rows decode to `"unit"`, and every corporate entity
  comes from the legacy `organisations` table, which still holds all 17 rows. This file has never
  been re-saved by post-E1 code.
- Ground truth otherwise **confirmed exactly**: 1010 / 999 / 17 / 13 / 1027 / 1012, plus 15 roots,
  166 distinct parents, max sibling group 31, depth 5, zero dangling parents, zero self-loops,
  zero cycles.

### Tooling changed in this session

`scripts/scan-nul.mjs` and `npm run scan:nul`, now the first gate of `npm run verify`. It proves
its own detector on every run, treats "could not run" and "zero files enumerated" as failures
distinct from clean, and enumerates through `git ls-files --cached --others --exclude-standard`.
Evidence: clean tree → `clean, 306 files scanned`, exit 0; a planted NUL under `src/` → exit 1
with the path named; a bad root → exit 2.

`public/project.gpkg` was read from temp copies only and is byte-identical throughout
(`7d0b0e592a1128a0d83e7575110bf2dc`).

### Documentation cut back to what Slice 2 actually needs — same session, owner-directed

`docs/timelines/` went from **7,811 lines to 4,025**; `docs/` from 8,808 to 5,035. The trigger was
the owner's question: *if the code is built, aren't the code and the ADRs enough?* Largely yes —
and the measurement that settled it is that the largest document in the repo was
`SLICE_0_1_OPEN_QUESTIONS.md` at 1,420 lines, bigger than any spec, growing every session and
never once drained.

**Deleted — four files, 2,526 lines. Git history has all of them.**

| file | lines | why |
|---|---|---|
| `GABRIEL_V2_FOUNDATION_SPEC.md` | 952 | Superseded, and **wrong in six measured places**: a 7-column `relationships` DDL, 7 violation codes against the shipped 9, a `decodeAliases` decode precedent that inverts on a required field, a `GeoPackageLoadResult.warnings` that does not exist, a stale `units.table.ts:31`, and a `saveGeoPackage` signature contradicting Slice 2A. The single highest-value deletion — this is the file an agent following the index would have built against. |
| `SLICE_2_HANDOFF.md` | 293 | Written for a session that has now happened. Three of its figures were wrong: two duplicated literals (three), 16 call sites (19), 142 position-derived units (741). |
| `SLICE_0_CRITERIA.md` | 489 | Frozen contract for shipped, reviewed work. |
| `SLICE_1_CRITERIA.md` | 792 | Same. |

**Compressed.** `SLICE_0_1_OPEN_QUESTIONS.md`, 1,420 → **101 lines**. It keeps only the four
entries that record *unratified* behaviour — where the code shows a behaviour nobody has blessed,
which is the one thing a source comment cannot carry — plus an index resolving every `Q<n>`
citation to the document that now owns the ruling. Q32–Q41 were already copied in full into the 2A
criteria amendments and the 2B spec, so the questions file was redundant for them the day it was
written.

**The rule that replaces "append-only".** At each slice commit, every entry goes exactly one of
three ways: into the code as a comment stating the whole reasoning (the model is
`src/core/entity/externalId.ts:100-108`, which carries its argument in full and cites Q31 only as
a date stamp); into an ADR if it has consequences beyond the line it touches; or deleted with one
line here. Append-only was right for a single run and wrong for a file outliving five slices.

**Kept, and why `GABRIEL_V2_SLICE_0_1_BUILD.md` was not deleted with the other Slice 0/1
paperwork.** It has two live functions that are not reproducible from the code: it is the
**authored source of the thirteen `publicDefinition` strings** that ship verbatim in the CC-BY
dataset — `vocabulary.test.ts:24,85` transcribes them from it *by line number*, deliberately not
from the implementation — and it holds the binding "Decisions carried into Slice 2 and beyond"
section. Deleting it would have orphaned the provenance of published prose.

**A defect this session caused and then fixed.** The Trap T7 amendment inserted 9 lines at `:485`
of that file, so **every citation into it above line 488 became short by 9** — including the
frozen Slice 2A criteria's authority pointer and `validate.ts:64`. Corrected with a drift table in
that file's new appendix and a dated note in the 2A criteria header; all five affected anchors
re-verified line by line, and the four citations below 488 confirmed unaffected. A first attempt at
the fix made it worse by inserting the note at the top of the file, which shifted everything again;
it was redone at iso-line count. **Prefer section headings to line numbers** — this is the second
cross-file line citation to go stale in this project.

**Also corrected, because it was an active falsehood rather than clutter.**
`GABRIEL_V2_TIMELINE.md`'s Stage 1 gate stated the stage ends "with `parentId` gone from the type
and from the file". That is the pre-review plan the expert panel revised away: `parentId` is
**kept** as a derived field and the `relationships` table is the source of truth. A stage gate that
contradicts the shipped decision is exactly what an agent builds against.

**One dangling reference left on purpose.** `vocabulary.test.ts:220` cites
`SLICE_0_CRITERIA.md criterion 23`. The comment carries the entire reasoning inline and the
citation is provenance only, so it resolves through git like Q31 does. No source file was touched
in this session.

### What Slice 2A must do before it starts (updated)

1. ~~Split `project-gpkg-fixture.test.ts`.~~ Still required — criterion 20, and Q35 confirms it.
2. Convert `ViewPage.tsx` as part of Task 3 (Q38).
3. Read the amendments in `SLICE_2A_CRITERIA.md` before grading anything: criteria 24, 24b, 25, 26,
   26b, 27, 28, 29, 46, 47 and the `BASE` definition all carry dated owner-authorised changes, and
   the header note corrects every line citation into `GABRIEL_V2_SLICE_0_1_BUILD.md` by +9.
4. Expect Task A to leave the suite red until Task B lands. Do not grade in between.
5. **Skip Phase 1.** The criteria are already frozen. Phase 1 is only needed for 2B.
