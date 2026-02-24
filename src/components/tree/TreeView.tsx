import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import type { MapEntity } from "@/types/domain.types"
import { MilitarySymbolNode } from "./MilitarySymbolNode"

const nodeTypes = { militarySymbol: MilitarySymbolNode }
const X_SPACING_PER_LEVEL = 320
const Y_SPACING = 100

type Props = {
  entities: MapEntity[]
  selectedEntityId: string | null
  onSelectEntity: (id: string | null) => void
}

export function TreeView({ entities, selectedEntityId, onSelectEntity }: Props) {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>()
    const edgeList: Edge[] = []
    let y = 0

    function buildTree(parentId: string | null, depth: number) {
      const children = entities.filter((e) => e.parentId === parentId)
      for (const entity of children) {
        const nodeId = String(entity.id)
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            type: "militarySymbol",
            position: { x: depth * X_SPACING_PER_LEVEL, y: y * Y_SPACING },
            data: { label: entity.name, entity },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          })
          y++
        }
        if (entity.parentId != null) {
          edgeList.push({
            id: `e-${entity.parentId}-${nodeId}`,
            source: String(entity.parentId),
            target: nodeId,
          })
        }
        buildTree(nodeId, depth + 1)
      }
    }

    buildTree(null, 0)

    return { nodes: Array.from(nodeMap.values()), edges: edgeList }
  }, [entities])

  const nodesWithSelection = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      className: `tree-symbol-node${node.id === selectedEntityId ? " selected" : ""}`,
    }))
  }, [nodes, selectedEntityId])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectEntity(node.id)
    },
    [onSelectEntity]
  )

  const handlePaneClick = useCallback(() => {
    onSelectEntity(null)
  }, [onSelectEntity])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodesWithSelection}
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
