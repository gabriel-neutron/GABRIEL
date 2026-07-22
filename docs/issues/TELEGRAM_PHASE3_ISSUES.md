# Telegram OSINT — Phase 3→5 Issue Timeline

AFK-ready issue breakdown for implementing real Telegram crawling (collector → expander →
crawler wiring), sliced as tracer bullets. Derived from
`gabriel-telegram-phase3-collector-handoff.md` and an adversarial critique pass
(validation-first / architecture-seams / account-safety lenses), 2026-07-22.

**Ordering principle:** reach real Telegram data through *product code* as early as possible
(slice 1), settle open validation questions before building on them (slice 0), and never let
the most ban-dangerous operations onto the automated critical path. Each slice is
independently verifiable.

**Legend:** `AFK` = implementable + mergeable without human interaction · `HITL` = requires a
human (live ban-risk API run or a design/go-no-go decision). Slices are listed in dependency
order; do blockers first.

---

## 0 — Live validation spike: settle member visibility + first rate number

**Type:** HITL (no product code)

### What to build

Run the two already-written-but-unrun validation scripts against the live production Telethon
session, and record the results. `01c_participant_visibility.py` settles the open question of
whether a *non-member* `get_participants` yields real members or only admins — a result that
determines whether the member-overlap signal is buildable at all. A separate metered
rate-limit burst on a single channel records a first real data point for where `FloodWaitError`
begins (no throwaway account exists, so this is the only measured number the governor can be
tuned from). Reconfirm the previously-recorded channel/message/participant object shapes still
hold against the current Telethon version.

No product code changes. The output is recorded findings that gate slices 1, 3, and 4.

### Acceptance criteria

- [ ] `01c_participant_visibility.py` run on the live session; result recorded: non-member `get_participants` returns { real members | admins-only }
- [ ] Member-overlap go/no-go decision documented (drives whether slice 4 is built or dropped)
- [ ] Rate-limit burst run on one channel; first FloodWait onset / calls-before-throttle number recorded
- [ ] Known shape landmines reconfirmed: `participants_count` is `None` from `get_entity` (needs `GetFullChannelRequest`); `get_participants` raises `ChatAdminRequiredError` on broadcast channels
- [ ] Findings written to the validation results file so downstream slices cite measured numbers, not guesses

### Blocked by

- None — can start immediately.

---

## 1 — First live single-channel collect through the ChannelSource seam

**Type:** AFK build + HITL accept

### What to build

The first product code that fetches real Telegram data, delivered as a single tracer bullet
that reaches the analyst's existing graph view.

Introduce a domain-typed **`ChannelSource` seam** — a narrow protocol of the operations the
collector needs, each returning plain dataclasses/records, *not* Telethon objects. The real
adapter is the **only** module that imports Telethon RPCs; it wraps `get_entity` +
`GetFullChannelRequest` (for the member count `get_entity` returns as `None`) + one page of
message history. A fake adapter returns canned records so unit tests assert against domain
records, never emulated Telethon shapes. Demote the public raw-client accessor so the adapter
is the single path to Telegram.

Pin the **identity contract**: `channels.id` **is** the Telegram peer ID. Seed rows currently
carry surrogate autoincrement rowids, which collide with the real peer IDs the crawler traffics
in — reconcile by storing seeds username-keyed (no fake `id`) until resolved on collection.

Persist **raw JSON as the authoritative sink**; typed columns are a provisional projection to
be promoted only after real shapes are confirmed. Add `UNIQUE(channel_id, message_id)` so
re-collection is idempotent.

Route every Telegram call through a **minimal non-bypassable choke**: a fixed jittered
inter-call delay, the existing `FloodWaitError`/`PeerFloodError` hard-stop, and an
extra-conservative cold-start cap on the first-ever live calls. (The full tunable governor is
slice 3.) Expose `POST /collect/{channel_id}`.

> Seam shape (from critique — mirrors the existing `expand_channel` injection precedent):
> the adapter exposes `fetch_channel_metadata(ref) -> ChannelMeta` and
> `fetch_recent_messages(ref, limit) -> list[MessageRecord]` returning plain records; the
> choke sits *innermost*, wrapped by the reactive retry: `with_flood_wait_retry(governed(rpc))`,
> so each physical retry also spends a budget token.

### Acceptance criteria

- [ ] `channels.id` equals the Telegram peer ID; a seed and its later-discovered self do not produce duplicate rows
- [ ] Only the `ChannelSource` adapter imports Telethon; no other module can reach the raw client
- [ ] Collector maps a real channel into `raw_json` + provisional typed columns; re-running `/collect` on the same channel adds no duplicate messages
- [ ] Unit tests run against the fake adapter and cover the `None` member-count and broadcast-channel branches
- [ ] Every Telegram call passes through the choke; the cold-start cap cannot be disabled or raised by config
- [ ] No send/join/invite call exists anywhere in the collect path (read-only boundary intact)
- [ ] Collected message text and any stored identities are covered by a documented per-investigation archival/deletion expectation (PII acceptance)
- [ ] **HITL:** `/collect` against one real seed channel enriches its node on the existing graph view (real title, member count, messages), verified in a browser

### Blocked by

- Slice 0 (member/shape/cold-start findings).

---

## 2 — `resolve_username` seam + `expand_channel` expander

**Type:** AFK

### What to build

Turn a collected channel into a list of neighbor channel IDs the crawler can enqueue. Run the
already-built `edges.py` extractors (linked-channel `t.me/` parsing + keyword-mention matching)
on the **real** description/message text collector wrote in slice 1.

Username→ID resolution is its own governed Telegram RPC, not a free sub-step of text parsing:
add a **`resolve_username(str) -> int | None` seam**, injected and faked like `ChannelSource`,
routed through the same choke. `expand_channel(id) -> list[int]` becomes a thin composition:
collected text → `edges` extract → resolve → identity-upsert (per slice 1's contract, creating
username-keyed placeholder rows for not-yet-collected neighbors) → return resolved peer IDs.
Unresolvable usernames (private/renamed/nonexistent) are dropped from the returned IDs and
logged.

### Acceptance criteria

- [ ] `expand_channel` returns real Telegram peer IDs for resolvable neighbors of a collected channel
- [ ] Username resolution goes through its own governed seam; unresolvable usernames are dropped, not enqueued as garbage
- [ ] Discovered-but-uncollected neighbors are upserted as placeholder rows consistent with the identity contract (no duplicate/ID-space collisions)
- [ ] Unit tests exercise the expander against a fake resolver + real collected rows from slice 1
- [ ] `expand_channel` provably issues **no** member-enumeration call

### Blocked by

- Slice 1.

---

## 3 — Hardened rate governor

**Type:** AFK

### What to build

Promote slice 1's minimal choke into the full non-bypassable governor the owner requires — the
one thing that must never be disabled by mistake, even if it slows the app. It stays the single
choke-point inside the `ChannelSource` adapter (there is no other path to Telegram).

Enforce, with numbers seeded from slice 0's measurement and conservative until then:

- Min inter-call delay + jitter on every call (never a tight loop).
- Per-call-type hourly ceilings (metadata / history / participants), a global hourly ceiling so
  per-type caps can't sum into a spike, and a rolling 24h daily cap.
- Warm-up ramp: start at a fraction of the ceilings, scale over days.
- Post-`FloodWait` cooldown: halve the effective budget and lengthen delays for a window; auto-tighten if FloodWait fires more than ~once/hour.
- **Persistent, cross-restart budget ledger** in SQLite, reloaded on boot — a restart (incl. `uvicorn --reload`) must not reset the hourly/daily counters.
- **Process-wide kill-switch latch**: one flag halts all outbound Telegram calls and refuses new ones; tripped manually and automatically on `PeerFloodError`.
- **@SpamBot preflight probe**: a callable health check run before any crawl and after any FloodWait.
- **Per-run call-count ceiling**: a single crawl run auto-pauses for human confirmation after K calls.

Config may only *tighten* these; coded ceilings are hard floors (`effective = min(config, ceiling)`).

### Acceptance criteria

- [ ] Governor enforces per-type + global + daily ceilings; config cannot raise any past the coded floor
- [ ] Budget ledger persists across a sidecar restart (counters are not reset by `--reload`)
- [ ] `PeerFloodError` trips a process-wide kill-switch that blocks all subsequent Telegram calls until manually cleared
- [ ] A `FloodWaitError` triggers automatic cooldown (reduced budget + longer delays); repeated FloodWaits auto-tighten
- [ ] @SpamBot status is checkable and is invoked as a preflight before crawl runs
- [ ] Per-run ceiling auto-pauses a run after K calls
- [ ] Unit tests (fake clock) prove throttling, floor-enforcement, ledger persistence, and kill-switch latch

### Blocked by

- Slice 0 (measured numbers), Slice 1 (the choke-point + seam it hardens).

---

## 4 — Gated member enumeration *(conditional — built only if slice 0 says members are visible)*

**Type:** AFK

### What to build

**Conditional slice.** If slice 0's `01c` result is *admins-only*, **do not build this** —
drop it, remove the member-overlap edge from scope, and document the gap (as the risk register
already contemplates for other unbuildable signals). Build the rest of this only if real members
are visible to a non-member.

If built: member enumeration is the highest ban-risk operation, so it lives entirely off the
automated crawl path. Add an **opt-in** endpoint (`POST /collect/{id}/members`), **off by
default**, as a `fetch_participants` method on the same `ChannelSource` protocol, routed through
the governor with its own **tighter** per-operation budget (well under ~20–30/hr). Hard-stop
(no retry) on `PeerFloodError`. Never paired with any add/invite. Default to **non-identifying
storage** — store only the aggregate/overlap needed for edges, not raw member identities, unless
explicitly opted in.

### Acceptance criteria

- [ ] If slice 0 = admins-only: slice not built; member-overlap edge removed from scope; gap documented
- [ ] If built: member enumeration is reachable only via the opt-in endpoint, never from any `/crawl/*` path
- [ ] Enumeration uses a dedicated tight budget in the governor; `PeerFloodError` hard-stops with zero retries
- [ ] Raw member identities are not stored by default (non-identifying aggregate only) unless explicitly opted in
- [ ] Unit tests cover the tight budget and the `PeerFloodError` hard-stop path

### Blocked by

- Slice 0 (go/no-go), Slice 1 (seam).

---

## 5 — Wire `expand_channel` into the crawler + `/crawl/*` endpoints

**Type:** AFK

### What to build

Feed slice 2's real `expand_channel` into the already-built-and-tested `crawler.py::run_crawl`,
and expose the crawl controls: `POST /crawl/start`, `POST /crawl/pause`, `POST /crawl/resume`,
`GET /crawl/status`. Make the BFS FloodWait-aware: pause frontier expansion during a wait,
resume after, without losing state (the pause/resume persistence already exists).

**Hard invariant, enforced structurally (not by comment):** the crawler's `expand_channel`
callback issues **zero** member-enumeration calls — BFS discovery relies only on linked-channel
and keyword-mention signals. The expander module must not be able to import the participants
function. The actual *unleashing* of a real crawl is gated on the hardened governor (slice 3)
and the canary (slice 6).

### Acceptance criteria

- [ ] `/crawl/start|pause|resume` and `/crawl/status` drive `run_crawl` with the real expander
- [ ] Pausing then resuming continues from the correct persisted frontier (identical result to an uninterrupted run)
- [ ] A `FloodWaitError` mid-crawl pauses expansion and resumes without losing state
- [ ] The crawl path provably issues no `GetParticipants` call — enforced so the expander cannot import the participants function
- [ ] Every expansion step routes through the governor

### Blocked by

- Slice 2. (Real-crawl *unleashing* additionally gated on Slice 3 + Slice 6.)

---

## 6 — Canary crawl: authorize the full run

**Type:** HITL

### What to build

A small, human-supervised live crawl that must come back clean before the full crawl is
authorized. Run from 1–3 seeds at depth 1 with the governor in cold-start/warm-up mode, watching
@SpamBot status and FloodWait frequency throughout. This gates slice 8: the code for the full
crawl exists earlier, but pointing it at 18 seeds / depth 3 is authorized only on a clean canary.

### Acceptance criteria

- [ ] Canary crawl (1–3 seeds, depth 1) completes with @SpamBot clean before and after
- [ ] FloodWait frequency observed < ~1/hr; zero `PeerFloodError`
- [ ] Discovered channels are collected and appear on the graph view
- [ ] Go/no-go for the full crawl (slice 8) recorded; governor numbers tightened if the canary showed pressure

### Blocked by

- Slice 3 (hardened governor), Slice 5 (crawl wiring).

---

## 7 — WebSocket crawl progress + live graph

**Type:** AFK

### What to build

Stream crawl progress to the browser: `WS /ws/crawl` emitting node/edge/frontier counts, and
have the existing Sigma graph view reflect newly discovered nodes as the crawl runs. Polish on
top of a working crawl.

### Acceptance criteria

- [ ] `WS /ws/crawl` streams node/edge counts and current frontier size in real time
- [ ] The graph view shows newly discovered nodes appearing during a live crawl
- [ ] Disconnect/reconnect of the WebSocket does not crash the crawl or the UI

### Blocked by

- Slice 5.

---

## 8 — Full 18-seed depth-3 crawl + shape/PII validation

**Type:** HITL

### What to build

The culmination: run a full crawl from the 18 real seed channels to depth 3, now that every
piece has been live-validated incrementally. Confirm collected data shape matches the schema and
resolve any deviations, measure real message volume and adjust `N` if needed, and confirm the
PII/archival handling holds at volume.

### Acceptance criteria

- [ ] Full crawl from 18 seeds reaches a meaningful discovered-channel count (target ≥ 200 @ depth 3; document if the real graph is sparser)
- [ ] Collected data shape confirmed against the schema; any deviations documented and resolved (typed columns promoted from `raw_json` as warranted)
- [ ] Real message volume per channel measured; `N` tuned
- [ ] No credentials in logs; per-investigation archival/deletion expectation holds at volume
- [ ] Governor held: no `PeerFloodError`; FloodWait handled without state loss across the full run

### Blocked by

- Slice 6 (clean canary).
