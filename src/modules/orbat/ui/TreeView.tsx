import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import { MilitarySymbolNode } from "./MilitarySymbolNode"
import { useProjectStore } from "@/store/useProjectStore"
import { selectEntity } from "@/core/map/selection"
import { useShallow } from "zustand/shallow"
import { buildOrbat } from "@/core/entity/hierarchy"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import { computeTreeXIndex } from "@/modules/orbat/services/treeLayout"

const nodeTypes = { militarySymbol: MilitarySymbolNode }

const H_SPACING = 110
const V_SPACING = 130

export function TreeView() {
  const { entities: allEntities, relationships, selectedEntityId } = useProjectStore(
    useShallow((s) => ({
      entities: s.entities,
      relationships: s.relationships,
      selectedEntityId: s.selectedEntityId,
    }))
  )
  /** Military only — this tab has never shown corporate entities (those live in HierarchyPanel's "Industry" section). */
  const entities = useMemo(() => allEntities.filter((e) => e.kind === "unit"), [allEntities])
  const index = useMemo(
    () => hierarchyIndex(relationships, { entityIds: new Set(allEntities.map((e) => e.id)) }),
    [relationships, allEntities],
  )

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = []
    const edgeList: Edge[] = []

    const orbat = buildOrbat(entities, index)
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

      // A contested child draws no edge, in either direction: a line to one of two competing
      // parents would be this view electing the winner ADR 0011 forbids. It still renders as
      // a node, at depth 0, and HierarchyPanel is where the contest is named.
      const link = orbat.parentOf(entity.id)
      if (link.state === "parent" && xIndexById.has(link.parentId)) {
        edgeList.push({
          id: `e-${link.parentId}-${nodeId}`,
          source: String(link.parentId),
          target: nodeId,
        })
      }
    }

    return { nodes: nodeList, edges: edgeList }
  }, [entities, index, selectedEntityId])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectEntity(node.id)
  }, [])

  const handlePaneClick = useCallback(() => {
    selectEntity(null)
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
