import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { Source } from "@/core/provenance/source"
import type { Claim } from "@/core/provenance/claim"
import type { RatingEvent } from "@/core/provenance/ratingEvent"
import type { Relationship } from "@/core/relationship/relationship"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"

/**
 * Thin aliases, not separate shapes: the SQL column-descriptor lists (units.table.ts,
 * layers.table.ts) type themselves directly against the domain types, so these exist
 * only to keep the documented MapEntity/GpkgEntity naming boundary intact at the
 * GeoPackage I/O surface — not to duplicate field lists.
 */
export type GpkgLayer = Layer
export type GpkgEntity = MapEntity
export type GpkgGeometry = DrawnGeometry
export type GpkgSource = Source
export type GpkgClaim = Claim
export type GpkgRatingEvent = RatingEvent
export type GpkgRelationship = Relationship
export type GpkgIntegrityEvent = IntegrityEvent

export interface GeoPackageLoadResult {
  layers: GpkgLayer[]
  /** Both military units and corporate entities (kind-discriminated, ADR 0004 / E1). */
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
  /** URL → cached snippet map loaded from the `research_sources` table. Empty map for older projects. */
  sourceCache: Map<string, string>
  /**
   * First-class provenance records (ADR 0006). `entity.sources` no longer exists (removed
   * in Slice B, E2.6) — these are the sole source of truth for every consumer, derived on
   * every load from the legacy raw `sources` columns (units/organisations) if not already
   * persisted, merged idempotently with whatever was already persisted from a prior save.
   */
  sources: GpkgSource[]
  claims: GpkgClaim[]
  /** Phase 4 (v1.5) append-only audit trail — empty for a pre-Phase-4 project. */
  ratingEvents: GpkgRatingEvent[]
  /**
   * ADR 0011: relationships ARE the hierarchy. For a pre-2B file (no `relationships` table)
   * this is the one-shot migration's output, minted in memory from the legacy `parent_id`
   * column and not written until a deliberate save; thereafter it is what the file carries.
   * `entities[].parentId` is derived from these on every load and is never an input again.
   */
  relationships: GpkgRelationship[]
  /**
   * The durable integrity record: whatever the file already carried, plus anything this load
   * detected that it did not already hold under the same deterministic id.
   */
  integrityEvents: GpkgIntegrityEvent[]
}

export interface ApplyGeoPackageResultState {
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  /**
   * Carried through from the load result unchanged (§7 step 6). `applyGeoPackageResult` is a
   * layer-and-entity function: it neither derives a parent from these nor mints an event into
   * them — both happen in `load.ts`, one storey down, where the entity kinds and the edge set
   * are in the same scope.
   */
  relationships: Relationship[]
  integrityEvents: IntegrityEvent[]
  selectedEntityId: string | null
}
