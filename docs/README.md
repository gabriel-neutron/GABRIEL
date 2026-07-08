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
| `timelines/ROADMAP.md` | Master roadmap **and live execution log**: checkbox steps, per-phase success criteria + separate-agent gates, and a ledger of deferrals/risks/decisions | Active |
| `timelines/TELEGRAM_TIMELINE.md` | Detailed phase plan for the Telegram OSINT module | WIP |

The **canonical glossary** (domain language) lives at the repo root: [`../CONTEXT.md`](../CONTEXT.md).
`ARCHITECTURE.md` describes the code *as it is today*; the *target* architecture and the decisions
behind it live in `adr/` and `timelines/ROADMAP.md`, so no doc describes an architecture the code
does not yet have.

---

## Rules (enforced by hook)

Every time a file in `/docs/` is created or modified:

1. Is this topic already covered in an existing file? → Add there, don't create new.
2. Is the new file listed in this README? → Add it before committing.
3. Does this file exceed 250 lines? → Add a table of contents at the top.
4. Is this README still under 200 lines? → Keep it an index, not a content file.
5. Is this a hard-to-reverse, surprising decision resulting from a real trade-off? → Record it as an ADR in `adr/`, don't bury it in prose.

## Agent Planning Doc Set

For `/phase-start` and other agent planning commands, use this set by default:

- `PRD.md`
- `TECH_STACK.md`
- `CONSTRAINTS.md`
- `ARCHITECTURE.md`
- `timelines/ROADMAP.md`
- `adr/` (scan titles; read those relevant to the task)

Do **not** include `TELEGRAM_OSINT_PRD.md` or `timelines/TELEGRAM_TIMELINE.md` unless the task
explicitly targets Telegram OSINT work.
