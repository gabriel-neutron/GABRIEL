# Slice Build Loop — unattended agent workflow

**Invoke with:** `Follow docs/SLICE_BUILD_LOOP.md. Target: Slice 2A.`
(Or any slice that has a frozen criteria file or a build spec.)

> **Current target, updated 2026-07-31: the four prerequisite commits, then Slice 2B.**
> **Slice 2A is committed at `65ddc11`**, which is `BASE` for everything below.
>
> **P1, P1b, P2, P3 come first** and are specified in the *Prerequisite* block of
> `docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md`, with the reasoning in `SLICE_RUN_LOG.md`,
> *"Owner ruling session — 2026-07-31, before Slice 2B"*. They are small, sequential, and each
> gets its own commit; **none of them may land inside the migration commit.** P2 implements
> ADR [0012](adr/0012-layer-identity-is-the-id.md) and must be green **before** anything writes to
> `public/project.gpkg`. They have no frozen criteria file and do not need one — run them through
> Phases 2-6 with the ADR and the Prerequisite block as the contract, skipping Phase 1.
>
> **Then Slice 2B**, which is a migration and does need its own Phase 1 criteria file, frozen from
> `docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md`. **Read that spec's §8b before writing a single
> criterion** — five lessons, each of which already cost a criterion, and one standing hazard: the
> spec was frozen on 2026-07-29 and the tree moved under it on 2026-07-30, so every enumeration and
> line number in it is a measurement with a date on it. §4.7 is the worked example of what happens
> when one is trusted rather than re-measured.
>
> **Do not run §10, the rehearsal.** It writes to `public/project.gpkg` and it is the owner's, not
> an agent's. Stop when 2B is committed and the file is still
> md5 `7d0b0e592a1128a0d83e7575110bf2dc`.

This file is the prompt. Read it fully before acting. It defines a six-phase loop with a
hard iteration cap and a set of prohibitions that exist because each one describes a real
way an unattended agent has silently produced a green build over broken work.

---

## Phase 0 — Orient (no subagents)

1. Identify the authoritative contract for the target slice. **Slice 2A:**
   `docs/timelines/SLICE_2A_CRITERIA.md`, already frozen. **Slice 2B:**
   `docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md`, plus the binding
   "Decisions carried into Slice 2 and beyond" section of
   `docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`. There is no third document — read
   `docs/README.md`'s reading list and stop there.
2. Confirm the working tree is clean and `npm run verify` is green at HEAD. If it is red
   before you start, **stop** — write the failure to `docs/timelines/SLICE_RUN_LOG.md` and
   end the run. Do not build on a red baseline.
3. Record the starting commit SHA in the run log. That SHA is the revert point.
4. Read the spec's trap list. Every trap in it is a thing that compiles, passes, and is wrong.

---

## Phase 1 — Planning agent: freeze the success criteria

Spawn **one planning agent**. Its only job is to produce the contract everything else is
graded against. It writes no source code.

Its output is `docs/timelines/SLICE_<N>_CRITERIA.md` containing a numbered checklist where
every entry is one of:

- **`[MACHINE]`** — verifiable by a command, with the exact command and the exact expected
  result written out. "The vocabulary test asserts 13 entries" is not a criterion;
  `npm run test -- vocabulary` exits 0 with a test named `locks the vocabulary at 13` is.
- **`[HUMAN]`** — needs a person to read it. Wording of published definitions, ADR prose,
  glossary entries. These do **not** block the commit; they are collected into a
  morning-review list.

Rules for the planner:

- Every `Done when` clause in the spec must map to at least one criterion.
- Every file the spec says to create or modify must appear in a criterion.
- If a spec clause cannot be made machine-checkable, say so and mark it `[HUMAN]` — do not
  invent a proxy assertion that passes without testing the real thing.
- List the traps from the spec as explicit **negative** criteria ("no NUL bytes in new
  files"; "`external_ids` descriptor carries no `constraints`"; "decoding an empty array
  yields `undefined`, not `[]`").

**The criteria file is frozen after this phase.** No later agent may edit, weaken, or delete
an entry. If a criterion turns out to be wrong, that is a stop-and-report, not an edit.

---

## Phase 2 — Coding agents: one per task

The planner's decomposition gives the task list. Spawn **one coding agent per task**, in
parallel where the tasks touch disjoint files, sequentially where they do not.

Each coding agent receives: its single task, the criteria its work must satisfy, the spec's
trap list, and this rule —

> **If you find yourself about to guess, do not guess.** Append the question and the guess
> you would have made to `docs/timelines/SLICE_<N>_OPEN_QUESTIONS.md`, implement the most
> conservative option, and flag it in your report. A recorded guess is cheap. An unrecorded
> one is the bug someone finds in November.

Coding agents do not write tests and do not run `npm run verify` as a pass/fail gate — they
may run it for their own feedback, but the verdict is not theirs to give.

---

## Phase 3 — Test author agent

Spawn a **separate** agent — never one of the coding agents.

It writes tests from the frozen criteria and the spec's declared signatures. It may read
implementation signatures to make tests compile; it must not shape assertions around what
the implementation happens to do. A test that encodes current behaviour rather than required
behaviour is worse than no test, because it makes the next regression invisible.

Where the spec names an existing test as the pattern to follow (e.g. the `aliases` fixture
assertion in `project-gpkg-fixture.test.ts`), clone that shape rather than inventing one.

---

## Phase 4 — Test runner agent: the verdict

Spawn a **third, different** agent. Its entire job is to run and report. The separation is
the point: the author does not grade its own work.

- Runs `npm run verify` (lint → test:coverage → build).
- Reports PASS or FAIL with the **actual output**, not a summary of it.
- On failure, diagnoses the cause and names the file and line.
- **Is forbidden from editing any file.** Source, test, fixture, config — none.

Its report goes back to Phase 2 if red, forward to Phase 5 if green.

---

## Phase 5 — Review and simplify

Run `/code-review` against the starting SHA from Phase 0. If it reports findings, triage
them: correctness findings loop back to Phase 2; style and simplification findings are
applied directly unless they would change behaviour covered by a criterion.

Then run `/simplify` on the changed code. Re-run Phase 4 after any edit — a simplification
that breaks a test is a failed simplification, not a new problem.

---

## Phase 6 — Verification agent: commit or loop

Spawn a final agent that has **not** written code, tests, or reviews this iteration. It
grades the work against `SLICE_<N>_CRITERIA.md`, criterion by criterion, citing evidence for
each — a command output, a file:line, a test name. "Looks done" is not evidence.

**If every `[MACHINE]` criterion passes:**

1. Byte-scan for NUL: **`npm run scan:nul`**. Any hit is a hard stop — this repo has a
   recorded history of template literals writing NUL bytes and corrupting diffs. The same
   scan now runs first inside `npm run verify`, so step 2 covers it too; run it alone here to
   get the finding before the slower gates.
   *Amended 2026-07-29 by owner ruling (Q36).* This step printed `rg -c $'\x00' src/` until
   that date. **That command is vacuous under Git Bash and so is its `rg --text` variant** —
   the shell collapses the escape to an empty-string argument, `rg` then matches the empty
   pattern on every line of every file, and the check exits 0 whether or not a NUL byte is
   present. Measured against a control file: a two-line NUL-free file and a file containing a
   NUL report the identical count and the identical exit code. Every NUL scan reported in the
   Slice 0 and Slice 1 runs was therefore vacuously green. **Never report an `rg`-based NUL
   check as evidence for this step.**
2. Confirm `npm run verify` is green one final time on the exact tree being committed.
3. Commit. Imperative present tense, per `CLAUDE.md`. Reference the slice.
4. Append to `docs/timelines/SLICE_RUN_LOG.md`: the slice, the iteration count, the commit
   SHA, every recorded open question, and every `[HUMAN]` criterion awaiting review.
5. If more slices remain in the target, return to Phase 1 for the next one.

**If any `[MACHINE]` criterion fails:** produce a defect list naming the criterion, the
observed behaviour, and the suspected file. Return to **Phase 2** — not Phase 1. The criteria
are frozen; only the implementation is in question.

---

## Loop control

- **Maximum three iterations per slice.** On the third failure, stop. Write the blocked
  criteria, the defect list and the last test output to the run log, and end the run. Leave
  the work uncommitted on the branch.
- Do not start a slice whose predecessor did not commit cleanly.
- If two consecutive iterations fail on the *same* criterion with the same error, stop
  immediately — that is a spec defect, not a code defect, and another iteration will not fix
  it.

---

## Prohibitions

Each of these is a specific way a green build has hidden broken work. None is negotiable.

1. **Never modify a test fixture, checked-in data file, or `public/project.gpkg` to make a
   test pass.** If the real-file gate goes red, the code is wrong — not the file. This is the
   single most likely way to destroy the project's irreplaceable data while showing green.
2. **Never weaken, reword, or delete a success criterion.** Failing a criterion is a result.
   Editing it is falsifying one.
3. **Never mock the GeoPackage layer** in persistence tests. Real WASM, real file, 60s
   timeouts (`CONSTRAINTS.md:96-101`).
4. **Never use `--no-verify`,** and never commit with `npm run verify` red.
5. **Never widen scope.** Do not fix `useProjectStore.ts`'s 343 lines, `EntityInspector.tsx`'s
   611, or any other pre-existing violation you notice. Record it and move on.
6. **Never delete or skip a failing test** to reach green. Diagnose it or stop.
7. **Never invent a type, signature, or constant the spec references but does not define.**
   Record it as an open question and implement the most conservative reading.
8. **Do not push.** Commit locally only. The morning review decides what leaves the machine.

---

## What the morning reader gets

By the end of the run, `docs/timelines/SLICE_RUN_LOG.md` answers, without opening the code:
which slices committed and at what SHA, how many iterations each took, every question an
agent had to guess at, every `[HUMAN]` criterion still needing eyes, and — if the run
stopped — exactly which criterion blocked it and what the last error was.

If that file is empty or missing in the morning, the run failed in a way it did not
understand, and the starting SHA from Phase 0 is the revert point.
