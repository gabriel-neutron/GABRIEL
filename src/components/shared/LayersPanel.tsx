import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { Layer, MapEntity } from "@/types/domain.types"

type Props = {
  readOnly?: boolean
  layers: Layer[]
  entities: MapEntity[]
  selectedEntityId: string | null
  onSelectEntity: (id: string) => void
  onToggleVisible: (layerId: string, visible: boolean) => void
  onToggleExpanded: (layerId: string, expanded: boolean) => void
  onRemoveLayer: (layerId: string) => void
  onRenameLayer: (layerId: string, name: string) => void
  onAddLayer: () => void
  onRemoveEntity: (entityId: string) => void
  onMoveLayer: (layerId: string, direction: "up" | "down") => void
}

function getLayerTitle(isOsmLayer: boolean, expanded: boolean, readOnly: boolean): string | undefined {
  if (isOsmLayer) return undefined
  if (expanded) return "Collapse"
  if (readOnly) return "Expand"
  return "Expand. Right-click to rename or delete."
}

export function LayersPanel({
  readOnly = false,
  layers,
  entities,
  selectedEntityId,
  onSelectEntity,
  onToggleVisible,
  onToggleExpanded,
  onRemoveLayer,
  onRenameLayer,
  onAddLayer,
  onRemoveEntity,
  onMoveLayer,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ layerId: string; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    function handleEscape() {
      setContextMenu(null)
    }
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
  const canRename = contextLayer?.kind === "custom"
  const canRemove = contextLayer && (contextLayer.kind === "custom" || isOsmContext)
  const visibleLayers = layers.filter(
    (layer) =>
      layer.osmData != null ||
      layer.kind === "custom" ||
      entities.some((e) => e.layerId === layer.id),
  )

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Layers</h2>
        {!readOnly && (
          <Button type="button" variant="outline" size="xs" onClick={onAddLayer}>
            Add layer
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-1 p-4">
        {visibleLayers.map((layer, index) => {
          const isOsmLayer = layer.osmData != null
          const isCustomLayer = layer.kind === "custom"
          const layerEntities = entities.filter((e) => e.layerId === layer.id)
          const prevLayer = visibleLayers[index - 1]
          const nextLayer = visibleLayers[index + 1]
          const canMoveUp = isCustomLayer && prevLayer?.kind === "custom"
          const canMoveDown = isCustomLayer && nextLayer?.kind === "custom"

          return (
            <div key={layer.id} className="rounded-md border">
              <div
                className="flex items-center justify-between gap-2 px-3 py-2"
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
                  onClick={() => !isOsmLayer && onToggleExpanded(layer.id, !layer.expanded)}
                  title={getLayerTitle(isOsmLayer, layer.expanded, readOnly)}
                >
                  {!isOsmLayer && (
                    <span className="text-muted-foreground">
                      {layer.expanded ? "▾" : "▸"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{layer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {isOsmLayer
                        ? "OSM layer"
                        : `${layerEntities.length} ${
                            layerEntities.length === 1 ? "entity" : "entities"
                          }`}
                    </div>
                  </div>
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
                        onClick={() => onMoveLayer(layer.id, "up")}
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
                        onClick={() => onMoveLayer(layer.id, "down")}
                        title="Move layer down (draw order)"
                      >
                        ↓
                      </Button>
                    </>
                  )}
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={(checked) => onToggleVisible(layer.id, checked)}
                  />
                </div>
              </div>
              {!isOsmLayer && layer.expanded && layerEntities.length > 0 && (
                <div className="border-t bg-muted/30 px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {layerEntities.map((entity) => (
                      <div key={entity.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectEntity(entity.id)}
                          className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted ${
                            selectedEntityId === entity.id ? "bg-primary/15 text-primary" : ""
                          }`}
                        >
                          {entity.name}
                        </button>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="h-5 w-5 shrink-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveEntity(entity.id)
                            }}
                            title="Remove entity"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-32 rounded-md border bg-popover py-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {canRename && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                if (!contextLayer) return
                const name = window.prompt("Layer name", contextLayer.name)
                if (name != null) onRenameLayer(contextMenu.layerId, name)
                setContextMenu(null)
              }}
            >
              Rename
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                onRemoveLayer(contextMenu.layerId)
                setContextMenu(null)
              }}
            >
              {isOsmContext ? "Remove layer" : "Delete layer"}
            </button>
          )}
          {isEchelonLayer && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              Echelon layers cannot be renamed or deleted.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
