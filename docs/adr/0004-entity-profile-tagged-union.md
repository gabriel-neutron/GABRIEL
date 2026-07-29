# MapEntity generalises to Entity + a flat typed Profile

**Superseded in part by ADR [0010](0010-first-class-relationships.md)**: relations between Entities become first-class typed edges, so Hierarchy is one derived view (over `subordinate_to` / `corporate_parent`) rather than the core relation and `parentId` becomes derived and non-authoritative; and "G2-strict" is relaxed only far enough to author `vessel`, `person` and `equipment_class` as **field-less** profiles that carry a `kind` and nothing else — field-bearing profiles and the `Entity` field mirror stay deferred, and the flat tagged union below is unchanged.

`MapEntity` (a military unit: echelon, affiliation, NATO symbol, `militaryUnitId`) generalises to a domain-agnostic **`Entity`**: a node that is *sourced, source-rated, geolocated, and hierarchable*. Every `Entity` carries a common core — `id`, a `kind` discriminant, `name`, geometry/position, Provenance Ledger, source rating, `parentId` — plus a type-specific **Profile**. The military unit becomes the **Unit Profile**, the only profile populated today.

The generalisation is done **strictly** ("G2-strict"): the core becomes generic and the Unit Profile is carved out, but **no other profile (vessel, company, person) is authored**. Future profiles are a modelling exercise deferred to the investigation that needs them.

Profiles are a **flat tagged union** — `Entity = EntityCore & UnitProfile` discriminated by `kind`, with all fields at the top level (`entity.echelon`, not `entity.profile.echelon`). They are a typed discriminated union, never an open `attributes: Record<string, unknown>` bag.

## Why

Gabriel v2.0 is a co-deliverable that must be *project-agnostic* — "entities, sources, ratings, and geometries in a single auditable structure" that any team can point at an adjacent accountability domain (corporate, maritime, financial). A military-only `MapEntity` with domain modules bolted on the side fragments that structure and re-implements provenance/rating per module. Generalising at ~15k lines costs far less than at 60k.

The union is **flat** because physical nesting (`entity.profile.echelon`) would break, in a single non-incremental change, three things at once: the column-by-column GeoPackage decode (`columnDescriptor.decodeRow` assigns `decoded[prop]` where `prop` is `keyof T`), the store's shallow-merge `updateEntity` (`{...e, ...patch}`), and ~15 direct field reads in the inspectors. Flat keeps every one of those green.

## Considered options

- **G1 — keep an ORBAT core, bolt on modules.** Rejected: betrays the project-agnostic deliverable; provenance/rating/geometry get re-implemented per domain.
- **G2-large — generalise now and stub vessel/company/person profiles.** Rejected: authoring unbuilt profiles is adding features, and freezes modelling decisions before the investigation informs them.
- **G3 — extract the shared spine, defer type generalisation.** Reasonable, but the team chose to generalise the type now while the codebase is small.
- **Open attribute bag instead of a typed union.** Rejected: breaks strong typing and the column-by-column GeoPackage round-trip.

## Consequences

- Parent/child **Hierarchy is a core property of any Entity**, not a military one (a corporate control chain and a shipowner chain are also trees). `src/utils/orbat.ts` (already generic over `{id, parentId}`) becomes the core Hierarchy index (`hierarchy.ts`); **ORBAT** is redefined as the *military view* of that generic hierarchy.
- Profile-*specific* code (column descriptors, map symbol renderers, enrichment/NER schemas) lives in the profile's **module** and registers into core. The union type stays in `core/entity`; core must not import any one profile's field set — otherwise every future profile leaks into core.
- `Organisation` is revealed to be a second profile already implemented by copy-paste. Collapsing it into `Entity` + a Corporate Profile is the pilot that validates this ADR — but it is a GeoPackage **schema migration** and was sequenced as a deferred, round-trip-tested epic (see ADR 0005), not part of the mechanical reorg. Complete — see the Corporate Profile in `core/entity`.
- The rename `MapEntity → Entity` ships behind a `export type MapEntity = Entity` alias so the ~47 referencing files stay green atomically.
