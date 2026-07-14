import { memo, useCallback, useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import type { MapEntity } from "@/types/domain.types"
import { ORGANISATION_TYPE_LABELS } from "@/types/organisation.types"
import { useProjectStore } from "@/store/useProjectStore"
import { useEntityVisibilityStore } from "@/modules/orbat/store/useEntityVisibilityStore"
import { selectEntity } from "@/core/map/selection"
import { buildOrbat, type Orbat, type OrbatNode } from "@/core/entity/hierarchy"

type Props = {
  /** Overridable for Storybook/tests; defaults to `useEntityVisibilityStore` (ADR 0007). */
  hiddenEntityIds?: Set<string>
  onToggleEntityVisible?: (entityId: string, visible: boolean) => void
}

type NodeProps = {
  entity: MapEntity
  depth: number
  orbat: Orbat<MapEntity>
  ancestorPath: ReadonlySet<string>
  hiddenEntityIds: Set<string>
  expandedIds: Set<string>
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
  onToggleExpanded: (id: string) => void
}

type HierarchyPanelHeaderProps = {
  anyVisible: boolean
  onToggleAllVisibility: () => void
}

/** Root ancestor path for a top-level node; never mutated, only copied. */
const EMPTY_PATH: ReadonlySet<string> = new Set()

function compareByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

function getOrderedEntities(items: MapEntity[], orbat: Orbat<MapEntity>): MapEntity[] {
  const sortedItems = [...items].sort(compareByName)
  const collapsibleItems = sortedItems.filter((item) => orbat.childrenOf(item.id).length > 0)
  const nonCollapsibleItems = sortedItems.filter((item) => orbat.childrenOf(item.id).length === 0)
  return [...collapsibleItems, ...nonCollapsibleItems]
}

/**
 * A disconnected cycle's synthetic root (see `buildOrbat`'s cycle policy) still has its own
 * dangling `parentId` pointing back into the cycle — that id never resolves to a real node, so
 * `orbat.ancestors()` can't see it. Check it directly so a hidden-then-orphaned parent still
 * hides its child, matching pre-refactor behaviour.
 */
function isAncestorHidden<T extends OrbatNode>(
  item: T,
  orbat: Orbat<T>,
  hiddenEntityIds: Set<string>,
): boolean {
  if (item.parentId != null && hiddenEntityIds.has(item.parentId)) return true
  return orbat.ancestors(item.id).some((ancestor) => hiddenEntityIds.has(ancestor.id))
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

/**
 * Shared by the unit tree and the "Industry" (corporate) tree. Corporate entities never had a
 * per-item visibility toggle (only units did, driven by `MainLayout`'s `hiddenEntityIds`), so the
 * toggle and hidden-state are suppressed for `kind === "corporate"` — same behaviour as the two
 * formerly-separate `EntityNode`/`OrgNode` components, just one component now.
 */
const EntityNode = memo(function EntityNode({
  entity,
  depth,
  orbat,
  ancestorPath,
  hiddenEntityIds,
  expandedIds,
  onToggleEntityVisible,
  onToggleExpanded,
}: NodeProps) {
  const isRoot = depth === 0
  const isCorporate = entity.kind === "corporate"
  const childPath = new Set(ancestorPath).add(entity.id)
  const children = getOrderedEntities(
    orbat.childrenOf(entity.id).filter((child) => !childPath.has(child.id)),
    orbat,
  )
  const hasKids = children.length > 0
  const expanded = expandedIds.has(entity.id)
  const isHidden = !isCorporate && hiddenEntityIds.has(entity.id)
  const ancestorHidden = !isCorporate && isAncestorHidden(entity, orbat, hiddenEntityIds)
  const effectivelyHidden = isHidden || ancestorHidden
  const isSelected = useProjectStore((s) => s.selectedEntityId === entity.id)
  const title =
    isCorporate && entity.type
      ? `${entity.name} — ${ORGANISATION_TYPE_LABELS[entity.type as keyof typeof ORGANISATION_TYPE_LABELS]}`
      : entity.name

  function handleSelectEntity() {
    selectEntity(entity.id)
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
            title={title}
          >
            {entity.name}
          </button>
        </div>

        {!isCorporate && (
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
        )}
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
                orbat={orbat}
                ancestorPath={childPath}
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
})

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
  const orbat = useMemo(() => buildOrbat(units), [units])
  const orgOrbat = useMemo(() => buildOrbat(corporateEntities), [corporateEntities])
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
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units without a parent
          </div>
        ) : (
          orderedRoots.map((root) => (
            <EntityNode
              key={root.id}
              entity={root}
              depth={0}
              orbat={orbat}
              ancestorPath={EMPTY_PATH}
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
              <EntityNode
                key={root.id}
                entity={root}
                depth={0}
                orbat={orgOrbat}
                ancestorPath={EMPTY_PATH}
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
