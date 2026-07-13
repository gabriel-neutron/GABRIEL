import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { SelectedRef } from "@/types/module.types"

/**
 * Every selection kind except entities (ADR 0007). Entity selection stays in
 * `useProjectStore`'s transactional quintet, since `deleteEntity`/`removeLayer`
 * clear it atomically in the same `set` call as entity/geometry removal — a
 * separate store here would break that invariant. `selectedRef` (in
 * `useSelectedRef.ts`) derives the unified view every consumer reads: entity
 * selection wins when present, otherwise this store's ref.
 */
export interface SelectionState {
  selectedRef: SelectedRef | null
}

export interface SelectionActions {
  setSelectedRef(ref: SelectedRef | null): void
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  devtools(
    (set) => ({
      selectedRef: null,

      setSelectedRef(ref) {
        set({ selectedRef: ref }, false, "setSelectedRef")
      },
    }),
    { name: "GabrielSelectionStore", enabled: import.meta.env.DEV },
  ),
)
