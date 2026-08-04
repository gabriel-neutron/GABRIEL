import { memo } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/ui/button"
import { selectEntity } from "@/core/map/selection"
import type { Orbat } from "@/core/entity/hierarchy"
import { getOrderedEntities, isAncestorHidden } from "@/modules/orbat/services/hierarchyOrdering"
import { useProjectStore } from "@/store/useProjectStore"
import type { MapEntity } from "@/types/domain.types"
import { ORGANISATION_TYPE_LABELS } from "@/types/organisation.types"

export type HierarchyNodeProps = {
  entity: MapEntity
  depth: number
  orbat: Orbat<MapEntity>
  ancestorPath: ReadonlySet<string>
  /** Entity id -> name, for naming the competing parents on a contested badge without
   *  each node reaching back into the store for the whole entity array. */
  nameById: ReadonlyMap<string, string>
  hiddenEntityIds: Set<string>
  expandedIds: Set<string>
  onToggleEntityVisible: (entityId: string, visible: boolean) => void
  onToggleExpanded: (id: string) => void
}

/**
 * The one place a contest is legible to a person. Everything else about a contested child
 * looks exactly like a root: it derives no parent, so it sits at the top level of this
 * panel, and "this unit answers to no one" is a stronger ORBAT claim than picking a winner
 * would have been — and one a reader cannot detect is wrong (ADR 0011, corrected 2026-08-04).
 *
 * Showing that a contest exists is not resolving it. There is deliberately no control here
 * to pick a parent: the competing edges are the record, and a person edits those.
 */
function ContestedBadge({ parentNames }: { parentNames: string[] }): React.ReactElement {
  const under = parentNames.length > 0
    ? parentNames.map((name) => "\"" + name + "\"").join(", ")
    : "more than one parent"
  return (
    <span
      className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400"
      title={
        "Recorded under " + under + " at once. No parent is derived until a person records " +
        "which is correct, so it is listed here rather than under either."
      }
    >
      Contested
    </span>
  )
}

/**
 * Shared by the unit tree and the "Industry" (corporate) tree. Corporate entities never had a
 * per-item visibility toggle (only units did, driven by `MainLayout`'s `hiddenEntityIds`), so the
 * toggle and hidden-state are suppressed for `kind === "corporate"` — same behaviour as the two
 * formerly-separate `EntityNode`/`OrgNode` components, just one component now.
 */
export const HierarchyEntityNode = memo(function HierarchyEntityNode({
  entity,
  depth,
  orbat,
  ancestorPath,
  nameById,
  hiddenEntityIds,
  expandedIds,
  onToggleEntityVisible,
  onToggleExpanded,
}: HierarchyNodeProps) {
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
  const parentLink = orbat.parentOf(entity.id)
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

          {parentLink.state === "contested" && (
            <ContestedBadge
              parentNames={parentLink.via.map((edge) => nameById.get(edge.toId) ?? edge.toId)}
            />
          )}
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
              <HierarchyEntityNode
                key={child.id}
                entity={child}
                depth={depth + 1}
                orbat={orbat}
                ancestorPath={childPath}
                nameById={nameById}
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
