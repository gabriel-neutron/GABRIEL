# Open questions — Slice 2A

Recorded by the Phase 2 coding agents. Each entry states the question, the option taken (always
the most conservative available), and what a different owner ruling would cost to apply.

> **STATUS, 2026-07-30 — owner ruled, and a fix pass ran.** Three rulings were given: amend the
> frozen criteria as needed and fix everything; the flag means **"the whole operation landed"**; and
> the refusal message **stays exactly as ruled**, no `projectStorage:` prefix. Under those rulings
> `SLICE_2A_CRITERIA.md` gained four dated owner-authorised amendments — **24b** (four sites, and
> ordering pinned for the first time), **15b** (new: the store-path integration test), **34** and
> **46** (the rename and the new file). Every amendment is additive or a stated replacement; nothing
> was weakened.
>
> **Resolved by the fix pass:** [[Q2A-5]], [[Q2A-8]], [[Q2A-11]] (one bug, fixed together),
> [[Q2A-12]], and all of [[Q2A-13]] except the message prefix.
>
> **A second owner sitting, same day, closed the rest.** Three further rulings: **[[Q2A-9]]** —
> criterion 23 passes on substance, its second command recorded as an over-broad proxy; **[[Q2A-10]]**
> — *"Si le slice est terminé il doit être commité"*, so criterion 47's prohibition is **discharged**
> (it bound the unattended run, and the review it was protecting has now happened) and the slice ships
> as **one commit** covering all fifteen paths; and **`[HUMAN]` criterion 54 is RATIFIED**, so 2B may
> build its compile-error mechanism on the eight required options. All four `[HUMAN]` criteria are now
> closed.
>
> **CLOSED, 2026-07-31 — everything on this page is now ruled.** The rulings are not repeated here;
> they live where the builder reads them, in `SLICE_RUN_LOG.md`, *"Owner ruling session —
> 2026-07-31, before Slice 2B"*, and in **ADR [0012](../adr/0012-layer-identity-is-the-id.md)**.
> In short: [[Q2A-14]] splits in two and the ruling on each is in ADR 0012 — the echelon layer's
> name is **not** analyst data (the built-in vocabulary is authoritative), while the two
> neighbouring branches are **rehabilitated as `custom`, not dropped**. [[Q2A-6]] and the
> `ViewPage` breach in [[Q2A-7]] become prerequisite commits **P3** and **P1**, before any
> migration code. [[Q2A-15]]'s `tx.oncomplete` fix is deferred to its own commit **after** 2B.
> [[Q2A-13]]'s message-prefix debt is **confirmed** as accepted debt.
>
> **Two statements on this page are wrong and the run log carries the corrections.** [[Q2A-14]]'s
> claim that a dropped layer leaves its entities behind is false — `selectPersistableSnapshot`
> filters entities by membership in `state.layers` (`useProjectStore.ts:123,125`), so the layer's
> entities, geometries and claims are deleted with it. And its claim that the selector's three
> lossy branches are "exercised by nothing" is false at the unit level:
> `useProjectStore.test.ts:39`, `:72` and `:97` cover all three. The no-op is on the **real
> fixture** only.

---

## Q2A-1 — `project-gpkg-fixture.test.ts` was **not** split, declining a recorded owner preference

**Raised by:** Task A (call-site conversion), 2026-07-30.

`SLICE_RUN_LOG.md:456` ("What Slice 2 must do before it starts", item 1), the Q35 ruling at
`:476` and the restated item at `:599` all say to **split** this file. It was not split. This is
the one place Task A knowingly departs from a stated owner preference, so the reasoning is
recorded rather than acted on.

**Why.** Criteria 16 and 20 are only mutually satisfiable by keeping one file at 300 lines or
fewer.

- Criterion 20's **first** branch explicitly permits "ends <= 300 lines"; the split is its second
  branch, not a requirement.
- Criterion 16 runs `npx vitest run` against **three named paths** and requires nine named tests
  to be present and passing. Seven of those nine live in `project-gpkg-fixture.test.ts`. Vitest
  treats those arguments as filename filters, so any test moved into a sibling file would no
  longer be executed by that command, and criterion 16 would fail exactly as written. Criterion
  10 anticipates a split (it allows the nine `saveGeoPackage({` occurrences to be spread across
  files); criterion 16 does not.

**The premise of the Q35 ruling is also materially weaker after the conversion.** Q35 argued the
file "breaks on the first line added" at 299 lines. The conversion **shrinks** it to **279
lines**, leaving 21 lines of headroom. Separately, the two new real-WASM tests this slice adds
(criteria 5 and 15) are specified to live in their own new files, so nothing in Slice 2A needs to
grow this one.

**If the owner still wants the split:** it is a follow-up task, not a 2A change, because the
split cannot be made without failing criterion 16 as frozen. Doing it later also requires
updating criterion 16's command to name the new sibling.

---

## Q2A-2 — the two preserved comments were reworded, not copied verbatim

**Raised by:** Task A, 2026-07-30.

The brief required preserving the two explanatory comments from the old parameter list by moving
them onto the corresponding members of `SaveGeoPackageOptions`. Copied verbatim, both would have
asserted something the conversion makes **false**:

- ADR 0006 E2 Slice A note, at BASE: "additive **trailing params**, not yet threaded through from
  the store/useProjectIO (E2.4) — **every existing call site keeps working unchanged**." There
  are no longer trailing params, and under criterion 4 an un-updated call site is a compile
  error, which is the point of the task.
- Phase 4 note, at BASE: "same **additive-trailing-param** pattern as sources/claims above."

**Taken:** the *why* of each comment is kept and only the phrasing rendered false is dropped.
Now: "ADR 0006, E2 Slice A: additive fields, not yet threaded through from the
store/useProjectIO (E2.4)." and "Phase 4 (v1.5): same additive pattern as sources/claims above."
No provenance reference (ADR 0006, E2 Slice A, E2.4, Phase 4, v1.5) was lost.

**Noticed, not fixed:** the "not yet threaded through from the store/useProjectIO" clause was
**already stale at BASE** — `performProjectSave` has threaded `sources`, `claims` and
`ratingEvents` through since before this slice. Correcting it is not in any criterion and would
be scope creep (Prohibition 5), so it stands as written.

---

## Q2A-3 — `saveGeoPackage` takes `options` and destructures in the body

**Raised by:** Task A, 2026-07-30.

Criterion 1 permits either `saveGeoPackage(options: SaveGeoPackageOptions)` or destructuring in
place, but prints only the first form as its expected output.

**Taken:** the printed form, plus a single-line destructure as the function's first statement.
This satisfies criterion 1 both literally and by its parenthetical, and it keeps criterion 6
exact: the diff's only **removed** code lines are the thirteen of the old parameter list, and
every line of the body is untouched context. Measured:
`git diff BASE -- src/core/persistence/geopackage/save.ts | rg "^-" | rg -v "^---" | rg -v "^-\s*(\*|//|/\*)"`
returns the ten non-comment lines of the old signature and nothing else.

---

## Q2A-4 — call-site formatting convention

**Raised by:** Task A, 2026-07-30.

No `max-len` ESLint rule and no Prettier config exists in this repo (re-verified), so formatting
is a free choice bounded only by the 300-line cap. Three conventions are now visible in the
converted files, and the inconsistency is deliberate:

1. **One line per call, where the call was one line at BASE.** All four sites in
   `geopackage.service.test.ts` (forced: criterion 21 requires exactly 321 lines and a 4/4
   numstat) and the four one-line sites in `project-gpkg-fixture.test.ts`. Lines reach roughly
   240 characters.
2. **Grouped 3/2/3 keys across five lines**, where the call was already multi-line: the five
   multi-line sites in `project-gpkg-fixture.test.ts` and the one in
   `project-open-save-restore.integration.test.ts`. This is what buys the headroom in Q2A-1.
3. **One key per line**, in production code (`useProjectIO.ts`, both sites), where the criteria
   grep the keys individually (criterion 12) and where readability outranks line count.

The rule applied: **preserve each call's existing shape** (one line stays one line, multi-line
stays multi-line) so the diff shows only the conversion. If the owner wants one convention
across all sixteen sites, it is a pure reformat with no behavioural content.

---

## Q2A-5 — ESCALATION: the guard refuses the second save of a from-scratch session

**Raised by:** the Phase 5 spec review, 2026-07-30. **This is the one entry an owner must read.**
It is **not** a criterion failure — criteria 24 and 24b are implemented exactly as amended, and
every MACHINE criterion passes. It is a hole in the amended contract itself, which is why it is
recorded and escalated rather than patched: a fix contradicts criterion 24b as frozen, and
Prohibition 2 plus this file's own header make that the owner's call, not an agent's.

**The sequence, verified against the code:**

1. Cold start with an empty IndexedDB. `restoreSession` (`useProjectIO.ts:147-149`) returns early
   at `if (!stored || !mounted) return`, so the `snapshotIsAuthoritative` ref stays `false`.
2. The analyst builds a project from scratch **without pressing New or Open** — nothing forces
   either, since the store already opens on `initialState()`'s default echelon layers + Industry.
   Those two gestures and a successful restore are the only three sites that set the flag `true`
   (criterion 24b).
3. **Save 1 succeeds.** `loadProject()` returns `null`, so the guard's second clause is false.
   `performProjectSave` then calls `deps.saveProject(buffer)` and **fills IndexedDB**.
4. **Save 2 is refused.** `loadProject()` now returns that buffer with `byteLength > 0`, the ref is
   still `false`, and the analyst is told "this session never loaded it" — over data **this session
   itself just wrote**.

**Why this matters beyond the annoyance.** It is precisely the failure the criterion 24 amendment
levelled *against* the struck four-dimension condition: "`handleNew` never routes through
`performProjectSave` and never calls `saveProject`, so its first Save fills IndexedDB and the
**second Save on a fresh empty project is refused**." The amendment closed that hole on the
`handleNew` route and left it open on the one route `handleNew` does not cover — the analyst who
never pressed New at all.

**Severity, stated honestly.** The failure direction is safe: the guard **refuses**, it does not
destroy, and `save.ts` is never reached, so nothing is written. The analyst is not stranded
either — Save 1 already wrote a `.gpkg` to disk through `writeGeoPackageToFile`, and the refusal
message's first instruction ("Reload the page to load your project again") is an accurate remedy,
because the reload restores from the IndexedDB copy Save 1 wrote and sets the flag `true`. So this
is a recoverable obstruction with a correct stated exit, not data loss. Against what the guard
prevents — 1 unit written over 1010 — the trade stays heavily favourable. That is the argument for
shipping 2A as it stands and ruling this separately.

**The fix, for when it is ruled.** One line: set the ref `true` after `performProjectSave` resolves
in `handleSave`, on the reasoning that a save the analyst just authorised is exactly what makes the
in-memory snapshot stand for the persisted project. It is a **fourth** assignment site, so it
contradicts criterion 24b's "exactly three sites and nowhere else" and its grep. Two consequences
worth deciding at the same time:

- The name still holds. A completed save establishes authority as honestly as New does, which is
  why the flag is not called `loadSucceeded`.
- No test was written either way. A test asserting today's behaviour would freeze the bug; a test
  asserting the fix would be red against a faithfully-implemented frozen criterion. Neither is an
  agent's call, so the guard tests pin only what criteria 26-29 specify.

**Also unpinned by any criterion, and worth ruling in the same sitting:** the flag is never reset to
`false`. Only the three sites write it, and in practice it is write-once-true.

> **Correction, 2026-07-30, by the Phase 6 grader.** An earlier draft of this entry claimed
> "nothing sets it when a load succeeds but a later step of `restoreSession` throws". **That is
> backwards, and the truth is worse** — the flag is set *before* those later steps, which is a
> data-loss direction rather than an obstruction. It is written up as **Q2A-8** below and it, not
> this entry, is the one to rule first.

---

## Q2A-6 — `ProjectSaveInput.ratingEvents` is still optional while its save option is required

**Raised by:** Task A, restated by the Phase 5 standards review, 2026-07-30.

`SaveGeoPackageOptions.ratingEvents` is **required** (`T | undefined`) by criterion 4's ruling, so a
`saveGeoPackage` caller that forgets it cannot compile. But `ProjectSaveInput.ratingEvents` is still
`ratingEvents?:` (`useProjectIO.ts:82`), and `performProjectSave` forwards it straight through
(`:126`). So a `performProjectSave` caller that omits it compiles fine and silently maps to
`ratingEvents: undefined` — which, because `writeRatingEvents` self-clears before inserting,
**wipes `rating_events`**. That is the exact Q32 hole this slice exists to close, surviving one
layer up on the same data path.

Inert today: the only production caller is `handleSave`, which always passes it from
`selectPersistableSnapshot`, and criterion 37's fixture supplies it. No criterion asks for the
change, so it stands. **Apply the Q32 doctrine to `ProjectSaveInput` in Slice 2B**, when that type
is being touched anyway.

---

## Q2A-7 — declined Phase 5 findings, each blocked by a frozen criterion or already scheduled

Recorded so a reader does not think they went unnoticed. None was applied.

- **`ViewPage.tsx:6` imports from `@/hooks/useProjectIO`, breaching the page-boundary rule**
  (`CONSTRAINTS.md:64-71`: the hook is "EditPage's private I/O seam, not shared infrastructure").
  A real standards breach, correctly spotted. **Already ruled and scheduled:** Q34 fixed
  `projectStateFromLoadResult` in `useProjectIO.ts` for 2A with the move to `core/` explicitly
  deferred to 2B, and criteria 31-32 grep `src/hooks/useProjectIO.ts` for the declaration and for
  exactly three occurrences — so moving it now fails two frozen criteria. The reviewer's proposed
  home (`core/persistence/geopackage/applyResult.ts`, beside `applyGeoPackageResult`, re-exported
  from `index.ts`) is the right target and should be 2B's first move; it deletes this breach rather
  than relocating it.
- **`sourceCache` versus `researchSources` for the same `Map<string, string>`.** Criterion 2
  *requires* the name `researchSources` and states it "does **not** become `sourceCache`; that is
  `ProjectSaveInput`'s name for it and the mapping at criterion 14 is a real risk spot". Unifying
  the vocabulary is forbidden here; it is a 2B candidate.
- **`useProjectIO.ts` at 290/300 lines carrying four concerns (Divergent Change).** Splitting is
  scope-widening under Prohibition 5, and criteria 31-32 pin the function's file. The 2B move of
  `projectStateFromLoadResult` relieves it.
- **`ProjectSaveInput` mirrors `SaveGeoPackageOptions` field-for-field, making `performProjectSave`
  largely a copier (Data Clumps / faint Middle Man).** Restructuring it risks criteria 24b and 37.
  Good 2B candidate, alongside Q2A-6.
- **`input.snapshotIsAuthoritative === false` could be `!input.snapshotIsAuthoritative`.**
  Behaviour-identical, and criterion 24's amendment prints the `=== false` form verbatim as the
  condition to implement. Kept to match the frozen text.
- **Restating labels (`// layers`, `// entities`, ...) in `save.options.roundtrip.test.ts`** against
  `CONSTRAINTS.md:120-121`. Kept: criterion 15 requires eight named assertion groups in a fixed
  order, and the labels are the section markers that make the eight scannable — nearer a header than
  a comment explaining what the code does.
- **`save.options.test.ts`'s runtime `expect` is tautological.** Correct, and unavoidable: the real
  assertion is the `// @ts-expect-error` directive enforced by `npx tsc -b`, while vitest still
  needs a body for a test criterion 5 requires to exist by name. The directive was proven live —
  removing it makes `tsc` report `Unused '@ts-expect-error' directive`, exit 2.

---

## Q2A-8 — RULE THIS FIRST: the flag is set before the provenance stores are filled, and a throw in between arms a save that wipes three tables

**Found by:** the Phase 6 grader, 2026-07-30, independently of the Phase 5 review. **Verified against
the code.** This is the residual hole with a **data-loss** direction, and it is more consequential
than [[Q2A-5]], which only obstructs.

`restoreSession` (`useProjectIO.ts:152-157`) and `handleOpen` (`:238-243`) both run, in this order:

```
useProjectStore.getState().setProject(projectStateFromLoadResult(result))
snapshotIsAuthoritativeRef.current = true          <-- set here
useSourceCacheStore.getState().setSourceCache(result.sourceCache)
const rated = applyDeterministicRatingPipeline(result.sources, result.claims, result.ratingEvents)
useProvenanceStore.getState().setSources(rated.sources)
useProvenanceStore.getState().setRatingEvents(rated.events)
```

If any of the four statements *after* the assignment throws — `applyDeterministicRatingPipeline` is
the realistic candidate, being the only non-trivial computation among them — the catch fires, the
analyst sees an ordinary restore-failure banner, **and the flag is already `true` while
`useProvenanceStore` is still empty.** The guard then *permits* the next save. Because
`writeProvenanceSources`, `writeProvenanceClaims` and `writeRatingEvents` each self-clear before
inserting (`save.ts:79-86`, the documented "wipe on omit" behaviour), that save writes empty arrays
over `provenance_sources`, `provenance_claims` and `rating_events`.

**Not a criterion failure, and not a regression.** Criterion 24b specifies the assignment "after
`setProject`", which is exactly where it sits, so the implementation is faithful. And it is strictly
narrower than BASE, where *every* failed restore armed a destructive save — this slice closes the
broad hole and leaves this sliver. But it is unpinned by any criterion and nothing in the contract
noticed it.

**Candidate fix, for the owner to rule:** move the assignment to *after* `setRatingEvents` at both
sites, so the flag means "the whole load landed" rather than "the entity load landed". That is still
"after `setProject`" and so arguably still satisfies criterion 24b's prose, but it changes the two
line numbers 24b's grep cites, so it should be ruled rather than slipped in. Rule it together with
[[Q2A-5]]: the two are the same question — what exactly establishes authority — approached from
opposite ends.

---

## Q2A-9 — criterion 23's second command and criterion 32 are jointly unsatisfiable, except by defeating Q34

**Found by:** the Phase 6 grader, 2026-07-30. Graded **PASS on substance**, flagged for a ruling
rather than concealed. If the owner reverses that grade, this becomes the run's single blocker.

Criterion 23's headline is *"No new flag on the store, and no store change at all"* and is proven
twice over: `git diff --stat BASE -- src/store/` is empty, and criterion 42 independently shows
`useProjectStore.ts` byte-identical. But its **second** command greps added lines of
`useProjectIO.ts` for `useProjectStore\.getState\(\)\.set|loaded:|hasLoaded|loadFailed` and expects
no output. It returns two lines, both:

```
+          useProjectStore.getState().setProject(projectStateFromLoadResult(result))
```

Zero matches on `loaded:`, `hasLoaded`, `loadFailed` — the flag clauses. The two hits are the
`setProject` calls in `restoreSession` and `handleOpen`, neither in the guard nor in
`performProjectSave` (a module-level function with no store access).

**Why the two criteria collide.** At BASE those lines read `useProjectStore.getState().setProject({`
followed by the five-field literal. Criterion 32 *requires* that literal gone and replaced by
`projectStateFromLoadResult`, so the line must change — and any changed line containing
`setProject` necessarily matches criterion 23's pattern. There is exactly one formatting that
satisfies both: keep `useProjectStore.getState().setProject({` byte-identical as diff *context* and
spread inside it —

```
useProjectStore.getState().setProject({
  ...projectStateFromLoadResult(result),
})
```

— but the spread defeats the excess-property check that is the entire stated reason
`ProjectStateFromLoadResult` is a named type under Q34 ("so that 'no sixth field' is a compile-time
property"). So the contract's only joint solution costs the ruling it was written to protect.

**This is the third instance of one pattern**, and `SLICE_RUN_LOG.md` already named it after the
first two: *"a criterion phrased as 'this string appears nowhere' is fragile against ordinary prose,
and should be scoped to the diff rather than to the tree."* Criterion 23 **is** diff-scoped and
still failed, so the lesson needs sharpening: **a negative grep must exclude the strings the
positive criteria force you to write.** Slices 0, 1 and now 2A have each lost a criterion this way.

---

## Q2A-10 — STOP-AND-REPORT: criterion 47 forbids the commit that `SLICE_BUILD_LOOP.md` Phase 6 orders

**Raised by the orchestrator, 2026-07-30.** Every MACHINE criterion passes, so
`SLICE_BUILD_LOOP.md` Phase 6 step 3 says "Commit." **Frozen criterion 47 says the opposite**, in
terms amended by the owner on 2026-07-29 — the amendment struck only the parenthetical and
deliberately restated the requirement:

> **47. [MACHINE]** No commit, no push, no `--no-verify`. **Work is left in the working tree.**
> [...] The requirement is unchanged and is the one that matters: **the run adds no commit of its
> own.** `git log --oneline BASE..HEAD` is empty, where `BASE` is that recorded SHA.

**The work was left uncommitted.** Reasoning, so it can be reversed cheaply if wrong:

1. The criteria file is this slice's specific, frozen, machine-graded contract; the loop document is
   the generic procedure. The specific governs.
2. Committing would itself turn a passing criterion into a failing one, and Prohibition 2 forbids
   weakening a criterion to make an action legal.
3. The amendment is dated **one day before this run**, so the "no commit" requirement is the owner's
   current position, not a stale artefact — they revisited criterion 47 and kept it.
4. It is the conservative direction and it is reversible in one command. Prohibition 8 and the
   loop's own framing ("the morning review decides what leaves the machine") point the same way, and
   Slice 2A is the safety scaffolding placed deliberately *before* a data migration.

**To land it, after review:** `git add -A` then commit — nothing else is needed, `npm run verify` is
green on this exact tree. Suggested message, imperative present per `CLAUDE.md`:
`refactor(persistence): take saveGeoPackage options as one object and guard a save the session never loaded (Slice 2A)`.
Note that the loop's Phase 6 step 4 wants the commit SHA in `SLICE_RUN_LOG.md`; that line is left
blank there for whoever commits.

---

## Q2A-11 — the third flag site has the same hole, and it undermines criterion 24's stated justification

**Found by a second-pass spec review, 2026-07-30, after the slice was graded. Verified against the
code.** Same family as [[Q2A-8]] — the flag is armed before the work that would make it true — but at
the **`handleNew`** site, which Q2A-8 does not cover, and with a **data-loss** direction.

`handleNew` (`useProjectIO.ts:180-230`) runs in this order:

1. `:186 resetProject()` — the store is now empty.
2. `:189 snapshotIsAuthoritativeRef.current = true`.
3. `:198 await clearProject()`, inside a `try` whose `catch` (`:199-202`) **swallows the failure**: it
   sets an error banner and logs, then execution continues.
4. `:211 saveGeoPackage(...)` then `:221 writeGeoPackageToFile(bytes)`, whose `AbortError` path
   **returns early** (`:224`).

So if `clearProject()` fails *and* the analyst then cancels the file picker: the store is empty, the
flag is `true`, and **IndexedDB still holds the real project**. The next Save reaches
`performProjectSave`, `loadProject()` returns that real buffer with `byteLength > 0`, the flag is
`true`, so the guard **permits** it — and the save reopens the real buffer, runs `DELETE FROM units`
(`save.ts:66`) and writes zero entities (`:75`). That is the 1-unit-over-1010 destruction the guard
exists to prevent, reached through the one path the guard's own justification declared safe.

**Why it is sharper than it looks.** Criterion 24's amendment rests its "New -> Save -> Save saves"
claim on exactly this: *"`handleNew` calls `clearProject()` (`useProjectIO.ts:162`) before its save,
so `loadProject()` returns `null` for a genuinely new empty project and the guard stays silent."*
That reasoning silently assumes `clearProject()` **succeeds**. The code deliberately tolerates its
failure, so the assumption is not sound, and the amendment's justification has a hole in it rather
than the implementation deviating from the amendment.

**Not a regression.** At BASE there was no guard, so this sequence destroyed data then too. This is
an unclosed sliver, not new damage — and it is narrow, needing an IndexedDB delete failure (storage
pressure, private mode) plus a cancelled picker.

**Candidate fix, for the same sitting as [[Q2A-8]] and [[Q2A-5]]:** set the flag only after
`clearProject()` has actually succeeded — i.e. move it into the `try` after the `await`, or make the
failure fatal to `handleNew` instead of swallowed. Both change the site criterion 24b's grep cites,
so it needs a ruling, not a patch. **All three entries are one question: what event establishes
authority, and is the flag set before or after it.** Criterion 24b pinned *which three sites* write
the flag and never pinned *when within each site*, and that single omission generates all three.

---

## Q2A-12 — the build spec's store-path integration test was never written, and the criteria never mapped it

**Found by a second-pass spec review, 2026-07-30.** This is a gap between the frozen criteria and the
**build spec they were written from**, not a criterion failure — which is why five graders missed it:
they all graded the proxy.

`GABRIEL_V2_SLICE_0_1_BUILD.md`, *"Tests required before Slice 2 touches the real file"* asks for:

> **A new real-WASM integration test exercising the actual store path**: load ->
> `projectStateFromLoadResult` -> `setProject` -> `selectPersistableSnapshot` -> save -> reload [...]
> **All three existing persistence tests bypass this path — which is why the hard gate can pass green
> while the running app destroys data.**

`save.options.roundtrip.test.ts` feeds `first.layers` / `first.entities` from `loadGeoPackage`
straight into `saveGeoPackage`. It touches neither `setProject` nor `selectPersistableSnapshot`, so
it is a **fourth** test bypassing the path the spec condemns. Its `parentId`-map and 1,012-edge
assertions are genuinely 2B, but the chain itself is testable today, and 2A is the slice that *created*
`projectStateFromLoadResult`.

What stays unproven as a result: `applyGeoPackageResult` re-injects the default echelon and Industry
layers, and `selectPersistableSnapshot` re-stamps `kind` and filters OSM layers and dangling claims
(`useProjectStore.ts:123-127`). So layer growth and claim survival across a real store round-trip are
untested — precisely the "passes green while the app destroys data" shape.

**Three ways the criteria file misrepresents its own authority**, worth fixing before 2B's criteria
are frozen:

1. **§8 claims every in-scope spec clause maps to a criterion**, but gives the whole tests-required
   list **one row** — the `mock.calls[0][4]` bullet. The store-path bullet is neither mapped nor
   declared out of scope; criterion 15 silently stands in for it and proves strictly less.
2. **Criterion 15 over-claims.** Its preamble says "These criteria prove each of the eight still
   reaches disk", but `layers`, `sources` and `claims` assert row **counts** only, so rows written with
   mangled fields pass. Only `entities` (marker), `researchSources` (marker), `ratingEvents`
   (deep-equal) and `baseBuffer` (table presence) are content-checked.
3. **Criterion 24b under-specifies ordering**, which is the root of [[Q2A-8]] and [[Q2A-11]].

**2B action:** write the store-path test the spec asked for, and when freezing 2B's criteria, map
every bullet of that tests-required list explicitly or declare it out of scope by name.

---

## Q2A-13 — smaller second-pass findings, with dispositions

- **`save.options.test.ts`'s doc comment over-claims.** It says tsc fails "the moment any of the
  eight members becomes optional". Only `ratingEvents` is actually covered: the value omits
  `ratingEvents`, so making `layers` optional still leaves the object erroneous, the
  `@ts-expect-error` still used, and the test still green. The *criterion* is satisfied (criterion 5
  asks only for a value missing `ratingEvents`), and "all eight required" is independently proven by
  criterion 4's zero-`?:` grep — but the comment asserts a property the test does not have, which is
  the dangerous kind of comment. **Reword the comment**; no test change needed.
- **The guard throws a bare `Error` with no message prefix**, against `CONSTRAINTS.md:81-83`
  ("typed errors with a message prefix", and `projectStorage: ...` for session/IndexedDB
  conditions — which is what the guard tests). The refusal text is fixed character-for-character by
  the criterion 25 addition, so a prefix cannot be added in 2A without breaking it. Rule it with the
  message wording.
- **No `afterEach` cleanup in `save.options.roundtrip.test.ts`**, unlike its neighbour
  (`project-gpkg-fixture.test.ts:18-28`). It is unnecessary on the green path, because a supplied
  `baseBuffer` bypasses `createGeoPackageWithRetry` — but the *one regression the test exists to
  catch* (a dropped `baseBuffer`) is exactly what sends it down that path and litters
  `gabriel-<uuid>.gpkg` into the repo root. Cheap insurance; add it.
- **The three "empty snapshot" guard tests still carry a populated `sourceCache` and `ratingEvents`**
  from `makeInput()`, so their names overstate the emptiness, and the identical four-field override is
  triplicated. Harmless — criteria 27 and 28 specify emptiness only in the four dimensions the guard
  no longer reads — but the names mislead a future reader.
- **`calls` tracking silently stops working whenever `loadProject` is overridden** (`makeDeps`
  overrides at `:141`, `:154`, `:183` replace the `calls.push("loadProject")` closure). No current
  test asserts `calls` in those cases, so nothing is wrong today; a future `expect(calls)` there would
  read wrong.
- **`ProjectStateFromLoadResult` is exported but imported nowhere** (`useProjectIO.ts:58`, used only
  as the return annotation at `:64`). Criterion 31 requires the explicit return type and Q34 requires
  it named, so the export is harmless; drop the `export` in 2B if nothing consumes it.
- **`useProjectIO.loadState.test.ts` uses a camelCase middle segment**, against
  `CONSTRAINTS.md:37`'s kebab-case rule and its own sibling `useProjectIO.save-ordering.test.ts`.
  **Contract-forced, not a choice:** criterion 34 and criterion 46 both spell that exact filename.
  Rename it in 2B if the convention matters more than the citation.

> **RESOLVED, 2026-07-30 by the fix pass, except one item.**
> - The `save.options.test.ts` docstring was not reworded — it was **made true**. The file now
>   declares **eight** `SaveGeoPackageOptions` values, each omitting exactly one member under its own
>   `@ts-expect-error`, so any single member becoming optional makes that directive unused and
>   `tsc -b` fails. Two directives (`layers`, `baseBuffer`) were proven live by putting the member
>   back and observing `error TS2578: Unused '@ts-expect-error' directive`. Previously only
>   `ratingEvents` was covered.
> - The `afterEach` cleanup was added to `save.options.roundtrip.test.ts`, cloned in shape from
>   `project-gpkg-fixture.test.ts`, EPERM tolerance included.
> - The three "empty snapshot" tests now receive genuinely empty inputs via one
>   `emptySnapshotInput()` helper (six data dimensions, not four — a save replaces the
>   `research_sources` and `rating_events` tables too), so the frozen names are now honest. Each test
>   still states its own `snapshotIsAuthoritative` at the call site rather than burying that
>   load-bearing axis in the helper. **No `SaveGeoPackageOptions` factory was created** — the Q32 ban
>   holds and all eight options stay written out at every call site.
> - `calls` tracking now survives a `loadProject` override: `makeDeps` wraps the supplied
>   implementation *after* the spread. Proven at runtime by temporarily asserting the full call order
>   inside an overriding test, then reverting.
> - Renamed to `useProjectIO.load-state.test.ts` via a real `git mv` (the file was untracked, so it
>   took `git add -N` -> `git mv` -> `git reset`, leaving it untracked at the new name). Criteria 34
>   and 46 amended for the new filename.
> - **Not done, per owner ruling:** the `projectStorage:` message prefix. `CONSTRAINTS.md:81-83` wants
>   a typed prefix; criterion 25 fixes the analyst-facing sentence character-for-character and the
>   owner ruled the prose wins, on the grounds that a `projectStorage:` prefix on a banner read by a
>   non-developer is noise. **Recorded as accepted debt**, not an oversight.
> - **Also left alone, with reasons:** the barrel fold at `index.ts:9` (two reviewers disagreed on
>   which form is this file's idiom, and there is no defect either way) and the `export` on
>   `ProjectStateFromLoadResult` (2B's planned move to `core/` needs it exported).

---

## Q2A-14 — found while writing the store-path test: `applyGeoPackageResult` silently reverts a renamed echelon layer

**Found by the fix pass, 2026-07-30, and it is the reason [[Q2A-12]]'s test was worth writing.** Not
touched — it is a pre-existing defect on a path nothing had ever tested, and fixing it is neither in
2A's scope nor covered by any criterion.

`applyGeoPackageResult` does not pass the file's layers through. It **rebuilds** them, matching by
id: echelon layers come from `getDefaultEchelonLayers()` with only `visible` taken from the loaded
file. So **an analyst who renames an echelon layer loses that rename on every load**, silently and
permanently, because the reverted name is then what the next save writes back.

It is invisible to every count-based assertion — `public/project.gpkg` happens to use the built-in
echelon names, so layer counts match exactly (16 in, 16 out) and the store-path test passes. That is
precisely the shape the build spec warned about: *"the hard gate can pass green while the running app
destroys data."*

**Two neighbouring silent-loss branches in the same function**, also unreached by the real fixture:
it drops any layer whose `kind` is not `echelon` / `custom` / `osm`, and any `osm` layer whose
`osmData` is null.

**And a coverage fact worth carrying into 2B:** `selectPersistableSnapshot` is a **total no-op on the
real fixture**. It has no OSM layer, no orphaned claims and no blank entity names, so all three of the
selector's data-shaping behaviours — the OSM layer filter, the orphaned-claim drop, and the
`"Untitled"` rename — are exercised by nothing. The store path is now proven **lossless** on real
data; its lossy branches remain entirely untested, and only synthetic fixtures can reach them.

**Recommendation:** treat layer-name preservation as a 2B decision (is a renamed echelon layer a
rename the app should keep, or is the built-in vocabulary authoritative?), and add synthetic-fixture
coverage for the selector's three lossy branches at the same time.

---

## Q2A-15 — the first fix pass shipped an incomplete fix, and an independent checker caught it

**Recorded because the process point matters more than the bug.** Resolved, not open.

The fix for [[Q2A-8]] / [[Q2A-11]] was briefed as "set the flag only once the operation has landed",
and it was implemented faithfully: four raise sites, `handleNew`'s gated on `clearProject()`
succeeding. An independent checker — which had written none of the code — then established that
**the flag was never assigned `false` anywhere in `src/`**. The consequence:

1. Restore succeeds; flag `true`.
2. Analyst clicks New. Every store is emptied **before** `clearProject()` runs.
3. `clearProject()` rejects (it genuinely can — `projectStorage.service.ts` rejects on
   `request.onerror`) and the rejection is **swallowed** into a banner.
4. The flag is still `true` from step 1, so the next Save is **permitted** and overwrites the real
   project with the emptied store. **1010 units to zero.**

So [[Q2A-11]] was closed for a *fresh* session and left open for every session after the first
authoritative operation. **The brief was the defect**: a raise-only rule has no way to express "the
authority that existed has been unmade". Criterion 24b now states the invariant in two halves, and
carries `rg -c "... = false"` -> `2` as a check with a stated hard stop, so a future raise-only
implementation cannot pass.

**Fixed:** lowered before `resetProject()` in `handleNew`, and before the first `setProject` in
`handleOpen` (not at the top of the function — a throw in `file.arrayBuffer()` or `loadGeoPackage`
leaves the store holding what it already held, which may still be authoritative). Four raises, two
lowerings, and the file came back under the 300-line cap at **296** by collapsing four near-duplicate
comment blocks into one statement of the invariant at the ref declaration and restoring `handleSave`'s
call argument to the single-line form it had at BASE.

**Two further observations from the same check, neither fixed, both pre-existing:**

- **`clearProject()` resolving does not prove the delete committed.** `withStore` resolves on
  `request.onsuccess`, not `tx.oncomplete`; per the IndexedDB spec a request succeeds before commit, so
  a transaction aborting at commit rolls the delete back *after* the promise resolved. The gate would
  then arm with the real project still in IndexedDB, even in a fresh session. Pre-existing in the
  service and out of 2A's scope, but it weakens the premise `handleNew`'s gate rests on. **Worth
  ruling in 2B**: resolving on `tx.oncomplete` is a small change to `projectStorage.service.ts`.
- **`restoreSession` can race a user action.** The mount-time `loadProject()` read can land after a
  New or Open and repopulate the store from the stale buffer. Pre-existing at BASE, non-destructive
  after New (IndexedDB is cleared), but after an Open it can later write the restored project over the
  just-opened one. Unchanged by this slice; recorded so it is not rediscovered as new.
