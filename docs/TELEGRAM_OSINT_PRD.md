contin# PRD — Telegram OSINT Graph Module

**Type:** Feature module  
**Target app:** Existing React web application (ORBAT mapping tool)  
**Owner:** [REDACTED]  
**Status:** Scoped v2.0 — April 2026  
**Context:** Law enforcement / intelligence analyst use; private channel access is authorized.

**Telethon source of truth (for all AI agents and contributors):** use `https://codeberg.org/Lonami/Telethon`. The GitHub mirror is not up to date and must not be treated as canonical.  
**Telethon documentation source of truth:** use `https://docs.telethon.dev/en/stable/` for API and usage references.

---

## Goal

Extend the existing React-based ORBAT mapping application with a self-contained Telegram OSINT module. The module collects publicly available and authorized Telegram data, discovers related military-relevant channels and actors, stores the result as a relationship graph in a dedicated SQLite database, and links discovered entities to the existing order-of-battle GeoPackage when a confident match exists.

---

## Problem Statement

Russian military OSINT relies on cross-referencing many Telegram channels, groups, and accounts. Today this is manual: analysts open channels, copy names, and maintain spreadsheets. The primary goal is to build a network map of Telegram groups, channels, and actors linked to an existing order of battle — not to replace it.

---

## Architecture

```
React App (port 5173)
       │
       │ localhost HTTP / WebSocket
       │
FastAPI sidecar (port 8000)
       │
   Telethon (MTProto)
   tgspyder (private channel scraping)
       │
  Telegram servers
```

The Python sidecar manages all Telegram interaction and the `.tgdb` SQLite file. The React app calls the sidecar REST API for all data reads and writes. The `.gpkg` file continues to be managed exclusively by the browser via the existing `geopackage.service.ts`.

**Startup:** `npm run sidecar` starts FastAPI + uvicorn alongside `npm run dev`.

---

## Scope

### In Scope

- Seed import: CSV upload or manual channel username/ID entry (FR-1)
- Automated BFS discovery crawler with depth limit and manual pause/resume (FR-2)
- Discovery signals: linked channels (t.me/ links), shared admins/members, keyword mentions (FR-2)
- Channel/group metadata collection: name, description, member count, admins, links (FR-3)
- Recent message collection: last 1,000–5,000 messages per channel (FR-3)
- Member list and admin scraping via Telethon + tgspyder for private channels (FR-3)
- Military relevance scoring: rule-based keyword/regex first, OpenAI gpt-4o-mini for ambiguous content (FR-4)
- Entity extraction from message text via OpenAI gpt-4o-mini: units, persons, locations, equipment, MUNs (FR-5)
- Graph storage in a separate `project.tgdb` SQLite file alongside `project.gpkg` (FR-6)
- Interactive Sigma.js (WebGL) network graph view in the React UI (FR-7)
- Graph search: find channels by unit name, MUN, person, keyword (FR-7)
- OOB match proposals: propose + manual confirm before writing channel URL to `.gpkg` `sources` field (FR-2)
- Export: GraphML and Neo4j Cypher statements for external analysis (FR-7)
- Private channel access via invite links and tgspyder (law enforcement authorized context)

### Out of Scope (v1)

- Real-time streaming (batch collection only)
- Forward-chain edge discovery (strongest signal for info-flow hierarchy — recommended for v2)
- Offline LLM (Ollama, spaCy) — OpenAI only in v1
- Bundled Neo4j — export target only, not deployed
- Geolocation via Geogramint
- Full message history beyond 5,000 most recent per channel
- Multi-tenant or public-facing deployment
- Integration with paid external data services
- Automated OOB writes without analyst confirmation

---

## Users

Primary: analyst / researcher running the app locally or on a private machine.  
Context: law enforcement — authorized to access private/invite-only channels.  
No multi-tenant or public-facing requirements for v1.

---

## Functional Requirements

**FR-1 — Seed import**  
The user can import a list of Telegram channel usernames or IDs (CSV or manual entry) as the starting seed set.

**FR-2 — Automated discovery**  
BFS crawler expands the seed set by following: (a) t.me/ links found in channel descriptions and messages, (b) shared admin/member membership overlap, (c) keyword mentions that reference known entity names. Depth limit is user-configurable; the crawl can be paused and resumed at any time. When a discovered channel matches an existing OOB unit (confidence > 0.75), the system creates a match proposal for analyst review; if accepted, the channel URL is written to the unit's `sources` field.

**FR-3 — Collection**  
For each discovered channel/group, collect: full Telethon entity JSON, description, member count, admin list, recent messages (last 1,000–5,000), and linked channel references. Member lists and private channel content are scraped via tgspyder where Telethon alone is insufficient.

**FR-4 — Military relevance filter (dual-mode)**  
Each collected channel receives a relevance score:
- Rule engine: keyword/regex dictionaries for MUN patterns, rank words, unit designators, weapon system names in Russian and English.
- AI classifier: OpenAI gpt-4o-mini for ambiguous channels where rules are inconclusive. Used in batches, not per-message.

**FR-5 — Entity extraction**  
OpenAI gpt-4o-mini processes message batches to extract structured entities: unit names, MUN codes, person names, location names, equipment names. Extracted entities are stored in the `.tgdb` and are searchable from the React UI.

**FR-6 — Storage**  
Graph data is stored in a separate `project.tgdb` SQLite file (not embedded in the `.gpkg`). GeoPackage is not suitable for graph/relational data at this scale; SQLite handles 1,000–10,000 channels with millions of rows without issues. The `.tgdb` is managed exclusively by the FastAPI sidecar; the React app reads it via the sidecar REST API. Neo4j / Gephi export is available for deep analysis outside the app.

**Estimated data volume (medium scale: 5,000 channels):**
- Channels: ~5 MB
- Messages (5K channels × 3K messages × 500 bytes avg): ~7.5 GB (use selective storage; store metadata + summary only for low-relevance channels)
- Members/users: ~500 MB
- Edges: ~100 MB
- **Practical recommendation:** Store full messages only for channels scoring above the relevance threshold. Discard or summarize below-threshold channel messages to stay under ~2 GB total.

**FR-7 — Graph query interface**  
The analyst can: view the network as an interactive Sigma.js WebGL graph, search by unit name / MUN / channel name / person, click a node to see its detail (metadata, extracted entities, matched OOB entry), and traverse edges visually. Export to GraphML or Neo4j Cypher from the panel header.

---

## Non-Functional Requirements

- Runs locally: React app + Python sidecar on the user's machine, no cloud services required.
- Sidecar started with `npm run sidecar`; no Docker required.
- Telegram credentials (`api_id`, `api_hash`, `.session` file) stored locally and never committed to version control.
- OpenAI API key passed via environment variable; sidecar reads from `.env` file.
- `.tgdb` file can be opened alongside any `.gpkg` file; they are independent but linked via OOB match proposals.
- Sidecar must handle Telegram rate limits (FloodWaitError) gracefully and surface errors to the React UI.
- All external tool capabilities must be validated empirically before production integration (see `timelines/TELEGRAM_TIMELINE.md`).

---

## Data Model (SQLite — `.tgdb`)

```sql
-- Nodes
channels (id, username, title, description, member_count, type,
          relevance_score, is_private, collected_at, raw_json)

users (id, username, first_name, last_name, is_bot, collected_at)

messages (id, channel_id, message_id, text, date, view_count)

entities_extracted (id, source_id, source_type, entity_type,
                    value, confidence, oob_entity_id)

-- Edges
edges (id, from_id, to_id, edge_type, weight, collected_at)
-- edge_type: 'LINKED_CHANNEL' | 'SHARED_ADMIN' | 'SHARED_MEMBER' | 'MENTIONS'

-- Crawl state
crawl_sessions (id, started_at, status, depth_limit,
                current_depth, seed_ids)

-- OOB matching
oob_proposals (id, channel_id, oob_entity_id, confidence,
               evidence_text, status, decided_at)
-- status: 'pending' | 'accepted' | 'rejected'
```

---

## FastAPI Sidecar API

```
POST /crawl/start          { seed_ids, depth_limit } → { session_id }
POST /crawl/pause          { session_id }
POST /crawl/resume         { session_id }
GET  /crawl/status         → { status, progress, node_count, edge_count }
WS   /ws/crawl             → real-time progress events

GET  /graph                → { nodes[], edges[] } (Sigma-compatible)
GET  /channels             → paginated channel list + relevance scores
GET  /channel/{id}         → channel detail + messages + extracted entities
GET  /search?q=            → cross-graph search

GET  /oob/proposals        → pending match proposals
POST /oob/accept/{id}      → returns { channel_url } to write to .gpkg
POST /oob/reject/{id}

GET  /export/graphml       → GraphML file download
GET  /export/neo4j         → Cypher statements download
```

---

## Technical Stack

| Layer | Choice | Rationale |
|---|---|---|
| HTTP server | FastAPI + uvicorn | Async, auto-generates OpenAPI docs, WebSocket support |
| Telegram collection | Telethon | MTProto, handles rate limits, members, messages |
| Private channel scraping | tgspyder | Actively maintained (Feb 2026), OSINT-focused |
| Graph database | SQLite (aiosqlite) | Zero install, handles medium scale comfortably |
| NER / classification | OpenAI gpt-4o-mini | Best accuracy for Russian military text, batched |
| Graph visualization | Sigma.js + @react-sigma | WebGL, 100K+ nodes, best TypeScript support |
| Graph data structure | graphology | Required by Sigma.js, full algorithm support |
| Frontend state | useTelegramStore (Zustand) | Separate from useProjectStore |
| OOB proposal UI | Existing EnrichDrawer pattern | Reuse existing proposal/confirm flow |

---

## OOB Linkage Flow

1. After entity extraction, the sidecar computes string similarity between extracted unit names and all OOB entity names (`.gpkg` loaded by the sidecar on startup, read-only).
2. If similarity > 0.75 → create `oob_proposals` record (channel_id, oob_entity_id, confidence, evidence_text).
3. React fetches pending proposals from `/oob/proposals` and displays them in a review panel (same pattern as existing enrichment proposals).
4. Analyst accepts → React writes the channel URL to the `.gpkg` entity's `sources` field via existing `geopackage.service.ts`. The sidecar never writes to the `.gpkg`.

---

## Acceptance Criteria

- Given a seed list of 10 known Russian military channels, the system discovers at least 200 related channels with no manual intervention.
- At least 80% of channels scoring above the relevance threshold are confirmed military-relevant by an analyst.
- Crawl can be paused and resumed without data loss.
- The graph is queryable from the React UI (search by unit name, MUN, or channel name) and renders without lag at 1,000 nodes.
- OOB match proposals can be reviewed and accepted; accepted proposals write the channel URL to the correct `.gpkg` entity `sources` field.
- GraphML export is loadable in Gephi.

---

## Risks and Dependencies

| Risk | Mitigation |
|---|---|
| Telethon rate limits / flood bans | Validate limits empirically before building crawler; implement FloodWaitError backoff |
| **Collection account permanently banned** | See [Account Safety](#account-safety) — this is the highest-likelihood operational risk, not a tuning concern |
| tgspyder private channel capabilities unverified | Run isolated test against a known private channel before integrating |
| OpenAI cost at scale | Cache all extractions in SQLite; validate cost per 1K messages before enabling at scale |
| Sigma.js performance at 5K+ nodes | Test with mock data before building crawl pipeline |
| Telegram invite-link join may be patched | Validate tgspyder path; document manual-join fallback |
| `.session` file contains credentials | Never commit; add to `.gitignore`; document in setup guide |

---

## Account Safety

The sidecar authenticates **as a real Telegram user account** (MTProto via Telethon), not a bot. That account can be
**permanently banned** by Telegram's anti-spam system, which is a distinct and more severe outcome than a `FloodWaitError`.
Treat account survival as a first-class design constraint, not a rate-limit detail. All guidance below is grounded in the
sources listed at the end of this section.

### FloodWait is not a ban

- **`FloodWaitError`** — a *temporary* throttle. Telegram tells you how many seconds to wait (seconds to ~24h); it lifts on
  its own. The crawler must catch it, wait the stated time, and resume. This is expected and survivable.
- **`PeerFloodError`** — a *persistent* account restriction (cannot message non-contacts, etc.). This is a warning shot, not
  a timeout. On `PeerFloodError` the sidecar must **hard-stop the account, not retry**.
- **Full ban / deletion** — permanent. Recovery is unreliable. This is the outcome the rules below exist to prevent.
- Detect account health by messaging **[@SpamBot](https://t.me/SpamBot)**; a limited account also surfaces
  `PeerFloodError` on some peers but not others.

### Hard rules (design-level, non-negotiable)

1. **Dedicated collection account only — never a personal account.** Assume this account *will* eventually be banned and
   design so that is survivable (archive data per-investigation; no dependence on account longevity). Never authenticate
   with a number or identity you care about.
2. **Physical SIM over VoIP/virtual numbers.** VoIP-registered accounts are flagged and banned faster. If a virtual number
   is unavoidable, use a reputable high-verification provider, never a cheap disposable one.
3. **Never combine member enumeration with adds/invites.** Calling `GetParticipants` alongside `AddChatUser` or channel
   invitations is an *immediate* spam signal. Gabriel is read-only collection and must **never add, invite, or message**
   users under any code path — encode this as a hard boundary in `telegram_client.py`, not just a convention.
4. **Age and warm up the account before any bulk collection.** Fresh accounts hit restrictions within days; accounts ~6+
   months old with genuine activity are far more resilient. Before crawling, warm up over weeks with human-like behavior
   (join a few channels, read, gradual scaling) — do not point a day-old account at a 200-channel BFS.
5. **Member-list extraction (`GetParticipants`) is the top ban vector — budget it tightly.** Message/history scraping is
   low-risk and stable; member enumeration is Telegram's #1 spam signal. Keep member calls well under **~20–30
   `GetParticipants` calls/hour** on large groups. Prefer message-history collection wherever the intelligence goal allows.
6. **Jittered, human-scale delays.** Use a randomized base delay (≈1–2s + jitter) between requests; never a tight fixed
   loop. Gradual scaling beats sudden spikes.
7. **One session per account; isolate IPs.** Never share `.session` strings across devices. Use a stable (ideally
   residential) proxy per account; run no more than 2–3 accounts per IP; stagger start times.
8. **Stay current.** Use the latest Telethon and keep the account's linked Telegram Desktop/app updated.

### Ban-avoidance is a Phase 1 exit gate

There is no throwaway account available to empirically probe the account restriction threshold, and the real collection
account must never be risked to find it. The Phase 5 BFS delay budget is instead derived directly from the documented
community guidance in the Hard rules above (member calls well under ~20–30/hour, jittered 1–2s+ base delay). The crawler
must implement automatic `FloodWaitError` backoff plus a `PeerFloodError` hard-stop before any large crawl runs, and treat
the real collection account's first `FloodWaitError`/`PeerFloodError` in production as live signal to tighten the budget
further, not as an isolated validation experiment.

### Sources

- [Telethon FAQ — bans and limitations](https://docs.telethon.dev/en/stable/quick-references/faq.html)
- [Telegram Scraper: What Works and What Gets You Banned (Clura)](https://clura.ai/blog/telegram-scraper)
- [How to Avoid Getting Banned on Telegram (2026 Guide)](https://telegramscraper.shop/blog/how-to-avoid-telegram-ban)
- [Fix Telegram FloodWait Error Fast (Membertel)](https://membertel.com/blog/how-to-fix-telegram-floodwait-error-fast/)

---

## Data Retention (PII)

Collected message text and any stored identities (`users.first_name`/`last_name`/`username`,
message `from_id`) are personal data about real people, not just OSINT signal. Gabriel is
local-first (see project principles) — `project.tgdb` and every `.gpkg` export live only on the
analyst's device, per investigation, never on a shared server. Each investigation's `.tgdb`/
`.gpkg` is expected to be archived or deleted by the analyst once that investigation concludes,
the same way any other case file would be — Gabriel does not implement automatic retention
limits or scheduled deletion (out of scope for v1); the analyst is responsible for their own
per-investigation archival/deletion practice and local legal obligations around PII they collect.

---

## Open Items (Resolve Before Phase 2)

1. Telegram credentials: user must supply `api_id` + `api_hash` from my.telegram.org.
2. Russian military keyword dictionary: needed for rule-based relevance scoring. Build from scratch or import from existing OSINT resource?
3. Which `.gpkg` file does the sidecar load for OOB matching? Needs a configurable path or file-picker integration.
4. Forward chains (not selected for v1): revisit for v2 — they are the strongest signal for Russian military Telegram intelligence.


---

## Credentials

#telegram
app_id=38723789
apps_api_hash=f24b56beee4756ff947f24954710089d
app_name=myapp
test_ip=149.154.167.40:443

-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAyMEdY1aR+sCR3ZSJrtztKTKqigvO/vBfqACJLZtS7QMgCGXJ6XIR
yy7mx66W0/sOFa7/1mAZtEoIokDP3ShoqF4fVNb6XeqgQfaUHd8wJpDWHcR2OFwv
plUUI1PLTktZ9uW2WE23b+ixNwJjJGwBDJPQEQFBE+vfmH0JP503wr5INS1poWg/
j25sIWeYPHYeOrFp/eXaqhISP6G+q2IeTaWTXpwZj4LzXq5YOpk4bYEQ6mvRq7D1
aHWfYmlEGepfaYR8Q0YqvvhYtMte3ITnuSJs171+GDqpdKcSwHnd6FudwGO4pcCO
j4WcDuXc2CTHgH8gFTNhp/Y8/SpDOhvn9QIDAQAB
-----END RSA PUBLIC KEY-----
149.154.167.50:443
-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g
5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO
62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/
+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9
t6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs
5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB
-----END RSA PUBLIC KEY-----
