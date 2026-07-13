import { useState, useEffect, useRef, useMemo } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/ui/button"
import { useProjectStore } from "@/store/useProjectStore"
import { selectEntity } from "@/core/map/selection"
import { ORGANISATION_TYPE_LABELS } from "@/types/organisation.types"

type Props = {
  readOnly?: boolean
}

function getLayerTitle(isOsmLayer: boolean, expanded: boolean, readOnly: boolean): string | undefined {
  if (isOsmLayer) return undefined
  if (expanded) return "Collapse"
  if (readOnly) return "Expand"
  return "Expand. Right-click to rename or delete."
}

type LayersContextMenuProps = {
  x: number
  y: number
  canRename: boolean
  canRemove: boolean
  isOsmContext: boolean
  isEchelonLayer: boolean
  isOrgLayer: boolean
  onRename: () => void
  onRemove: () => void
}

function LayersContextMenu({
  x,
  y,
  canRename,
  canRemove,
  isOsmContext,
  isEchelonLayer,
  isOrgLayer,
  onRename,
  onRemove,
}: LayersContextMenuProps) {
  return (
    <div
      className="fixed z-50 min-w-32 rounded-md border bg-popover py-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {canRename && (
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
          onClick={onRename}
        >
          Rename
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          {isOsmContext ? "Remove layer" : "Delete layer"}
        </button>
      )}
      {isEchelonLayer && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Echelon layers cannot be renamed or deleted.
        </div>
      )}
      {isOrgLayer && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Industry layer cannot be renamed or deleted.
        </div>
      )}
    </div>
  )
}

export function LayersPanel({ readOnly = false }: Props) {
  const layers = useProjectStore((s) => s.layers)
  const entities = useProjectStore((s) => s.entities)
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)

  const [expandedByLayerId, setExpandedByLayerId] = useState<Record<string, boolean>>({})
  const [contextMenu, setContextMenu] = useState<{ layerId: string; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function handleToggleLayerRowExpanded(layerId: string): void {
    setExpandedByLayerId((prev) => {
      const isExpanded = prev[layerId] === true
      return { ...prev, [layerId]: !isExpanded }
    })
  }

  function handleRemoveLayer(id: string): void {
    const s = useProjectStore.getState()
    const layer = s.layers.find((l) => l.id === id)
    if (layer?.kind === "echelon") return
    const isOsm = layer?.osmData != null
    if (!isOsm && !window.confirm("Remove this layer and all its entities and geometries?")) return
    s.removeLayer(id)
  }

  function handleDeleteEntity(entityId: string): void {
    if (!window.confirm("Delete this entity and all its linked geometries?")) return
    useProjectStore.getState().deleteEntity(entityId)
  }

  useEffect(() => {
    if (!contextMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    function handleEscape() { setContextMenu(null) }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [contextMenu])

  const contextLayer = contextMenu ? layers.find((l) => l.id === contextMenu.layerId) : null
  const isOsmContext = contextLayer?.osmData != null
  const isEchelonLayer = contextLayer?.kind === "echelon"
  const isOrgLayerContext = contextLayer?.kind === "organisation"
  const canRename = contextLayer?.kind === "custom"
  const canRemove = !!contextLayer && (contextLayer.kind === "custom" || isOsmContext)
  const visibleLayers = layers.filter(
    (layer) =>
      layer.osmData != null ||
      layer.kind === "custom" ||
      layer.kind === "organisation" ||
      entities.some((e) => e.layerId === layer.id),
  )

  const entityHasChildren = useMemo(() => {
    const hasChildren = new Map<string, boolean>()
    for (const e of entities) {
      if (e.parentId) hasChildren.set(e.parentId, true)
    }
    return hasChildren
  }, [entities])

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Layers</h2>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => useProjectStore.getState().addNewLayer()}
          >
            Add layer
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-1 p-4">
        {visibleLayers.map((layer, index) => {
          const isOsmLayer = layer.osmData != null
          const isCustomLayer = layer.kind === "custom"
          const rowExpanded = expandedByLayerId[layer.id] === true
          const layerEntities = entities
            .filter((e) => e.layerId === layer.id)
            .sort((a, b) => {
              const aGroup = entityHasChildren.get(a.id) === true
              const bGroup = entityHasChildren.get(b.id) === true
              if (aGroup !== bGroup) return aGroup ? -1 : 1
              return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            })
          const itemCount = layerEntities.length
          const prevLayer = visibleLayers[index - 1]
          const nextLayer = visibleLayers[index + 1]
          const canMoveUp = isCustomLayer && prevLayer?.kind === "custom"
          const canMoveDown = isCustomLayer && nextLayer?.kind === "custom"

          return (
            <div key={layer.id} className="rounded-md border">
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-muted/40 focus-within:bg-muted/40"
                onContextMenu={
                  readOnly
                    ? undefined
                    : (e) => {
                        e.preventDefault()
                        setContextMenu({ layerId: layer.id, x: e.clientX, y: e.clientY })
                      }
                }
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => !isOsmLayer && handleToggleLayerRowExpanded(layer.id)}
                  title={getLayerTitle(isOsmLayer, rowExpanded, readOnly)}
                >
                  {!isOsmLayer && (
                    <span className="text-muted-foreground">
                      {rowExpanded ? "▾" : "▸"}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-sm font-medium">
                    {layer.name} ({itemCount})
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!readOnly && isCustomLayer && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6"
                        disabled={!canMoveUp}
                        onClick={() => useProjectStore.getState().moveLayer(layer.id, "up")}
                        title="Move layer up (draw order)"
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6"
                        disabled={!canMoveDown}
                        onClick={() => useProjectStore.getState().moveLayer(layer.id, "down")}
                        title="Move layer down (draw order)"
                      >
                        ↓
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 active:scale-95"
                    onClick={() => useProjectStore.getState().setLayerVisible(layer.id, !layer.visible)}
                    title={layer.visible ? "Hide" : "Show"}
                  >
                    <span className="relative h-3 w-3">
                      <Eye
                        className={`absolute inset-0 h-3 w-3 transition-all duration-150 ${
                          layer.visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
                        }`}
                      />
                      <EyeOff
                        className={`absolute inset-0 h-3 w-3 transition-all duration-150 ${
                          layer.visible ? "scale-75 opacity-0" : "scale-100 opacity-100"
                        }`}
                      />
                    </span>
                  </Button>
                </div>
              </div>

              {/* Entities expand section (units and, for the fixed Industry layer, corporate entities) */}
              {!isOsmLayer && layerEntities.length > 0 && (
                <div
                  className={`grid overflow-hidden border-t bg-muted/30 transition-[grid-template-rows,opacity] duration-150 ease-out ${
                    rowExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div
                    className={`min-h-0 overflow-hidden px-3 transition-[padding] duration-150 ease-out ${
                      rowExpanded ? "py-2" : "py-0"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      {layerEntities.map((entity) => {
                        const isCorporate = entity.kind === "corporate"
                        return (
                          <div key={entity.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => selectEntity(entity.id)}
                              className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted ${
                                selectedEntityId === entity.id ? "bg-muted font-medium text-foreground" : ""
                              }`}
                              title={
                                isCorporate && entity.type
                                  ? ORGANISATION_TYPE_LABELS[entity.type as keyof typeof ORGANISATION_TYPE_LABELS]
                                  : undefined
                              }
                            >
                              {entity.name}
                            </button>
                            {!readOnly && !isCorporate && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="h-5 w-5 shrink-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteEntity(entity.id)
                                }}
                                title="Remove entity"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && contextMenu && (
        <div ref={menuRef}>
          <LayersContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            canRename={canRename}
            canRemove={canRemove}
            isOsmContext={isOsmContext}
            isEchelonLayer={isEchelonLayer}
            isOrgLayer={isOrgLayerContext}
            onRename={() => {
              if (!contextLayer) return
              const name = window.prompt("Layer name", contextLayer.name)
              if (name != null) useProjectStore.getState().renameLayer(contextMenu.layerId, name)
              setContextMenu(null)
            }}
            onRemove={() => {
              handleRemoveLayer(contextMenu.layerId)
              setContextMenu(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
