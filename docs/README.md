# Gabriel — Documentation Index

> This is the single source of truth for all project documentation.
> Before creating or modifying any `/docs/` file, read this index.

---

## Index

| File | Covers | Status |
|---|---|---|
| `PRD.md` | Product requirements, scope, user stories, success criteria | Active |
| `TECH_STACK.md` | Approved technologies, versions, dependencies, rationale | Active |
| `CONSTRAINTS.md` | Code style, naming, architecture patterns, error handling, performance | Active |
| `ARCHITECTURE.md` | Component tree, data flows, coordinate contract, enrichment pipeline | Active |
| `TIMELINE.md` | Multi-phase quality roadmap, milestones, acceptance criteria | Active |
| `TELEGRAM_OSINT_PRD.md` | PRD for Telegram scraper and graph module (work-in-progress, exclude from phase commands) | WIP |

---

## Rules (enforced by hook)

Every time a file in `/docs/` is created or modified:

1. Is this topic already covered in an existing file? → Add there, don't create new
2. Is the new file listed in this README? → Add it before committing
3. Does this file exceed 250 lines? → Add a table of contents at the top (applies to inherently long files like user guides or job-specific references)
4. Is this README still under 200 lines? → Keep it an index, not a content file

## Agent Planning Doc Set

For `/phase-start` and other agent planning commands, use this set by default:

- `PRD.md`
- `TECH_STACK.md`
- `CONSTRAINTS.md`
- `ARCHITECTURE.md`
- `TIMELINE.md`

Do **not** include `TELEGRAM_OSINT_PRD.md` unless the task explicitly targets Telegram OSINT work.
