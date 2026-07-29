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

**Not started.** It is a separate run with its own criteria file. Nothing in this tree touches
`externalId.ts` or the `external_ids` column; criterion 65 asserts that machine-checkably.

_Slice 1 appended below when it runs._
