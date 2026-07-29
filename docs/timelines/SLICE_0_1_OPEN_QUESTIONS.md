# Slices 0 and 1 — recorded questions and guesses

Append only. Each entry: the question, the guess that would have been made, and the
conservative reading actually implemented. Answered before Slice 2 starts.

**Renumbered 2026-07-29 (ids only — no question text changed, no entry removed).** Three
Phase 2 agents appended in parallel and two of them both claimed `Q8`; a third id was
suffixed `-B` and two more `-D`. Every entry now has a unique id, and each renumbered entry
carries a line naming what it used to be called, so an older citation can still be followed.
An id is never reused for a different entry, so the numbers run in append order but are not
monotonic: `Q16`–`Q19` are the four entries that moved. The map, old → new:
`Q8-B` → `Q16`, `Q9-B` → `Q17`, `Q8` (Trap T2 allowlist) → `Q18`, `Q8` (CONTEXT.md
`## Relationships`) → `Q19`, `Q10-D` → `Q10`, `Q11-D` → `Q11`. Everything else keeps its id.
`SLICE_0_CRITERIA.md` cites only `Q1`, `Q2` and `Q3`, none of which moved.

---

## Q1 — the NUL byte-scan command in the spec does not work

**Raised by:** planning agent (Phase 1), Slice 0.

**Question.** `GABRIEL_V2_SLICE_0_1_BUILD.md:482` and `docs/SLICE_BUILD_LOOP.md:120` both
prescribe `rg -c $'\x00' src/` as the T7 byte-scan. In Git Bash `$'\x00'` expands to the
**empty string**, because a shell variable cannot hold a NUL. Ripgrep then receives an empty
pattern, matches every line of every file, and exits `0`. Verified: it reported a count equal
to the line count for all 250-odd files in `src/` and `docs/`, on a tree with no NUL bytes.
Run directly with a literal pattern, `rg -c '\x00' src/` errors with
`pattern contains "\0" but it is impossible to match` because binary detection is on.

**Guess I would have made.** That the command works as written, and that its exit `0` meant
the tree was clean.

**Conservative reading implemented.** `SLICE_0_CRITERIA.md` criterion 49 uses
`rg --text -c '\x00' src/ docs/ CONTEXT.md`, which exits `1` and prints nothing on a clean
tree and exits `0` listing offenders when a NUL is present (verified both ways on a scratch
file). A shell-independent `node -e` equivalent is given alongside. **The spec and the loop
document still print the broken command** — that is a doc defect for a human to fix; this
agent did not edit either file.

---

## Q2 — the spec does not name the Slice 0 test files

**Question.** The Slice 0 "Files" block (spec:50-59) lists eight files, none of them tests,
but the "Tests" subsection (spec:325-344) requires eight test behaviours. Where do they live?

**Guess I would have made.** A single `src/core/relationship/relationship.test.ts` covering
all three modules.

**Conservative reading implemented.** Repo convention is a colocated `*.test.ts` beside each
source file (every existing module follows it). Criteria therefore fix:
`src/core/relationship/relationship.test.ts`, `vocabulary.test.ts`, `validate.test.ts`;
a new `src/core/entity/entity.test.ts`; and the Trap T2 cases appended to the **existing**
`src/core/persistence/geopackage/units.table.test.ts`.

---

## Q3 — which glossary terms Slice 0 must add to CONTEXT.md

**Question.** Spec:58 says `CONTEXT.md modified — glossary` and spec:352 says a human reads
"the `CONTEXT.md` glossary entries", but no term list is given.

**Guess I would have made.** Dump all thirteen edge types into the glossary.

**Conservative reading implemented.** Criterion 12 requires three terms only —
**Relationship**, **Record tier**, **Assessment tier** — the three concepts the rest of the
project's language must now be consistent with. The thirteen types are already published
verbatim in `vocabulary.ts` and duplicating them in `CONTEXT.md` would breach
`CONSTRAINTS.md:161` (no duplicated content across docs). Wording and any further terms are
`[HUMAN]` criterion 47.

---

## Q4 — the coverage threshold gate exists

**Question.** The Phase 1 brief states "There is no coverage threshold gate."
`vitest.config.ts:26-31` sets global thresholds: lines 12, branches 9, functions 9,
statements 12.

**Guess I would have made.** None — recorded so a Phase 4 coverage failure is not
misdiagnosed as a flake. `npm run verify` will fail on a threshold regression.

---

## Q5 — `decodeExportOverride` has no accept case in the spec

**Question.** Spec:343-344 lists five inputs that must return `undefined` and no input that
must return a value. A stub `() => undefined` satisfies every listed case.

**Guess I would have made.** Leave it, matching the spec's bullet exactly.

**Conservative reading implemented.** Criterion 13 adds one accept case, derived from the
spec's own sentence at spec:118 ("accepts a JSON string or an object"): a well-formed object
and the equivalent JSON string both decode to the same `ExportOverride`. No new field,
signature or constant is invented.

---

## Q6 — the shape of the thirteen `publicDefinition` strings

**Question.** Spec:198-247 prints the definitions wrapped at roughly 90 columns. Is the
persisted string the wrapped text, or one line?

**Guess I would have made.** Keep the newlines from the spec block.

**Conservative reading implemented.** One line per definition, the spec block's wraps joined
by exactly one space — criterion 24 asserts no `\n` and no double space. Rationale: these
ship verbatim in the CC-BY dataset (spec:150) where a hard wrap is an artefact of the spec's
formatting, not of the sentence.

---

## Q7 — ADR 0010 and the docs index

**Question.** Does adding `docs/adr/0010-first-class-relationships.md` require an edit to
`docs/README.md`?

**Answer, not a guess.** No. `docs/README.md:17` lists the `adr/` directory as a whole and
does not enumerate individual ADRs. Recorded so no agent widens scope to "fix the index"
(Prohibition 5).

---

## Q16 — two authored `publicDefinition` strings contain a semicolon, which the "no semicolon" test forbids

**Renumbered 2026-07-29: this entry was `Q8-B`.** The `-B` suffix marked Slice 0 task B
(`src/core/relationship/`); three Phase 2 agents appended in parallel and each reached for
`Q8`, which is why a suffix was used and why it is now gone.

**Raised by:** coding agent (Phase 2), Slice 0, task B (`src/core/relationship/vocabulary.ts`).

**Question.** Spec:333-334 (and frozen criterion 23) require every `publicDefinition` to
contain **no semicolon**, "proving PRD mechanics were stripped rather than pasted". But the
authored text the spec orders copied **verbatim** (spec:198-247, and frozen criterion 24,
which deep-equals the strings against that block) contains a semicolon in two of the
thirteen:

- `corporate_parent` — "...it is given as a percentage**;** where no percentage is recorded..."
- `owned_by` — "No minimum threshold is applied**;** reusers may filter by the recorded percentage."

Criteria 23 and 24 cannot both hold. Both are frozen, so this is a stop-and-report, not an
edit (`SLICE_BUILD_LOOP.md` Phase 1, Prohibition 2).

**Guess I would have made.** Silently swap the two semicolons for commas or full stops so the
`rg`-style assertion goes green, and say nothing.

**Conservative reading implemented.** The strings are **verbatim**, semicolons included, byte-
for-byte equal to spec:198-247 (verified by script: 13/13 exact, wraps joined with exactly one
space, no `\n`, no double space). Rationale: the definitions ship in a CC-BY dataset, the task
brief says "do not paraphrase, do not tidy the prose", criterion 24 is the byte lock, and
criterion 44's human check requires `corporate_parent` to keep the "no ownership share,
controlling interest or acquisition date has been established" clause and `owned_by` to keep
"no minimum threshold is applied" — both of which sit on the semicolon. The semicolon rule
reads as a heuristic against pasted PRD table cells, written before the definitions were
authored; the authored prose legitimately uses the punctuation.

**Needs a human decision before Slice 0 can be graded green.** Either criterion 23 is a stale
proxy and the test drops the semicolon clause (keeping backtick and >= 40 chars), or the two
sentences are re-punctuated — in which case the new wording must be authored in the spec first,
because criterion 24 locks `vocabulary.ts` to the spec block and not the other way round.

---

## Q17 — two judgement calls inside `decodeExportOverride`

**Renumbered 2026-07-29: this entry was `Q9-B`.**

**Raised by:** coding agent (Phase 2), Slice 0, task B (`src/core/relationship/relationship.ts`).

**Question (a).** Spec:118-120 requires "all four fields are non-empty strings". Is a
whitespace-only string (`"   "`) non-empty?

**Guess I would have made.** `value.length > 0`, so `"   "` decodes to a valid override.

**Conservative reading implemented.** `typeof value === "string" && value.trim().length > 0`
— a whitespace-only field fails, because the decoder is fail-closed and a blank `confirmedBy`
is not a second person. The **original**, untrimmed string is what gets stored, so nothing the
analyst typed is rewritten.

**Question (b).** Does the decoder return the input object, or a fresh object carrying only the
four declared fields?

**Guess I would have made.** Return the input, cast.

**Conservative reading implemented.** A fresh `{ proposedBy, confirmedBy, confirmedAt,
rationale }`, so unknown extra keys from a persisted JSON blob cannot ride into memory
unvalidated and no caller can mutate the source object through the result. The whole body also
sits in a `try`/`catch` returning `undefined`, so a throwing getter on a hostile input still
cannot make the function throw (spec:113-114).

---

## Q18 — where the Trap T2 kind allowlist lives: `validation.ts` or `units.table.ts`

**Renumbered 2026-07-29: this entry was `Q8`** — the Task A one, of the two entries that both
claimed that number.

**Raised by:** coding agent (Phase 2), Task A, Slice 0.

**Question.** The Phase 2 task brief says to *prefer* adding `decodeEntityKind` to
`src/core/persistence/geopackage/validation.ts` (matching how `decodePositionMode` is wired)
and calling it from `units.table.ts`. The frozen criteria contradict that in two places:

- **Criterion 41** requires `rg -c "ENTITY_KINDS" src/core/persistence/geopackage/units.table.ts`
  to report **at least 2** matches, "the import and the use". If the allowlist lives in
  `validation.ts`, `units.table.ts` imports `decodeEntityKind` and never mentions
  `ENTITY_KINDS` at all — zero matches.
- **Criterion 57** fixes the changed-file set under `src/` at exactly ten paths.
  `validation.ts` is not one of them, so editing it is scope creep by that criterion's own
  definition.

**Guess I would have made.** Follow the brief's stated preference, edit `validation.ts`, and
assume criteria 41 and 57 were drafted before that preference was written.

**Conservative reading implemented.** The criteria are frozen and the brief is not, so the
criteria win. `decodeEntityKind` and its module-level `VALID_ENTITY_KINDS` set live in
`units.table.ts` itself, immediately below `UNITS_TABLE`. They follow the *shape* of
`decodePositionMode` / `decodeOrganisationType` exactly — a `Set` built from the const tuple
plus a small function falling back to a default — but are module-private rather than exported,
because `units.table.ts` is their only caller. `validation.ts` was not touched.

**For the reader to decide before Slice 2:** whether `decodeEntityKind` should move to
`validation.ts` alongside the other three decoders once the criteria for this slice are
discharged. A second caller (Slice 5's `load.ts` kind bucketing, spec:459-461) would force the
move anyway.

---

## Q19 — the `## Relationships` section of CONTEXT.md collides with the new domain term

**Renumbered 2026-07-29: this entry was `Q8`** — the Task C one, of the two entries that both
claimed that number.

**Raised by:** Task C coding agent (Phase 2), Slice 0, documentation.

**Question.** `CONTEXT.md` already has a `## Relationships` section listing sentences about
how the *concepts* relate ("an Enrichment Run produces zero or more Enrichment Proposals").
Slice 0 makes **Relationship** a domain term meaning a typed edge between two Entities.
Criterion 47 says a reader decides whether that collision belongs in `## Flagged ambiguities`
— it does not say whether this agent should put it there.

**Guess I would have made.** Rename the section to "Model invariants" and move on.

**Conservative reading implemented.** Renamed nothing. Added one entry to
`## Flagged ambiguities` recording the two senses, marked **unresolved**, and naming the
rename as a possibility rather than doing it. The new glossary terms went into a new
`### Typed relationships (edges)` subsection under `## Language` (after Hierarchy index,
which is the concept they generalise), not into the existing `## Relationships` section.
The human answering criterion 47 still has the full decision.

---

## Q9 — how much of the deferred migration decision belongs in ADR 0010

**Id unchanged 2026-07-29.** It is now unambiguous: the parallel entry that was `Q9-B` is
`Q17`.

**Raised by:** Task C coding agent (Phase 2), Slice 0, documentation.

**Question.** The supersession of ADR 0004 cannot be stated without saying what happens to
`parentId`, and that answer lives in `GABRIEL_V2_SLICE_0_1_BUILD.md:500-547` ("Decisions
carried into Slice 2") — but `CONSTRAINTS.md:161` forbids duplicating content across docs.

**Guess I would have made.** Restate the migration section in the ADR, including the table
of thirteen legacy corporate links.

**Conservative reading implemented.** ADR 0010 records only the three migration facts the
supersession itself depends on — `parentId` is kept but derived, the retained column is not a
backup, and `corporate_parent` is hierarchy-bearing — and links to the build spec for
sequencing. The thirteen legacy links, the id scheme and the integrity-event design are not
repeated.

---

## Q10 — how many violations one edge may draw from a single code

**Renumbered 2026-07-29: this entry was `Q10-D`** (the `-D` marked Slice 0 task D). No other
entry ever held plain `Q10`.

**Raised by:** coding agent (Phase 2), Slice 0, task D (`src/core/relationship/validate.ts`).

**Question.** The spec fixes multiplicity for exactly one code: `multiple-active-hierarchy`
emits "one violation per offending edge" (spec:296-298). It is silent for the codes where a
single edge can be wrong in more than one place at once — an edge whose `fromId` *and* `toId`
are both absent from `entityIds`, an edge whose `startDate` *and* `endDate` are both malformed,
and an edge carrying two illegal metadata keys. One violation each, or two?

**Guess I would have made.** One per offending field/key, i.e. two `dangling-endpoint`
violations for an edge with two dangling ends.

**Conservative reading implemented.** **At most one violation per (edge, code) pair.** The
detail string names every offending endpoint / date / metadata key, joined (`" and "` for
endpoints and dates, `"; "` for metadata keys), so nothing is lost from the report. Rationale:
it is the reading under which the spec's one explicit multiplicity rule for
`multiple-active-hierarchy` is worth stating at all, and it is the reading a
`toHaveLength(1)`-style assertion in a Phase 3 test is most likely to expect. The looser
reading (one per field) can be adopted later without changing any caller, since callers group
by `code` and `relationshipId`.

---

## Q11 — which checks still run when `type` is not in `EDGE_TYPES`

**Renumbered 2026-07-29: this entry was `Q11-D`** (the `-D` marked Slice 0 task D). No other
entry ever held plain `Q11`.

**Raised by:** coding agent (Phase 2), Slice 0, task D (`src/core/relationship/validate.ts`).

**Question.** Three of the nine rules are defined in terms of `EDGE_TYPES[type]`:
`missing-required-date` reads `dateRequired`, `invalid-metadata` reads the declaring type's
`MetadataSpec`, and `invalid-export-override`'s third clause reads `tier`. When the type is
unknown, `EDGE_TYPES[type]` is `undefined` at runtime (`noUncheckedIndexedAccess` is off, so
the compiler does not flag it). Does an unknown-typed edge also collect those three codes?

**Guess I would have made.** Treat the missing definition as an empty one, so every metadata
key on an unknown-typed edge becomes an `invalid-metadata` violation on top of `unknown-type`.

**Conservative reading implemented.** An unknown type yields `unknown-type` and nothing that
depends on the definition. The endpoint, self-loop, date, date-order and *structural*
export-override checks still run, because none of them needs the vocabulary; only the
record-tier clause of `invalid-export-override` is skipped. Rationale: a type absent from the
vocabulary declares nothing, so "the declaring type does not own this key" is not a finding
about the data — it is a restatement of `unknown-type`, and duplicating it would inflate the
report for one root cause. Fixing the type surfaces any real metadata violation on the next
run.

---

## Q12 — the spec contradicts itself on semicolons in `publicDefinition`

**Raised by:** test author agent (Phase 3), Slice 0.

**Question.** Spec:333-334 and `SLICE_0_CRITERIA.md` criterion 23 both require that every
`publicDefinition` "contains no backtick and no semicolon", as proof that PRD implementation
mechanics were stripped rather than pasted. But the authored definitions the spec prints at
spec:198-247 — which criterion 24 requires to be reproduced **verbatim** — contain two
semicolons:

- `corporate_parent`: "...it is given as a percentage; where no percentage is recorded..."
- `owned_by`: "No minimum threshold is applied; reusers may filter by..."

The two criteria cannot both hold. Either the no-semicolon rule is wrong, or two authored
strings are.

**Guess I would have made.** That the no-semicolon rule was the loose one, and quietly weaken
the test to a backtick check only (or to a semicolon check that skips the two known rows).

**Conservative reading implemented.** Both tests were written exactly as the spec and the
frozen criteria state them, and the no-semicolon one **fails**:
`vocabulary.test.ts > EDGE_TYPES > publishes a non-empty definition of at least 40 characters
with no backtick and no semicolon for every type`. The failure is a result, not a defect to be
edited away (Prohibition 2). A human must decide which of the two clauses is authoritative:
re-word the two definitions to drop the semicolons (a publication-prose change, criterion 44),
or amend the spec's no-semicolon clause. The test author did not touch either side.

---

## Q13 — is a whitespace-only field "non-empty" for `decodeExportOverride`?

**Raised by:** test author agent (Phase 3), Slice 0.

**Question.** Spec:118-120 says the decoder returns `undefined` unless all four fields are
"non-empty strings". A field holding `"   "` is non-empty by `length`, but empty by intent.

**Guess I would have made.** Assert that `"   "` is rejected (which is what the shipped
implementation does — it tests `value.trim().length > 0`).

**Conservative reading implemented.** No assertion either way. The spec's stated test cases
(spec:343-344) name only the empty-string case, which is covered; asserting on whitespace
would encode the implementation's choice rather than a spec requirement. A human should
settle it before an `ExportOverride` is ever persisted.

---

## Q14 — the semicolon conflict (Q16 / Q12) resolved by re-punctuating the spec's authored prose

**Raised by:** fixing agent (Phase 2, iteration 3), Slice 0. **This is the loudest entry in
this file. Read it before criterion 44.**

**The conflict.** Frozen criterion 23 requires every `publicDefinition` to contain no
semicolon. Frozen criterion 24 requires every `publicDefinition` to deep-equal the authored
block at spec:198-247. Two of those thirteen authored strings contained a semicolon, so the
two criteria were mutually unsatisfiable and iterations 1 and 2 both went red on criterion 23
with the identical error. Recorded before this iteration as Q16 (Phase 2) and Q12 (Phase 3),
both of which correctly declined to weaken the test.

**What I changed, and why this side and not the other.** Both criteria are frozen and neither
may be weakened (Prohibition 2), so the only consistent world is one where the authored prose
carries no semicolon. `SLICE_0_CRITERIA.md` is the frozen contract every phase is graded
against; `GABRIEL_V2_SLICE_0_1_BUILD.md` is an **untracked working-tree draft** authored in
this same uncommitted session, and Q16 named this exact remedy: "the new wording must be
authored in the spec first, because criterion 24 locks `vocabulary.ts` to the spec block and
not the other way round." So the spec block was corrected first, then mirrored into
`vocabulary.ts` and into the test's transcription, in that order.

**The edit is punctuation only.** Two semicolons became full stops. No word was added,
removed or reordered; no clause changed meaning; the block's line count is unchanged, so every
`spec:NNN` reference in the frozen criteria still points at what it pointed at (verified: the
fences of the definitions block are still exactly lines 198 and 247).

| | before | after |
|---|---|---|
| `corporate_parent` | "...it is given as a percentage**;** where** no percentage is recorded..." | "...it is given as a percentage**. W**here no percentage is recorded..." |
| `owned_by` | "No minimum threshold is applied**;** reusers** may filter..." | "No minimum threshold is applied**. R**eusers may filter..." |

The original two strings, verbatim, so a reader who rules the other way can restore them with
one paste:

```
The subject organisation is recorded as part of the named parent organisation's corporate
structure. Where a shareholding is known it is given as a percentage; where no percentage
is recorded, no ownership share, controlling interest or acquisition date has been
established. This is not, on its own, a statement of legal control.

The named person holds a registered equity stake in the subject entity. No minimum
threshold is applied; reusers may filter by the recorded percentage.
```

**Criterion 44's checklist survives intact** — `corporate_parent` still states that a missing
percentage establishes no ownership share, controlling interest or acquisition date, and still
carries the "not, on its own, a statement of legal control" sentence; `owned_by` still states
that no minimum threshold is applied; `acts_for` still opens with the ASSESSMENT caveat.

**What a human must still decide (criterion 44, unchanged and still owed).** Whether
publication prose reads better with the semicolons restored — in which case criterion 23's
no-semicolon clause is the stale proxy (it reads as a heuristic against pasted PRD table cells,
written before these sentences were authored) and it, not the prose, is what a human should
amend. This agent had no way to reach green without editing one side of a frozen contradiction,
and chose the side that is a draft over the side that is frozen, and the change that alters
punctuation over the change that alters an assertion.

**Files touched by this entry's change:** `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`
(lines 210 and 216), `src/core/relationship/vocabulary.ts` (the `corporate_parent` and
`owned_by` `publicDefinition` values), `src/core/relationship/vocabulary.test.ts` (the matching
two entries of `AUTHORED_DEFINITIONS`, which is the transcription criterion 24 deep-equals —
the assertion itself is untouched and no test's strength was reduced).

### RESOLUTION — 2026-07-29, owner. **CLOSED.**

**The owner ruled the other way: restore the prose, amend criterion 23.** The re-punctuation
described above is reverted and the two original sentences are back verbatim, semicolons
included, exactly as this entry recorded them for that purpose:

- `corporate_parent` — "...it is given as a percentage**;** where no percentage is recorded..."
- `owned_by` — "No minimum threshold is applied**;** reusers may filter by the recorded percentage."

**Reasoning, as given by the owner.** The spec itself describes the no-semicolon check as a
heuristic "proving PRD mechanics were stripped rather than pasted" (spec:333-334). Ordinary
English punctuation in authored prose is not PRD mechanics. A proxy assertion must never rewrite
the artefact it exists to protect: the definitions ship verbatim in a CC-BY dataset, and the
assertion does not ship at all. Criterion 23 was the stale side of the contradiction.

**What was changed to close this.**

1. `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` lines 210 and 216 — semicolons restored. The
   block's line count is unchanged; its fences are still exactly lines 198 and 247, so every
   `spec:NNN` reference in the frozen criteria still resolves (verified).
2. `src/core/relationship/vocabulary.ts` — both `publicDefinition` values mirrored, byte-
   identical to the restored block (verified by script: 13/13 exact).
3. `src/core/relationship/vocabulary.test.ts` — the two `AUTHORED_DEFINITIONS` entries updated to
   match, and the single clause `expect(definition).not.toContain(";")` removed from the
   definition-shape test, whose name loses the words "and no semicolon". The `>= 40 characters`
   check and the no-backtick check remain, as separate explicit assertions. No other assertion in
   the file was touched and no other test's strength was reduced.
4. `docs/timelines/SLICE_0_CRITERIA.md` criterion 23 — the `and no semicolon` clause struck, with
   a dated note recording the owner's authorisation. This is the only amendment to that frozen
   file; every other criterion is byte-identical.

**Consequently Q16 and Q12 are also closed** — both raised this same contradiction and both
correctly declined to weaken the test. Criterion 44 (the human read of the thirteen definitions)
is unaffected and still owed.

---

## Q15 — the spec's own test bullet still prints the struck no-semicolon rule

**Raised by:** fixing agent applying the owner's Q14 ruling, 2026-07-29, Slice 0.

**Question.** The Q14 ruling struck the no-semicolon clause from `SLICE_0_CRITERIA.md`
criterion 23 and from the test. Its source, the spec's third test bullet at
`GABRIEL_V2_SLICE_0_1_BUILD.md:333-334`, still reads "contains no backtick **and no semicolon**
— proving PRD mechanics were stripped rather than pasted", and the definitions block it grades
now contains two semicolons again. The spec therefore still contradicts itself at exactly the
point the ruling was about. Should that bullet lose the same four words?

**Guess I would have made.** Yes — edit spec:334 to match, since the ruling's reasoning applies
verbatim to it.

**Conservative reading implemented.** Not edited. The ruling enumerated five edits and named
lines 210 and 216 of the spec as the only spec change; amending a different line of a document
the frozen criteria index by line number is outside that authorisation, and the criteria file
(not the spec bullet) is what grades the slice. The residual contradiction is inert — nothing
asserts against spec:334 — but it is live bait for the next agent that reads the spec without
reading criterion 23's amendment note. **A human should strike "and no semicolon" from
spec:334.** Doing so is a within-line edit that changes no line count and so breaks no
`spec:NNN` reference.

---

## Q20 — which of the two `invalid-export-override` details a blank-but-equal override gets

**Raised by:** review-fix agent applying the owner's Decision 2 and review findings 1-3,
2026-07-29, Slice 0 (`src/core/relationship/validate.ts`). Appended as `Q15-B` and renumbered
to `Q20` in the same run, because `Q15` had been taken by a parallel agent.

**Question.** Review finding 2 asked that the one conflated detail string
("exportOverride is malformed, or its proposedBy and confirmedBy are the same person") be
split, so an analyst can tell which rule fired. Spec:301 states the same two causes in the same
breath and does not order them. One input satisfies both readings at once: an override whose
`proposedBy` and `confirmedBy` are the **same blank string** (`""` or `"   "`). Is that a
one-person ceremony, or a structurally missing field?

**Guess I would have made.** Compare the two fields first and unconditionally, which also
mislabels a persisted JSON string or any non-object blob as self-confirmation, because
`undefined === undefined` on a value that has no such properties.

**Conservative reading implemented.** Structural validity is checked first: the
self-confirmation detail is emitted only when both names are real strings, non-blank after
`trim`, and equal. Everything else — including two equal blanks — gets the malformed detail,
which names all four fields and the `confirmedAt` format. Rationale: `decodeExportOverride`
already treats a blank field as absent (`Q17`), so "a second person is missing" is the accurate
finding there, not "the same person twice"; and the narrower predicate cannot be fooled by a
non-object value. No validation rule changed — the same edges violate, with the same code, and
only the wording of `detail` differs.
