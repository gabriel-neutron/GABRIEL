import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import { MilitarySymbolNode } from "./MilitarySymbolNode"
import { useProjectStore } from "@/store/useProjectStore"
import { useShallow } from "zustand/shallow"
import { buildOrbat } from "@/core/entity/hierarchy"
import { computeTreeXIndex } from "@/modules/orbat/services/treeLayout"

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

    const orbat = buildOrbat(entities)
    const xIndexById = computeTreeXIndex(orbat)

    for (const entity of entities) {
      const nodeId = String(entity.id)
      const xIndex = xIndexById.get(entity.id)

      if (xIndex == null) continue

      const position = {
        x: xIndex * H_SPACING,
        y: orbat.depthOf(entity.id) * V_SPACING,
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

      if (entity.parentId != null && xIndexById.has(entity.parentId)) {
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
