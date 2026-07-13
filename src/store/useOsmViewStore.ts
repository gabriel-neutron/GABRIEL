import { create } from "zustand"
import { devtools } from "zustand/middleware"

export interface OsmViewState {
  entityOsmGeometries: Record<string, GeoJSON.FeatureCollection>
  osmUnavailable: boolean
}

export interface OsmViewActions {
  setEntityOsmGeometries(
    updater:
      | Record<string, GeoJSON.FeatureCollection>
      | ((prev: Record<string, GeoJSON.FeatureCollection>) => Record<string, GeoJSON.FeatureCollection>),
  ): void
  setOsmUnavailable(v: boolean): void
  resetOsmView(): void
}

function initialState(): OsmViewState {
  return {
    entityOsmGeometries: {},
    osmUnavailable: false,
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

      resetOsmView() {
        set(initialState(), false, "resetOsmView")
      },
    }),
    { name: "GabrielOsmViewStore", enabled: import.meta.env.DEV },
  ),
)
