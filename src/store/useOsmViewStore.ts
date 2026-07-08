import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { SelectedOsmObject } from "@/types/domain.types"

export interface OsmViewState {
  entityOsmGeometries: Record<string, GeoJSON.FeatureCollection>
  osmUnavailable: boolean
  selectedOsmObject: SelectedOsmObject
}

export interface OsmViewActions {
  setEntityOsmGeometries(
    updater:
      | Record<string, GeoJSON.FeatureCollection>
      | ((prev: Record<string, GeoJSON.FeatureCollection>) => Record<string, GeoJSON.FeatureCollection>),
  ): void
  setOsmUnavailable(v: boolean): void
  setSelectedOsmObject(obj: SelectedOsmObject): void
  resetOsmView(): void
}

function initialState(): OsmViewState {
  return {
    entityOsmGeometries: {},
    osmUnavailable: false,
    selectedOsmObject: null,
  }
}

export const useOsmViewStore = create<OsmViewState & OsmViewActions>()(
  devtools(
    (set) => ({
      ...initialState(),

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

      setSelectedOsmObject(obj) {
        set({ selectedOsmObject: obj }, false, "setSelectedOsmObject")
      },

      resetOsmView() {
        set(initialState(), false, "resetOsmView")
      },
    }),
    { name: "GabrielOsmViewStore", enabled: import.meta.env.DEV },
  ),
)
