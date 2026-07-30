# Open questions — the live ones

**Compressed 2026-07-29 from 1,420 lines to this.** The file had become the largest document in
the repo and nobody was ever going to read it. What was removed and why:

- **Q1–Q31 (Slices 0 and 1, shipped).** Closed. Where a decision still matters it now lives in
  the code that implements it, stating the reasoning in full and citing the question number only
  as a date stamp — the model is `src/core/entity/externalId.ts:100-108`. The narrative of what
  happened, including the semicolon contradiction and the two owner rulings that resolved it, is
  in `SLICE_RUN_LOG.md`. The full text is in git history.
- **Q32–Q41 (Slices 2A and 2B).** Every ruling was copied, in full, into the document the builder
  actually reads. That copy is the authority; the index below only says which document.

**Four entries survive**, because they record a behaviour that was *implemented but never
ratified*, or a gap left deliberately. The code shows the behaviour; it cannot show that nobody
has blessed it, and that is the one thing a source comment cannot carry.

---

## Live — unratified behaviour

### L1 — is a whitespace-only string "non-empty" for `decodeExportOverride`? (was Q13)

`decodeExportOverride` (`src/core/relationship/relationship.ts`) rejects a field that is
whitespace-only, treating `"   "` as absent. **The tests deliberately assert nothing either way**,
so the code is silent by design and reading it tells you nothing about whether this was chosen or
merely happened.

**The trigger has now fired.** Q13 said "settle before an `ExportOverride` is ever persisted", and
Slice 2B persists one: `relationships.export_override`, decoded by this very function
(`GABRIEL_V2_SLICE_2B_BUILD.md` §4.4).

**Standing answer unless the owner rules otherwise:** whitespace-only counts as absent, the whole
override decodes to `undefined`, and it is excluded from export. That is the fail-closed
direction, and reusing `decodeExportOverride` as the column's `decode` makes it the single gate
rather than a second implementation. **Slice 2B should add the assertion the Slice 0 tests
withheld**, so this stops being unratified.

### L2 — INN and OGRN carry check digits that nothing verifies (was Q27)

`isValidExternalId` checks length and charset only for `inn` (10 or 12 digits) and `ogrn`
(13 or 15). Both schemes have a published check-digit algorithm. `lei` has the same gap against
mod-97, and that one is spec-stated and locked by a test named so the next reader knows it was
known rather than forgotten.

A typo'd INN or OGRN passes structural validation today. Harmless while nothing dedups on it;
becomes a silent wrong-entity match when the Stage 3 connector lands.

### L3 — scheme-prefix stripping versus a value that legitimately begins with its registry's name (was Q28)

`normalizeExternalId` strips a scheme prefix so `"IMO 9074729"` and `"9074729"` compare equal. No
rule says what happens to a free-form `registry` value whose real text starts with the registry's
own name. Undecided, and cheap to decide only while `externalIdKey` still has no consumer.

### L4 — `isValidExternalId` validates the normalised form, not the raw one (was Q22)

Deliberate and coherent: validating the raw string would reject `"IMO 9074729"` while
`externalIdKey` treats it as identical to the valid `"9074729"`. Recorded because it looks like a
bug to a fresh reader and the next person to "fix" it will break the pair.

---

## Where the Slice 2 rulings actually live

Q32–Q41 were ruled on 2026-07-29. Each one is written out in full in the document named here;
that document is the authority, and this table exists only so a `Q<n>` citation resolves.

| was | subject | now lives in |
|---|---|---|
| Q32 | all eight `SaveGeoPackageOptions` fields required | `SLICE_2A_CRITERIA.md` criterion 4 |
| Q33 | the save guard reads a session flag, not emptiness; the refusal wording | `SLICE_2A_CRITERIA.md` criteria 24, 24b, 25, 26, 26b, 27, 28, 29 |
| Q34 | `projectStateFromLoadResult` placement and signature | `SLICE_2A_CRITERIA.md` criteria 31-34 |
| Q35 | the 300-line cap versus Prohibition 5 | `SLICE_2A_CRITERIA.md` criteria 20, 21 |
| Q36 | the NUL byte-scan could never fail | `scripts/scan-nul.mjs`, `npm run scan:nul`, `SLICE_BUILD_LOOP.md` Phase 6 |
| Q37 | `BASE` no longer matches HEAD | `SLICE_2A_CRITERIA.md` header and criterion 47 |
| Q38 | a third duplicated project-state literal, in `ViewPage.tsx` | `SLICE_2A_CRITERIA.md` criterion 46 |
| Q39 | one exported `isHierarchyBearing`, shared by the derivation and the control | `GABRIEL_V2_SLICE_2B_BUILD.md` §4.2 |
| Q40 | contested children derive `null`; the display cascade | `GABRIEL_V2_SLICE_2B_BUILD.md` §4.3 and Trap T15 |
| Q41 | `mergeEntities` is ported to edges | `GABRIEL_V2_SLICE_2B_BUILD.md` §4.8 and Trap T16 |

`SLICE_RUN_LOG.md` carries the one-paragraph account of why each was ruled the way it was.

---

## How this file is used from now on

`SLICE_BUILD_LOOP.md` Phase 2 tells a coding agent to append a question here rather than guess
silently. Keep doing that — it is the mechanism that produced Q31 and Q36, both of which were real
defects nobody had noticed.

**But drain it at every slice commit.** Each entry goes exactly one of three ways:

1. **Into the code**, as a comment stating the whole reasoning, citing the entry only as a date
   stamp. This is the default and the model is `externalId.ts:100-108`.
2. **Into an ADR**, if the decision has consequences beyond the line it touches.
3. **Deleted**, with a single line in `SLICE_RUN_LOG.md`.

An entry survives here only when it is genuinely unratified — where the code shows a behaviour
that no one has yet blessed. That is what the four above have in common, and it is the only thing
this file is for. Append-only was the right property for one run; it is the wrong property for a
file that outlives five slices.
