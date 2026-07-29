# Gabriel — Documentation Index

> This is the single source of truth for all project documentation.
> Before creating or modifying any `/docs/` file, read this index.

---

## Index

| File | Covers | Status |
|---|---|---|
| `PRD.md` | Product requirements, scope, user stories, success criteria | Active |
| `TECH_STACK.md` | Approved technologies, versions, dependencies, rationale | Active |
| `CONSTRAINTS.md` | Code style, naming, folder layout, error handling, performance | Active |
| `ARCHITECTURE.md` | Current component tree, data flows, coordinate contract, enrichment pipeline | Active |
| `TELEGRAM_OSINT_PRD.md` | PRD for the Telegram scraper + graph module (work-in-progress) | WIP |
| `adr/` | Architecture Decision Records — one decision per file, numbered | Active |
| `SLICE_BUILD_LOOP.md` | The unattended agent build loop, invoked as a prompt — six phases, iteration cap, prohibitions | Active |
| `GABRIEL_V2_PRD.md` | Capability plan for Gabriel v2.0 (OSINT data fusion) — the master PRD, sliced per stage | Active |
| `timelines/GABRIEL_V2_TIMELINE.md` | Stage status and order for v2.0 — the master tracker | WIP |
| `timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` | Authoritative build spec for v2.0 Slices 0 and 1 (relationship vocabulary, `Relationship` type, External Ids). Supersedes `GABRIEL_V2_FOUNDATION_SPEC.md` for those two slices | Active |
| `timelines/GABRIEL_V2_FOUNDATION_SPEC.md` | Build spec for v2.0 Stage 1 (Relationships, vocabulary, External Ids, hierarchy seam, Proposal spine). **Superseded for Slices 0–1 by `timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`** — it still describes the revised-away plan (`parentId` deletion, `query.ts`, seven violation codes, an eight-slice Stage 1). Do not read it for Slices 0–1 except where the Slice 0/1 build spec cites it | Superseded (Slices 0–1) |
| `timelines/SLICE_0_CRITERIA.md` | Frozen `[MACHINE]`/`[HUMAN]` success criteria for Slice 0 — no later agent may weaken or delete an entry | Active |
| `timelines/SLICE_0_1_OPEN_QUESTIONS.md` | Append-only record of every question an agent had to guess at in Slices 0–1, and the conservative reading it implemented instead | Active |
| `timelines/SLICE_RUN_LOG.md` | Append-only log of `SLICE_BUILD_LOOP.md` runs — iterations, commit SHAs, recorded guesses, and the `[HUMAN]` review list | Active |
| `timelines/TELEGRAM_TIMELINE.md` | Phase plan + live execution log for the Telegram OSINT module | WIP |

The **canonical glossary** (domain language) lives at the repo root: [`../CONTEXT.md`](../CONTEXT.md).
`ARCHITECTURE.md` describes the code *as it is today*; the *target* architecture and the decisions
behind it live in `adr/` and `timelines/`, so no doc describes an architecture the code does not
yet have.

---

## Rules

Every time a file in `/docs/` is created or modified:

1. Is this topic already covered in an existing file? → Add there, don't create new.
2. Is the new file listed in this README? → Add it before committing.
3. Does this file exceed 250 lines? → Add a table of contents at the top.
4. Is this README still under 200 lines? → Keep it an index, not a content file.
5. Is this a hard-to-reverse, surprising decision resulting from a real trade-off? → Record it as an ADR in `adr/`, don't bury it in prose.
6. Is it a live plan, phase checklist, or execution status? → Belongs in `timelines/`, not here — `docs/` proper should almost never change.

## Agent Planning Doc Set

For `/phase-start` and other agent planning commands, use this set by default:

- `PRD.md`
- `TECH_STACK.md`
- `CONSTRAINTS.md`
- `ARCHITECTURE.md`
- `timelines/` (whichever timeline covers the task)
- `adr/` (scan titles; read those relevant to the task)

Do **not** include `TELEGRAM_OSINT_PRD.md` or `timelines/TELEGRAM_TIMELINE.md` unless the task
explicitly targets Telegram OSINT work.

Do **not** include `timelines/GABRIEL_V2_FOUNDATION_SPEC.md` for v2.0 Slices 0–1 — it is
superseded there by `timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`, and reading it will hand you a
revised-away plan.
