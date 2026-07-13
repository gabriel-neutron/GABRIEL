import { useProjectStore } from "@/store/useProjectStore"
import { useSelectionStore } from "@/store/useSelectionStore"
import type { SelectedRef } from "@/types/module.types"

/**
 * Selection helpers shared by every map layer / list that can select an entity or a
 * peripheral (non-entity) object — only one selection kind is ever active at a time,
 * mirroring the exclusivity `MapView` enforced by hand before ADR 0007.
 */
export function selectEntity(id: string | null): void {
  useProjectStore.getState().setSelectedEntityId(id)
  // Unconditional: selecting OR deselecting an entity always clears whatever
  // peripheral object was selected, so a stale osm ref can't resurface once the
  // entity selection that was masking it goes back to null.
  useSelectionStore.getState().setSelectedRef(null)
}

export function selectPeripheral(ref: SelectedRef | null): void {
  useSelectionStore.getState().setSelectedRef(ref)
  useProjectStore.getState().setSelectedEntityId(null)
}

export function clearSelection(): void {
  selectEntity(null)
}
