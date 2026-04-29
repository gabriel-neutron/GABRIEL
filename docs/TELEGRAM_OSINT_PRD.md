# PRD — Telegram OSINT Graph Module

**Type:** Feature module  
**Target app:** Existing React web application (OOB mapping tool)  
**Owner:** [REDACTED]  
**Status:** Draft v1.0 — April 2026

---

## Goal

Extend an existing React-based order-of-battle mapping application with a self-contained module that collects publicly available Telegram data, discovers related military-relevant channels and actors, and stores the result as a relationship graph linked to an order-of-battle file or dataset, with an AI pipeline that matches discovered entities to existing OOB entries and appends the source to the matched entity's `sources` field where relevant; a local backend is acceptable if it runs on the user's machine.

---

## Problem Statement

Russian military OSINT relies on cross-referencing many Telegram channels, groups, and accounts. Today this is manual: analysts open channels, copy names, and maintain spreadsheets. The main goal is to build a network map of Telegram groups, channels, and actors and link that network to the existing order of battle first; query workflows and advanced requests are a second-stage use case.

---

## Scope

In scope:
- Telegram channel/group discovery from a seed list via API or GitHub scraping tools
- Message and member metadata collection
- Entity extraction from message text (units, persons, locations, equipment, identifiers)
- Military-relevance filtering (AI and rule-based)
- In-browser graph storage and traversal
- Display as an interactive graph view within the existing React app
- Access to private or invite-only

Out of scope:

- Real-time live streaming (batch collection only, v1)
- Integration with external paid data services

---

## Users

Primary: analyst / researcher running the app locally or on a private server.  
No multi-tenant or public-facing requirements for v1.

---

## Functional Requirements

**FR-1 — Seed import**  
The user can import a list of Telegram channel usernames or IDs (CSV or manual entry) as the starting seed set.

**FR-2 — Automated discovery**  
The system does not ingest or merge a large order-of-battle database. The host application is a geospatial tool that can load a GeoPackage, including an existing Russia order-of-battle dataset. This feature adds a new Telegram analysis point of view by building a network from seeded Telegram groups and channels; as a nice-to-have, when a discovered group is clearly associated with an existing OOB entity, its Telegram URL can be added to the `sources` field of that OOB record.

**FR-3 — Collection**  
For each discovered entity, collect the data needed to build the network, especially channel/group metadata, shared users, shared groups, forwarding sources, membership overlap indicators, and messages when available.

**FR-4 — Military relevance filter (dual-mode)**  
Each collected channel and message receives a relevance score using:  
- Rule engine: keyword/regex dictionaries (MUN patterns, rank words, unit designators, weapon system names in Russian/English)  
- Optional AI classifier: a cheap OpenAI model used in batched workflows where needed to classify military / civilian / ambiguous content and support entity-linking decisions

**FR-5 — Entity extraction**  
The database created from telegram data should be searchable via in app search tools and by Ai agents.

**FR-6 — In-browser graph storage**  
All nodes and edges are stored in a .gpkg, please advice user on the kind of format he should use , if possible he would like to add it in the gpkg , please estimate the amount of data this telegram graph will generate and propose an adapted storage solution.

**FR-7 — Graph query interface**  
The analyst can query the graph: find all channels mentioning a given unit, find all accounts affiliated with a given person node, or traverse the forwarding chain between two channels.


---

## Non-Functional Requirements

- Runs entirely in the browser or as a lightweight local Python/Javascript/Typescript sidecar (no cloud services required).
- Collection layer may use official Telegram API credentials (MTProto or Bot API), local scraping tools, or a lightweight local backend provided by the user.

---

## Reference Tools (context for implementation)

| Function | Tool | Notes |
|---|---|---|
| Telegram collection | **Telethon** (Python) | MTProto client; supports messages, members, forwards |
| Group/channel discovery | **telegram-groups-crawler** (edogab33, GitHub) | Graph-first crawler with edge output |
| Analysis helper | **telegram_analyzer** (orSpec, GitHub) | Post-collection stats and activity patterns |
| Geolocalization | **Geogramint** (Alb-310, GitHub) | Nearby-user/group discovery via location |
| OSINT reference lists | **Awesome Telegram OSINT** (ItIsMeCall911, GitHub) | Curated list of Telegram OSINT tools |
| User scrapiing | https://github.com/Darksight-Analytics/tgspyder | Scrappe menber , messages .... |
| Graph analytics (offline) | **Neo4j** + **Neo4j GDS** | For deep analysis; target format for export |
| NER / classification | **spaCy** + transformer model or local LLM | Russian/Ukrainian military vocab support |
| Geocoding | **Nominatim / Photon** | Open-source, self-hostable |
| Translation | **Argos Translate** | Offline, no API key required |
| React integration | Existing app stack (React, TypeScript, Supabase) | Module must expose a composable React component |

---

## Acceptance Criteria

- Given a seed list of 10 known Russian military channels, the system discovers at least 200 related channels with no manual intervention, the goal is to let the dataabse grow until user stop the search or filters stop it due to rate limit or data detected as out of scope.
- At least 80% of channels scoring above threshold are confirmed military-relevant by an analyst.
- The system must support linking newly discovered network entities to the pre-existing OOB database when a confident match exists; scraping messages and attaching message-level evidence is useful but not required as a success criterion for v1.
- The graph is queryable from the React UI (search by unit name, MUN, or channel) and displayable.
