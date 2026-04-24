# Results & Insights Overview (from `public/project.gpkg`)

## Dataset Scope at a Glance
- Source file analyzed: `public/project.gpkg`.
- Core project tables present:
  - `layers` (15 rows),
  - `units` (1010 rows),
  - `geometries` (286 rows),
  - `research_sources` (5 rows),
  - plus standard GeoPackage metadata tables/views.
- Mapped domain scope:
  - Military entities are modeled as a hierarchy with spatial linkage where available.
  - Practical granularity reaches low tactical levels (down to squad/team labels in a minority of records).

## Entity Types and Hierarchical Structure
- Hierarchy representation:
  - `parent_id` creates explicit chain-of-command structure.
  - Observed: 11 root entities and 999 child entities (deep, nested structure).
- Echelon labels observed in data include:
  - `Army`, `Division`, `Brigade`, `Regiment/group`, `Battalion/squadron`,
  - `Company/battery/troop`, `Platoon/detachment`,
  - `Command`, `Region/Theater`, `Squad`, `Team/Crew`.
- Approximate structural pattern (inferred from schema + counts):
  - Many entities concentrated at regiment/group and battalion/squadron levels,
  - with fewer top-level formations (army/division), consistent with a top-down ORBAT decomposition.

## Spatial Content
- Geometry rows: 286.
- Geometry type distribution in current file:
  - `point`: 286
  - `line`: 0 observed
  - `polygon`: 0 observed
- Linked spatial coverage:
  - All recorded geometries appear linked to entities (`entity_id` populated in 286 rows).
- Additional spatial reference fields in units:
  - `osm_relation_id` populated for 148 entities (relation-level geospatial anchoring available for subset).

## Layering and Organization
- Layer rows: 15 total.
- Layer kind distribution:
  - `echelon`: 14
  - `osm`: 1
  - `custom`: 0 in this packaged sample
- Interpretation:
  - Dataset is structured primarily by military echelon categories, with one OSM overlay/context layer cached in-project.

## Attribute Coverage and Data Completeness Signals
- `affiliation`:
  - 1010/1010 marked `Hostile` (single-side operational framing in this file).
- `domain`:
  - `Ground`: 651,
  - `Air`: 2,
  - `Space`: 1,
  - null/unspecified: 356.
- Other key fields populated:
  - `military_unit_id`: 551 entities,
  - `sources`: 268 entities,
  - `notes`: 134 entities,
  - `is_exact_position = 1`: 152 entities.
- Interpretation:
  - Coverage is heterogeneous by field: hierarchy/name representation is dense, while sourcing/notes/exact-position metadata is partial and likely iterative.

## Source and Workflow Patterns (inferred, non-speculative)
- Evidence capture pattern in schema:
  - Entity-level `sources` is free-form newline-delimited citations.
  - Separate `research_sources` table stores cached URL snippets for reuse.
- Repeated workflow pattern implied by app logic:
  - Breadth-first (parent-first) enrichment/research,
  - skip entities already "rich" in evidence,
  - queue unresolved entities for human review,
  - apply only accepted proposals.
- Manual vs repeated process split:
  - Manual: final adjudication, hierarchy modeling, geometry editing.
  - Repeated/automated: batch retrieval, source caching, proposal generation, queue progression.

## Practical Outcome and Operational Scope
- What the project concretely achieves:
  - Consolidates a large, structured ORBAT-style entity graph into a portable local dataset.
  - Couples organizational hierarchy with map positions and selected external geospatial references.
  - Supports ongoing iterative refinement through contributor edits and assisted enrichment.
- Practical scope boundaries visible from dataset/code:
  - Strong on hierarchical order-of-battle representation and point-based geolocation.
  - Not a full combat simulation or dynamic battlefield tracker in current packaged form.
  - Precision and citation density vary by entity, indicating staged completeness rather than uniformly final annotation.

## Storytelling-Oriented Framing Inputs (for script design, not marketing copy)
- Scale anchor:
  - "1000+ entities structured into one hierarchy."
- Depth anchor:
  - "From army-level roots down to battalion/company/platoon and below."
- Spatial anchor:
  - "Hundreds of geolocated military records linked to organizational nodes."
- Workflow anchor:
  - "Human-led curation augmented by repeatable AI-assisted research and source caching."
- Credibility anchor:
  - "Each record can carry sources/notes; enrichment is proposal-based and review-gated."
