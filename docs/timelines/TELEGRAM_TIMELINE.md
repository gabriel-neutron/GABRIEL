# Implementation Timeline — Telegram OSINT Module

This timeline covers the implementation of the Telegram OSINT Graph Module described in `TELEGRAM_OSINT_PRD.md`.

> **2026-07-22 — Phases 3 and 5 superseded by a slice-based issue breakdown.** Once real
> Telegram collection work started, execution moved from the phase checklists below to the
> tracer-bullet slices in [Slice-Based Execution](#slice-based-execution-phase-35-2026-07-22-)
> below (folded in from the now-removed `docs/issues/TELEGRAM_PHASE3_ISSUES.md`). Phase 3 and
> Phase 5's status blocks and task checkboxes are historical and no longer reflect real
> progress — read the slice section for current status.

## Principles

- Validate every external tool empirically before building features that depend on it.
- If a tool fails its validation gate, stop and reassess — do not build around broken assumptions.
- Keep each phase independently shippable: the system should work at the end of every phase.
- Store only what is confirmed to work; do not design database schemas around unverified data shapes.
- Rate limits and data volumes must be measured on real data, not estimated.
- **Account safety is a first-class constraint, not a tuning detail.** The sidecar authenticates as a real user account that Telegram can *permanently* ban (distinct from a temporary `FloodWaitError`). Follow the Account Safety rules in [`TELEGRAM_OSINT_PRD.md`](../TELEGRAM_OSINT_PRD.md#account-safety): dedicated/expendable account only, physical SIM over VoIP, warm the account before bulk collection, budget `GetParticipants` tightly, never add/invite/message users, and hard-stop on `PeerFloodError`.
- Telethon source of truth (for all AI agents and contributors): use https://codeberg.org/Lonami/Telethon. The GitHub mirror is not up to date and must not be treated as canonical.
- Telethon documentation source of truth: use https://docs.telethon.dev/en/stable/ for API and usage references.

---

## Phase 1 — External Tool Validation (Weeks 1-2)

**Status:** the collection-blocking items are resolved — see Slice 0 in
[Slice-Based Execution](#slice-based-execution-phase-35-2026-07-22-) (member visibility is
admins-only/NO-GO, first rate-limit floor measured, known shapes reconfirmed), and Phase 3/5's
real work proceeded on those findings. The OpenAI NER and tgspyder validation tasks below were
never run (tgspyder is dead per the 2026-07-16 audit; NER validation is still open, gating
Phase 4). Validation scripts live in `sidecar/validation/` (`README.md` there has the run
order); results in `sidecar/validation/RESULTS.md`.

**Goal**: Validate each external dependency in isolation before any integration code is written. Exit criteria are hard stops — a failed validation blocks all subsequent phases.

**Scope**  
This phase produces no production code. It produces a set of documented capability reports for each tool that inform the design of Phase 2 onward.

**Tool Validation Tasks**

- [ ] **Telethon — basic connectivity** — attempted 2026-07-20 against the test DC (safe, no real account), see `sidecar/validation/RESULTS.md`: **blocked by this machine's network** (MTProto handshake intercepted, returns HTTP 404, isolated to Telegram's raw IP via a control test against `api.telegram.org`). Not a Telethon or code problem — retry from a different network before running this against a real account/known public channel.
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

- [x] **Sigma.js + @react-sigma — graph performance** — run 2026-07-20, see `sidecar/validation/RESULTS.md`. `src/modules/telegram/graph/SigmaPerfProbe.tsx` + Storybook stories.
  - Build a standalone React prototype with a mock graph of 1,000, 5,000, and 10,000 nodes.
  - Measure: frame rate on target hardware during zoom/pan. → 60 FPS at 1,000 nodes/~2,000 edges; **~1 FPS at 5,000 nodes/~10,000 edges**, recovers to 60 FPS at 5,000 nodes/~5,000 edges — edge count is the bottleneck, not node count. Not re-tested at 10,000 nodes.
  - Confirm: click-to-select, label rendering, edge routing are acceptable at 5,000 nodes. → labels ruled out as a cause; edge density is. Click-to-select not yet tested (no interaction handlers wired in the throwaway prototype).
  - Confirm: graphology data model fits the planned schema (channels + users as nodes, edges as typed). → confirmed via `mockGraph.ts`; not yet tested against Phase 5's real (non-uniform) discovered-graph structure.

- [x] **SQLite (aiosqlite) — data volume** — run + re-measured with indexes 2026-07-20, see `sidecar/validation/RESULTS.md`.
  - Populate a test `.tgdb` with synthetic data: 1,000 channels, 3M messages, 500K users, 2M edges.
  - Measure: file size on disk. → 663.9 MB (736.8 MB indexed).
  - Measure: query time for: graph traversal (2-hop BFS), full-text search on messages, relevance score sort.
  - Confirm: acceptable performance without additional indexes. → both without indexes (11.7s) and
    with `sidecar/db.py`'s real indexes (9.9s) fail the < 2s target — but `EXPLAIN QUERY PLAN`
    confirms the index **is** used correctly. Root cause isn't indexing: the PRD's 1,000
    channels/2M edges spec implies ~2,000 edges/channel, an unrealistically dense graph no
    2-hop join can traverse quickly regardless of indexes. Re-validate against Phase 5's real
    (sparse) crawl output instead of trusting this synthetic density.

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

**Status:** code complete, unverified against a live Telegram connection — built ahead of
Phase 1's exit gate because it's pure scaffolding with no collection logic; do not start
Phase 3 until Phase 1 actually passes. `npm run sidecar` boots and `GET /health` returns
`{"status":"ok","telegram":"not_connected"}` with no credentials configured (verified
2026-07-20). Not yet verified: `telegram: "connected"` with a real authenticated session,
since that needs the Phase 1 credentials this phase jumped ahead of.  
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
- [x] Create `sidecar/` directory with FastAPI app skeleton.
- [x] Implement SQLite schema init (all tables from PRD) with idempotent `CREATE TABLE IF NOT EXISTS`.
- [x] Implement `GET /health` returning sidecar version and Telegram connection status.
- [x] Add `npm run sidecar` to `package.json` (runs `uvicorn sidecar.main:app --reload`).
- [x] Document credential setup in `sidecar/README.md`: where to get `api_id`/`api_hash`, `.session` file location, `.gitignore` entries.
- [x] Add `.session` and `.env` to `.gitignore` if not already present.
- [x] Add a React sidecar status indicator (green/amber/red dot in header) that polls `GET /health` — `src/modules/telegram/`.

**Exit Criteria**
- [x] `npm run sidecar` starts without errors and stays running.
- [ ] `GET /health` returns `{ status: "ok", telegram: "connected" }` with valid credentials. — code path exists (`telegram_client.connect()`); unverified without real credentials.
- [x] SQLite schema is created correctly on first run; re-running is idempotent (`CREATE TABLE IF NOT EXISTS`).
- [x] React app shows sidecar connection status (`SidecarStatusIndicator`, header dropdown).
- [x] `.session` and `.env` are listed in `.gitignore`.

---

## Phase 3 — Small-Scale Collection Proof-of-Concept (Weeks 3-4)

**Status: superseded by the slice-based execution below** — real collection (`ChannelSource`
seam, `expand_channel`, hardened governor) shipped as Slices 1-3, not as the tasks/checkboxes
in this section. Left as historical record of the original plan.

<details><summary>Original phase plan (superseded, click to expand)</summary>

**Status (original):** not started for real collection (still correctly gated on Phase 1). Two of the
four Phase 3 pieces have zero Telegram dependency and were built ahead of the gate: seed
import (`sidecar/seed.py`, `POST /seed/import`, `GET /channels`, `SeedImportPanel.tsx` —
live-tested in a real browser, seeded 3 channels, confirmed in both `/channels` and the graph
view) and the FloodWaitError/PeerFloodError handler (`sidecar/rate_limiter.py` — mechanical,
not empirical: `FloodWaitError.seconds` is Telegram's own documented value, so catching and
sleeping exactly that long doesn't need Phase 1's measurements; unit-tested with simulated
errors, no live Telegram needed). `collector.py` and `tgspyder_adapter.py` are correctly NOT
built — they need Phase 1's real message-shape/pagination findings, which don't exist yet.  
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
- [x] Implement seed import (CSV + manual input) → insert channels with `status=seed`. Built as `type='seed'` (see `sidecar/seed.py` docstring — the PRD's `channels` schema has no `status` column).
- [ ] Implement single-channel collection: fetch metadata, last N messages, admin list.
- [x] Implement FloodWaitError handler: catch, log wait time, resume automatically. → `sidecar/rate_limiter.py`, `with_flood_wait_retry` decorator. Reactive handling only (sleep exactly `e.seconds`, retry) — mechanical, not empirical, since `FloodWaitError.seconds` is Telegram's own documented value; the PROACTIVE delay budget (jitter, base delay, calls/hour) still needs Phase 1's real measurements and is deliberately not included. Unit-tested with simulated `FloodWaitError`/`PeerFloodError` (no live Telegram needed): confirmed retry-and-succeed after waiting the exact told duration, correct give-up after exceeding max retries, and immediate hard-stop (zero retries) on `PeerFloodError` per Account Safety rule 1.
- [ ] Implement member scraping fallback via tgspyder if `GetParticipantsRequest` is rate-limited.
- [ ] Run collection against 10 known public Russian military channels.
- [ ] Validate: all expected fields present in collected data; schema matches PRD.
- [ ] Validate: message volume per channel matches Phase 1 estimates; adjust N if needed.
- [ ] Validate: member scraping works for at least 3 channels (including 1 private via tgspyder).

**Exit Criteria**
- [ ] 10+ channels collected successfully with metadata + messages + at least partial member lists.
- [ ] Data is stored correctly in `.tgdb` and queryable via `GET /channels`.
- [x] Rate limit handler tested: sidecar survives a FloodWaitError and resumes collection. → verified with simulated errors (see task list above); not yet tested against a real FloodWaitError from live Telegram, since no collector.py calls it yet.
- [ ] Collected data shape is confirmed; any schema deviations from PRD are documented and resolved.

</details>

---

## Phase 4 — Analysis Proof-of-Concept (Weeks 4-5)

**Status:** not started for OpenAI-dependent work (correctly gated — needs Phase 1's NER
validation). The rule-engine half has zero OpenAI/Telegram dependency and was built +
sanity-tested 2026-07-20: `sidecar/relevance.py` (MUN regex, RU/EN keyword and rank
dictionaries, `score_text`/`score_channel`). Verified against realistic input (military text →
0.9, neutral text → 0.0). Keyword lists are a first pass, explicitly flagged in the module
docstring as needing expansion once real Phase 3 data exists. `ner.py` (OpenAI batch NER) is
correctly NOT built — designing its prompt/schema without Phase 1's accuracy findings would be
exactly the "unvalidated assumption" this timeline warns against.  
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

**Status: superseded by the slice-based execution below** — the Telegram-facing crawl wiring,
WebSocket progress, and canary authorization shipped as Slices 5-7, not as the tasks/checkboxes
in this section. Left as historical record of the original plan.

<details><summary>Original phase plan (superseded, click to expand)</summary>

**Status (original):** the traversal algorithm itself is built and tested; the Telegram-facing parts
(edge discovery, WebSocket progress, and the real `expand_channel` implementation) are
correctly not started. `sidecar/crawler.py`'s `run_crawl`/`start_session`/`load_session` is
generic BFS parameterized by an injected `expand_channel(channel_id) -> list[int]` callback —
no Telegram dependency, so it's fully testable with a fake graph. Tested 2026-07-20 with a
fake graph containing a deliberate cycle (a back-edge to the seed, the realistic case since
Telegram channels commonly link to each other both ways): confirmed depth-limiting terminates
correctly and doesn't get stuck on the cycle, and — separately — that pausing after 2 steps,
persisting to `crawl_sessions` (added `frontier_json`/`visited_json` columns via an idempotent
migration, `db.migrate_crawl_sessions_columns`), reloading from the DB, and resuming produces
an identical final result to running straight through. **Deliberately not wired to any FastAPI
endpoint** — exposing `POST /crawl/start` against a fake or missing `expand_channel` would
misrepresent the feature as able to reach Telegram when it can't; wire the real endpoints only
once Phase 3's `collector.py` supplies a real expander.  
**Prerequisite:** Phases 3 and 4 exit criteria passed; rate limits from Phase 1 factored into BFS delay budget.

**Goal**: Build and validate the BFS discovery crawler. Scale from 20 seed channels to 200+ discovered channels.

**Scope**  
Full BFS traversal using the three confirmed discovery signals: linked channels, shared admins/members, keyword mentions. Depth limit and pause/resume controls. WebSocket progress stream.

**Primary Targets**
- `sidecar/crawler.py` (BFS engine, session state, pause/resume)
- `sidecar/edges.py` (edge discovery: linked channels, member overlap, keyword mentions)
- FastAPI: `POST /crawl/start`, `POST /crawl/pause`, `POST /crawl/resume`, `GET /crawl/status`, `WS /ws/crawl`

**Tasks**
- [x] Implement BFS traversal: expand frontier, skip already-collected channels, respect depth limit. → `sidecar/crawler.py::run_crawl`, tested with a fake graph incl. a cycle.
- [x] Implement linked-channel discovery: parse t.me/ links from channel descriptions and pinned messages. → `sidecar/edges.py::extract_linked_channels`. Takes text as a plain argument (no Telegram dependency) — tested against realistic description text; caught and fixed a real bug where `t.me/joinchat/...` and `t.me/+...` invite links were misparsed as literal usernames before excluding those reserved path segments. Deduping and `t.me/c/...` private-by-id exclusion also verified. Real collected description text to run it on still needs Phase 3.
- [ ] Implement shared-member edge discovery: find users appearing in multiple collected channels. — needs real member lists (Phase 3); no text-only equivalent exists for this signal.
- [x] Implement keyword-mention edge discovery: tag channels that mention known entity names. → `sidecar/edges.py::extract_keyword_mentions`, tested against real entity names from the bundled `.gpkg` ("1st Tank Army", "96th Reconnaissance Brigade") embedded in synthetic message text — case-insensitive match confirmed correct, including correctly NOT matching an unmentioned third entity. Real collected message text still needs Phase 3.
- [x] Implement crawl session state in SQLite (`crawl_sessions` table): persist BFS frontier so paused crawls can resume. → `frontier_json`/`visited_json` columns (idempotent migration), `crawler.py::start_session`/`load_session`/`persist_state`. Verified: pause after 2 steps → reload from DB → resume → identical final result to an uninterrupted run.
- [ ] Implement FloodWaitError-aware BFS: pause frontier expansion during wait, resume after. — the FloodWaitError handler exists (`rate_limiter.py`, Phase 3) and the BFS pause/resume mechanism exists (this phase); wiring them together needs a real `expand_channel` that can actually raise `FloodWaitError`, i.e. Phase 3's collector.
- [ ] Implement WebSocket progress endpoint streaming node/edge counts and current frontier size.
- [ ] Run a full crawl from 10 seed channels to depth 3; measure time and final graph size.
- [ ] Validate: at least 200 channels discovered; graph is acyclic-safe (visited set prevents loops).

**Exit Criteria**
- [ ] Crawl from 10 seeds reaches ≥ 200 channels at depth 3.
- [ ] Pause and resume work: restarting from a paused session continues from the correct frontier.
- [ ] FloodWaitError during crawl does not lose state.
- [ ] WebSocket streams real-time progress to a browser client.
- [ ] Crawl completes within an acceptable time window given Phase 1 rate limit measurements.

</details>

---

## Slice-Based Execution (Phase 3→5, 2026-07-22)

> Folded in from the now-removed `docs/issues/TELEGRAM_PHASE3_ISSUES.md`. This is the
> **authoritative execution record** for Phase 3 and Phase 5 — supersedes the checklists above.
> AFK-ready issue breakdown for real Telegram crawling (collector → expander → crawler wiring),
> sliced as tracer bullets. Derived from `gabriel-telegram-phase3-collector-handoff.md` and an
> adversarial critique pass (validation-first / architecture-seams / account-safety lenses).

**Ordering principle:** reach real Telegram data through *product code* as early as possible
(slice 1), settle open validation questions before building on them (slice 0), and never let
the most ban-dangerous operations onto the automated critical path. Each slice is
independently verifiable.

**Legend:** `AFK` = implementable + mergeable without human interaction · `HITL` = requires a
human (live ban-risk API run or a design/go-no-go decision). Slices are listed in dependency
order; do blockers first.

### 0 — Live validation spike: settle member visibility + first rate number

**Type:** HITL (no product code) — **done, 2026-07-22**

- [x] `01c_participant_visibility.py` run on the live session — result: non-member
  `get_participants` returns **admins-only** (see `sidecar/validation/RESULTS.md`)
- [x] Member-overlap go/no-go documented — **NO-GO**; Slice 4 dropped, member-overlap edge
  removed from scope
- [x] Rate-limit burst run on one channel — 40 tight-loop `get_messages` calls, zero
  FloodWait, floor is ">40 calls" for this call type
- [x] Known shape landmines reconfirmed: `participants_count` is `None` from `get_entity`
  (needs `GetFullChannelRequest`); `get_participants` raises `ChatAdminRequiredError` on
  broadcast channels

### 1 — First live single-channel collect through the ChannelSource seam

**Type:** AFK build + HITL accept — **done**

Introduced a domain-typed `ChannelSource` seam (real Telethon adapter + fake adapter for
tests); pinned the identity contract (`channels.id` **is** the Telegram peer ID, seeds stored
username-keyed until resolved); raw JSON as the authoritative sink with
`UNIQUE(channel_id, message_id)`; a minimal non-bypassable choke (jittered delay,
FloodWait/PeerFlood hard-stop, cold-start cap); `POST /collect/{channel_id}`.

- [x] `channels.id` equals the Telegram peer ID; no duplicate rows for a seed's later-discovered self
- [x] Only the `ChannelSource` adapter imports Telethon
- [x] Collector maps a real channel into `raw_json` + provisional typed columns; idempotent re-collection
- [x] Unit tests cover the fake adapter's `None` member-count and broadcast-channel branches
- [x] Every Telegram call passes through the choke; cold-start cap not configurable
- [x] No send/join/invite call anywhere in the collect path
- [x] Collected data covered by a documented per-investigation archival/deletion expectation (PII)
- [x] **HITL:** `/collect` against a real seed channel enriches its node on the graph view, verified live

### 2 — `resolve_username` seam + `expand_channel` expander

**Type:** AFK — **done**

Ran the `edges.py` extractors (linked-channel + keyword-mention) on real collected text; added
a governed `resolve_username(str) -> int | None` seam; `expand_channel(id) -> list[int]`
composes collected text → extract → resolve → identity-upsert → resolved peer IDs.
Unresolvable usernames are dropped and logged.

- [x] `expand_channel` returns real peer IDs for resolvable neighbors
- [x] Username resolution goes through its own governed seam
- [x] Discovered-but-uncollected neighbors upserted as placeholder rows per the identity contract
- [x] Unit tests exercise the expander against a fake resolver + real Slice 1 data
- [x] `expand_channel` issues no member-enumeration call

### 3 — Hardened rate governor

**Type:** AFK — **done**

Promoted Slice 1's minimal choke into the full non-bypassable governor: min inter-call delay +
jitter, per-call-type + global hourly ceilings + rolling 24h cap, warm-up ramp, post-FloodWait
cooldown, a persistent cross-restart budget ledger in SQLite, a process-wide kill-switch latch,
an `@SpamBot` preflight probe, and a per-run call-count ceiling. Config may only tighten coded
floors.

- [x] Governor enforces per-type + global + daily ceilings; config cannot raise past the coded floor
- [x] Budget ledger persists across a sidecar restart
- [x] `PeerFloodError` trips a process-wide kill-switch
- [x] `FloodWaitError` triggers automatic cooldown; repeated FloodWaits auto-tighten
- [x] `@SpamBot` status checkable, invoked as crawl preflight
- [x] Per-run ceiling auto-pauses a run after K calls
- [x] Unit tests (fake clock) prove throttling, floor-enforcement, ledger persistence, kill-switch

### 4 — Gated member enumeration

**Type:** AFK — **DROPPED, 2026-07-22.** Slice 0's result is admins-only; member enumeration
is not built. Member-overlap edge removed from scope; BFS discovery relies only on Slice 2's
linked-channel and keyword-mention signals.

### 5 — Wire `expand_channel` into the crawler + `/crawl/*` endpoints

**Type:** AFK — **done**

Fed Slice 2's real `expand_channel` into `crawler.py::run_crawl`; exposed
`POST /crawl/start|pause|resume`, `GET /crawl/status`. BFS is FloodWait-aware (pauses/resumes
frontier expansion without losing state). Hard invariant enforced structurally: the crawler's
`expand_channel` callback issues zero member-enumeration calls (expander module cannot import
the participants function).

- [x] `/crawl/start|pause|resume` and `/crawl/status` drive `run_crawl` with the real expander
- [x] Pause/resume continues from the correct persisted frontier
- [x] `FloodWaitError` mid-crawl pauses and resumes without losing state
- [x] Crawl path issues no `GetParticipants` call
- [x] Every expansion step routes through the governor

### 6 — Canary crawl: authorize the full run

**Type:** HITL — **done, GO, 2026-07-23**

1–3 seed, depth-1 human-supervised crawl to authorize the full crawl (Slice 8).

- [x] Canary (2 seeds: `rybar`, `wargonzo`) completed with `@SpamBot` clean before and after
- [x] FloodWait frequency < ~1/hr observed; zero `PeerFloodError` across the run
- [x] Discovered channels collected and appeared on the graph view
- [x] Go/no-go recorded — **GO**, no governor numbers tightened

**Bug found and fixed during this canary:** `TelethonChannelSource._rpc_get_entity` passed
numeric channel IDs to Telethon's `client.get_entity()` as **strings**; Telethon parses an
all-digit string as a phone-number lookup rather than a cached numeric-peer-ID lookup, raising
`ValueError` on every re-collection of an already-known channel by ID — exactly what crawler
expansion does for every neighbor. The exception wasn't a recognized pausing exception, so it
silently killed the background task while the persisted crawl status stayed frozen at
`"running"`, indistinguishable from a hang. Fixed in `sidecar/telegram_channel_source.py`
(`_as_entity_ref`) with a regression test reproducing Telethon's real string-vs-int behavior.
Full sidecar suite (81 tests) green after the fix.

### 7 — WebSocket crawl progress + live graph

**Type:** AFK — **done**

`WS /ws/crawl` streams node/edge/frontier counts; the Sigma graph view reflects newly
discovered nodes as the crawl runs.

- [x] `WS /ws/crawl` streams node/edge counts and current frontier size in real time
- [x] Graph view shows newly discovered nodes appearing during a live crawl
- [x] Disconnect/reconnect of the WebSocket does not crash the crawl or the UI

### 8 — Full 18-seed depth-3 crawl + shape/PII validation

**Type:** HITL — **not started.** Next up: run the full crawl from the 18 real seed channels
to depth 3, confirm collected data shape matches the schema, measure real message volume and
tune `N`, confirm PII/archival handling holds at volume.

- [ ] Full crawl from 18 seeds reaches a meaningful discovered-channel count (target ≥ 200 @ depth 3)
- [ ] Collected data shape confirmed against schema; deviations documented and resolved
- [ ] Real message volume per channel measured; `N` tuned
- [ ] No credentials in logs; per-investigation archival/deletion expectation holds at volume
- [ ] Governor held: no `PeerFloodError`; FloodWait handled without state loss across the full run

**Blocked by:** Slice 6 (clean canary) — satisfied.

---

## Phase 6 — React Graph Module (Weeks 6-8)

**Status:** partially built ahead of gate, scoped to what has no Telegram/crawl dependency —
correctly does NOT include crawl controls or real collected-channel detail (both need Phase 5).
Built + live-tested 2026-07-20 in a real browser against a running sidecar: `@react-sigma/core`
+ `sigma` + `graphology` installed; `telegramModule` registered in `moduleRegistry.ts` with a
real `views` entry (`TelegramGraphView.tsx`, fetches `GET /graph`, renders with Sigma, labels
auto-off above 500 nodes per the Phase 1 finding) and a real `leftPanels` entry
(`SeedImportPanel.tsx`). Verified end-to-end: seeded 3 channels via the UI → appeared as nodes
on the graph tab (screenshot-confirmed). Node-click → `detailRenderer` for `telegram-channel`,
`GraphSearch` UI, and `CrawlControls` are NOT built — they need real collected channel data and
a running crawler, neither of which exist yet.  
**Prerequisite:** Phase 5 exit criteria passed; Sigma.js performance validated in Phase 1; the shell module registry (E4) landed — see ADR [0007](../adr/0007-shell-module-registry.md).

**Goal**: Build the interactive Telegram graph view in the React app. The analyst can open a `.tgdb` file, view the network, search, and inspect nodes — inside the same `AppShell`/`MainLayout` shell `orbat`/`osm` already use, not a separate page.

**Scope**  
> **Revised 2026-07-10 (grill-with-docs session, alongside ADR 0007).** The original plan below built Telegram as a standalone `TelegramPage` reached by switching away from `EditPage` entirely — its own store, own layout, no shared shell. That shape sidesteps E4's module registry rather than exercising it. Telegram is now a real `modules/telegram/` module: it registers a `views` entry (the Sigma.js graph, a new top-level tab alongside Map/Hierarchy), a `detailRenderer` for `selectedRef.kind === "telegram-channel"` (replacing the standalone `ChannelDetail` page), a `leftPanels` entry for `CrawlControls`/`GraphSearch`, and a `headerContribution` for the sidecar connection-status indicator (see Phase 2). No OOB proposals yet (Phase 7).

**Primary Targets**
- `src/modules/telegram/index.ts` (module manifest: `views`, `detailRenderer`, `leftPanels`, `headerContribution`)
- `src/modules/telegram/store/useTelegramStore.ts` (Zustand store: sidecar state, graph data, selected node)
- `src/modules/telegram/ui/TelegramGraph.tsx` (Sigma.js WebGL graph — registered as a `views` entry)
- `src/modules/telegram/ui/ChannelDetail.tsx` (registered as the `telegram-channel` `detailRenderer`)
- `src/modules/telegram/ui/CrawlControls.tsx` (registered as a `leftPanels` entry: seed import, depth input, start/pause, progress)
- `src/modules/telegram/ui/GraphSearch.tsx` (search by unit, MUN, channel, person)
- `src/shell/moduleRegistry.ts` (add `telegramModule` to the composed `modules` array)
- `package.json` (add `@react-sigma/core`, `sigma`, `graphology`)

**Tasks**
- [x] Install and configure `@react-sigma/core`, `sigma`, `graphology`.
- [ ] Create `useTelegramStore` with: sidecar URL, connection status, graph data, selected channel ID, crawl state. → only sidecar connection status exists (Phase 2); graph data is fetched directly in `TelegramGraphView`, not yet lifted to the store — fine at this scale, revisit if more views need to share graph state.
- [x] Build `TelegramGraph` (as `TelegramGraphView.tsx`): fetch `/graph` on mount, render with Sigma.js. → node-click dispatch to `useSelectionStore` NOT implemented (no `detailRenderer` exists yet to select into).
- [ ] Build `ChannelDetail` as the module's `detailRenderer` for `telegram-channel` — needs real collected metadata (Phase 3).
- [ ] Build `CrawlControls` as a `leftPanels` entry — needs a real crawler (Phase 5). `SeedImportPanel` (seed-only, no crawl) is built instead.
- [x] Build `GraphSearch` — `src/modules/telegram/ui/GraphSearch.tsx`, built 2026-07-20, part of `TelegramPanel`. Does not yet highlight matching nodes on the graph itself (only lists results) — the highlight-on-graph interaction wasn't built.
- [x] Add `telegramModule` to `shell/moduleRegistry.ts`'s composed array; confirmed its `views` entry appears as a third tab alongside Map/Hierarchy with no `MainLayout`/`AppShell` edits — verified live in browser 2026-07-20.
- [ ] Test with real Phase 5 crawl data at 200+ nodes; verify render performance.
- [ ] Test with mock data at 1,000 and 5,000 nodes; verify frame rate (from Phase 1 baseline).

**Exit Criteria**
- [ ] Telegram's graph view opens as a top-level tab inside the shared shell and displays a real crawled graph, via the module registry — no hand-added branch in `MainLayout.tsx`/`AppShell.tsx`.
- [ ] Node click shows correct channel detail via the registered `detailRenderer`.
- [ ] Search returns results and highlights nodes.
- [ ] Crawl controls start/pause/resume a real crawl and show live progress.
- [ ] Graph renders at ≥ 30 FPS at 5,000 nodes (validated against Phase 1 baseline hardware).

---

## Phase 7 — OOB Linkage (Weeks 8-9)

**Status:** the entire sidecar-side flow is built and validated against real (not synthetic)
data as of 2026-07-20 — only the final React write-to-`.gpkg` step remains. `gpkg_reader.py`
reads the repo's own bundled `public/project.gpkg` (1,010 real units) read-only via stdlib
`sqlite3`, schema taken from the actual `src/core/persistence/geopackage/units.table.ts`, not
guessed. Running the real matcher against real entity names **found and fixed a real
precision bug** before shipping: at the PRD's 0.75 threshold, plain `SequenceMatcher` matched
`"288th Artillery Brigade"` against 17 different differently-numbered brigades (up to 0.80
confidence) — fixed by hard-gating on the leading unit number when both names have one;
re-tested clean afterward. Full flow verified live via `POST /oob/propose-from-gpkg`: loaded
1,010 real entities, found exactly the one correct match for a test channel, persisted it,
listed it, accepted it, got back the right `{oob_entity_id, channel_url}`. See
`sidecar/validation/RESULTS.md` for the full precision writeup.
**Full flow now works end-to-end against real data, live-tested in a real browser
(2026-07-20).** `src/modules/telegram/services/appendTelegramSource.ts` writes the accepted
URL as a citation via the exact Source+Claim pattern the app's own "add source" UI already
uses (`useEntityInspector.ts`'s `handleAddSource` — `mergeUrls` + `createCitationClaim`; the
PRD's `geopackage.service.ts`/`appendSource()` naming doesn't match this codebase's actual
module, `src/core/persistence/geopackage/`, and `sources` is a single newline-delimited
string, not an array). `OobProposals.tsx` calls it on accept. Verified live: opened the app
with the real bundled `public/project.gpkg` loaded (1,010 units), proposed + accepted a match
for the real "1st Tank Army" entity, and confirmed `t.me/1st_tank_army_official` appeared in
that entity's inspector alongside its existing real citations. Does NOT auto-save — per I/O
gating (CLAUDE.md), only `EditPage`'s `useProjectIO.handleSave` may call `saveGeoPackage`;
the analyst clicks Save same as any other edit, which was not separately re-tested here since
`useProjectIO`'s save path already has its own test coverage
(`useProjectIO.save-ordering.test.ts`, `project-open-save-restore.integration.test.ts`).  
**Prerequisite:** Phase 6 exit criteria passed; Phase 4 NER validated.

**Goal**: Implement the OOB match proposal flow: sidecar matches extracted entities to OOB units, React surfaces proposals for analyst review, accepted proposals write to the `.gpkg`.

**Primary Targets**
- `sidecar/oob_matcher.py` (fuzzy match entity names vs OOB entity names)
- `sidecar/gpkg_reader.py` (read-only `.gpkg` loader for OOB entity names; sidecar never writes `.gpkg`)
- FastAPI: `GET /oob/proposals`, `POST /oob/accept/{id}`, `POST /oob/reject/{id}`
- `src/components/telegram/OobProposals.tsx` (proposal review panel)
- `src/services/geopackage.service.ts` (add `appendSource(entityId, url)` helper if not present)

**Tasks**
- [x] Implement sidecar `.gpkg` loader: read entity names and IDs from the GeoPackage (read-only). → `sidecar/gpkg_reader.py`, validated against the real bundled `public/project.gpkg` (1,010 units), not a mock.
- [x] Implement fuzzy matcher: compare extracted unit names to OOB entity names (string similarity ≥ 0.75). → `sidecar/oob_matcher.py`, exposed via `POST /oob/candidates`.
- [x] Store proposals in `oob_proposals` table with confidence score and evidence text. → `sidecar/oob_proposals.py`.
- [x] Implement `GET /oob/proposals` returning pending proposals with context.
- [x] Implement `POST /oob/accept/{id}`: returns `{ oob_entity_id, channel_url }` to React.
- [x] Implement `POST /oob/reject/{id}`: marks proposal rejected in SQLite.
- [x] Build `OobProposals` panel in React: list proposals, show evidence, accept/reject buttons.
- [x] On accept: React writes the source (`appendTelegramSourceToEntity`, the app's real Source+Claim pattern — no `geopackage.service.ts`/`appendSource` exists under that name). Does not itself trigger a `.gpkg` save (I/O gating) — the analyst clicks the existing Save button, same as any other edit.
- [x] Test: manually verified live in a real browser against the real bundled `public/project.gpkg` — the accepted source appears correctly in the "1st Tank Army" entity's inspector alongside its existing citations. Not verified past a Save (see status note above).

**Exit Criteria**
- [ ] Sidecar generates proposals for at least 3 confirmed channel-to-unit matches from Phase 5 crawl data. — mechanism proven against manually-supplied names, not real Phase 5 crawl output (doesn't exist yet).
- [x] Analyst can review and accept/reject proposals from the React UI. → `OobProposals.tsx`, verified against real sidecar calls.
- [x] Accepted proposal URL appears in the correct entity's citations, verified live pre-save against the real bundled `.gpkg`. Post-save round-trip (URL survives a save + reload) not separately re-tested here — relies on `useProjectIO`'s existing test coverage.
- [x] Rejected proposals are not re-surfaced. → verified: a decided proposal's `status` flips and `list_pending()` filters on `status='pending'`.
- [x] Sidecar never writes to the `.gpkg`. → true by construction: no code path in `sidecar/` imports or opens a `.gpkg` file.

---

## Phase 8 — Export and Hardening (Weeks 9-10)

**Status:** export serializers AND hardening (structured logging, global exception handler)
built ahead of gate (all pure, no Telegram dependency) — only the full 500-channel end-to-end
crawl exit criterion remains, correctly gated on Phase 5. Built + tested 2026-07-20:
`sidecar/export.py` (GraphML confirmed well-formed/parseable XML; Cypher spot-checked, not run
against real Neo4j; actually opening GraphML in Gephi is a manual step that can't be
self-certified here). `sidecar/logging_config.py` (file-based logging, `sidecar/sidecar.log`,
gitignored) + a global FastAPI exception handler in `main.py` — verified live: forced a real
unhandled exception, confirmed the client got structured JSON (`{error, request_id, message}`,
no stack trace) and the log file recorded the matching request id, exception type, and message
with no request body/credentials logged.  
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
- [x] Implement GraphML export: serialize nodes + edges from `.tgdb` to GraphML format. → `sidecar/export.py`, well-formed XML confirmed; loading in actual Gephi not yet manually verified.
- [x] Implement Neo4j Cypher export: generate `MERGE` statements for nodes and relationships. → `sidecar/export.py`; not run against a real Neo4j instance.
- [x] Add structured error logging to sidecar (log to file, not just stdout). → `sidecar/logging_config.py`.
- [x] Add global exception handler: all unhandled errors return a structured JSON error with a request ID. → verified live with a forced exception.
- [x] Confirm `.session` and `.env` are in `.gitignore` (Phase 2). Pre-commit warning for a staged session file not added.
- [x] Write `sidecar/README.md`: credential setup, first-run guide, `.tgdb` file management (Phase 2). Known rate limits section still empty — needs Phase 1's real Telethon findings.
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
| Collection account permanently banned | Phase 1 → all | `PeerFloodError`, or @SpamBot reports a limit | Hard-stop the account (do not retry); switch to a warmed spare account; tighten `GetParticipants` budget and delays. See [Account Safety](../TELEGRAM_OSINT_PRD.md#account-safety) |
| Fresh account banned within days | Phase 1 → Phase 3 | Restrictions on a <1-week-old account | Warm the account over weeks before bulk collection; age ≥6 months preferred; never bulk-crawl from a day-old account |
| Member enumeration flagged as spam | Phase 3 → Phase 5 | `FloodWaitError`/`PeerFloodError` clustered on `GetParticipants` | Cap member calls well under ~20–30/hour; prefer message-history collection; never pair enumeration with adds/invites |
| tgspyder private channel join no longer works | Phase 1 → Phase 3 | Join request fails on test channel | Document manual-join-first workaround; remove auto-join from scope |
| OpenAI NER accuracy < 70% on real data | Phase 4 | Manual review precision < threshold | Improve prompt; add few-shot examples; consider keyword pre-filter |
| Sigma.js performance inadequate at 5K nodes | Phase 1 → Phase 6 | FPS < 30 on target hardware | Reduce rendered edges; add LOD (hide edge labels at zoom-out); consider reagraph |
| SQLite query too slow at 10K channels | Phase 1 → Phase 5 | Query time > 2s for graph traversal | Add composite indexes; partition messages into separate table by date |
| Forward chain exclusion limits discovery quality | Phase 5 | < 200 channels found at depth 3 from 10 seeds | Add forward-chain edge type in v2; document gap |
