import { create } from "zustand"
import { devtools, type NamedSet } from "zustand/middleware"
import { getDefaultEchelonLayers } from "@/core/persistence/geopackage"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { Claim } from "@/core/provenance/claim"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import { withContestedParentEvents } from "@/core/integrity/contestedParentEvents"
import type { Relationship } from "@/core/relationship/relationship"
import { activeParentMap, withDerivedParents } from "@/core/relationship/activeParent"
import { mergeEntities as mergeIdentityGraph } from "@/core/identity/merge"
import type { CredibilityAssessmentResult } from "@/core/provenance/reviewQueue"
import { createClaimActions } from "./projectClaimActions"
import { createLayerActions } from "./projectLayerActions"

// The two React-free readers over `ProjectState` live in a sibling module so this file stays
// inside its declared line cap; re-exported here because they are part of the store's public
// surface and nine call sites import `selectPersistableSnapshot` from this path.
export { selectPersistableSnapshot, unacknowledgedIntegrityEvents } from "./projectSnapshot"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ProjectState {
  layers: Layer[]
  /** Both military units and corporate entities (kind-discriminated, ADR 0004 / E1) share this array. */
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  /**
   * Provenance claims (ADR 0006, E2.4) — entity-keyed, so cascade-deleted alongside
   * `drawnGeometries` for the same reason: a dangling `claim.entityId` after entity
   * deletion is the same class of bug atomicity here prevents. `Source` records
   * themselves are NOT entity-keyed and live in the peripheral `useProvenanceStore`.
   */
  claims: Claim[]
  /** The edge set (ADR 0011). Authoritative for `entity.parentId`, which is derived from it. */
  relationships: Relationship[]
  /** Durable integrity findings, persisted alongside the edges rather than surfaced and lost. */
  integrityEvents: IntegrityEvent[]
  selectedEntityId: string | null
  /**
   * Runtime-only secondaryId -> primaryId breadcrumb left by `mergeEntities`, not persisted
   * to the .gpkg. Lets a consumer holding a since-merged-away id (e.g. an in-progress
   * enrichment session keyed by entity id) redirect to the surviving entity.
   */
  entityMergeMap: Record<string, string>
}

const INDUSTRY_LAYER = {
  id: INDUSTRY_LAYER_ID,
  name: "Industry",
  visible: true,
  kind: "organisation" as const,
}

function initialState(): ProjectState {
  return {
    layers: [...getDefaultEchelonLayers(), INDUSTRY_LAYER],
    entities: [],
    drawnGeometries: [],
    claims: [],
    relationships: [],
    integrityEvents: [],
    selectedEntityId: null,
    entityMergeMap: {},
  }
}

/** zustand's own type for a `devtools`-wrapped setter, whose third action-name argument
 *  exists only under that middleware. */
type SetFn = NamedSet<ProjectState & ProjectActions>

/**
 * Private, deliberately: the edge set and the `parentId` derived from it must never be written
 * apart. Every relationship mutation funnels through here, and the ONE `set` writes the edges AND
 * the re-derived entities in a single object literal, so no subscriber can observe them out of
 * step (ADR 0005 atomicity). The derivation runs on `next`, before the `set` — reading it back off
 * the store afterwards would be a second notification and a second answer to one question. Load
 * reaches the same pure derivation through `load.ts`/`applyGeoPackageResult`, one path for both.
 *
 * `rest` exists for the one mutation that rewrites more than the edges: a merge also replaces
 * entities, claims, geometries and the merge map, and emitting those as a second `set` would put
 * merged entities and stale edges one notification apart — exactly what this function prevents.
 * Its `entities`, when given, are what the derivation runs over, since the pre-merge array still
 * holds the record the merge removed.
 *
 * The integrity rows come out of the SAME derivation, in the same `set`: `activeParentMap`
 * decides which children are contested, and a contested child silently loses its parent on
 * screen. Leaving the record to the next load would mean the analyst sees the change now and the
 * ledger learns of it only after a save and a reload — a visible data change with nothing
 * written down, which is what the ledger exists to prevent. The clock is read here because this
 * is the store boundary; everything below it takes `now` injected.
 */
function commitRelationships(
  set: SetFn,
  state: ProjectState,
  next: Relationship[],
  rest?: Partial<ProjectState>,
): void {
  const parents = activeParentMap(next)
  const entities = withDerivedParents(rest?.entities ?? state.entities, parents)
  const integrityEvents = withContestedParentEvents(
    rest?.integrityEvents ?? state.integrityEvents,
    parents.contested,
    next,
    entities,
    new Date().toISOString(),
  )
  set({ ...rest, relationships: next, entities, integrityEvents }, false, "commitRelationships")
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ProjectActions {
  setProject(p: {
    layers: Layer[]
    entities: MapEntity[]
    drawnGeometries: DrawnGeometry[]
    // Required, not optional: an optional record field a call site forgets is a record that
    // silently does not exist, and the defaulted claims member was that hole on the ledger.
    claims: Claim[]
    relationships: Relationship[]
    integrityEvents: IntegrityEvent[]
    selectedEntityId: string | null
  }): void
  resetProject(): void
  /** The single public entry to the edge set. Replaces it wholesale and rewrites every derived
   *  `parentId` in the same notification. Callers mint the edges; the store never invents one. */
  setRelationships(next: Relationship[]): void

  addLayer(layer: Layer): void
  addNewLayer(): void
  renameLayer(layerId: string, name: string): void
  removeLayer(id: string): void
  moveLayer(layerId: string, direction: "up" | "down"): void
  setLayerVisible(id: string, visible: boolean): void

  addEntity(entity: MapEntity): void
  updateEntity(entityId: string, patch: Partial<MapEntity>): void
  deleteEntity(entityId: string): void
  /** Collapse two records for one real-world entity into `primaryId` (ADR 0006, E3). */
  mergeEntities(primaryId: string, secondaryId: string): void

  addGeometry(geom: DrawnGeometry): void
  deleteGeometry(geometryId: string): void

  addClaims(claims: Claim[]): void
  removeClaim(claimId: string): void
  /** ADR 0009: the review-queue Confirm action — the only path to credibility `1`. A no-op if the claim isn't eligible (see `confirmCredibility`). */
  confirmClaimCredibility(claimId: string): void
  /** Phase 6 (v2, exploratory): the review-queue Refute action — records analyst disagreement for the Actor track record (`actorPosterior.ts`) without changing the claim's numeric credibility. */
  refuteClaimCredibility(claimId: string): void
  /**
   * Patches only the claims in `claimIds` with a credibility assessment that resolved
   * after they were already committed — the accept flow (`useEnrichment.ts`'s
   * `applyAcceptedProposals`) commits new claims synchronously and kicks off credibility
   * assessment as a detached (un-awaited) promise; this is that promise's continuation.
   * Looks up claims fresh from current state at call time, not a stale closure, so an
   * intervening edit or deletion can't be clobbered or resurrected. Not meant for
   * synchronous use — call it from a `.then()`, not inline.
   */
  applyCredibilityToClaims(claimIds: string[], result: CredibilityAssessmentResult | null): void

  setSelectedEntityId(id: string | null): void
  closeDetail(): void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    (set, get) => ({
      ...initialState(),
      // Two concerns whose bodies live in siblings so this file stays inside the 300-line cap
      // (`CONSTRAINTS.md:113`). They are spread, not re-declared, so `ProjectActions` below stays
      // the one place the store's whole surface is stated — and a member missing from either
      // creator is a compile error here, not a runtime hole.
      ...createLayerActions(set, get),
      ...createClaimActions(set, get),

      setProject({ layers, entities, drawnGeometries, claims, relationships, integrityEvents, selectedEntityId }) {
        set(
          { layers, entities, drawnGeometries, claims, relationships, integrityEvents, selectedEntityId, entityMergeMap: {} },
          false,
          "setProject",
        )
      },

      resetProject() {
        set(initialState(), false, "resetProject")
      },

      setRelationships(next) {
        commitRelationships(set, get(), next)
      },

      addEntity(entity) {
        set((s) => ({ entities: [...s.entities, entity] }), false, "addEntity")
      },

      updateEntity(entityId, patch) {
        set((s) => {
          const entities = s.entities.map((e) => (e.id === entityId ? { ...e, ...patch } : e))
          const drawnGeometries =
            patch.layerId !== undefined
              ? s.drawnGeometries.map((g) =>
                  g.entityId === entityId ? { ...g, layerId: patch.layerId! } : g,
                )
              : s.drawnGeometries
          return { entities, drawnGeometries }
        }, false, "updateEntity")
      },

      deleteEntity(entityId) {
        set((s) => ({
          entities: s.entities.filter((e) => e.id !== entityId),
          drawnGeometries: s.drawnGeometries.filter((g) => g.entityId !== entityId),
          claims: s.claims.filter((c) => c.entityId !== entityId),
          selectedEntityId: s.selectedEntityId === entityId ? null : s.selectedEntityId,
        }), false, "deleteEntity")
      },

      mergeEntities(primaryId, secondaryId) {
        const s = get()
        // A merge rewrites the edge set, so it goes through `commitRelationships` like every
        // other relationship mutation — its `rest` argument carries the merge's own slices into
        // the same single `set`, so no subscriber can see merged entities against stale edges.
        const { entities, claims, geometries, relationships, integrityEvents } = mergeIdentityGraph(
          { entities: s.entities, claims: s.claims, geometries: s.drawnGeometries, relationships: s.relationships },
          primaryId,
          secondaryId,
          new Date().toISOString(),
        )
        // mergeIdentityGraph is a no-op (returns its input unchanged) when the ids are equal,
        // either is missing, or the kinds differ — only record the remap when the secondary
        // genuinely existed before this call and was removed by it. Checking post-merge
        // absence alone would also match a secondaryId that was already gone (deleted, or
        // never real), wrongly redirecting that id onto primaryId for later consumers.
        const merged = s.entities.some((e) => e.id === secondaryId) && !entities.some((e) => e.id === secondaryId)
        // The primary survives; a selection pointing at the now-gone secondary follows it.
        commitRelationships(set, s, relationships, {
          entities,
          claims,
          drawnGeometries: geometries,
          // Appended, never replaced: a dropped-edge finding is the only trace left of an
          // assertion someone made, so it accumulates alongside the ledger it belongs to.
          integrityEvents: integrityEvents.length === 0
            ? s.integrityEvents
            : [...s.integrityEvents, ...integrityEvents],
          selectedEntityId: s.selectedEntityId === secondaryId ? primaryId : s.selectedEntityId,
          entityMergeMap: merged ? { ...s.entityMergeMap, [secondaryId]: primaryId } : s.entityMergeMap,
        })
      },

      addGeometry(geom) {
        set((s) => ({ drawnGeometries: [...s.drawnGeometries, geom] }), false, "addGeometry")
      },

      deleteGeometry(geometryId) {
        set(
          (s) => ({ drawnGeometries: s.drawnGeometries.filter((g) => g.id !== geometryId) }),
          false,
          "deleteGeometry",
        )
      },

      setSelectedEntityId(id) {
        set({ selectedEntityId: id }, false, "setSelectedEntityId")
      },

      closeDetail() {
        set({ selectedEntityId: null }, false, "closeDetail")
      },
    }),
    { name: "GabrielProjectStore", enabled: import.meta.env.DEV },
  ),
)
