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
| `timelines/SLICE_2A_CRITERIA.md` | **Frozen contract for Slice 2A** (safety scaffolding, no migration code) — the next thing to build. Carries dated owner-authorised amendments to criteria 24, 24b, 25, 26, 26b, 27, 28, 29, 46, 47 and the `BASE` definition | Active |
| `timelines/GABRIEL_V2_SLICE_2B_BUILD.md` | **Build spec for Slice 2B** — the hierarchy migration, the `relationships` and `integrity_events` tables, the trap list and the rehearsal procedure. **The first slice that writes to `public/project.gpkg`** | Active |
| `timelines/GABRIEL_V2_SLICE_0_1_BUILD.md` | Slices 0 and 1, shipped. Kept for two live reasons only: it is the **authored source of the thirteen published CC-BY edge definitions** (transcribed by line number in `vocabulary.test.ts`), and it holds the binding **"Decisions carried into Slice 2 and beyond"** section. Its line numbers drifted +9 above 488 — cite its headings, and read its appendix first | Active |
| `timelines/SLICE_0_1_OPEN_QUESTIONS.md` | The **live** unratified behaviours only (four), plus an index resolving `Q<n>` citations to the document that now owns each ruling. Compressed from 1,420 lines on 2026-07-29 | Active |
| `timelines/SLICE_RUN_LOG.md` | Append-only log of `SLICE_BUILD_LOOP.md` runs and owner ruling sessions — iterations, commit SHAs, rulings, and what each cost | Active |
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

**For Gabriel v2 Slice 2, read exactly these and nothing else from `timelines/`:**
`SLICE_BUILD_LOOP.md` (the workflow), `timelines/SLICE_2A_CRITERIA.md` (the frozen contract for
2A), `timelines/GABRIEL_V2_SLICE_2B_BUILD.md` (the spec for 2B), the
**"Decisions carried into Slice 2 and beyond"** section of
`timelines/GABRIEL_V2_SLICE_0_1_BUILD.md`, and `timelines/SLICE_RUN_LOG.md` for what already
happened. The 2B spec is self-contained on everything else.

**Deleted on 2026-07-29, do not go looking for them** (git history has all four):
`timelines/GABRIEL_V2_FOUNDATION_SPEC.md` — superseded and wrong in six measured places;
`timelines/SLICE_2_HANDOFF.md` — its job is done and three of its figures were wrong;
`timelines/SLICE_0_CRITERIA.md` and `timelines/SLICE_1_CRITERIA.md` — frozen contracts for work
that shipped and was reviewed.
