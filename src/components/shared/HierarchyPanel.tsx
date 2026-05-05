import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MapEntity } from "@/types/domain.types"
import { useProjectStore } from "@/store/useProjectStore"
import { useShallow } from "zustand/shallow"

type Props = {
  hiddenEntityIds: Set<string>
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
}

type NodeProps = {
  entity: MapEntity
  depth: number
  entities: MapEntity[]
  selectedEntityId: string | null
  hiddenEntityIds: Set<string>
  expandedIds: Set<string>
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
  onToggleExpanded: (id: string) => void
}

type HierarchyPanelHeaderProps = {
  anyVisible: boolean
  onToggleAllVisibility: () => void
}

function hasChildren(entityId: string, entities: MapEntity[]): boolean {
  return entities.some((e) => e.parentId === entityId)
}

function compareByName(a: MapEntity, b: MapEntity): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

function getOrderedEntities(items: MapEntity[], allEntities: MapEntity[]): MapEntity[] {
  const sortedItems = [...items].sort(compareByName)
  const collapsibleItems = sortedItems.filter((item) => hasChildren(item.id, allEntities))
  const nonCollapsibleItems = sortedItems.filter((item) => !hasChildren(item.id, allEntities))
  return [...collapsibleItems, ...nonCollapsibleItems]
}

function isAncestorHidden(entity: MapEntity, entities: MapEntity[], hiddenEntityIds: Set<string>): boolean {
  if (entity.parentId == null) return false
  if (hiddenEntityIds.has(entity.parentId)) return true
  const parent = entities.find((e) => e.id === entity.parentId)
  if (!parent) return false
  return isAncestorHidden(parent, entities, hiddenEntityIds)
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

function EntityNode({
  entity,
  depth,
  entities,
  selectedEntityId,
  hiddenEntityIds,
  expandedIds,
  onToggleEntityVisible,
  onToggleExpanded,
}: NodeProps) {
  const isRoot = depth === 0
  const children = getOrderedEntities(
    entities.filter((e) => e.parentId === entity.id),
    entities,
  )
  const hasKids = children.length > 0
  const expanded = expandedIds.has(entity.id)
  const isHidden = hiddenEntityIds.has(entity.id)
  const ancestorHidden = isAncestorHidden(entity, entities, hiddenEntityIds)
  const effectivelyHidden = isHidden || ancestorHidden
  const isSelected = selectedEntityId === entity.id

  function handleSelectEntity() {
    const s = useProjectStore.getState()
    s.setSelectedEntityId(entity.id)
    s.setSelectedOsmObject(null)
  }

  return (
    <div className={isRoot ? "rounded-md border" : undefined}>
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-muted/40 focus-within:bg-muted/40"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="flex shrink-0 items-center justify-center text-muted-foreground transition-transform duration-150 active:scale-95 disabled:opacity-0"
            onClick={() => onToggleExpanded(entity.id)}
            aria-label={expanded ? "Collapse" : "Expand"}
            disabled={!hasKids}
          >
            {hasKids ? (expanded ? "▾" : "▸") : ""}
          </button>

          <button
            type="button"
            onClick={handleSelectEntity}
            className={`min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors ${
              isSelected ? "text-foreground" : ""
            } ${effectivelyHidden ? "opacity-40" : ""}`}
            title={entity.name}
          >
            {entity.name}
          </button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 active:scale-95"
          onClick={() => onToggleEntityVisible(entity.id, isHidden)}
          title={isHidden ? "Show" : "Hide"}
          disabled={ancestorHidden}
        >
          <span className="relative h-3 w-3">
            <Eye
              className={`absolute inset-0 h-3 w-3 transition-all duration-150 ${
                isHidden || ancestorHidden ? "scale-75 opacity-0" : "scale-100 opacity-100"
              }`}
            />
            <EyeOff
              className={`absolute inset-0 h-3 w-3 transition-all duration-150 ${
                isHidden || ancestorHidden ? "scale-100 opacity-100" : "scale-75 opacity-0"
              }`}
            />
          </span>
        </Button>
      </div>

      {hasKids && (
        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-150 ease-out ${
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className={`min-h-0 overflow-hidden ${isRoot ? "border-t bg-muted/30" : ""}`}>
            {children.map((child) => (
              <EntityNode
                key={child.id}
                entity={child}
                depth={depth + 1}
                entities={entities}
                selectedEntityId={selectedEntityId}
                hiddenEntityIds={hiddenEntityIds}
                expandedIds={expandedIds}
                onToggleEntityVisible={onToggleEntityVisible}
                onToggleExpanded={onToggleExpanded}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function HierarchyPanel({ hiddenEntityIds, onToggleEntityVisible }: Props) {
  const { entities, selectedEntityId } = useProjectStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId }))
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const anyVisible = entities.some(
    (e) => !hiddenEntityIds.has(e.id) && !isAncestorHidden(e, entities, hiddenEntityIds),
  )

  function handleToggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleToggleAllVisibility() {
    const visible = !anyVisible
    for (const entity of entities) onToggleEntityVisible(entity.id, visible)
  }

  const orderedRoots = getOrderedEntities(
    entities.filter((e) => e.parentId == null),
    entities,
  )

  return (
    <div className="flex min-w-0 flex-col">
      <HierarchyPanelHeader anyVisible={anyVisible} onToggleAllVisibility={handleToggleAllVisibility} />
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {orderedRoots.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units without a parent
          </div>
        ) : (
          orderedRoots.map((root) => (
            <EntityNode
              key={root.id}
              entity={root}
              depth={0}
              entities={entities}
              selectedEntityId={selectedEntityId}
              hiddenEntityIds={hiddenEntityIds}
              expandedIds={expandedIds}
              onToggleEntityVisible={onToggleEntityVisible}
              onToggleExpanded={handleToggleExpanded}
            />
          ))
        )}
      </div>
    </div>
  )
}
