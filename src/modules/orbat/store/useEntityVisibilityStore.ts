import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { MapEntity } from "@/types/domain.types"

/**
 * Per-entity map/tree visibility toggles, owned by orbat (`HierarchyPanel` writes it,
 * `SymbolsLayer` reads it) — peeled out of `MainLayout` local state so both can be
 * self-contained `leftPanels`/`mapLayers` manifest entries (ADR 0007) with no shell
 * prop-drilling between them.
 */
export interface EntityVisibilityState {
  hiddenEntityIds: Set<string>
}

export interface EntityVisibilityActions {
  /** Hides/shows `entityId` and every descendant (toggling a parent cascades). */
  setEntityVisible(entityId: string, visible: boolean, entities: MapEntity[]): void
  reset(): void
}

/**
 * The seventh hierarchy walker in this codebase, and the only one that was not cycle-safe.
 * `buildOrbat` guards explicitly and `computePositions` is saved by its `progress` flag; this
 * one enqueued forever on a parent cycle and hung the tab. Cycles are reachable: Q2B-22 records
 * that the merge acyclicity guarantee was traded away rather than replaced, and the parent
 * picker (`useEntityInspector.ts:99`) filters only self and kind, so a descendant is selectable.
 * Two edits make a 2-cycle, and either visibility toggle then never returns.
 */
function collectDescendants(entities: MapEntity[], rootId: string): string[] {
  const result: string[] = [rootId]
  const seen = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const e of entities) {
      if (e.parentId === current && !seen.has(e.id)) {
        seen.add(e.id)
        result.push(e.id)
        queue.push(e.id)
      }
    }
  }
  return result
}

export const useEntityVisibilityStore = create<EntityVisibilityState & EntityVisibilityActions>()(
  devtools(
    (set) => ({
      hiddenEntityIds: new Set<string>(),

      setEntityVisible(entityId, visible, entities) {
        const affected = collectDescendants(entities, entityId)
        set(
          (s) => {
            const next = new Set(s.hiddenEntityIds)
            affected.forEach((id) => (visible ? next.delete(id) : next.add(id)))
            return { hiddenEntityIds: next }
          },
          false,
          "setEntityVisible",
        )
      },

      reset() {
        set({ hiddenEntityIds: new Set<string>() }, false, "reset")
      },
    }),
    { name: "GabrielEntityVisibilityStore", enabled: import.meta.env.DEV },
  ),
)
