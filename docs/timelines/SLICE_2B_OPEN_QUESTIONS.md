# Slice 2B — open questions

> **OWNER RULINGS, 2026-07-31, taken during the run.** Two questions were escalated rather than
> guessed, and both were answered by the owner mid-run:
>
> 1. **[[Q2B-19]] — `relationships.metadata`.** §4.4 asks for both a `NOT NULL` column and an
>    encoder emitting `null` for the empty bag; SQLite holds neither reading together, and criteria
>    22 and 25 inherited the contradiction. **Ruled: drop `NOT NULL`, keep `encode({}) -> null`.**
>    So **criterion 22 fails as written** and does so by owner ruling, not by defect. The DDL half
>    was the wrong half: `decode(null) -> {}` is required by criterion 25 and only means something
>    if `null` is storable at all. Applied at `relationships.table.ts`, with the reasoning in a
>    comment beside the descriptor.
> 2. **`useProjectIO.load-state.test.ts`'s "no sixth field" assertion.** **Ruled: update it to the
>    seven keys.** The assertion's intent — no *undeclared* field reaches `setProject` — is
>    preserved; only the declared count moved, and criterion 48 requires exactly that growth.

> **OWNER RULINGS, 2026-08-03, taken after the slice was committed at `8527d44`.** Seven more, on the
> questions the run left for the owner and on how the frozen artefacts are to be corrected. Each
> names what it settles and what it costs to undo.
>
> 1. **[[Q2B-7]] — the six unrecordable violation codes get a durable row.** **Ruled: add a fifth
>    `IntegrityEventKind`**, so `unknown-type`, `date-order`, `invalid-date`,
>    `missing-required-date`, `invalid-metadata` and `invalid-export-override` become
>    `integrity_events` rows carrying their code, as §7 step 4 always said they would. Rejected:
>    keeping `console.warn` (a log is not a record — the information does not survive the session, and
>    the hole is in a *publishable* audit trail); making them fatal (one malformed `endDate` string
>    would make a legitimate file permanently unopenable, which §7's own reasoning against throwing on
>    a cross-kind edge rejects with more force); and deferring to Slice 3 (the branch goes live the
>    first time a foreign tool or a hand edit writes such a file, and nothing schedules the fix).
>    **This supersedes criterion 8's "four" and its locking test** — superseded, not failed. A
>    parallel agent is implementing it. **Cost to undo:** the union member, `INTEGRITY_EVENT_KINDS`,
>    criterion 8's deep-equal, and the event-building body reverts to the warning. **No data
>    migration**, because no file has ever been saved with the old behaviour: the old behaviour
>    writes nothing.
> 2. **[[Q2B-24]] — an unreadable `integrity_events` row is rehabilitated, not dropped.** **Ruled:**
>    a row that fails `decodeIntegrityEvent` is kept as a **neutral event carrying its raw payload
>    verbatim**, rather than dropped from the returned array and named in a `console.warn`. This is
>    ADR 0012's doctrine for an unrecognised layer kind — rehabilitate, never discard — applied one
>    storey down, to a row; and it is what §4.1's own prose says ("decodes to a neutral event rather
>    than throwing"), against which its declared signature was the wrong half. It removes the narrow
>    data loss Q2B-24 records: today the dropped row is not re-written on the next save, i.e. it is
>    gone from the file. Ruled together with Q2B-7, as Q2B-24 asked. **Cost to undo:** revert to
>    dropping, and accept that a row a foreign tool wrote is destroyed by the first save Gabriel
>    makes.
> 3. **[[Q2B-22]] — the merge acyclicity guarantee is accepted as traded away.** **Ruled: recorded
>    as debt, not repaired, and no cycle-detection code is added.** A contested child derives `null`,
>    so the *rendered* hierarchy cannot loop, and `buildOrbat` traverses cycle-safely; the three-edge
>    cycle remains possible in the edge set and undetected. The trade is Q40's — an ancestor merged
>    into its descendant leaves the survivor contested rather than having a winner elected for it —
>    and it is now written down, which is what Q2B-22 asked for. **Cost to undo:** restoring the old
>    guarantee means electing a winner inside `mergeEntities`, so the undo is a **Q40 reversal**, not
>    a test edit or a bug fix.
> 4. **The criteria file gets dated annotations, not edits.** **Ruled:** `SLICE_2B_CRITERIA.md` keeps
>    every one of its 83 criteria byte-for-byte (Prohibition 2) and gains a §0 recording the four
>    vacuously-green commands, 55d's stale count, the four criterion defects with their causes,
>    criterion 8's supersession, and the six files no criterion grades. The value of that file is
>    that it records what was actually frozen; a corrected criterion would erase the evidence that
>    the run graded 73 of 83. **Cost to undo:** re-pointing the four commands and editing 55d in
>    place is five minutes' work — and the record of what the run measured goes with them.
> 5. **The spec gets §11 entries and a widened §8b lesson 1, not a rewritten body.** **Ruled:**
>    `GABRIEL_V2_SLICE_2B_BUILD.md` §11 exists precisely so measured defects are recorded rather than
>    silently patched, so the six found in this run (§3's self-contradiction, §4.4's impossible pair,
>    §4.4's wrong trap number, §7 step 6's stale lines, §10 step 17's stale citation, §4.1's
>    disagreeing halves) go there with their dates and how they were measured; §8b lesson 1 is
>    widened to cover the spec's declared signatures and the code's own documentation, and a sixth
>    lesson records the `-t`-filter hazard. **Cost to undo:** patching the body instead is cheap to
>    do and costs the next slice the evidence of how these defects were found.
> 6. **[[criterion 82]] — `merge-dropped-edge`'s summary loses the raw identifier.** **Ruled:** the
>    sentence names the edge in readable words instead of carrying the vocabulary token
>    `subordinate_to`. A summary is publishable prose read by someone who has never seen the schema —
>    "if it reads like a stack trace it is a log, not a record" (§10 step 25) — and `detail` still
>    carries the type verbatim, so nothing machine-readable depends on the wording. The other three
>    summaries pass criteria 81/82 as written and are not touched. **Cost to undo:** one string.
> 7. **[[Q2B-21]], [[criterion 83]] — the file-cap debt gets its own commit before Slice 3.**
>    **Ruled:** the splits are scheduled now, not carried further. `useEntityInspector.ts` is at
>    **305 of its 305 ceiling with zero headroom**, so the next line added to it fails criterion 6;
>    `useProjectStore.ts` is 394 and `useProjectStore.test.ts` 384. It is scheduled ahead of Slice 3
>    rather than inside it because Q2B-21 records that the React-free extraction of
>    `handleParentChange`'s body — the same shape P1b applied to `useProjectIO` — is also **the only
>    way to make that body testable** without jsdom, which was ruled against; so the cap debt and
>    criterion 62c's untested hook body are one repair, not two. **Cost to undo:** none in code;
>    deferring it again spends Slice 3's first line in `useEntityInspector.ts` on a criterion
>    failure.

Every entry is a question an agent had to answer without a ruling. Each records the question, the
answer taken (always the most conservative available), and what a different owner ruling would cost
to undo. Prohibition 7: a recorded guess is cheap, an unrecorded one is the bug someone finds in
November.

---

## Q2B-1 — C1: where the derivation is applied. §3 contradicts itself, and one of its own rows defers to §7

**Raised by:** the Phase 1 planner, as contradiction C1 in `SLICE_2B_CRITERIA.md` §6.

**The planner's finding.** §3's file table annotates `applyResult.ts` "modified — derivation applied
here", while §7 step 5 says the derivation is last inside `load.ts`, between `readRatingEvents` and
the return, with the T10 cross-kind filter applied there. The planner declined to adjudicate (spec
§12) and wrote criteria 47 and 48 on §7's reading, naming them as the two to fail if the owner rules
the other way.

**The orchestrator's addition, measured after the criteria froze.** The same §3 table's **`load.ts`
row reads "modified — read, migrate, validate, derive (see §7)"**. So §3 says "derive" for `load.ts`
*and* "derivation applied here" for `applyResult.ts`, in two adjacent rows — §3 contradicts itself,
and the row that mentions the derivation first explicitly defers to §7 as the authority. §7 is also
the section the spec introduces with "the order is load-bearing and is not obvious from any existing
document."

**Reading taken:** §7's. The derivation runs in `load.ts`. `applyResult.ts` is still "modified", as
§3's other row says, because §7 step 6 requires `ApplyGeoPackageResultState` to gain both members and
`applyGeoPackageResult` to carry them through — so both §3 rows are satisfied under this reading and
only the loose phrase "applied here" is not.

**Why this is not an adjudication of a live conflict.** Deriving inside `applyGeoPackageResult`
instead would leave `GeoPackageLoadResult.entities` carrying raw `parentId` while the store carries
derived values — two answers to one question on the exact seam this slice exists to close — and it
would put the T10 cross-kind filter one storey away from `load.ts:60-63`, the throw it exists to
prevent on the *next* load.

**Cost to undo if the owner rules for §3's `applyResult.ts` phrasing:** criteria 47 and 48, plus the
`load.ts` half of Task F. No test outside `migration.store-path.test.ts` depends on the choice.

**Status:** recorded, not blocking. The owner should correct §3's `applyResult.ts` annotation to
"modified — carries relationships and integrityEvents through (§7 step 6)".

---

## Q2B-2 — the criteria file was frozen before Wave 1 measured `isHierarchyBearing`'s achievable shape

**Raised by:** the orchestrator, reading criterion 76a before Phase 2.

Criterion 76a expects **exactly two lines** from a predicate-scoped `rg` over non-test `src/`, and
names them as "the `subordinate_to` test and the `attachment === "attached"` test". But
`isHierarchyBearing` must also decide `corporate_parent`, and the criterion's own pattern includes
`=== "corporate_parent"`. A three-branch implementation therefore emits three lines and fails a
criterion that is otherwise correct in intent.

**Reading taken:** the criterion is satisfiable and is not being edited (Prohibition 2). It
constrains the *shape* of the function to at most two matching lines, which a two-branch form
satisfies while still testing all three conditions — the `attached` test written as `!==` does not
match the criterion's `attachment === ` pattern. Task B was told the constraint exists and that the
criterion is the contract.

**Cost if the shape proves unreachable:** criterion 76a fails and is reported as a defective
criterion under the loop's stop-and-report rule. It is not edited.

**Status:** recorded before Phase 2, so the outcome is attributable.

---

## Q2B-3 — how strict `decodeIntegrityEvent` should be about `createdAt`, and whether it accepts a JSON string

**Raised by:** Task A (`src/core/integrity/integrityEvent.ts`), during Phase 2.

§4.1 declares `createdAt` as "ISO 8601, injected" and criterion 10 fixes the fail-closed behaviour by
example (`undefined`, `null`, `42`, `"x"`, `[]`, `{}`, unknown `kind`, invalid-JSON `detail`), but
neither says whether a structurally intact row carrying a **non-ISO** `createdAt` is a valid event or
a corrupt one, and neither says whether `raw` may arrive as the JSON **text** of a row rather than an
object.

**Answers taken (the conservative ones, i.e. the ones that lose the least data).**
1. `createdAt` is checked for presence and non-emptiness only, never for ISO shape. Dropping an
   otherwise intact integrity record over an odd timestamp would be the control destroying the data
   it records — the same reasoning §4.1 gives for not throwing.
2. `raw` is accepted both as an object and as a JSON string, reusing the shipped `parseCandidate`
   idiom from `decodeExportOverride` (`relationship.ts:63-72`). A string that is not JSON (criterion
   10's `"x"`) still decodes to `undefined`, so the tolerance cannot weaken criterion 10.

**Cost to undo if the owner rules the other way:** a two-line regex guard in `decodeIntegrityEvent`
for (1) — the same `ISO_DATE`-style test `validate.ts:20` already uses — and deleting the
`typeof raw === "string"` branch of `parseCandidate` for (2). No other module depends on either.

**Status:** recorded, not blocking. Nothing in criteria 7-10 distinguishes the two readings.

---

## Q2B-4 — §8b lesson 1 caught a JSDoc string, not a code string, and the spec was the thing that forced it

**Raised by:** the orchestrator, from Task B's report.

§4.2 of the build spec writes `isHierarchyBearing`'s JSDoc out verbatim, and one of its bullets
contains the literal text `metadata.attachment === "attached"`. Criterion 76a's predicate grep
includes the pattern `attachment === ` and expects **exactly two matching lines in non-test `src/`**.
Copying §4.2's JSDoc verbatim — which the spec instructs — therefore produced a **third** matching
line and failed the criterion, from a comment that is not a predicate at all.

**Reading taken:** Task B reworded that one phrase to `` `metadata.attachment` is `"attached"` ``,
meaning identical, and left the rest of the JSDoc as §4.2 writes it. The criterion was not edited
(Prohibition 2).

**Why this is worth recording rather than shrugging at.** §8b lesson 1 says a negative grep must
exclude the strings the *positive criteria* force you to write. This is the same failure one storey
further out: the string was forced by the **spec's own verbatim JSDoc**, not by a criterion, so a
planner checking lesson 1 against the criteria list alone would not find it. The lesson's scope
should be widened to "the strings the positive criteria **or the spec's declared signatures** force
you to write."

**Cost to undo:** none — it is a comment. The risk is the reverse: a future reader restoring §4.2's
exact wording silently breaks criterion 76a.

**Status:** recorded. Suggest the owner either reword §4.2's bullet to match, or widen §8b lesson 1.

---

## Q2B-5 — three calls `migrateHierarchy.ts` had to make that no clause declares

> Renumbered from `Q2B-3` by the orchestrator: Tasks A and E ran in parallel and both claimed that
> number. No content changed.

**Raised by:** the Phase 2 agent for Task E (§4.6), while writing the module.

**(a) The `hierarchy-migrated` event when the migration mints nothing.** §4.6 declares
`integrityEvents: IntegrityEvent[]` on the result; criterion 74 requires **exactly one** row for the
real-file migration; §10 step 16 counts one row after 1012 edges. Nothing says what a run that mints
**zero** edges should emit — the second in-memory pass (criterion 73, `1012 === 0 + 1012`) and a
project with no parented entity are both such runs.

**Reading taken (the conservative one):** the event is emitted **only when `mintedEdges > 0`**. An
integrity row is a durable, publishable record, and a row reading "0 links migrated" records an event
that did not happen — exactly the "log, not a record" failure §10 step 25 rejects. Emitting always
would also put a spurious row in the file on every no-op path. Criterion 74 is satisfied either way,
because the real migration mints 1012.

**Cost to undo if the owner wants an event on every invocation:** one condition in
`migrateHierarchyToRelationships`, plus whatever the Phase 3 test asserts about `integrityEvents`
on the second pass.

**(b) The event's deterministic id.** §4.1 says the id is "deterministic, so re-detection updates one
row instead of accumulating", but declares no shape. Taken: the constant
`"integrity:hierarchy-migrated"` — one migration, one row, namespaced with the same first-colon
convention as the edges' `hier:` prefix. Cost to undo: a one-line constant, but only before a file has
been saved with the old id.

**(c) What can actually make the count assertion fire.** By construction every entity with a non-null
`parentId` is either minted or already present, so the assertion §4.6 mandates would be unreachable —
and an unreachable assertion cannot be tested, while criterion 40 requires a test that "crafts a
deficit". Taken: a **duplicate child id** in the entity set is counted in `entitiesWithParentId` but is
neither minted (its `hier:` id is already taken by the first occurrence) nor counted as already
present, so it lands in the assertion's unaccounted list by name. That makes the duplicate a loud
throw with the `Hierarchy migration` prefix rather than a silently dropped edge or a duplicate primary
key at save time, and it gives criterion 40 its deficit. Cost to undo: the `seenChildIds` guard.

**Status:** recorded, not blocking. All three are internal to `migrateHierarchy.ts`.

---

## Q2B-6 — two criteria in §3.E/§3.F count strings the house pattern also emits

> Renumbered from `Q2B-5` by the orchestrator: Tasks D and E ran in parallel and both claimed a
> number already taken. No content changed.

**Raised by:** the Phase 2 agent for Task D (§4.4, §4.5), while writing the two tables.

**(a) Criterion 24c expects `rg -c "tableExists"` to give "one match per file".** It cannot: the
symbol has to be imported before it can be called, so the import line matches too. Every sibling
already counts **2** — `ratingEvents.table.ts` and `provenanceSources.table.ts` both do. The only way
to reach 1 would be to stop importing `tableExists` and inline `connection.isTableExists`, which is
the exact call `columnDescriptor.ts:96-98` exists to centralise.

**Reading taken:** the house pattern. Both new files count 2 (one import, one call), matching every
sibling. The criterion's intent — existence is detected with `tableExists` and not with
`getFeatureTables` — is satisfied, and 24b already enforces the negative half.

**Cost to undo:** none in code; the criterion should read "at least one call site per file, and no
`getFeatureTables`".

**(b) Criterion 23 greps the whole file for `optional|fallbackSql`, which forbids naming the
mechanism in a comment.** The Task D brief asked for a JSDoc warning telling a future reader that a
column added to either table later must be declared with the missing-column flags, must switch the
reader to the two-argument `buildSelectClause`, and needs a `save.ts` back-fill call. Written in the
obvious words that warning fails criterion 23 from a comment that is not a descriptor at all — the
same shape of failure as Q2B-4.

**Reading taken:** the criterion is the contract and is not edited (Prohibition 2). Both files carry
the warning, worded around the two banned tokens ("`columnDescriptor.ts`'s missing-column flags",
"back-fill the column on files reopened from a `baseBuffer`"), with file:line pointers so the reader
can still find the mechanism.

**Cost to undo:** none — it is a comment. The risk is the reverse: a future editor restoring the
plain wording silently breaks criterion 23.

**Status:** recorded, not blocking. Both are criterion-wording defects, not implementation choices.

---

## Q2B-7 — six of the seven non-throwing violation codes cannot be recorded at all, and §7 step 4 says they must be

**Raised by:** the orchestrator before Phase 2, confirmed by the Task F agent (`load.ts`) while
writing step 4. **Not adjudicated here** — this is the reading taken so the code could be written,
and it is the one that can be reversed most cheaply.

**The contradiction, in full.** §7 step 4 says `dangling-endpoint` and `self-loop` throw and "every
other code becomes an `integrity_events` row". `RELATIONSHIP_VIOLATION_CODES` (`validate.ts:6-10`)
has nine members, so seven codes are non-throwing. But `IntegrityEventKind` is locked at **four**
members by criterion 8, which is backed by a test that deep-equals a four-element array, and of the
seven only **`multiple-active-hierarchy`** has a matching kind — the same string in both
vocabularies, deliberately (`integrityEvent.ts:15-17`). The remaining six — `unknown-type`,
`date-order`, `invalid-date`, `missing-required-date`, `invalid-metadata`,
`invalid-export-override` — **have no representation in the durable record**. Two frozen artefacts
of this slice therefore cannot both be satisfied, and neither can be edited (Prohibition 2).

**What was implemented.** `multiple-active-hierarchy` becomes one `integrity_events` row **per
contested child** (not per offending edge: the finding is "this entity has two parents", which the
competing edges assert jointly, and it is the case Q39/Q40 exist for). The event id is
`"integrity:multiple-active-hierarchy:" + childId`, deterministic, and its `detail` carries every
competing relationship id and parent id.

**The reading taken for the other six, and the four options it was chosen from.**

| Option | Why not |
| --- | --- |
| Add a fifth `IntegrityEventKind` | Forbidden: criterion 8 locks the union at four and a test deep-equals it. |
| Discard them silently | Forbidden, and it is the exact failure P2 was rewritten to remove. |
| File them under an existing kind | Misnames a finding in a **publishable** durable record — worse than not recording it, because a wrong record is trusted. |
| Throw | Makes a file with, say, one malformed `endDate` string permanently unopenable. §7's own reasoning against throwing on a cross-kind edge (T10) applies with more force here: none of the six contradicts the entity set. |

**Taken:** the violations are surfaced through `console.warn` from `warnUnrecordableViolations`
(`load.ts`), naming the count and carrying the full `RelationshipViolation[]` — code,
`relationshipId` and the validator's own `detail` sentence — and the load proceeds with every edge
returned exactly as recorded. This is the only option that invents no kind, misnames nothing,
discards nothing in silence, and leaves no legitimate file unopenable. **It is explicitly the weak
one**: a warning is a log, not a record, so the information does not survive the session. It is
recorded here rather than shrugged at because that weakness is a real gap in the audit trail the
moment the branch goes live.

**Note on liveness.** On the real file `validateRelationships` returns **zero** violations across
all nine codes (criterion 70), so this branch is dead code today. It goes live the first time an
analyst hand-edits a file or a foreign tool writes one — which is precisely why it must not be
decided silently.

**Cost to undo, per ruling:**
- *Owner adds a fifth kind* (e.g. `"relationship-violation"`, one row per offending edge carrying
  `code` in `detail`): the union, `INTEGRITY_EVENT_KINDS`, criterion 8's test, and replacing the
  `console.warn` body with the same event-building shape `multipleActiveHierarchyEvents` already
  has. Roughly twenty lines, no data migration — no file has been saved with the old behaviour
  because the old behaviour writes nothing.
- *Owner rules they should throw*: one line, moving the six codes into `FATAL_VIOLATION_CODES`.
- *Owner rules they should be dropped*: delete `warnUnrecordableViolations` and its call.

**Status:** recorded, **not** adjudicated. The owner should rule, because the choice is between a
gap in an audit trail and a fifth member of a union a frozen test pins at four.

---

## Q2B-8 — four calls `load.ts` had to make that no clause declares

**Raised by:** the Phase 2 agent for Task F (§7), while writing the load seam.

**(a) Where `now` comes from.** `migrateHierarchyToRelationships` takes an injected `now: string` so
it stays pure and reproducible (criterion 42), but `loadGeoPackage(buffer)` takes no clock and no
clause says where the timestamp is to come from. Criterion 42's no-clock grep is scoped to
`migrateHierarchy.ts` alone, so reading a clock in `load.ts` does not violate it — but nothing says
so either. **Taken:** `const now = new Date().toISOString()` inside `loadGeoPackage`, read **once**
per load, so the migration event, any `multiple-active-hierarchy` event and any `cross-kind-parent`
event minted by one load all carry one instant rather than three. The alternative — widening the
signature to `loadGeoPackage(buffer, now?)` — was rejected as the larger change: it puts a parameter
on the public entry point that every call site and every story would have to know about, to serve a
test that can already assert `createdAt` exactly by calling the pure migration directly.
**Cost to undo:** one parameter with a default, and threading it from the two pages that call
`loadGeoPackage`.

**(b) What happens when a load re-detects an event the file already holds.** Event ids are
deterministic, so a `cross-kind-parent` condition detected on load N is detected again on load N+1,
while the file already carries the row from the save after load N. Nothing declares whether the
fresh copy or the persisted one wins. **Taken: the persisted one.** It may carry an
`acknowledgedBy`/`acknowledgedAt`/`acknowledgedNote` an analyst typed, which the freshly minted
duplicate cannot; replacing it would silently erase an acknowledgement. It is also load-bearing for
save: `writeIntegrityEvents` inserts each event into a table whose `id` is `PRIMARY KEY`, so two
rows sharing one id would abort the save. **Cost to undo:** invert the collision rule in
`mergeIntegrityEvents` — three lines — but any ruling that lets the fresh copy win must also say
what happens to the acknowledgement fields.

**(c) The throw message for `dangling-endpoint` and `self-loop`.** §7 step 4 says these two throw
but does not give the message. **Taken:** the file's existing convention, the `Unsupported schema: `
prefix used by the four throws already in `loadGeoPackage`, so the message survives the catch at the
bottom of the file unwrapped rather than being re-diagnosed as `Corrupted GeoPackage` — the same
reasoning T13 gives for the `Hierarchy migration` prefix. The message names every offending
relationship id with its code and the validator's own detail sentence. **Cost to undo:** the string.

**(d) Whether the two new `GeoPackageLoadResult` members get `Gpkg*` aliases.** `types.ts` gives
every other member of that interface a thin `Gpkg*` alias, and `ApplyGeoPackageResultState` uses the
bare domain types. **Taken:** follow both local conventions exactly — `GpkgRelationship` and
`GpkgIntegrityEvent` were added and used in `GeoPackageLoadResult`; `ApplyGeoPackageResultState` uses
`Relationship` and `IntegrityEvent` bare. They are aliases, not shapes, so no consumer is forced to
import them. **Cost to undo:** two type lines and two barrel exports.

**Status:** recorded, not blocking. (a)-(c) are internal to `load.ts`; (d) is internal to this
directory.

---

## Q2B-9 — criterion 50b's "four matches" cannot coexist with importing the four functions

> Renumbered from `Q2B-7` by the Task F agent: Tasks F and G ran in parallel and both claimed that
> number. No content changed. `load.ts` cites `Q2B-7` and `Q2B-8` in code comments, which is why the
> collision was resolved this way round rather than the other.

**Raised by:** the Phase 2 agent for Task G (`save.ts`), while wiring the two new tables.

**The finding.** Criterion 50b runs
`rg -n "createRelationshipsTable|writeRelationships|createIntegrityEventsTable|writeIntegrityEvents"`
over `save.ts` and expects **four matches**. `rg` counts lines, and the four symbols must be imported
before they can be called: two `import` lines from `./relationships.table` and
`./integrityEvents.table` (the house pattern every other table in this file follows, and what the
task brief required — sibling modules, not the barrel). The floor is therefore **six**, not four.
This is the same shape as Q2B-6(a), one section further down the criteria file.

**Reading taken:** the house pattern, and the criterion's stated intent — the four *call sites* — is
what the code satisfies: `createRelationshipsTable` / `createIntegrityEventsTable` sit last in the
`create*Table` block (`save.ts:88-89`), before `ensureOptionalColumns` and before the `DELETE FROM`
block, and `writeRelationships` / `writeIntegrityEvents` sit last among the writes
(`save.ts:125-126`). Count is 6: 2 imports + 4 calls.

**Side effect on a comment, which is the Q2B-4 shape again.** The `SaveGeoPackageOptions` JSDoc
originally named `writeRelationships`/`writeIntegrityEvents` when explaining that both self-clear;
that pushed the count to 7, so the sentence was reworded to "both write functions self-clear (see
below)". The explanation survives; the criterion made the precise names unwritable in a comment.

**Cost to undo:** none in code. The criterion should read "four *call sites*, plus the imports".

**Status:** recorded, not blocking. A criterion-wording defect, not an implementation choice.

---

## Q2B-10 — nothing in the spec names the public store action that `commitRelationships` funnels

**Raised by:** the Phase 2 agent for Task H (`useProjectStore.ts`).

**The finding.** §4.7 declares `commitRelationships` **private** — "not exported, not on the store
interface" — and criterion 56a re-states it. But `tsconfig.app.json` sets `noUnusedLocals: true`, so
a module-scoped function nothing calls is a compile error, and criterion 56d requires a test to
drive one commit and observe exactly one store notification. A private function needs a public
caller, and **no section of the build spec or the criteria names one.** Criterion 62a is the only
place the gap is visible: it grades `handleParentChange` on the parent write going "through the
store's relationship action" — singular, definite article, never defined anywhere.

**Reading taken: one action, `setRelationships(next: Relationship[]): void`,** whose whole body is
`commitRelationships(set, get(), next)`. Chosen because it is the shape §4.7's own signature already
implies — `commitRelationships` takes the **complete** `next` array, not a delta — so a wholesale
setter adds no semantics the spec did not already fix. The rejected alternative was a domain-level
`setEntityParent(childId, parentId)`, which would have made the store decide edge type from entity
kind, mint edge ids, end the previous hierarchy-bearing edge and raise cross-kind events: four
policies no clause states, on the seam Task I owns.

**Consequence for Task I.** `useEntityInspector.ts` and `MainLayout.tsx` mint their own edges and
call `setRelationships`. If a different name or granularity was intended, this is the one symbol to
rename.

**Still open, and not Task H's to close:** `mergeEntities` in the store does **not** yet funnel
through `commitRelationships`, because it cannot until `mergeIdentityGraph` returns relationships
(§4.8, Task I's `merge.ts`). Criterion 56a's "every relationship mutation funnels through it" holds
today only because merge is not yet a relationship mutation. Whoever lands §4.8 must route it.

**Cost to undo:** one rename plus its call sites; nothing depends on the name's meaning.

**Status:** recorded, not blocking.

---

## Q2B-11 — criterion 55a expects `0` from a command that can only print nothing

**Raised by:** the Phase 2 agent for Task H, self-checking against the criteria.

**The finding.** Criterion 55a is
`sed -n '/setProject(p: {/,/}): void/p' src/store/useProjectStore.ts | rg -c "\?:"` -> `0`.
`rg -c` prints a count **only for files with a match**; with none it prints nothing and exits 1. The
passing state is therefore *empty output, exit 1*, never the literal `0` the criterion demands. Same
family as Q2B-6 and Q2B-9: a criterion written without running its own command.

**Reading taken:** the implementation satisfies the intent — the `setProject` parameter block
contains no optional member. Verified as `... | rg -c "\?:"` printing nothing, exit 1.

**Cost to undo:** none. The criterion should read "no output, exit 1", or use `rg -c "\?:" ; true`.

**Status:** recorded, not blocking. A criterion-wording defect.

---

## Q2B-12 — criterion 66a's "nine members", and its `rg -c` again

**Raised by:** the Phase 2 agent for Task J, self-checking against the criteria.

**The finding.** Criterion 66a is
`sed -n '/export interface ProjectSaveInput/,/^}/p' src/hooks/projectSave.ts | rg -c "\?:"` -> `0`,
"and the block lists nine members". Measured at BASE (`44994ef`), `ProjectSaveInput` already lists
**eight** members: layers, entities, geometries, researchSources, sources, claims, ratingEvents,
snapshotIsAuthoritative. Adding the two this criterion mandates makes **ten**, not nine. The
prerequisite commits are the likely cause — P3 made `ratingEvents` a listed required member where the
spec's snapshot may still have counted it as absent. Second defect, same family as Q2B-6/9/11: with
no `?:` in the block, `rg -c` prints nothing and exits 1, never the literal `0`.

**Reading taken:** the mandate, not the arithmetic. Both members added as required; the block now
lists ten, with zero `?:`. Nothing in the slice depends on the count being nine.

**Cost to undo:** none. The criterion should read "ten members" and "no output, exit 1".

**Status:** recorded, not blocking. A criterion-wording defect.

---

## Q2B-13 — criterion 65 pins a line that criterion 66 requires new members on

**Raised by:** the Phase 2 agent for Task J, while wiring `performSaveProject`.

**The finding.** Criterion 65 forbids any `+`/`-` diff line matching `authority.current` or
`snapshotIsAuthoritative` in `projectIO.ts`/`projectSave.ts`. At BASE, `performSaveProject` builds
`performProjectSave`'s whole first argument on **one line** (`projectIO.ts:229`), and that line both
lists the save-input members and reads the authority flag. Criterion 66 requires two more members on
that argument. Folding them into the literal rewrites the line, so 65's `rg` matches it as `-` and
`+` and 65 fails — the two criteria collide on one line of source.

**Reading taken:** the pinned line is left byte-for-byte as Slice 2A wrote it and the two collections
are merged onto it via `Object.assign`, with the result annotated `ProjectSaveInput` so a forgotten
member is still a compile error. Both criteria then pass, and the authority read stays where 2A put
it — inside `try`, before the `await`, with nothing evaluated between it and the save. This is
narrower than reformatting the literal and narrower than an ordering change; it costs one extra
statement and one non-obvious `Object.assign`.

**Why not the alternative.** Editing the line and amending criterion 65 was the other route. It was
rejected because 65 is frozen and is the one pin standing in for Q2A-8/11/15, two of which had a
data-loss direction; a Phase 2 agent weakening it to make its own wiring convenient is exactly the
move the pin exists to prevent.

**Cost to undo:** if the owner prefers the plain literal, one edit collapsing the `Object.assign`
back into a single object and a corresponding amendment to criterion 65's command (e.g. matching
only `authority\.current = ` assignments, which is what its stated intent is about).

**Status:** recorded, not blocking. Worth an owner ruling before the criterion is reused in Slice 3.

---

## Q2B-14 — §4.8 never says through which return channel a `merge-dropped-edge` event leaves `mergeEntities`

**Raised by:** the Phase 2 agent for Task I (§4.8 / T16, `src/core/identity/merge.ts`).

**The finding.** §4.8 and criterion 60 both say the dropped edge is "captured verbatim and
unnormalised into a `merge-dropped-edge` integrity event", and criterion 60 pins what the event's
`detail` must contain. Neither says **where the event goes**: `mergeEntities` returns
`IdentityGraph`, whose three (now four) members are all entity-keyed slices, and an integrity event
is not one. Four sub-questions follow from the same gap, and none has a ruling.

**Answers taken (each the option that loses nothing).**

1. **Return channel.** `IdentityGraph` gains **only** `relationships`, exactly as criterion 60
   states. The *return type* widens to a new
   `export type MergeResult = IdentityGraph & { integrityEvents: IntegrityEvent[] }`, carrying the
   events **this merge minted** and never the caller's ledger. Rejected: making `integrityEvents` a
   fifth `IdentityGraph` member, which would force every caller to hand the pure merge an unrelated
   durable ledger as input. The store appends the returned events to `state.integrityEvents` in the
   same atomic `set` as the merge (see Q2B-16).
2. **`now`.** `mergeEntities` gains a required fourth parameter `now: string`. `IntegrityEvent`'s
   own contract says `createdAt` is "injected, never read from a clock inside a pure function"
   (`integrityEvent.ts:30`) and `migrateHierarchyToRelationships` already takes `now` for exactly
   this reason. The clock lives at the store boundary. Every existing `merge.test.ts` call site
   already fails to compile on the required `relationships` member, so this adds no separate break.
3. **Event granularity and id.** One event **per dropped edge**, id
   `"integrity:merge-dropped-edge:" + rel.id` — deterministic, matching `MIGRATION_EVENT_ID`'s
   stated reason ("so a re-run updates one row instead of accumulating"). `detail` is **exactly**
   the four keys `{ id, fromId, toId, type }` read off the pre-rewrite edge, with no merge context
   added, because criterion 60 asserts them by string equality and a fifth key would break a
   `toEqual`. The merge context lives in the `summary` sentence, which names the two entities.
4. **The no-op path.** `mergeEntities(graph, "a", "a")` can no longer return the **same object**
   (`merge.test.ts:122-124` asserts `.toBe(graph)`); it returns `{ ...graph, integrityEvents: [] }`,
   which is `toEqual`-identical and shares every slice array by reference. Phase 3 must write
   `toEqual`/`toMatchObject` there, not `toBe`.

**Also decided, and also unstated:** what makes two edges "duplicates" after re-pointing. The key is
`fromId, toId, type, startDate, endDate, sorted metadata entries, exportOverride` — everything but
the id. Two edges are collapsed **only when at least one of them was re-pointed by this merge**:
a pair that was already identical before the merge is left alone, because `activeParentMap`'s own
comment treats two identical edges as two separate assertions, and collapsing them here would be
this function deciding they say the same thing.

**Cost to undo:** (1) is one type alias and one destructure in the store. (2) is one parameter and
its two call sites. (3) and the dedupe key are the body of two short private functions.

**Status:** recorded, not blocking. §4.8 should say where the event goes.

---

## Q2B-15 — nothing settles replace-vs-add for the parent picker, and the two line caps decide where the answer lives

**Raised by:** the Phase 2 agent for Task I (§9 clauses 8-9, criteria 62 and 63).

**The finding, part one: semantics.** §9 clause 8 says `handleParentChange` "sets a parent by
committing an edge" and clause 9 says `MainLayout` "creates an entity's parent as an edge". Neither
says whether committing a parent **replaces** the child's existing hierarchy-bearing edge or **adds**
a second one.

**Answer taken: replace, always.** Adding would give the child two active hierarchy-bearing edges,
which makes it CONTESTED, and a contested child is deliberately absent from `parentById` (Q40) — so
the analyst would set a parent in the picker and watch it vanish on the next load. That is the
data-loss direction. A conflict inherited from two merged records is a real finding worth blocking
on; one manufactured by a picker is not a finding, it is a bug. Clearing the parent removes the
edge and adds nothing.

**The finding, part two: where it lives.** The replace needs `isHierarchyBearing` (criterion 76a
forbids a second predicate anywhere in non-test `src/`), and it is needed by **two** call sites. But
criterion 6 caps `useEntityInspector.ts` at **305** lines (301 at BASE) and `MainLayout.tsx` at
**300** (293 at BASE), and the logic written inline in the hook measures roughly 18 lines over its
cap. Criterion 76b additionally expects `isHierarchyBearing` to appear in **no file other than**
`validate.ts` and `activeParent.ts`, which rules out a new module for it.

**Answer taken:** one pure exported helper, **`withActiveParent(rels, child, parentId, edgeId)`**,
added to `src/core/relationship/activeParent.ts` — the only file that can hold it without failing
76a, 76b or 6. It is the third thing that file does, alongside `activeParentMap` and
`withDerivedParents`, and it is where "which edges compete" is already decided. Both call sites are
then one line. This is the one file Task I touched that its brief did not name, and §9 clause 12's
"the only change under `src/core/relationship/` is `isHierarchyBearing` plus its consumer" is the
clause it sits closest to: `activeParent.ts` **is** that consumer, and the addition is a writer for
the same derivation rather than a new concept.

**Two sub-rulings inside the helper, also unstated.**
- **Edge type from the child's kind:** `corporate` mints `corporate_parent`, everything else
  `subordinate_to` — the same two rules the one-shot migration uses, written as a literal pair
  rather than an `EDGE_TYPES` lookup so no assessment-tier type is reachable from a picker (T12).
- **Edge id injected**, never minted inside `core/`, so the helper stays pure and reproducible.

**One behaviour deliberately NOT changed:** `MainLayout`'s new entity is always `kind: "unit"` and
its parent is whatever was selected, which may be a corporate record. That cross-kind parent was
already writable at BASE (it was a `parentId` literal) and is now a cross-kind **edge**, which T10's
filter and the `cross-kind-parent` event already cover on the next load. Adding a kind guard in the
UI would be new policy no clause states.

**Cost to undo:** if the owner wants the helper elsewhere it is 20 lines and two imports — but
moving it out of `activeParent.ts` costs criterion 76b, and inlining it costs criterion 6.

**Status:** recorded, not blocking.

---

## Q2B-16 — routing merge through `commitRelationships` and keeping one `set` cannot both be done at §4.7's pinned signature

**Raised by:** the Phase 2 agent for Task I, closing the loose end Q2B-10 left open.

**The finding.** Q2B-10 recorded that the store's `mergeEntities` does not funnel through
`commitRelationships`, and that criterion 56a's "every relationship mutation funnels through it"
holds only because merge was not yet one. Once `mergeIdentityGraph` returns `relationships`, merge
**is** one. But a merge also rewrites `entities`, `claims`, `drawnGeometries`, `selectedEntityId`,
`entityMergeMap` and now `integrityEvents`, and §4.7 pins
`commitRelationships(set, state, next)` — a signature that can only write `relationships` and the
re-derived `entities`. Two `set` calls would satisfy the funnel and break ADR 0005 atomicity (a
subscriber would see merged entities against stale edges); one hand-rolled `set` in the action
would satisfy atomicity and break the funnel, putting a second copy of the derivation in the very
file criterion 56 exists to keep single.

**Answer taken:** `commitRelationships` gains **one optional fourth parameter**,
`rest?: Partial<ProjectState>`, spread into the same single `set` object literal, and the
derivation runs over `rest?.entities ?? state.entities` because the pre-merge array still contains
the record the merge removed. The function still has exactly one `set(`, still computes
`activeParentMap` then `withDerivedParents` before it, and still writes `relationships` and
`entities` in one literal — criteria 56b and 56c are unaffected, and 56a is strengthened.

**Known cosmetic cost:** a merge is now labelled `commitRelationships` in the Redux devtools
timeline rather than `mergeEntities`. A fifth `action` parameter would fix it; it was left out to
keep the deviation from the pinned signature to one parameter.

**Cost to undo:** delete the parameter and accept either two notifications or a second derivation
site — i.e. the choice above, made the other way.

**Status:** recorded, not blocking. §4.7's declared signature should gain the parameter.

---

## Q2B-17 — criterion 6's escape hatch for the `isHierarchyBearing` truth table adds a fifth path criterion 15a forbids

**Raised by:** the Phase 3 test-author agent for T1, writing the criterion 13 truth table.

**The finding.** Criterion 6 caps `src/core/relationship/validate.test.ts` at **300 lines** and says
in as many words that if the `corporate_parent` / `isHierarchyBearing` coverage would push it over,
"it goes in a new sibling test file instead". It does push it over: the file is 273 at BASE, the
criterion 14b test for `one active subordinate_to and one active corporate_parent` takes it to
**292**, and the criterion 13 truth table needs six-plus tests, the eleven-type iteration and an
`EDGE_TYPES` import — about 40 more lines, i.e. ~332. So the sibling file is the only route that
satisfies criteria 6 and 13 together.

But criterion 15a runs `git diff --name-only BASE -- src/core/relationship/` and expects **exactly
four paths** — `activeParent.ts`, `activeParent.test.ts`, `validate.ts`, `validate.test.ts` — "and
no other path". A sibling test file is a fifth. Criterion 15's intent is the **Q39 scope limit**
(no `vocabulary.ts`, no `relationship.ts`, no edge-vocabulary amendment under ADR 0010), which a new
test file for an already-declared function does not touch; but its command, read literally, fails.

**Answer taken:** the sibling file, at `src/core/relationship/isHierarchyBearing.test.ts` (74 lines).
Criterion 6 anticipates this case explicitly and names the remedy, criterion 15a does not anticipate
it at all, and criterion 13's command is `npx vitest run src/core/relationship/ -t
"isHierarchyBearing"` — directory-scoped, so it finds the sibling. Criterion 15a therefore prints a
fifth line and is reported as a failing criterion rather than resolved by weakening a test or
overrunning the cap. Nothing in the criteria file was edited (Prohibition 2).

**Cost to undo:** if the owner rules for criterion 15a's literal enumeration, the truth table folds
back into `validate.test.ts` and that file lands at roughly 332 lines, failing criterion 6 instead —
the two criteria cannot both hold. The third option, dropping coverage to fit, is refused: criterion
13 requires at least six tests and the eleven-type iteration.

**Status:** recorded, not blocking the tests. The owner should read criterion 15a as "no other
*source* path, and no vocabulary file", which is what its own prose says.

---

## Q2B-18 — two of the ten existing tests T5 had to repair cannot be made to compile *and* pass without touching what they assert

> Numbered 18 because Q2B-17 was already taken by the parallel T1 agent when this was written. No
> existing entry was disturbed.

**Raised by:** the Phase 3 agent for T5 (repairing the existing test files the two new required
members broke). T5's rule is that the repairs are mechanical — add the two members, change no
`expect`, and stop and report anything that would change what a test proves. Two files hit that rule.

**(a) `src/hooks/useProjectIO.load-state.test.ts` asserts the exhaustive key list of the one state
literal that reaches `setProject`, and that list is now stale.** The test ends with

```
// No sixth field reaches setProject.
expect(Object.keys(state).sort()).toEqual(["claims","drawnGeometries","entities","layers","selectedEntityId"])
```

`projectStateFromLoadResult` now returns **seven** keys — §7 step 6 added `relationships` and
`integrityEvents`, and `applyResult.ts:91` says so in as many words ("Six became seven when §7 step 6
added `relationships` and `integrityEvents`"). The fixture repair makes the file compile; the
assertion then fails with the two new keys as the only difference.

**Answer taken: the assertion was left exactly as written and the failure is reported.** Updating the
list to seven is almost certainly what the implementation intends, and it preserves the property the
test exists for (the literal is exhaustively enumerated, so an eighth field is caught). But it is
still an edit to an `expect`, which T5 is forbidden to make and which is not distinguishable, from
inside T5, from silently widening a guard to fit an implementation. **This is the one test in T5's
ten that is red for a reason no fixture change can address.**

**Cost to undo:** two strings added to the array and the comment reworded to "No eighth field". Under
one minute for whoever owns the assertion — the T2/T4 test-author agents or Phase 4.

**(b) `geopackage.service.test.ts`'s corporate round-trip needed a relationship literal, not `[]`.**
The test "round-trips corporate entities (kind: 'corporate')" asserts `parentId: "org-1"` on the
reloaded child. Under ADR 0011 the edge set is the sole authority for `parentId` after a reload
(`activeParent.ts`), and `createRelationshipsTable` runs on every save, so an empty `relationships`
array is not a neutral fixture value there: the table exists but is empty, the migration is correctly
gated off, and every `parentId` comes back `null`. `[]` would have made the test fail for a reason
that has nothing to do with what it tests.

**Answer taken:** the save was given the one edge that expresses the link the fixture already
declared — `{ id: "hier:org-2", fromId: "org-2", toId: "org-1", type: "corporate_parent", ... }`,
shape and id namespace as minted by `migrateHierarchy.ts`. No assertion changed. The same reasoning
put `first.relationships` / `first.integrityEvents` (rather than `[]`) into every save in
`project-gpkg-fixture.test.ts`, `save.options.roundtrip.test.ts` and `store-path.integration.test.ts`,
each of which re-saves a real loaded project, and `snapshot.relationships` /
`snapshot.integrityEvents` into the store-path gate specifically, mirroring `performProjectSave`.

**Why this is recorded rather than shrugged at:** it is the smallest possible instance of a real
property of this slice — after 2B, *a save that forgets the edges silently flattens the hierarchy,
and only a test that asserts parentage notices*. Three of the ten repaired files would have gone
green on `[]` while round-tripping a flattened project.

**Status:** recorded. (a) needs an owner or a Phase 4 decision; (b) is done and needs review only.

---

## Q2B-19 — `relationships.metadata` is declared NOT NULL and its encoder returns `null` for the empty bag, so no project with an edge can be saved

**Raised by:** the Phase 3 agent for T5, running the repaired tests. **This is a finding about the
implementation, not an open question**, and it is recorded here because it is what stands between
Slice 2B and a green suite.

**The defect.** `relationships.table.ts:69` declares the `metadata` column with
`constraints: "NOT NULL"`, and `encodeMetadata` (`:57-60`) returns `null` for a bag with no own
enumerable keys — with a JSDoc saying that is deliberate and "most edges". Both statements are
correct on their own and cannot both hold: SQLite rejects the INSERT. Every edge
`migrateHierarchyToRelationships` mints without a percentage carries `metadata: {}` (`:111`), which
on the real file is 1010 of 1012 edges, and `withActiveParent` mints `metadata: {}` unconditionally
(`activeParent.ts:101`).

**Observed as:** `Failed to save GeoPackage: NOT NULL constraint failed: relationships.metadata`,
from `saveGeoPackage`, on **every** save that carries at least one edge with an empty bag — i.e. on
the real project, through the real store path. Ten of T5's eleven remaining test failures are this
one defect.

**Confirmed as the sole cause, and confirmed non-masking.** A throwaway probe changing that one
`return null` to `return "{}"` was applied, the nine repaired files run, and the probe reverted
byte-for-byte (verified: no `TEMP PROBE` or `return "{}"` remains under `src/`). Under the probe
**all ten of those failures go green**, including
`store-path.integration.test.ts`'s full `entityId -> parentId` deep-equal across the round trip on
the real 1027-entity project. So the derivation, the migration, the store snapshot's edge filter and
the whole load->store->snapshot->save->reload chain are correct; the only thing broken is this
column.

**Not fixed here.** T5 may not touch an implementation file, and the choice between the two repairs
is not T5's to make:
1. drop `NOT NULL` from the descriptor, keeping `null` on disk for the empty bag (`decodeMetadata`
   already decodes null to `{}`, so this needs nothing else); or
2. keep `NOT NULL` and have `encodeMetadata` emit the literal `"{}"` — which is exactly what its own
   JSDoc says not to do, citing `encodeRatingMeta` as "the wrong thing to copy here".

(1) matches the JSDoc's stated intent and every nullable sibling column; (2) matches the descriptor.
Whoever fixes it should also say whether a criterion pins the `NOT NULL`.

**Status:** recorded, **blocking**. No project containing a hierarchy can be saved until it is fixed.

---

## Q2B-20 — criterion 58 pins its test to the one file criterion 5 caps three lines above where it stands

**Raised by:** the Phase 3 test-author agent for T3.

**The finding.** Criterion 58's command is
`npx vitest run src/store/useProjectStore.test.ts -t "drops an edge whose endpoint"` — it names the
file. Criterion 5 caps that same file at **385 lines** and it measured **382** at BASE, so the test
criterion 58 describes (an OSM-layer entity, an edge onto it, an edge between two survivors, and two
assertions) cannot be written there: the `it(...)` wrapper alone is three lines. Criterion 5 also
names the sibling-file split (P1b's `projectIO.authority.test.ts`, P2's
`useProjectStore.renameLayer.test.ts`) as the sanctioned way to add tests without touching the cap,
so the two criteria point in opposite directions for the same test.

**Answer taken:** the test lives in a new sibling, `src/store/useProjectStore.snapshot.test.ts`
(71 lines, well under criterion 4's 300), named
`drops an edge whose endpoint is filtered out with its OSM layer, and keeps the surviving edge`.
Everything criterion 58 asks for is asserted there, including the surviving-edge artefact.
`useProjectStore.test.ts` grew by 2 lines to 384 (a comment on the merge fixture, see Q2B-22) and
stays inside its cap. No existing test was shortened or deleted (Prohibition 6).

**The hazard this leaves, stated plainly.** Criterion 58's command **as written now exits 0
vacuously**: `npx vitest run src/store/useProjectStore.test.ts -t "drops an edge whose endpoint"`
reports `18 skipped (18)` and `$LASTEXITCODE` **0**. A grader running it verbatim gets a green that
proves nothing. The command must be re-pointed at `src/store/useProjectStore.snapshot.test.ts`, or
run as `npx vitest run src/store/ -t "drops an edge whose endpoint"`, which does match.

**Cost to undo:** move the three tests back into `useProjectStore.test.ts` and raise criterion 5's
385 to roughly 425 — i.e. spend the cap the criterion exists to protect.

**Status:** recorded, not blocking. The owner should re-point criterion 58's command.

---

## Q2B-21 — criterion 62c's test cannot invoke `handleParentChange`, and no permitted tool can

**Raised by:** the Phase 3 test-author agent for T3.

**The finding.** Criterion 62c is `npx vitest run src/modules/orbat/ -t "parent"`, "including a test
that clearing the parent still yields `positionMode: 'none'`". `handleParentChange` is a
`useCallback` inside `useEntityInspector`, so invoking it needs a React renderer. This project runs
vitest with `environment: "node"`, has no jsdom and no `@testing-library/react` (ruled against), and
the only pre-existing test under `src/modules/orbat/` is the pure `treeLayout.test.ts`.
Server-rendering the hook is not a way round it either: zustand v5 gives a server render
`getInitialState()`, so the hook would read an empty store instead of the fixture.

**Answer taken:** `src/modules/orbat/hooks/useEntityInspector.parent.test.ts` (121 lines) drives the
**real** store and the **real** `withActiveParent` through the exact composition
`useEntityInspector.ts:206-217` performs, in a four-line local `applyParentChange` that mirrors the
callback body. It covers edge-not-field, replace-not-add (Q2B-15), the `positionMode: "none"`
coupling on clear, and non-interference with a sibling's edge.

**The caveat, stated plainly.** This is a test of the *collaborators in the hook's composition*, not
of the hook's own body: if `handleParentChange` were deleted or rewired, these tests would still
pass. Criteria 62a and 62b (reading the source, and asserting no direct `parentId` write) are what
currently pin the body itself.

**The repair that would close it,** if the owner wants 62c to bite: extract the callback body as a
React-free function (`parentChangeCommands(entity, parentId, edgeId)` returning the edge set and the
optional entity patch) and have the hook call it — exactly the shape P1b applied to `useProjectIO`,
and for the same reason. `useEntityInspector.ts` is at 301 lines against criterion 6's ceiling of
305, so the extraction has to leave the file, which is why it is recorded rather than done.

**Cost to undo:** delete the extracted function and inline it again.

**Status:** recorded, not blocking.

---

## Q2B-22 — criterion 61 deletes the hierarchy behaviour four `merge.test.ts` tests exist to prove

**Raised by:** the Phase 3 test-author agent for T3.

**The finding.** Criterion 61 deletes `merge.ts`'s `parentId` writes (`parentId: primaryId`,
`resolveParent`). Four tests in `merge.test.ts` were written against exactly those writes and go red
on the ported code: *re-parents the secondary's children onto the primary*, *promotes the primary's
parent when the primary was parented to the secondary*, *back-fills the secondary's parent when the
primary is at the root (F3)*, and *promotes the primary out of the secondary's subtree instead of
forming a cycle (F2)*. Prohibition 6 forbids deleting them; the criteria forbid restoring the writes.

**Answer taken:** all four were kept and restated in the edge model, since ADR 0011 moves their
subject rather than removing it — the fixtures now carry edges and the assertions run through
`activeParentMap`. Three of the four prove the same proposition as before and pass. The fourth, F2,
does not, and that is the finding:

**F2's acyclicity guarantee is gone by design.** Merging an ancestor into its descendant used to
promote the survivor out of the subtree, and the test walked every parent chain to prove no cycle.
Under the port, the survivor inherits two hierarchy-bearing edges and is **contested**: Q40 forbids
electing a winner, and `merge.ts`'s own docstring says the resulting cycle is left for `buildOrbat`
to traverse cycle-safely and for a human to unwind. The test now asserts that — absent from
`parentById`, both edge ids in `contested` — under the title *leaves the survivor contested rather
than snapping an edge when an ancestor merges into its descendant (F2)*. **A guarantee the suite
used to make (a merge never leaves a cycle) is no longer made by anything.** Nothing in the frozen
criteria requires it, and Q40 is why; the owner should confirm that trade.

**Two smaller behavioural changes in the same file, for the record.**

1. `expect(mergeEntities(graph, ...)).toBe(graph)` on the three no-op paths (equal ids, missing id,
   kind mismatch) had to become `.toEqual({ ...graph, integrityEvents: [] })`. The documented
   contract "returns the input graph unchanged" is now "returns an **equal** graph": a caller
   relying on reference identity to detect a no-op (`result === graph`) would now see a change where
   there is none. The store's `mergeEntities` does not rely on it — it re-checks entity presence —
   but `merge.ts`'s docstring should be reworded.
2. `src/store/useProjectStore.test.ts`'s *collapses the secondary into the primary atomically* test
   set up `child` with `parentId: "b"` and **no edges**, and went red because every merge now
   re-derives `parentId` from the edge set. The fixture gained the edge the post-2B store would
   carry (`child -> b`); the test still proves the child follows the survivor, now via a re-pointed
   edge. No assertion was weakened. This is the pre-2B-fixture failure mode to expect in any other
   store test that writes `parentId` without an edge.

**Cost to undo:** restoring F2's guarantee means electing a winner inside `mergeEntities`, which
Q40 forbids — so the undo is a Q40 reversal, not a test edit.

**Status:** recorded, not blocking.

---

## Q2B-23 — what an in-session `multiple-active-hierarchy` row does on the second edit, and on the edit that resolves the contest

**Raised by:** the Phase 5 fix agent, wiring `ActiveParentMap.contested` into `commitRelationships`
(§4.3's stated reason for returning `contested` at all — "so the caller mints the integrity event
without a second validation pass" — which nothing outside tests was honouring).

**The finding it fixes.** `contested` was dead on the edit path. An analyst who created a contested
child in-session watched the child's parent drop to `null` on screen with **no integrity event
minted**; the finding only materialised after a save and a reload, when `load.ts` re-derived it from
`validateRelationships`. A visible data change with no record is the exact failure the ledger exists
to prevent. `commitRelationships` now consumes the `contested` map it already computes and mints one
row per contested child inside the single existing `set` (criteria 56b/56c/56d unaffected: still one
`set(`, still `activeParentMap` then `withDerivedParents` before it, still one notification).

**Two lifecycle questions no clause answers, and the answers taken.**

1. **The same contest re-committed.** Ids are deterministic, so the second commit computes the id the
   first one wrote. **Taken: the row already on the ledger wins and nothing is appended** — the same
   collision rule `mergeIntegrityEvents` uses on load (Q2B-8b), for the same two reasons: the
   existing row may carry an acknowledgement an analyst typed, and two rows sharing an id would abort
   the save on the table's PRIMARY KEY. Repeated edits therefore update one row, never accumulate.
   Pinned by a test that seeds an **acknowledged** row and commits the contest twice.
2. **The contest resolved.** When the analyst deletes one of the competing edges the child derives a
   parent again and the condition is gone, but the row is not. **Taken: the row is KEPT.** A finding
   is retired by being acknowledged, never by the condition quietly going away — and a load keeps
   the same row for the same reason (nothing in `load.ts` prunes persisted events). The cost is an
   open finding that no longer describes the current edge set until someone acknowledges it.
   **Cost to undo:** deleting rows whose child is no longer contested is four lines in
   `withContestedParentEvents`, but any ruling that way must also say what happens to a row someone
   had already acknowledged, and it makes the ledger lose the fact that the contest ever existed.

**Where the minter lives, and why not in `load.ts`.** A new pure module,
`src/core/integrity/contestedParentEvents.ts` (69 lines), takes `now` injected and is called from the
store, which reads the clock — the same split `migrateHierarchy.ts`/`merge.ts` already use. It does
**not** replace `load.ts`'s `multipleActiveHierarchyEvents`, which keys off `validateRelationships`'
violations and runs *before* the derivation that §7 steps 4-5 pin in that order; unifying the two
would have reordered a load sequence the spec calls "load-bearing". The two therefore emit the same
id, `kind`, `summary` and `detail` shape from two places, and a test asserts the exact id string so a
drift is red. **The owner should decide whether `load.ts` is re-pointed at the shared minter in
Slice 3**, which would also let §7 step 4 stop asking `validateRelationships` a question the
derivation answers ten lines later.

**Side effect worth naming:** a merge that leaves the survivor contested (the F2 case in Q2B-22, where
the acyclicity guarantee was deliberately dropped) now mints a durable row at the moment of the merge
rather than at the next load. That is the case Q2B-22 said "the owner should confirm" — it is now at
least recorded rather than only observable.

**Status:** recorded, not blocking.

---

## Q2B-24 — a structurally invalid `integrity_events` row is dropped on read, and the drop is a `console.warn`

**Raised by:** the Phase 5 fix agent, wiring `decodeIntegrityEvent` into `readIntegrityEvents`.

**The finding it fixes.** §4.1 declares `decodeIntegrityEvent` the fail-closed decoder and §10 step 16
counts "zero rejected rows", which presupposes rejection exists — but the decoder's only caller in the
whole tree was its own test. `readIntegrityEvents` decoded column-by-column with `decodeRow`, whose
descriptors **coerce** (`String(raw ?? "")`), so a row carrying `kind = "whatever"` reached the store
typed as an `IntegrityEventKind` and was re-written verbatim on the next save — laundering a corrupt
row into the durable record. Every row now goes through `decodeIntegrityEvent` after the column
decode; criteria 30 (`[]` for an absent table) and 31 (`detail` -> `{}`) are untouched.

**The question no clause answers:** what happens to the rejected row. It cannot be repaired (the
decoder cannot know what the writer meant), it must not throw (§4.1: a corrupt integrity row must
never make a project unopenable), and keeping it is what the fix exists to stop.

**Taken: dropped from the returned array and named in a `console.warn` carrying the raw rows.** This
is the same weak channel Q2B-7 records for the six unrecordable violation codes, and it is weak for
the same reason — a warning is a log, not a record, so the information does not survive the session,
and the dropped row is **not** re-written on the next save, i.e. it is gone from the file. That is a
deliberate, narrow data loss: the alternative is a record whose `kind` lies. **Cost to undo:** if the
owner wants the raw rows preserved, they have to go somewhere — a quarantine column or a fifth
`IntegrityEventKind` — which is the same union-of-four problem Q2B-7 leaves open, and the two should
be ruled on together.

**Status:** recorded, not blocking. Nothing in the real file exercises it: `public/project.gpkg` has
no `integrity_events` table today (criterion 30's test asserts exactly that).

---

## Q2B-25 — the fifth `IntegrityEventKind` is named `invalid-entry`, not `relationship-violation`

**Raised by:** the agent implementing the 2026-08-03 owner rulings (Q2B-7 and Q2B-24, ruled together
as the cost-to-undo note under Q2B-24 predicted).

**What the two rulings jointly require.** Ruling 1: the six violation codes with no kind of their own
get a durable, acknowledgeable row — exactly **one** new member of the union, suggested name
`relationship-violation`. Ruling 2: an `integrity_events` row that cannot be decoded is
**rehabilitated**, not dropped (ADR 0012 rule 2, applied to this table), under **one of the five**
kinds, with no sixth added.

**The tension.** Those two conditions cannot share a kind named after relationships: a row this table
carries need not be about a relationship at all — it can be a `hierarchy-migrated` row whose
timestamp column was blanked by a foreign tool. Filing it under `relationship-violation` would make
the `kind` column state something the row does not support, which is the one thing a durable integrity
record may not do. The other four kinds are worse: each names a specific finding the row is not.

**Taken: the fifth kind is `invalid-entry`** — "something this project carries could not be validated,
and is kept exactly as it stands rather than discarded". It covers both producers honestly, and
**which** condition produced a row is in `detail` (`{ code, relationshipId, detail }` for a violation;
the entire raw row for a rehabilitated one), never inferred from the kind. Ids stay
`integrity:<kind>:<discriminator>`: `integrity:invalid-entry:<code>:<relationshipId>` for a violation,
so two violations on one edge are two rows, and `integrity:invalid-entry:unreadable-row-<position>`
for a row that has no salvageable id of its own.

**What is arguable.** The name is broader than either producer, so a reader must open `detail` to know
which kind of invalidity a row records — where `relationship-violation` would have been self-evident
for the six codes and dishonest for the seventh case. The alternative the owner may still prefer is
two kinds (`relationship-violation` + something like `unreadable-row`), which is the sixth member both
rulings forbid. **Cost to undo:** the name is one string in four files
(`integrityEvent.ts`, `mintOnLoad.ts`, `integrityEvents.table.ts` and their tests) and no persisted
project carries it yet — `public/project.gpkg` still has no `integrity_events` table.

**Status:** implemented, recorded, not blocking.
