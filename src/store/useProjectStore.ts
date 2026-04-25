import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { getDefaultEchelonLayers } from "@/services/geopackage.service"
import type { Layer, MapEntity, DrawnGeometry, SelectedOsmObject } from "@/types/domain.types"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ProjectState {
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  sourceCache: Map<string, string>
  selectedEntityId: string | null
  selectedOsmObject: SelectedOsmObject
  showNetworks: boolean
  baseMap: BaseMapId
  entityOsmGeometries: Record<string, GeoJSON.FeatureCollection>
  osmUnavailable: boolean
  lastSavedAt: Date | null
}

function initialState(): ProjectState {
  return {
    layers: getDefaultEchelonLayers(),
    entities: [],
    drawnGeometries: [],
    sourceCache: new Map(),
    selectedEntityId: null,
    selectedOsmObject: null,
    showNetworks: false,
    baseMap: "osm",
    entityOsmGeometries: {},
    osmUnavailable: false,
    lastSavedAt: null,
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
    selectedEntityId: string | null
    sourceCache: Map<string, string>
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

  setSelectedEntityId(id: string | null): void
  setSelectedOsmObject(obj: SelectedOsmObject): void
  closeDetail(): void

  setShowNetworks(v: boolean): void
  setBaseMap(id: BaseMapId): void
  setEntityOsmGeometries(
    updater:
      | Record<string, GeoJSON.FeatureCollection>
      | ((prev: Record<string, GeoJSON.FeatureCollection>) => Record<string, GeoJSON.FeatureCollection>),
  ): void
  setOsmUnavailable(v: boolean): void
  mergeSourceCache(additions: { url: string; content: string }[]): void
  setLastSavedAt(date: Date | null): void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    (set, get) => ({
      ...initialState(),

      setProject({ layers, entities, drawnGeometries, selectedEntityId, sourceCache }) {
        set({ layers, entities, drawnGeometries, selectedEntityId, sourceCache }, false, "setProject")
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
        const { layers, entities, drawnGeometries, selectedEntityId } = get()
        const layer = layers.find((l) => l.id === id)
        if (layer?.kind === "echelon") return
        const removedEntityIds = new Set(entities.filter((e) => e.layerId === id).map((e) => e.id))
        set(
          {
            layers: layers.filter((l) => l.id !== id),
            entities: entities.filter((e) => e.layerId !== id),
            drawnGeometries: drawnGeometries.filter((g) => g.layerId !== id),
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

      setSelectedEntityId(id) {
        set({ selectedEntityId: id }, false, "setSelectedEntityId")
      },

      setSelectedOsmObject(obj) {
        set({ selectedOsmObject: obj }, false, "setSelectedOsmObject")
      },

      closeDetail() {
        set({ selectedEntityId: null, selectedOsmObject: null }, false, "closeDetail")
      },

      setShowNetworks(v) {
        set({ showNetworks: v }, false, "setShowNetworks")
      },

      setBaseMap(id) {
        set({ baseMap: id }, false, "setBaseMap")
      },

      setEntityOsmGeometries(updater) {
        if (typeof updater === "function") {
          set((s) => ({ entityOsmGeometries: updater(s.entityOsmGeometries) }), false, "setEntityOsmGeometries")
        } else {
          set({ entityOsmGeometries: updater }, false, "setEntityOsmGeometries")
        }
      },

      setOsmUnavailable(v) {
        set({ osmUnavailable: v }, false, "setOsmUnavailable")
      },

      mergeSourceCache(additions) {
        set((s) => {
          const next = new Map(s.sourceCache)
          for (const { url, content } of additions) next.set(url, content)
          return { sourceCache: next }
        }, false, "mergeSourceCache")
      },

      setLastSavedAt(date) {
        set({ lastSavedAt: date }, false, "setLastSavedAt")
      },
    }),
    { name: "GabrielProjectStore", enabled: import.meta.env.DEV },
  ),
)
