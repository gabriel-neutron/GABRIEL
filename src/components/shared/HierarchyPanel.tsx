import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MapEntity } from "@/types/domain.types"

type Props = {
  entities: MapEntity[]
  selectedEntityId: string | null
  hiddenEntityIds: Set<string>
  onSelectEntity: (id: string) => void
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
}

type NodeProps = {
  entity: MapEntity
  depth: number
  entities: MapEntity[]
  selectedEntityId: string | null
  hiddenEntityIds: Set<string>
  expandedIds: Set<string>
  onSelectEntity: (id: string) => void
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
  onToggleExpanded: (id: string) => void
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

function EntityNode({
  entity,
  depth,
  entities,
  selectedEntityId,
  hiddenEntityIds,
  expandedIds,
  onSelectEntity,
  onToggleEntityVisible,
  onToggleExpanded,
}: NodeProps) {
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

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-2 py-0.5"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
          onClick={() => onToggleExpanded(entity.id)}
          aria-label={expanded ? "Collapse" : "Expand"}
          disabled={!hasKids}
        >
          {hasKids ? (expanded ? "▾" : "▸") : ""}
        </button>

        {/* Entity name */}
        <button
          type="button"
          onClick={() => onSelectEntity(entity.id)}
          className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted ${
            isSelected ? "bg-primary/15 font-medium text-primary" : ""
          } ${effectivelyHidden ? "opacity-40" : ""}`}
          title={entity.name}
        >
          {entity.name}
        </button>

        {/* Visibility toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5 shrink-0 text-muted-foreground"
          onClick={() => onToggleEntityVisible(entity.id, isHidden)}
          title={isHidden ? "Show" : "Hide"}
          disabled={ancestorHidden}
        >
          {isHidden || ancestorHidden ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      </div>

      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <EntityNode
              key={child.id}
              entity={child}
              depth={depth + 1}
              entities={entities}
              selectedEntityId={selectedEntityId}
              hiddenEntityIds={hiddenEntityIds}
              expandedIds={expandedIds}
              onSelectEntity={onSelectEntity}
              onToggleEntityVisible={onToggleEntityVisible}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchyPanel({
  entities,
  selectedEntityId,
  hiddenEntityIds,
  onSelectEntity,
  onToggleEntityVisible,
}: Props) {
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

  const roots = entities.filter((e) => e.parentId == null)
  const orderedRoots = getOrderedEntities(roots, entities)

  return (
    <div className="flex min-w-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Hierarchy</h2>
          <Button type="button" variant="outline" size="xs" onClick={handleToggleAllVisibility}>
            {anyVisible ? "Hide all" : "Show all"}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-px overflow-y-auto p-2">
        {roots.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units without a parent
          </div>
        ) : (
          <>
            {orderedRoots.map((root) => (
              <EntityNode
                key={root.id}
                entity={root}
                depth={0}
                entities={entities}
                selectedEntityId={selectedEntityId}
                hiddenEntityIds={hiddenEntityIds}
                expandedIds={expandedIds}
                onSelectEntity={onSelectEntity}
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
