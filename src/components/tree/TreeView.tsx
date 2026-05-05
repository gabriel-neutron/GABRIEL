import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import type { MapEntity } from "@/types/domain.types"
import { MilitarySymbolNode } from "./MilitarySymbolNode"
import { useProjectStore } from "@/store/useProjectStore"
import { useShallow } from "zustand/shallow"

const nodeTypes = { militarySymbol: MilitarySymbolNode }

const H_SPACING = 110
const V_SPACING = 130

export function TreeView() {
  const { entities, selectedEntityId } = useProjectStore(
    useShallow((s) => ({ entities: s.entities, selectedEntityId: s.selectedEntityId }))
  )

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = []
    const edgeList: Edge[] = []
    const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))

    const childrenByParent = new Map<string | null, MapEntity[]>()
    for (const entity of entities) {
      const parentKey = (entity.parentId ?? null) as string | null
      if (!childrenByParent.has(parentKey)) {
        childrenByParent.set(parentKey, [])
      }
      childrenByParent.get(parentKey)!.push(entity)
    }

    const roots = childrenByParent.get(null) ?? []

    const xIndexById = new Map<string, number>()
    let currentXIndex = 0

    function layoutEntity(entity: MapEntity): number {
      const children = childrenByParent.get(entity.id) ?? []
      const childXIndexes: number[] = []

      for (const child of children) {
        const childIndex = layoutEntity(child)
        childXIndexes.push(childIndex)
      }

      let xIndex: number

      if (childXIndexes.length === 0) {
        xIndex = currentXIndex
        currentXIndex += 1
      } else {
        const first = childXIndexes[0]
        const last = childXIndexes[childXIndexes.length - 1]
        xIndex = (first + last) / 2
      }

      xIndexById.set(entity.id, xIndex)
      return xIndex
    }

    for (const root of roots) {
      layoutEntity(root)
    }

    const depthById = new Map<string, number>()
    function getDepth(entity: MapEntity): number {
      const cachedDepth = depthById.get(entity.id)
      if (cachedDepth != null) return cachedDepth
      if (entity.parentId == null) {
        depthById.set(entity.id, 0)
        return 0
      }
      const parent = entitiesById.get(entity.parentId)
      if (!parent) {
        depthById.set(entity.id, 0)
        return 0
      }
      const depth = getDepth(parent) + 1
      depthById.set(entity.id, depth)
      return depth
    }

    for (const entity of entities) {
      const nodeId = String(entity.id)
      const xIndex = xIndexById.get(entity.id)

      if (xIndex == null) continue

      const position = {
        x: xIndex * H_SPACING,
        y: getDepth(entity) * V_SPACING,
      }

      nodeList.push({
        id: nodeId,
        type: "militarySymbol",
        className: "tree-symbol-node",
        position,
        data: { label: entity.name, entity },
        selected: nodeId === selectedEntityId,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })

      if (entity.parentId != null) {
        edgeList.push({
          id: `e-${entity.parentId}-${nodeId}`,
          source: String(entity.parentId),
          target: nodeId,
        })
      }
    }

    return { nodes: nodeList, edges: edgeList }
  }, [entities, selectedEntityId])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const s = useProjectStore.getState()
    s.setSelectedEntityId(node.id)
    s.setSelectedOsmObject(null)
  }, [])

  const handlePaneClick = useCallback(() => {
    const s = useProjectStore.getState()
    s.setSelectedEntityId(null)
    s.setSelectedOsmObject(null)
  }, [])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  )
}
