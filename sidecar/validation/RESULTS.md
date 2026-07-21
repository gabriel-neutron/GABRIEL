# Phase 1 Validation Results

## SQLite (aiosqlite) — 2026-07-20

Synthetic `.tgdb`: 1,000 channels, 3M messages, 500K users, 2M edges (PRD medium-scale estimate).

- File size: **663.9 MB** (PRD estimated ~2 GB at this row count including message text —
  consistent; synthetic message text here is short filler, real Russian text will be larger).
- 2-hop graph traversal, **no index**: **12,887.7 ms** — fails the < 2s exit criterion badly.
- Message text `LIKE` search, no FTS index: 0.2 ms (dataset skew — most rows don't match the
  probe keyword, so this isn't a representative FTS benchmark; a real FTS5 virtual table should
  still be used for `GET /search`, not `LIKE`).
- Relevance score sort, no index: 0.3 ms (fine as-is).

**Re-measured 2026-07-20 with indexes applied** (matching `sidecar/db.py`'s real schema:
`idx_edges_from_id`, `idx_edges_to_id`, `idx_messages_channel_id`,
`idx_channels_relevance_score`): 2-hop traversal only dropped from 11.7s to 9.9s — **indexing
alone does not fix this.** `EXPLAIN QUERY PLAN` confirms both self-join legs correctly use
`idx_edges_from_id` (`SEARCH ... USING INDEX`, not a scan) — the index is not the problem.

**Real cause: the PRD's synthetic spec is unrealistically dense.** 1,000 channels / 2,000,000
edges implies an average out-degree of **2,000 edges per channel** (`2M / 1,000`), confirmed by
querying the generated data directly. A 2-hop join at that density necessarily touches ~2,000 ×
2,000 = 4,000,000 intermediate row combinations per query — no index changes that, since the
index only speeds up *finding* each channel's edges, not the combinatorial explosion of joining
two dense fan-outs. A real BFS-discovered channel network has nowhere near this density (a
channel typically links to a handful of others, not thousands) — this benchmark's input shape
does not represent realistic production data.

**Decision:** the < 2s exit criterion is **not meaningfully testable against the PRD's stated
synthetic volume** as specified (1,000 channels / 2M edges) — that data shape doesn't occur in
real BFS crawl output. Indexes stay in `sidecar/db.py` (they're free and correct for the real
access pattern), but re-validate 2-hop traversal performance against a graph with a realistic
degree distribution (e.g. the Sigma.js prototype below settled on ~2 edges/node as
representative) once Phase 5's real crawl output exists, rather than trusting this synthetic
number either way.

## Sigma.js + @react-sigma/core — 2026-07-20

Prototype: `src/modules/telegram/graph/SigmaPerfProbe.tsx` (+ `mockGraph.ts`), exposed as
Storybook stories (`SigmaPerfProbe.stories.tsx`) and measured via a live on-screen FPS
counter, driven headlessly through Playwright at `http://localhost:6006/iframe.html?id=...`.
Hardware: Intel Core Ultra 7 255H, Intel Arc 140T GPU (confirmed WebGL is hardware-accelerated
via ANGLE/D3D11, not software-rendered — ruled out as a headless-browser artifact).

| Node count | Edges (~4× avg degree) | Labels | Idle/interaction FPS |
|---|---|---|---|
| 1,000 | ~2,000 | on | 60 (stable through synthetic wheel-zoom interaction) |
| 5,000 | ~10,000 | on | **~1** (raw `requestAnimationFrame` fires ~3 times in 2.2s) |
| 5,000 | ~10,000 | off (`renderLabels: false`) | **~1** — labels are not the cause |
| 5,000 | ~5,000 (avgDegree=2) | off | **60** — edge count, not node count, is the bottleneck |

**Exit criterion PARTIALLY MET, with a mitigation confirmed**: "Sigma.js renders 5,000 nodes at
acceptable frame rate" — the default mock graph (avgDegree=4, ~10,000 edges) collapses to ~1 FPS
regardless of labels, but halving edge density to ~5,000 edges (avgDegree=2) restores a stable
60 FPS at the same 5,000 node count. So node count is not the limiting factor — **edge count is**.
This matches the PRD's own risk register entry ("Sigma.js performance inadequate at 5K+ nodes",
mitigation: "reduce rendered edges") almost exactly; the first suggested mitigation worked on the
first try. Not re-tested at 10,000 nodes or with a real (non-uniform-random) discovered-channel
edge distribution — a real BFS graph's degree distribution is unlikely to be uniform like this
synthetic one, so re-validate against Phase 5's actual crawl output before trusting this holds.

**Decision:** proceed to Phase 6 planning to render edges below a density/zoom threshold (LOD)
rather than all edges at once, per this result — do not render all discovered edges
unconditionally. `reagraph` fallback not needed based on this data; revisit only if Phase 5's
real graph structure turns out denser than this synthetic test.

## Telethon — test DC connectivity — 2026-07-20

Ran `sidecar/validation/00_test_dc_connectivity.py` against Telegram's public test DC 2
(`149.154.167.40`), using the api_id/api_hash + RSA key from the PRD's Credentials section
(confirmed by the user to be test-DC config, not a real account — safe to run autonomously,
no ban risk, no human phone/code entry needed).

**Result: blocked by this machine's network, not by Telegram or the code.**
- Raw TCP connect to `149.154.167.40:443` succeeds (`Test-NetConnection` confirms).
- The MTProto DH-params handshake never gets a real reply: Telethon raises
  `InvalidBufferError: Invalid response buffer (HTTP code 404)` — something on the network
  path is intercepting the connection and returning a canned HTTP 404 instead of passing
  MTProto bytes through.
- Reproduced identically on port 443 and port 80, and with/without Telethon's
  `ConnectionTcpObfuscated` transport — ruling out both a port-specific and a
  protocol-obfuscation fix.
- Control test: `Invoke-WebRequest https://149.154.167.40/` (direct HTTPS to the same IP,
  no SNI) fails with a TLS-level connection reset. `Invoke-WebRequest https://api.telegram.org`
  (proper HTTPS, real SNI, different endpoint) succeeds with `200`. This isolates the block to
  connections against Telegram's raw MTProto IP specifically, not a wholesale internet block —
  consistent with a corporate proxy / antivirus TLS-inspection layer that can't parse
  non-standard TLS/MTProto framing and falls back to a 404 response.

**Decision:** this is an environment finding, not a Telethon or PRD-architecture problem — do
not conclude Telethon "doesn't work." **validation/01, 02, 03 (real-account scripts) will very
likely hit the same block if run from this same machine/network.**

**Correction, re-tested 2026-07-20 with ProtonVPN fully disconnected**: initially attributed
this to ProtonVPN/NetShield (a VPN adapter was observed `Up` during the first test). That
attribution was **wrong** — confirmed VPN off (`Get-NetAdapter` shows no WireGuard/VPN adapter
up, only Wi-Fi and a WSL virtual adapter), re-ran the exact same script, and got the identical
`InvalidBufferError: HTTP code 404`. Also confirmed: no system HTTP proxy configured
(`netsh winhttp show proxy` → direct access), Windows Defender Network Protection disabled
(`Get-MpPreference` → `EnableNetworkProtection: 0`), standard Windows Firewall on (default
outbound-allow, unlikely to synthesize a crafted 404 response body — that behavior is
characteristic of an active intercepting proxy, not a simple firewall drop). The `api.telegram.org`
vs. raw-IP asymmetry still holds. With every OS-level cause ruled out, the remaining
candidates are the home router or the ISP itself — both outside what this machine can
diagnose further. Whoever runs Phase 1's remaining real-account validation should try a
different network (mobile hotspot, different location) before concluding the account or
credentials are bad — and note a VPN might be the *fix* here, not the cause, if the block is
ISP-level (the opposite of the original hypothesis).

**Superseded 2026-07-21 — the block is test-DC-specific and does NOT affect production.**
`01_telethon_connectivity.py` ran successfully from this same machine and network against
production Telegram: full MTProto login (phone + code), `get_entity`, `get_messages`, and
`get_participants` all worked, 3 API calls, no errors. So the prediction above ("validation/01,
02 will very likely hit the same block") was **wrong**. Whatever intercepts `149.154.167.40`
(test DC 2) does not intercept the production DCs Telethon actually resolves to. No network
change, no VPN, no different location was needed. **Do not spend further time diagnosing this
—** the test DC was only ever a way to check connectivity without a real account; production
access is what matters and it works. Left in place only so the earlier dead end isn't re-run.

## Telethon — basic connectivity (production) — 2026-07-21

Ran `validation/01_telethon_connectivity.py` with a real dedicated account against
`@wagner_group2022` (broadcast channel), then against its linked discussion group
(id `1629354228`, «Комментарии к "Белым дядям"», megagroup). 3 API calls on the second run,
**no `FloodWaitError`** — the per-call rate limit was never approached at this volume, so this
run says nothing about where the throttle actually sits.

**Confirmed data shapes** (the point of this exit criterion):
- Channel entity: `id`, `title`, `username`, `access_hash`, `date`, `broadcast`, `megagroup`,
  `has_link`, `level`, `restriction_reason`, plus ~25 boolean flags. Full field list in the run
  output — the Phase 3 schema should be built from these names, not guessed.
- Message: `id`, `peer_id`, `date`, `message`, `from_id`, `fwd_from`, `reply_to`, `media`,
  `views`, `forwards`, `edit_date`, `grouped_id`, `reactions`. Telethon also attaches private
  `_`-prefixed convenience attrs (`_chat`, `_sender`, …) — **do not persist those**, they are
  client-side objects, not wire data.
- Participant: `id`, `access_hash`, `first_name`, `last_name`, `username`, `phone` (None),
  `premium`, `status`, plus a `participant` sub-object carrying the role
  (`ChannelParticipantAdmin` with `admin_rights`/`rank`, etc.).

**`participants_count` is `None` on the entity from `get_entity`** — for both the channel and
the group. Member count requires a separate `GetFullChannelRequest`. Any Phase 3 schema or
relevance heuristic assuming `get_entity` yields a member count is wrong; budget the extra call.

**`get_participants` fails on broadcast channels with `ChatAdminRequiredError`** — Telegram
hides the member list of broadcast channels from non-admins. This is expected platform behavior,
not a code or account defect. Member enumeration only applies to megagroups. `01_telethon_connectivity.py`
now catches this explicitly instead of crashing. Added `validation/01b_find_linked_group.py` to
resolve a broadcast channel's linked discussion group (via `GetFullChannelRequest.full_chat.linked_chat_id`)
— that linked megagroup is the enumerable, on-topic target, and resolving it at runtime beats
guessing usernames from published OSINT channel lists, which go stale fast (Telegram deletes
OSINT channels without warning).

**OPEN — possible break in the member-overlap signal.** The `limit=10` participants request on
the linked group returned only **5** participants, on a group with 318K+ messages, and the first
was a `ChannelParticipantAdmin`; the entity showed `left: True` (account not a member). This is
consistent with Telegram returning **admins only** to non-members. If confirmed, the PRD's
member-overlap channel-similarity signal cannot be built from non-member enumeration at all —
it would require *joining* every discovered group, a materially worse ban-risk profile than
Account Safety rule 5 assumes. `validation/01c_participant_visibility.py` was written to settle
this (requests 200, breaks results down by participant type). **Run it and record the answer
before any Phase 2 design work depends on member overlap.**

## OOB fuzzy matcher — validated against real project data — 2026-07-20

`sidecar/gpkg_reader.py` built and tested against the repo's own bundled demo file,
`public/project.gpkg` — real, non-synthetic project data (1,010 units), not a mock. Confirms
the `units` table schema assumption (`id`, `name` columns) taken from
`src/core/persistence/geopackage/units.table.ts` is correct against a real file, not guessed.

**Found and fixed a real precision bug in `sidecar/oob_matcher.py`** before it ever shipped:
at the PRD's documented 0.75 confidence threshold, `SequenceMatcher`'s plain character-overlap
ratio produced heavy false-positive noise on real unit names sharing a common suffix but
different unit numbers — e.g. `"288th Artillery Brigade"` pulled in 17 candidates including
`"238th"`, `"236th"`, `"244th"`, `"227th Artillery Brigade"` (all ≥ 0.75). `"96th Recon
Brigade"` matched `"29th CBRN Brigade"` at 0.80. This would have flooded analysts with
near-miss false positives for every common unit-type suffix at the 1,010-entity scale of even
this one demo file.

**Fix**: hard-zero the similarity score when both names have a leading ordinal unit number
(`"288th"`, `"96th"`, `"1st"`, ...) and the numbers differ — the single most distinguishing
token, badly under-weighted by character-overlap ratio alone. Re-tested the same cases after
the fix: every one now returns exactly the correct single match, zero false positives.

**Decision:** the leading-number gate is necessary but not necessarily sufficient — it hasn't
been tested against Cyrillic name variants, unit names without a leading number, or aliases
(the `units` table has an `aliases` JSON column this matcher doesn't consult yet). Revisit
once real Phase 5 crawl output provides realistic Telegram channel name variety.

**Still open for Phase 1 exit:**
- Re-measure 2-hop SQLite traversal with indexes applied (see above).
- Real FTS5 index for message search (not `LIKE`) — needed before Phase 4/5 message volumes.
- Re-run Sigma.js prototype against Phase 5's real (non-synthetic) graph structure once available.
- All Telethon, tgspyder, and OpenAI NER validation tasks — these require a phone-verified
  Telegram account, a private test channel, and manually-sourced Russian message samples that
  only a human operator can provide. See `sidecar/validation/README.md` for the manual run order.
- Account ban-threshold probing (previously `validation/03_ban_threshold_probe.py`) was dropped —
  no second/throwaway account is available, and probing with the real collection account risks
  triggering the restriction it was meant to measure. The Phase 5 BFS delay budget is derived
  from documented community guidance instead; see `docs/TELEGRAM_OSINT_PRD.md#account-safety`.
