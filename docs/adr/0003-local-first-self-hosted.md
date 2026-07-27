# Gabriel is local-first and self-hosted, not browser-only

Gabriel's founding constraint was *browser-only*: the entire application runs in a single browser tab and no server ever touches the data. That framing is retired. Gabriel is **local-first and self-hosted**: producer data stays on the analyst's machine (`.gpkg` on disk + IndexedDB cache), and heavier pipelines run as **local sidecars the analyst launches** (e.g. the Telegram FastAPI sidecar on `localhost`). The zero-leak guarantee is preserved — no *third-party SaaS* touches the data — but "no server at all" is no longer true or desirable.

Two audiences are made explicit and are separately addressed:

- **Consumer** — anyone who opens the deployed read-only public map to read, verify a source, or cite an entity. Zero install, static deployment. This is today's `ViewPage`. It never runs a heavy pipeline; it consumes an already-computed artefact (the published `.gpkg` / CC-BY dataset).
- **Producer** — the analyst who *builds* the data: enrichment, Telegram crawl, corporate ETL, satellite change-detection, ADMIRALTY scoring. This is today's `EditPage`, plus the sidecars.

## Why

The v2.0 roadmap (see `docs/GABRIEL_V2_PRD.md`) requires a Python/FastAPI Telegram sidecar, ETL connectors to external registries, AIS/ADS-B feeds, and satellite-tile processing. None of these fit inside a browser tab. The FNF proposal budgets for hosting explicitly. Continuing to claim "browser-only" would force the already-specified Telegram module to be declared "not part of Gabriel" — splitting a single v2.0 deliverable across two repos to defend a constraint the roadmap has already abandoned.

## Considered options

- **Stay browser-only, sidecars live outside the repo.** Rejected: fragments the v2.0 deliverable and denies the roadmap.
- **Move to a hosted back-end platform (continuous ETL workers, live-fed public map).** Rejected for now: the biggest departure from the current identity, and premature — the investigation runs at two-analyst scale where local compute is unproven-insufficient.
- **Local-first / self-hosted, heavy compute behind an abstract capability interface.** Chosen. See ADR 0005 for the capability-abstraction consequence.

## Consequences

- Heavy pipelines sit behind an **abstract capability interface**; *where* a capability runs (local sidecar now, shared worker later) is a configuration detail, not an architecture decision. Local sidecars are the default first deployment.
- Wording across `CLAUDE.md`, `CONTEXT.md`, `PRD.md`, `TECH_STACK.md` changes from "browser-only / no server" to "local-first / self-hosted / zero third-party-SaaS".
- The read-only public deployment (`ViewPage`, static `dist/`) remains a hard requirement and is unaffected.
- A sidecar reads the `.gpkg` out-of-process (read-only). This is a *known* future violation of the "GeoPackage I/O lives only in page components" invariant and must be handled with an explicit read-replica / cache-coherence seam when the Telegram module lands — not silently.
