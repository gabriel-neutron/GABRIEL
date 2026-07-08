import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { getDefaultEchelonLayers } from "@/core/persistence/geopackage"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import type { Claim } from "@/core/provenance/claim"
import type { Source } from "@/core/provenance/source"

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
  selectedEntityId: string | null
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
    selectedEntityId: null,
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ProjectActions {
  setProject(p: {
    layers: Layer[]
    entities: MapEntity[]
    drawnGeometries: DrawnGeometry[]
    claims?: Claim[]
    selectedEntityId: string | null
  }): void
  resetProject(): void

  addLayer(layer: Layer): void
  addNewLayer(): void
  renameLayer(layerId: string, name: string): void
  removeLayer(id: string): void
  moveLayer(layerId: string, direction: "up" | "down"): void
  setLayerVisible(id: string, visible: boolean): void

  addEntity(entity: MapEntity): void
  updateEntity(entityId: string, patch: Partial<MapEntity>): void
  deleteEntity(entityId: string): void

  addGeometry(geom: DrawnGeometry): void
  deleteGeometry(geometryId: string): void

  addClaims(claims: Claim[]): void
  removeClaim(claimId: string): void

  setSelectedEntityId(id: string | null): void
  closeDetail(): void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * The single source of truth for what data gets written to disk. `sourceCache`/
 * `sources` live in peripheral stores (ADR 0005/0006) — passed in explicitly rather
 * than read off `ProjectState` so this stays the one place callers assemble a save
 * snapshot from, even though the data now spans multiple stores.
 */
export function selectPersistableSnapshot(
  state: ProjectState,
  sourceCache: Map<string, string>,
  sources: Source[] = [],
) {
  const nonOsmLayerIds = new Set(state.layers.filter((l) => l.osmData == null).map((l) => l.id))
  const entities = state.entities
    .filter((e) => nonOsmLayerIds.has(e.layerId))
    .map((e) => ({ ...e, name: e.name.trim() || "Untitled" }))
  const survivingEntityIds = new Set(entities.map((e) => e.id))
  return {
    layers: state.layers.map((l) => ({ ...l, kind: l.kind ?? (l.osmData != null ? ("osm" as const) : undefined) })),
    entities,
    geometries: state.drawnGeometries.filter((g) => nonOsmLayerIds.has(g.layerId)),
    sourceCache,
    // Only the claims belonging to a surviving (non-OSM) entity are persisted —
    // otherwise an OSM entity filtered out above would leave a dangling claim.entityId.
    claims: state.claims.filter((c) => survivingEntityIds.has(c.entityId)),
    sources,
  }
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    (set, get) => ({
      ...initialState(),

      setProject({ layers, entities, drawnGeometries, claims, selectedEntityId }) {
        set({ layers, entities, drawnGeometries, claims: claims ?? [], selectedEntityId }, false, "setProject")
      },

      resetProject() {
        set(initialState(), false, "resetProject")
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
