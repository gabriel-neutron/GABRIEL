import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

export interface MapPrefsState {
  showNetworks: boolean
  baseMap: BaseMapId
}

export interface MapPrefsActions {
  setShowNetworks(v: boolean): void
  setBaseMap(id: BaseMapId): void
}

export const useMapPrefsStore = create<MapPrefsState & MapPrefsActions>()(
  devtools(
    (set) => ({
      showNetworks: true,
      baseMap: "osm",

      setShowNetworks(v) {
        set({ showNetworks: v }, false, "setShowNetworks")
      },

      setBaseMap(id) {
        set({ baseMap: id }, false, "setBaseMap")
      },
    }),
    { name: "GabrielMapPrefsStore", enabled: import.meta.env.DEV },
  ),
)
