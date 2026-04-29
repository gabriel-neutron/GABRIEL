# PRD — Telegram OSINT Graph Module

**Type:** Feature module  
**Target app:** Existing React web application (ORBAT mapping tool)  
**Owner:** [REDACTED]  
**Status:** Scoped v2.0 — April 2026  
**Context:** Law enforcement / intelligence analyst use; private channel access is authorized.

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
- All external tool capabilities must be validated empirically before production integration (see TIMELINE).

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
| tgspyder private channel capabilities unverified | Run isolated test against a known private channel before integrating |
| OpenAI cost at scale | Cache all extractions in SQLite; validate cost per 1K messages before enabling at scale |
| Sigma.js performance at 5K+ nodes | Test with mock data before building crawl pipeline |
| Telegram invite-link join may be patched | Validate tgspyder path; document manual-join fallback |
| `.session` file contains credentials | Never commit; add to `.gitignore`; document in setup guide |

---

## Open Items (Resolve Before Phase 2)

1. Telegram credentials: user must supply `api_id` + `api_hash` from my.telegram.org.
2. Russian military keyword dictionary: needed for rule-based relevance scoring. Build from scratch or import from existing OSINT resource?
3. Which `.gpkg` file does the sidecar load for OOB matching? Needs a configurable path or file-picker integration.
4. Forward chains (not selected for v1): revisit for v2 — they are the strongest signal for Russian military Telegram intelligence.
