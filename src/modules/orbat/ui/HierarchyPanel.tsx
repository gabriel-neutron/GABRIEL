import { useCallback, useMemo, useState } from "react"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { buildOrbat } from "@/core/entity/hierarchy"
import { useHierarchyIndex } from "@/hooks/useHierarchyIndex"
import {
  compareByName,
  EMPTY_PATH,
  getOrderedEntities,
  isAncestorHidden,
} from "@/modules/orbat/services/hierarchyOrdering"
import { useEntityVisibilityStore } from "@/modules/orbat/store/useEntityVisibilityStore"
import { useProjectStore } from "@/store/useProjectStore"
import { HierarchyEntityNode } from "./HierarchyEntityNode"

type Props = {
  /** Overridable for Storybook/tests; defaults to `useEntityVisibilityStore` (ADR 0007). */
  hiddenEntityIds?: Set<string>
  onToggleEntityVisible?: (entityId: string, visible: boolean) => void
}

type HierarchyPanelHeaderProps = {
  anyVisible: boolean
  onToggleAllVisibility: () => void
}

function HierarchyPanelHeader({ anyVisible, onToggleAllVisibility }: HierarchyPanelHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Hierarchy</h2>
        <Button type="button" variant="outline" size="xs" onClick={onToggleAllVisibility}>
          {anyVisible ? "Hide all" : "Show all"}
        </Button>
      </div>
    </div>
  )
}

export function HierarchyPanel({ hiddenEntityIds: hiddenEntityIdsProp, onToggleEntityVisible: onToggleEntityVisibleProp }: Props) {
  const entities = useProjectStore((s) => s.entities)
  const storeHiddenEntityIds = useEntityVisibilityStore((s) => s.hiddenEntityIds)
  const setEntityVisible = useEntityVisibilityStore((s) => s.setEntityVisible)
  const hiddenEntityIds = hiddenEntityIdsProp ?? storeHiddenEntityIds
  const fallbackToggleEntityVisible = useCallback(
    (entityId: string, visible: boolean) => setEntityVisible(entityId, visible, entities),
    [setEntityVisible, entities],
  )
  const onToggleEntityVisible = onToggleEntityVisibleProp ?? fallbackToggleEntityVisible
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const units = useMemo(() => entities.filter((e) => e.kind === "unit"), [entities])
  const corporateEntities = useMemo(() => entities.filter((e) => e.kind === "corporate"), [entities])
  const nameById = useMemo(() => new Map(entities.map((e) => [e.id, e.name])), [entities])
  // The edge set, so this panel can tell a contested child from a root. Both trees read one
  // index over ALL entities rather than one each — see `useHierarchyIndex`.
  const index = useHierarchyIndex()
  const orbat = useMemo(() => buildOrbat(units, index), [units, index])
  const orgOrbat = useMemo(() => buildOrbat(corporateEntities, index), [corporateEntities, index])
  const anyVisible = units.some(
    (e) => !hiddenEntityIds.has(e.id) && !isAncestorHidden(e, orbat, hiddenEntityIds),
  )

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  function handleToggleAllVisibility() {
    const visible = !anyVisible
    for (const entity of units) onToggleEntityVisible(entity.id, visible)
  }

  const orderedRoots = getOrderedEntities(orbat.roots(), orbat)
  const orgRoots = [...orgOrbat.roots()].sort(compareByName)

  return (
    <div className="flex min-w-0 flex-col">
      <HierarchyPanelHeader anyVisible={anyVisible} onToggleAllVisibility={handleToggleAllVisibility} />
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {orderedRoots.length === 0 ? (
          // This list is not "units without a parent": `roots()` also holds orphans, the
          // entry point of a disconnected cycle, and CONTESTED children — entities with two
          // parents, which the old sentence declared had none. It is empty only when there
          // are no units at all, so that is what it now says.
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units in this project
          </div>
        ) : (
          orderedRoots.map((root) => (
            <HierarchyEntityNode
              key={root.id}
              entity={root}
              depth={0}
              orbat={orbat}
              ancestorPath={EMPTY_PATH}
              nameById={nameById}
              hiddenEntityIds={hiddenEntityIds}
              expandedIds={expandedIds}
              onToggleEntityVisible={onToggleEntityVisible}
              onToggleExpanded={handleToggleExpanded}
            />
          ))
        )}

        {corporateEntities.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Industry
            </div>
            {orgRoots.map((root) => (
              <HierarchyEntityNode
                key={root.id}
                entity={root}
                depth={0}
                orbat={orgOrbat}
                ancestorPath={EMPTY_PATH}
                nameById={nameById}
                hiddenEntityIds={hiddenEntityIds}
                expandedIds={expandedIds}
                onToggleEntityVisible={onToggleEntityVisible}
                onToggleExpanded={handleToggleExpanded}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
