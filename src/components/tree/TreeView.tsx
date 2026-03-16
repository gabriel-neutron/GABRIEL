import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import type { MapEntity } from "@/types/domain.types"
import { MilitarySymbolNode } from "./MilitarySymbolNode"

const nodeTypes = { militarySymbol: MilitarySymbolNode }

// Horizontal spacing between sibling units (same level)
const H_SPACING = 110
// Vertical spacing between hierarchical levels
const V_SPACING = 130

type Props = {
  entities: MapEntity[]
  selectedEntityId: string | null
  onSelectEntity: (id: string | null) => void
}

export function TreeView({ entities, selectedEntityId, onSelectEntity }: Props) {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>()
    const edgeList: Edge[] = []

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

    for (const entity of entities) {
      const nodeId = String(entity.id)
      const xIndex = xIndexById.get(entity.id)

      if (xIndex == null) continue

      let depth = 0
      let currentParentId = entity.parentId
      while (currentParentId != null) {
        const parent = entities.find((e) => e.id === currentParentId)
        if (!parent) break
        depth += 1
        currentParentId = parent.parentId
      }

      const position = {
        x: xIndex * H_SPACING,
        y: depth * V_SPACING,
      }

      nodeMap.set(nodeId, {
        id: nodeId,
        type: "militarySymbol",
        position,
        data: { label: entity.name, entity },
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
