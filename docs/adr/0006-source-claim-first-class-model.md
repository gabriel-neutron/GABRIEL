# Provenance becomes first-class Source and Claim records (target, deferred)

The persistent provenance model changes from a flat string to first-class records. Today `MapEntity.sources` is a newline-delimited string of bare URLs, and Authority Weight is computed transiently at enrichment time and never persisted. The target model promotes three concepts into `core/provenance`:

- **`Source`** — an identity-bearing record (URL/handle, domain type, reliability rating), **deduplicated across entities**. A government URL, a Telegram channel, an OpenSanctions record, and an AIS feed are all `Source`s.
- **`Claim`** — a `(entityId, field, value, sourceId, credibility, timestamp)` join. This is where a specific asserted fact links to the specific source that asserts it.
- **Entity rating** — *derived* from an entity's claims, not stored raw.

This ADR records the **decision and the target shape**. It is a Stream-2 epic (E2 in ADR 0005): a GeoPackage schema migration gated by a round-trip test, scheduled after the mechanical reorg. It is **not** implemented by the current refactor.

## Why

Everything the roadmap adds hangs off provenance, and a `\n`-joined URL string cannot bear the weight:

- **ADMIRALTY (NATO STANAG 2511)** rates source *reliability* (A–F) and information *credibility* (1–6). That is fundamentally per-*(source, claim)*, not per-entity — it has nowhere to live on a string of URLs.
- **Cross-module entity resolution** (the essence of a "data-fusion" tool) needs sources to have stable identity so the same real-world source cited two ways resolves to one record. Resolving "same source" and resolving "same entity" are the *same machinery* — hence a sibling `core/identity` concept (E3).
- **The Telegram `.tgdb ↔ .gpkg` bridge** works by writing a channel URL into `sources`; a channel *is* a `Source`. First-class sources make that bridge a typed link instead of a string append.

A single first-class `Source` record is the one change that simultaneously unlocks per-source ADMIRALTY, cross-module identity, and the sidecar bridge — which is why it anchors the roadmap even though it ships later.

## Considered options

- **Keep `sources` as a string, attach ADMIRALTY elsewhere.** Rejected: there is no coherent "elsewhere"; ratings and claims both need source identity.
- **Do it inside the mechanical reorg.** Rejected: it is a schema migration and must round-trip existing `.gpkg` files; it belongs in Stream 2 behind a migration test, per ADR 0005.

## Consequences

- The accept→merge logic currently under `src/services/enrichment/provenance-ledger.ts` is the seed of `core/provenance` and must be reachable by *every* producer of claims (enrichment, Telegram matcher, corporate ETL), not just the enrichment module.
- A `Source` dedup/identity capability and the `core/identity` cross-module resolution capability are recognised as the same machinery and should be designed together.
- Until this lands, `MapEntity.sources` (a string) remains the interim model; the mechanical reorg must not entrench it further (e.g. no new module should hard-code the string format).
