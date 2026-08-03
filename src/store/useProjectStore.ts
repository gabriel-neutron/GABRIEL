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
import { assignCredibility, confirmCredibility, refuteCredibility, type CredibilityAssessmentResult } from "@/core/provenance/reviewQueue"
import { createRatingEvent } from "@/core/provenance/ratingEvent"
import { useProvenanceStore } from "@/store/useProvenanceStore"

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

      addLayer(layer) {
        set((s) => ({ layers: [...s.layers, layer] }), false, "addLayer")
      },

      addNewLayer() {
        const { layers } = get()
        const names = layers.filter((l) => l.kind === "custom" || l.osmData != null).map((l) => l.name)
        let name = "New layer"
        for (let n = 1; names.includes(name); n++) name = `New layer ${n}`
        const id = crypto.randomUUID()
        set((s) => ({ layers: [...s.layers, { id, name, visible: true, kind: "custom" }] }), false, "addNewLayer")
      },

      renameLayer(layerId, name) {
        const trimmed = name.trim()
        if (!trimmed) return
        // ADR 0012: the vocabulary is authoritative for echelon layers, so a rename here would
        // persist in memory, survive one save and revert on the next load. Unlike removeLayer,
        // `organisation` is deliberately not guarded — Industry's name does round-trip.
        const layer = get().layers.find((l) => l.id === layerId)
        if (layer?.kind === "echelon") return
        set(
          (s) => ({ layers: s.layers.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l)) }),
          false,
          "renameLayer",
        )
      },

      removeLayer(id) {
        const { layers, entities, drawnGeometries, claims, selectedEntityId } = get()
        const layer = layers.find((l) => l.id === id)
        if (layer?.kind === "echelon" || layer?.kind === "organisation") return
        const removedEntityIds = new Set(entities.filter((e) => e.layerId === id).map((e) => e.id))
        set(
          {
            layers: layers.filter((l) => l.id !== id),
            entities: entities.filter((e) => e.layerId !== id),
            drawnGeometries: drawnGeometries.filter((g) => g.layerId !== id),
            claims: claims.filter((c) => !removedEntityIds.has(c.entityId)),
            selectedEntityId: selectedEntityId && removedEntityIds.has(selectedEntityId) ? null : selectedEntityId,
          },
          false,
          "removeLayer",
        )
      },

      moveLayer(layerId, direction) {
        set((s) => {
          const layers = [...s.layers]
          const i = layers.findIndex((l) => l.id === layerId)
          if (i < 0) return s
          if (direction === "up" && i === 0) return s
          if (direction === "down" && i === layers.length - 1) return s
          const j = direction === "up" ? i - 1 : i + 1
          ;[layers[i], layers[j]] = [layers[j], layers[i]]
          return { layers }
        }, false, "moveLayer")
      },

      setLayerVisible(id, visible) {
        set(
          (s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible } : l)) }),
          false,
          "setLayerVisible",
        )
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

      addClaims(claims) {
        set((s) => ({ claims: [...s.claims, ...claims] }), false, "addClaims")
      },

      removeClaim(claimId) {
        set((s) => ({ claims: s.claims.filter((c) => c.id !== claimId) }), false, "removeClaim")
      },

      confirmClaimCredibility(claimId) {
        const before = get().claims.find((c) => c.id === claimId)?.credibility ?? null
        set((s) => ({ claims: confirmCredibility(s.claims, claimId) }), false, "confirmClaimCredibility")
        const after = get().claims.find((c) => c.id === claimId)?.credibility ?? null
        if (after === before) return // ineligible — confirmCredibility left it unchanged, nothing to log
        useProvenanceStore.getState().appendRatingEvent(
          createRatingEvent({
            targetType: "claim",
            targetId: claimId,
            kind: "credibility",
            value: String(after),
            assessor: { kind: "analyst" },
          }),
        )
      },

      refuteClaimCredibility(claimId) {
        const claimExists = get().claims.some((c) => c.id === claimId)
        if (!claimExists) return
        set((s) => ({ claims: refuteCredibility(s.claims, claimId) }), false, "refuteClaimCredibility")
        useProvenanceStore.getState().appendRatingEvent(
          createRatingEvent({
            targetType: "claim",
            targetId: claimId,
            kind: "credibility",
            value: "refuted",
            assessor: { kind: "analyst" },
          }),
        )
      },

      applyCredibilityToClaims(claimIds, result) {
        if (result == null) return
        set((s) => {
          const idSet = new Set(claimIds)
          const targeted = s.claims.filter((c) => idSet.has(c.id))
          if (targeted.length === 0) return s
          const stamped = assignCredibility(targeted, result)
          const stampedById = new Map(stamped.map((c) => [c.id, c]))
          return { claims: s.claims.map((c) => stampedById.get(c.id) ?? c) }
        }, false, "applyCredibilityToClaims")
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
