# Implementation Timeline — Telegram OSINT Module

This timeline covers the implementation of the Telegram OSINT Graph Module described in `TELEGRAM_OSINT_PRD.md`.  
See [`ROADMAP.md`](./ROADMAP.md) for the parent project's master roadmap.

## Principles

- Validate every external tool empirically before building features that depend on it.
- If a tool fails its validation gate, stop and reassess — do not build around broken assumptions.
- Keep each phase independently shippable: the system should work at the end of every phase.
- Store only what is confirmed to work; do not design database schemas around unverified data shapes.
- Rate limits and data volumes must be measured on real data, not estimated.
- Telethon source of truth (for all AI agents and contributors): use https://codeberg.org/Lonami/Telethon. The GitHub mirror is not up to date and must not be treated as canonical.
- Telethon documentation source of truth: use https://docs.telethon.dev/en/stable/ for API and usage references.

---

## Phase 1 — External Tool Validation (Weeks 1-2)

**Status:** not started

**Goal**: Validate each external dependency in isolation before any integration code is written. Exit criteria are hard stops — a failed validation blocks all subsequent phases.

**Scope**  
This phase produces no production code. It produces a set of documented capability reports for each tool that inform the design of Phase 2 onward.

**Tool Validation Tasks**

- [ ] **Telethon — basic connectivity**
  - Connect with real `api_id`/`api_hash` against a known public channel.
  - Confirm: channel entity shape, message object fields, member list structure.
  - Measure: how many API calls per channel before a `FloodWaitError` is raised.
  - Document actual rate limits (requests/minute, messages/minute, members/call).

- [ ] **Telethon — channel metadata collection**
  - Collect metadata from 5 public Russian military channels.
  - Confirm: `GetParticipantsRequest` works for public groups.
  - Measure: time and call count for 100-member, 1,000-member, 10,000-member groups.
  - Confirm: message batch size (`GetHistoryRequest` limit) and pagination behavior.

- [ ] **tgspyder — private channel scraping**
  - Install and run tgspyder against a controlled private test channel.
  - Confirm: member scraping works, output format is parseable.
  - Confirm: invite-link join behavior (works / patched / requires manual join).
  - Document: which capabilities work vs. what requires an already-joined account.

- [ ] **OpenAI gpt-4o-mini — Russian military NER**
  - Prepare 50 real Russian Telegram message samples (manually sourced).
  - Send to gpt-4o-mini with a structured NER prompt for UNIT / MUN / PERSON / LOCATION / EQUIPMENT.
  - Measure: accuracy on known entities (manually evaluate 50 samples).
  - Measure: cost per 1,000 messages (token count × price).
  - Confirm: batch size limit and latency for a 100-message batch.

- [ ] **Sigma.js + @react-sigma — graph performance**
  - Build a standalone React prototype with a mock graph of 1,000, 5,000, and 10,000 nodes.
  - Measure: frame rate on target hardware during zoom/pan.
  - Confirm: click-to-select, label rendering, edge routing are acceptable at 5,000 nodes.
  - Confirm: graphology data model fits the planned schema (channels + users as nodes, edges as typed).

- [ ] **SQLite (aiosqlite) — data volume**
  - Populate a test `.tgdb` with synthetic data: 1,000 channels, 3M messages, 500K users, 2M edges.
  - Measure: file size on disk.
  - Measure: query time for: graph traversal (2-hop BFS), full-text search on messages, relevance score sort.
  - Confirm: acceptable performance without additional indexes.

**Exit Criteria**
- [ ] Each tool has a documented capability report (what works, what doesn't, actual limits).
- [ ] Telethon rate limits are known; BFS crawl speed can be estimated.
- [ ] tgspyder private channel path is confirmed working or an alternative is documented.
- [ ] OpenAI NER accuracy ≥ 70% on Russian military test set; cost per 1K messages is known.
- [ ] Sigma.js renders 5,000 nodes at acceptable frame rate on target hardware.
- [ ] SQLite query times are acceptable at expected data volume.

**Blocker gate:** Any tool that fails its exit criteria requires a documented decision (swap tool, narrow scope, or accept limitation) before Phase 2 begins.

---

## Phase 2 — Sidecar Foundation (Weeks 2-3)

**Status:** not started  
**Prerequisite:** Phase 1 exit criteria all passed.

**Goal**: Stand up the Python sidecar with credentials, SQLite schema, and a health check that the React app can verify. No crawling yet.

**Scope**  
Foundation infrastructure only. The sidecar must start, connect to Telegram, and be reachable from the browser before any collection features are built.

**Primary Targets**
- `sidecar/main.py` (FastAPI application, lifespan setup)
- `sidecar/db.py` (SQLite schema init + helpers via aiosqlite)
- `sidecar/telegram_client.py` (Telethon session management, connect/disconnect)
- `sidecar/requirements.txt`
- `sidecar/.env.example` (api_id, api_hash, openai_api_key)
- `package.json` (add `sidecar` script)

**Tasks**
- [ ] Create `sidecar/` directory with FastAPI app skeleton.
- [ ] Implement SQLite schema init (all tables from PRD) with idempotent `CREATE TABLE IF NOT EXISTS`.
- [ ] Implement `GET /health` returning sidecar version and Telegram connection status.
- [ ] Add `npm run sidecar` to `package.json` (runs `uvicorn sidecar.main:app --reload`).
- [ ] Document credential setup in `sidecar/README.md`: where to get `api_id`/`api_hash`, `.session` file location, `.gitignore` entries.
- [ ] Add `.session` and `.env` to `.gitignore` if not already present.
- [ ] Add a React sidecar status indicator (green/red dot in header) that polls `GET /health`.

**Exit Criteria**
- [ ] `npm run sidecar` starts without errors and stays running.
- [ ] `GET /health` returns `{ status: "ok", telegram: "connected" }` with valid credentials.
- [ ] SQLite schema is created correctly on first run; re-running is idempotent.
- [ ] React app shows sidecar connection status.
- [ ] `.session` and `.env` are listed in `.gitignore`.

---

## Phase 3 — Small-Scale Collection Proof-of-Concept (Weeks 3-4)

**Status:** not started  
**Prerequisite:** Phase 2 exit criteria passed; Telethon rate limits from Phase 1 are factored into implementation.

**Goal**: Prove the collection pipeline works on a small set (≤ 20 seed channels) before building the full crawler. Validate that collected data matches the Phase 1 schema assumptions.

**Scope**  
Manual seed import and single-hop collection only. No BFS traversal yet. Focus on data quality and schema fitness.

**Primary Targets**
- `sidecar/collector.py` (channel metadata, messages, members)
- `sidecar/tgspyder_adapter.py` (wrapper for tgspyder; use only if Telethon member scraping is insufficient)
- `sidecar/rate_limiter.py` (FloodWaitError handling, configurable delays)
- FastAPI: `POST /seed/import`, `POST /collect/{channel_id}`, `GET /channels`

**Tasks**
- [ ] Implement seed import (CSV + manual input) → insert channels with `status=seed`.
- [ ] Implement single-channel collection: fetch metadata, last N messages, admin list.
- [ ] Implement FloodWaitError handler: catch, log wait time, resume automatically.
- [ ] Implement member scraping fallback via tgspyder if `GetParticipantsRequest` is rate-limited.
- [ ] Run collection against 10 known public Russian military channels.
- [ ] Validate: all expected fields present in collected data; schema matches PRD.
- [ ] Validate: message volume per channel matches Phase 1 estimates; adjust N if needed.
- [ ] Validate: member scraping works for at least 3 channels (including 1 private via tgspyder).

**Exit Criteria**
- [ ] 10+ channels collected successfully with metadata + messages + at least partial member lists.
- [ ] Data is stored correctly in `.tgdb` and queryable via `GET /channels`.
- [ ] Rate limit handler tested: sidecar survives a FloodWaitError and resumes collection.
- [ ] Collected data shape is confirmed; any schema deviations from PRD are documented and resolved.

---

## Phase 4 — Analysis Proof-of-Concept (Weeks 4-5)

**Status:** not started  
**Prerequisite:** Phase 3 exit criteria passed; Phase 1 OpenAI NER validation passed.

**Goal**: Validate military relevance scoring and entity extraction on real collected data before scaling the pipeline.

**Scope**  
Analysis runs on the ≤ 20 channels collected in Phase 3. Validate accuracy on real data (not just the Phase 1 test set).

**Primary Targets**
- `sidecar/relevance.py` (keyword/regex rule engine + OpenAI classifier)
- `sidecar/ner.py` (OpenAI batch NER, structured output)
- `sidecar/keywords/` (Russian military keyword dictionaries — MUNs, ranks, weapon systems, unit types)
- FastAPI: `GET /channel/{id}` (include relevance score + extracted entities)

**Tasks**
- [ ] Build Russian military keyword dictionary (MUN patterns, rank words, weapon names, unit designators in Russian/English). Source from existing OSINT references or build manually.
- [ ] Implement rule engine: score each channel based on keyword matches in title + description + messages.
- [ ] Implement OpenAI batch NER: process message batches, extract UNIT / MUN / PERSON / LOCATION / EQUIPMENT.
- [ ] Implement OpenAI relevance classifier: send ambiguous channels (mid-range rule scores) for AI classification.
- [ ] Run analysis on Phase 3 collected channels.
- [ ] Manually review results: are high-scoring channels actually military-relevant?
- [ ] Measure actual OpenAI cost on Phase 3 data; project cost at 5,000-channel scale.
- [ ] Tune score thresholds based on manual review.

**Exit Criteria**
- [ ] Rule engine scores all collected channels; high-scorers are confirmed military-relevant by manual review (≥ 80% precision).
- [ ] NER extracts recognizable entities from Russian military message text.
- [ ] OpenAI cost per channel is measured; cost at 5,000-channel scale is within acceptable bounds.
- [ ] Score thresholds are set and documented based on real data (not assumptions).

---

## Phase 5 — BFS Discovery Crawler (Weeks 5-6)

**Status:** not started  
**Prerequisite:** Phases 3 and 4 exit criteria passed; rate limits from Phase 1 factored into BFS delay budget.

**Goal**: Build and validate the BFS discovery crawler. Scale from 20 seed channels to 200+ discovered channels.

**Scope**  
Full BFS traversal using the three confirmed discovery signals: linked channels, shared admins/members, keyword mentions. Depth limit and pause/resume controls. WebSocket progress stream.

**Primary Targets**
- `sidecar/crawler.py` (BFS engine, session state, pause/resume)
- `sidecar/edges.py` (edge discovery: linked channels, member overlap, keyword mentions)
- FastAPI: `POST /crawl/start`, `POST /crawl/pause`, `POST /crawl/resume`, `GET /crawl/status`, `WS /ws/crawl`

**Tasks**
- [ ] Implement BFS traversal: expand frontier, skip already-collected channels, respect depth limit.
- [ ] Implement linked-channel discovery: parse t.me/ links from channel descriptions and pinned messages.
- [ ] Implement shared-member edge discovery: find users appearing in multiple collected channels.
- [ ] Implement keyword-mention edge discovery: tag channels that mention known entity names.
- [ ] Implement crawl session state in SQLite (`crawl_sessions` table): persist BFS frontier so paused crawls can resume.
- [ ] Implement FloodWaitError-aware BFS: pause frontier expansion during wait, resume after.
- [ ] Implement WebSocket progress endpoint streaming node/edge counts and current frontier size.
- [ ] Run a full crawl from 10 seed channels to depth 3; measure time and final graph size.
- [ ] Validate: at least 200 channels discovered; graph is acyclic-safe (visited set prevents loops).

**Exit Criteria**
- [ ] Crawl from 10 seeds reaches ≥ 200 channels at depth 3.
- [ ] Pause and resume work: restarting from a paused session continues from the correct frontier.
- [ ] FloodWaitError during crawl does not lose state.
- [ ] WebSocket streams real-time progress to a browser client.
- [ ] Crawl completes within an acceptable time window given Phase 1 rate limit measurements.

---

## Phase 6 — React Graph UI (Weeks 6-8)

**Status:** not started  
**Prerequisite:** Phase 5 exit criteria passed; Sigma.js performance validated in Phase 1.

**Goal**: Build the interactive Telegram graph view in the React app. The analyst can open a `.tgdb` file, view the network, search, and inspect nodes.

**Scope**  
New `TelegramPage` in the React app. Sigma.js graph, channel/user detail panel, crawl controls, search. No OOB proposals yet (Phase 7).

**Primary Targets**
- `src/pages/TelegramPage.tsx` (new page, launched from EditPage header button)
- `src/store/useTelegramStore.ts` (new Zustand store: sidecar state, graph data, selected node)
- `src/components/telegram/TelegramGraph.tsx` (Sigma.js WebGL graph)
- `src/components/telegram/ChannelDetail.tsx` (selected node detail panel)
- `src/components/telegram/CrawlControls.tsx` (seed import, depth input, start/pause, progress)
- `src/components/telegram/GraphSearch.tsx` (search by unit, MUN, channel, person)
- `src/App.tsx` (add `telegram` to mode type)
- `src/pages/EditPage.tsx` (add Telegram launch button to header)
- `package.json` (add `@react-sigma/core`, `sigma`, `graphology`)

**Tasks**
- [ ] Install and configure `@react-sigma/core`, `sigma`, `graphology`.
- [ ] Create `useTelegramStore` with: sidecar URL, connection status, graph data, selected channel ID, crawl state.
- [ ] Build `TelegramGraph`: fetch `/graph` on mount, render with Sigma.js, wire node click to detail panel.
- [ ] Build `ChannelDetail`: display channel metadata, relevance score, extracted entities, member count.
- [ ] Build `CrawlControls`: CSV seed import, depth selector, start/pause/resume buttons, WebSocket progress display.
- [ ] Build `GraphSearch`: input → `GET /search?q=` → highlight matching nodes on graph.
- [ ] Add "Telegram" button to `EditPage` header that switches to `TelegramPage`.
- [ ] Test with real Phase 5 crawl data at 200+ nodes; verify render performance.
- [ ] Test with mock data at 1,000 and 5,000 nodes; verify frame rate (from Phase 1 baseline).

**Exit Criteria**
- [ ] TelegramPage opens from EditPage and displays a real crawled graph.
- [ ] Node click shows correct channel detail.
- [ ] Search returns results and highlights nodes.
- [ ] Crawl controls start/pause/resume a real crawl and show live progress.
- [ ] Graph renders at ≥ 30 FPS at 5,000 nodes (validated against Phase 1 baseline hardware).

---

## Phase 7 — OOB Linkage (Weeks 8-9)

**Status:** not started  
**Prerequisite:** Phase 6 exit criteria passed; Phase 4 NER validated.

**Goal**: Implement the OOB match proposal flow: sidecar matches extracted entities to OOB units, React surfaces proposals for analyst review, accepted proposals write to the `.gpkg`.

**Primary Targets**
- `sidecar/oob_matcher.py` (fuzzy match entity names vs OOB entity names)
- `sidecar/gpkg_reader.py` (read-only `.gpkg` loader for OOB entity names; sidecar never writes `.gpkg`)
- FastAPI: `GET /oob/proposals`, `POST /oob/accept/{id}`, `POST /oob/reject/{id}`
- `src/components/telegram/OobProposals.tsx` (proposal review panel)
- `src/services/geopackage.service.ts` (add `appendSource(entityId, url)` helper if not present)

**Tasks**
- [ ] Implement sidecar `.gpkg` loader: read entity names and IDs from the GeoPackage (read-only).
- [ ] Implement fuzzy matcher: compare extracted unit names to OOB entity names (string similarity ≥ 0.75).
- [ ] Store proposals in `oob_proposals` table with confidence score and evidence text.
- [ ] Implement `GET /oob/proposals` returning pending proposals with context.
- [ ] Implement `POST /oob/accept/{id}`: returns `{ oob_entity_id, channel_url }` to React.
- [ ] Implement `POST /oob/reject/{id}`: marks proposal rejected in SQLite.
- [ ] Build `OobProposals` panel in React: list proposals, show evidence, accept/reject buttons.
- [ ] On accept: React calls `appendSource(entityId, channelUrl)` in `geopackage.service.ts` and triggers a `.gpkg` save.
- [ ] Test: manually verify that an accepted proposal correctly appears in the OOB entity's `sources` field after save.

**Exit Criteria**
- [ ] Sidecar generates proposals for at least 3 confirmed channel-to-unit matches from Phase 5 crawl data.
- [ ] Analyst can review and accept/reject proposals from the React UI.
- [ ] Accepted proposal URL appears in the correct `.gpkg` entity's `sources` field after save.
- [ ] Rejected proposals are not re-surfaced.
- [ ] Sidecar never writes to the `.gpkg`.

---

## Phase 8 — Export and Hardening (Weeks 9-10)

**Status:** not started  
**Prerequisite:** Phase 7 exit criteria passed.

**Goal**: Add GraphML/Neo4j export and harden the sidecar for reliable daily use.

**Scope**  
Export endpoints, error handling, credential security, and a basic operational health check.

**Primary Targets**
- `sidecar/export.py` (GraphML serializer, Neo4j Cypher generator)
- `sidecar/main.py` (error handling middleware, structured logging)
- FastAPI: `GET /export/graphml`, `GET /export/neo4j`
- `src/components/telegram/TelegramGraph.tsx` (add export buttons)
- `sidecar/README.md` (operational guide: credentials, rate limit behavior, known limitations)

**Tasks**
- [ ] Implement GraphML export: serialize nodes + edges from `.tgdb` to GraphML format; validate it loads in Gephi.
- [ ] Implement Neo4j Cypher export: generate `MERGE` statements for nodes and relationships.
- [ ] Add structured error logging to sidecar (log to file, not just stdout).
- [ ] Add global exception handler: all unhandled errors return a structured JSON error with a request ID.
- [ ] Confirm `.session` and `.env` are in `.gitignore`; add pre-commit warning if session file is staged.
- [ ] Write `sidecar/README.md`: credential setup, first-run guide, known rate limits, `.tgdb` file management.
- [ ] Run a 500-channel crawl end-to-end; export GraphML and verify in Gephi.

**Exit Criteria**
- [ ] GraphML export loads in Gephi without errors on a 500-channel graph.
- [ ] Neo4j Cypher export can be imported into a local Neo4j instance.
- [ ] All errors surfaced in sidecar are structured JSON; no unhandled 500s reach the browser.
- [ ] Operational README covers all setup steps a new analyst would need.
- [ ] No credentials appear in any log output.

---

## Ongoing Cadence (Post Phase 8)

- After each investigation: archive `.tgdb` with the matching `.gpkg`; do not accumulate all investigations in one file.
- Monthly: re-test tgspyder against a private channel to confirm it still works (Telegram patches can break it without notice).
- Monthly: re-evaluate OpenAI cost per channel as message volumes grow.
- Quarterly: check for Telethon updates that affect rate limits or private channel handling.
- On Telegram ToS change: re-assess which collection methods remain authorized.

---

## Risk Register

| Risk | Phase at Risk | Signal to Watch | Response |
|---|---|---|---|
| Telethon rate limits stricter than expected | Phase 1 → all | FloodWaitError frequency > 1/hour | Increase delays; reduce BFS parallelism; consider session rotation |
| tgspyder private channel join no longer works | Phase 1 → Phase 3 | Join request fails on test channel | Document manual-join-first workaround; remove auto-join from scope |
| OpenAI NER accuracy < 70% on real data | Phase 4 | Manual review precision < threshold | Improve prompt; add few-shot examples; consider keyword pre-filter |
| Sigma.js performance inadequate at 5K nodes | Phase 1 → Phase 6 | FPS < 30 on target hardware | Reduce rendered edges; add LOD (hide edge labels at zoom-out); consider reagraph |
| SQLite query too slow at 10K channels | Phase 1 → Phase 5 | Query time > 2s for graph traversal | Add composite indexes; partition messages into separate table by date |
| Forward chain exclusion limits discovery quality | Phase 5 | < 200 channels found at depth 3 from 10 seeds | Add forward-chain edge type in v2; document gap |
