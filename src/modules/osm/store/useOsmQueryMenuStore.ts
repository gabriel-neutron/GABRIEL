import { create } from "zustand"

/**
 * `OsmQueryMenu`'s dialog-open state, lifted out of local `useState` so the command
 * palette's "Query OpenStreetMap…" command (ADR 0007) can open it without the shell
 * naming osm-specific UI.
 */
export interface OsmQueryMenuState {
  open: boolean
  setOpen(open: boolean): void
}

export const useOsmQueryMenuStore = create<OsmQueryMenuState>((set) => ({
  open: false,
  setOpen(open) {
    set({ open })
  },
}))
