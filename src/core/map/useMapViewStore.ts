import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { MapBounds } from "./MapBoundsReporter"

export type MapTool = "pan" | "point" | "line" | "polygon"

/**
 * Live map viewport/tool state, peeled out of `MapView`'s local state so
 * self-contained `mapLayers` (ADR 0007) can read `interactive`/viewport-culling
 * inputs without prop-drilling from `MapView`.
 */
export interface MapViewState {
  mapTool: MapTool
  mapBounds: MapBounds | null
}

export interface MapViewActions {
  setMapTool(tool: MapTool): void
  setMapBounds(bounds: MapBounds): void
}

/** Shared by any self-contained map layer that needs to know whether it should be interactive. */
export function useMapInteractive(): boolean {
  return useMapViewStore((s) => s.mapTool === "pan")
}

export const useMapViewStore = create<MapViewState & MapViewActions>()(
  devtools(
    (set) => ({
      mapTool: "pan",
      mapBounds: null,

      setMapTool(tool) {
        set({ mapTool: tool }, false, "setMapTool")
      },

      setMapBounds(bounds) {
        set({ mapBounds: bounds }, false, "setMapBounds")
      },
    }),
    { name: "GabrielMapViewStore", enabled: import.meta.env.DEV },
  ),
)
