import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node } from "reactflow"
import type { MapEntity } from "@/types/domain.types"
import { MilitarySymbolNode } from "./MilitarySymbolNode"

const nodeTypes = { militarySymbol: MilitarySymbolNode }

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

    // Build nodes and edges from parent relationships
    function buildTree(entityId: string | null, depth: number) {
      const children = entities.filter((e) => e.parentId === entityId)
      for (const entity of children) {
        const nodeId = entity.id
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            type: "militarySymbol",
            position: { x: depth * 200, y: y * 100 },
            data: { label: entity.name, entity },
          })
          y++
        }

        if (entity.parentId) {
          edgeList.push({
            id: `e-${entity.parentId}-${nodeId}`,
            source: entity.parentId,
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
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  )
}
