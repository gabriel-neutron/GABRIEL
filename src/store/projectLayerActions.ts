import type { NamedSet } from "zustand/middleware"
import type { ProjectActions, ProjectState } from "./useProjectStore"

/**
 * The six layer actions, split out of `useProjectStore.ts` so that file stays inside the 300-line
 * cap (`CONSTRAINTS.md:113`). The precedent in this directory is `projectSnapshot.ts`, and before
 * it P1b's `projectSave.ts`; the difference is that these are store *writers*, so they take `set`
 * and `get` as arguments and are spread back into the store creator.
 *
 * Every type imported from `useProjectStore.ts` is imported as a TYPE only, so nothing is imported
 * back at runtime and the single runtime edge between the two files points this way.
 *
 * `commitRelationships` deliberately did NOT come here: it must stay private to the store and
 * hold the one `set` that writes edges and derived entities together (criterion 56), and an
 * exported function in a sibling file is neither.
 */

type LayerActions = Pick<
  ProjectActions,
  "addLayer" | "addNewLayer" | "renameLayer" | "removeLayer" | "moveLayer" | "setLayerVisible"
>

export function createLayerActions(
  set: NamedSet<ProjectState & ProjectActions>,
  get: () => ProjectState,
): LayerActions {
  return {
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
  }
}
