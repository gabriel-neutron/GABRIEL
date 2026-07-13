import { create } from "zustand"

/**
 * The active top-level view id ("map" + whatever `views` modules contribute, ADR
 * 0007). Lifted out of `AppShell`'s local state so commands (Ctrl/Cmd+K) can switch
 * views without the shell wiring a per-module callback.
 */
export interface ViewState {
  activeViewId: string
  setActiveViewId(id: string): void
}

export const useViewStore = create<ViewState>((set) => ({
  activeViewId: "map",
  setActiveViewId(id) {
    set({ activeViewId: id })
  },
}))
