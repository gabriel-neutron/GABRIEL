import { useMemo } from "react"
import { useProjectStore } from "./useProjectStore"
import { useSelectionStore } from "./useSelectionStore"
import type { SelectedRef } from "@/types/module.types"

/**
 * The single thing every consumer reads for "what's selected" (ADR 0007).
 * Entity selection (`useProjectStore`) wins when present; otherwise falls back to
 * the peripheral `useSelectionStore` ref (osm today, telegram-channel later).
 */
export function useSelectedRef(): SelectedRef | null {
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  // `entities` is a cheap reference read (no scan); the O(n) lookup itself is a
  // useMemo below so it only re-runs when the id or the entities array actually
  // changed, not on every unrelated store mutation (claims/layers/geometries).
  const entities = useProjectStore((s) => s.entities)
  const peripheral = useSelectionStore((s) => s.selectedRef)

  const selectedEntityKind = useMemo(
    () => (selectedEntityId != null ? (entities.find((e) => e.id === selectedEntityId)?.kind ?? null) : null),
    [selectedEntityId, entities],
  )

  if (selectedEntityId != null && selectedEntityKind != null) {
    return { kind: selectedEntityKind, id: selectedEntityId }
  }
  return peripheral
}
